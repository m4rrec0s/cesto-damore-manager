import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Upload,
  Palette,
  Camera,
  Type as TypeIcon,
  Image as ImageIcon,
  Download,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { layoutApiService } from "@/services/layoutApiService";
import { useAuth } from "@/contexts/useAuth";

const DesignTestPage = () => {
  const navigate = useNavigate();
  const { layoutId } = useParams<{ layoutId: string }>();
  const { user } = useAuth();

  const fabricRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [activeCanvas, setActiveCanvas] = useState<any>(null);
  const [layout, setLayout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editableTexts, setEditableTexts] = useState<Record<string, string>>(
    {},
  );
  const [localImages, setLocalImages] = useState<Record<string, string>>(() => {
    try {
      if (!layoutId) return {};
      const saved = localStorage.getItem(`design-local-imgs-${layoutId}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [updateNonce, setUpdateNonce] = useState(0);

  // Persistir imagens locais
  useEffect(() => {
    if (layoutId && Object.keys(localImages).length > 0) {
      localStorage.setItem(
        `design-local-imgs-${layoutId}`,
        JSON.stringify(localImages),
      );
    }
  }, [localImages, layoutId]);

  // Carregar layout salvo
  useEffect(() => {
    const loadLayout = async () => {
      if (!layoutId) {
        toast.error("Layout não encontrado");
        navigate("/layouts");
        return;
      }

      try {
        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("appToken") ||
          "";
        const layoutData = await layoutApiService.getLayout(layoutId, token);
        setLayout(layoutData);
      } catch (error) {
        console.error("Erro ao carregar layout:", error);
        toast.error("Erro ao carregar design");
        navigate("/layouts");
      } finally {
        setLoading(false);
      }
    };

    loadLayout();
  }, [layoutId, navigate]);

  // Inicializar canvas com layout carregado
  useEffect(() => {
    if (!layout || !canvasContainerRef.current || loading) return;

    let c: any = null;

    const mountedRef = { current: true };

    const initCanvas = async () => {
      try {
        const { Canvas } = await import("fabric");

        if (!mountedRef.current) return;

        // Limpar o container e criar novo elemento canvas
        const container = canvasContainerRef.current!;
        container.innerHTML = "";

        const canvasElement = document.createElement("canvas");
        container.appendChild(canvasElement);

        const width = layout.width || 378;
        const height = layout.height || 567;

        c = new Canvas(canvasElement, {
          width,
          height,
          backgroundColor: "#ffffff",
          selection: false,
          interactive: false,
        });

        // Carregar estado do layout
        if (layout.fabricJsonState) {
          const state =
            typeof layout.fabricJsonState === "string"
              ? JSON.parse(layout.fabricJsonState)
              : layout.fabricJsonState;

          await c.loadFromJSON(state);

          if (!mountedRef.current) return;

          // Configurar objetos
          const objects = c.getObjects();
          const initialTexts: Record<string, string> = {};

          for (const obj of objects as any[]) {
            // Bloquear todos por padrão
            obj.set({
              selectable: false,
              evented: false,
              lockMovementX: true,
              lockMovementY: true,
              lockScalingX: true,
              lockScalingY: true,
              lockRotation: true,
              hasControls: false,
              hasBorders: false,
              hoverCursor: "default",
            });

            // Identificar frames
            const isFrame =
              obj.isFrame === true ||
              obj.name === "photo-frame" ||
              obj.name === "image-frame" ||
              (obj.customData && obj.customData.isFrame === true);

            if (isFrame) {
              obj.isFrame = true; // Normalizar

              const id = obj.id || obj.name;

              // Adicionar placeholder visual se não houver imagem local ou no canvas
              const hasImage = objects.some(
                (img: any) => img.name === `uploaded-img-${id}`,
              );

              if (!hasImage && !localImages[id]) {
                await addFramePlaceholder(c, obj);
              } else if (localImages[id]) {
                // Se temos uma imagem local salva, carregar ela
                await loadLocalImageToFrame(c, obj, localImages[id]);
              }
            }

            // Se for customizável, preparar campos
            if (obj.isCustomizable) {
              const id =
                obj.id ||
                obj.name ||
                `obj-${Math.random().toString(36).substr(2, 9)}`;

              if (!obj.id) obj.set("id", id);

              if (obj.type === "i-text") {
                initialTexts[id] = obj.text || "";
              }
            }
          }

          setEditableTexts(initialTexts);
          c.renderAll();
        }

        fabricRef.current = c;
        setActiveCanvas(c);
      } catch (error) {
        console.error("Erro ao inicializar canvas:", error);
        toast.error("Erro ao inicializar preview");
      }
    };

    initCanvas();

    return () => {
      mountedRef.current = false;
      if (c) {
        try {
          c.dispose();
        } catch (e) {
          console.error("Dispose error:", e);
        }
      }
      fabricRef.current = null;
      setActiveCanvas(null);
    };
  }, [layout, loading]);

  const handleTextChange = (id: string, value: string) => {
    const currentCanvas = activeCanvas || fabricRef.current;
    if (!currentCanvas) return;

    const obj = currentCanvas
      .getObjects()
      .find((o: any) => o.id === id || (o as any).id === id);
    if (obj && obj.type === "i-text") {
      const maxChars = (obj as any).maxChars || 50;
      const limitedValue = value.slice(0, maxChars);

      setEditableTexts((prev) => ({
        ...prev,
        [id]: limitedValue,
      }));

      obj.set("text", limitedValue);
      currentCanvas.renderAll();
    }
  };

  const handleColorChange = (id: string, color: string) => {
    const currentCanvas = activeCanvas || fabricRef.current;
    if (!currentCanvas) return;

    const obj = currentCanvas
      .getObjects()
      .find((o: any) => o.id === id || (o as any).id === id);
    if (obj) {
      obj.set("fill", color);
      currentCanvas.renderAll();
      setUpdateNonce((prev) => prev + 1);
    }
  };

  const addFramePlaceholder = async (canvas: any, frame: any) => {
    const { Text } = await import("fabric");

    // Fundo cinza suave
    frame.set("fill", "#f3f4f6");

    const center = frame.getCenterPoint();

    const icon = new Text("📷", {
      fontSize:
        Math.min(frame.width * frame.scaleX, frame.height * frame.scaleY) * 0.3,
      left: center.x,
      top: center.y - 10,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      hoverCursor: "default",
      name: `placeholder-icon-${frame.id || frame.name}`,
    });

    const label = new Text("Anexe sua imagem aqui", {
      fontSize:
        Math.min(frame.width * frame.scaleX, frame.height * frame.scaleY) *
        0.08,
      left: center.x,
      top: center.y + 20,
      originX: "center",
      originY: "center",
      fill: "#9ca3af", // text-gray-400
      selectable: false,
      evented: false,
      hoverCursor: "default",
      name: `placeholder-text-${frame.id || frame.name}`,
    });

    canvas.add(icon, label);
    canvas.renderAll();
  };

  const loadLocalImageToFrame = async (
    canvas: any,
    frame: any,
    dataUrl: string,
  ) => {
    const { FabricImage, Rect } = await import("fabric");
    const img = await FabricImage.fromURL(dataUrl);

    const frameWidth = frame.width * frame.scaleX;
    const frameHeight = frame.height * frame.scaleY;
    const center = frame.getCenterPoint();

    // Tornar o frame transparente para não cobrir a imagem
    frame.set({
      fill: "transparent",
      stroke: "transparent",
      opacity: 0, // Esconder completamente para evitar bordas residuais
    });

    // Escalar imagem para preencher o frame (crop fill)
    const scale = Math.max(frameWidth / img.width, frameHeight / img.height);

    img.set({
      scaleX: scale,
      scaleY: scale,
      left: center.x,
      top: center.y,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      hoverCursor: "default",
      name: `uploaded-img-${frame.id || frame.name}`,
    });

    // Criar uma máscara (Rect) baseada nas propriedades do frame original
    // para garantir que o clipPath funcione mesmo que o frame seja movido no editor
    const mask = new Rect({
      width: frame.width,
      height: frame.height,
      rx: frame.rx,
      ry: frame.ry,
      scaleX: frame.scaleX,
      scaleY: frame.scaleY,
      originX: "center",
      originY: "center",
      left: center.x,
      top: center.y,
      absolutePositioned: true,
    });

    img.set("clipPath", mask);

    const uploadedId = `uploaded-img-${frame.id || frame.name}`;

    // Se houver imagem anterior para este frame, remover
    const oldImg = canvas.getObjects().find((o: any) => o.name === uploadedId);
    if (oldImg) canvas.remove(oldImg);

    canvas.add(img);
    // Em vez de enviar para o fundo total, colocamos na frente do frame (que agora é transparente)
    // ou apenas garantimos que está no topo das imagens mas abaixo dos textos
    canvas.moveObjectTo(img, canvas.getObjects().indexOf(frame) + 1);

    canvas.renderAll();
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    frameId: string,
  ) => {
    const currentCanvas = activeCanvas || fabricRef.current;
    const file = e.target.files?.[0];
    if (!file || !currentCanvas) {
      if (!file) toast.error("Selecione uma imagem");
      return;
    }

    // Procurar pelo frame específico
    const frame = currentCanvas
      .getObjects()
      .find(
        (obj: any) =>
          obj.id === frameId ||
          obj.name === frameId ||
          (obj.isFrame && (obj.id === frameId || obj.name === frameId)),
      );

    if (!frame) {
      toast.error("Moldura não encontrada");
      return;
    }

    const toastId = toast.loading("Processando imagem local...");

    try {
      // Ler arquivo como DataURL (Base64) para preview local
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) {
          toast.error("Erro ao ler imagem");
          return;
        }

        // Salvar no estado local
        setLocalImages((prev) => ({
          ...prev,
          [frameId]: dataUrl,
        }));

        await loadLocalImageToFrame(currentCanvas, frame, dataUrl);

        // Remover placeholder
        const icon = currentCanvas
          .getObjects()
          .find((o: any) => o.name === `placeholder-icon-${frameId}`);
        const text = currentCanvas
          .getObjects()
          .find((o: any) => o.name === `placeholder-text-${frameId}`);
        if (icon) currentCanvas.remove(icon);
        if (text) currentCanvas.remove(text);

        currentCanvas.renderAll();
        setUpdateNonce((prev) => prev + 1);
        toast.success("Imagem carregada localmente!", { id: toastId });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Erro ao carregar imagem:", error);
      toast.error("Erro ao carregar imagem", { id: toastId });
    }
  };

  const handleExportFinalImage = async () => {
    const currentCanvas = activeCanvas || fabricRef.current;
    if (!currentCanvas) {
      toast.error("Canvas não encontrado");
      return;
    }

    const toastId = toast.loading("Gerando imagem em alta qualidade...");
    try {
      currentCanvas.set("backgroundColor", "#ffffff");
      currentCanvas.renderAll();
      const highQualityImage = currentCanvas.toDataURL({
        format: "png",
        multiplier: 5,
        enableRetinaScaling: true,
      });
      const link = document.createElement("a");
      link.href = highQualityImage;
      link.download = `${layout?.name.replace(/\s+/g, "_")}_personalizado_${new Date().toISOString().split("T")[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Imagem exportada com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao exportar imagem:", error);
      toast.error("Erro ao exportar imagem em alta qualidade", { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-900 border-none">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="text-white">Carregando design...</p>
        </div>
      </div>
    );
  }

  const objects =
    activeCanvas || fabricRef.current
      ? (activeCanvas || fabricRef.current).getObjects()
      : [];

  const textObjects = objects.filter(
    (obj: any) => obj.isCustomizable && obj.type === "i-text",
  );
  const shapeObjects = objects.filter(
    (obj: any) =>
      obj.isCustomizable &&
      obj.type !== "i-text" &&
      !obj.isFrame &&
      !obj.name?.startsWith("placeholder-"),
  );
  const photoFrames = objects.filter((obj: any) => obj.isFrame);

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col">
      <header className="border-b border-neutral-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/layouts")}
            className="text-white hover:bg-neutral-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{layout?.name}</h1>
            <p className="text-neutral-400 text-sm italic">
              Visualize a customização do cliente
            </p>
          </div>
        </div>
        <Button
          onClick={handleExportFinalImage}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Download className="h-4 w-4 mr-2" />
          Salvar Imagem Final
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8 bg-neutral-950 overflow-auto custom-scrollbar">
          <div
            className="bg-white rounded shadow-2xl relative"
            style={{
              width: layout?.width,
              height: layout?.height,
              transform: "scale(0.8)",
              transformOrigin: "center",
            }}
          >
            <div
              ref={canvasContainerRef}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        <div className="w-80 bg-neutral-800 border-l border-neutral-700 p-6 overflow-y-auto">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-rose-500">
            <Palette className="h-5 w-5" />
            Opções do Cliente
          </h2>

          <div className="space-y-8">
            {textObjects.length === 0 &&
              photoFrames.length === 0 &&
              shapeObjects.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-neutral-500 italic">
                    Nenhum campo marcado como customizável. Marque itens como
                    "Customizável" no editor para que apareçam aqui.
                  </p>
                </div>
              )}

            {textObjects.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest flex items-center gap-2">
                  <TypeIcon className="h-3 w-3" /> Textos
                </h3>
                {textObjects.map((obj: any) => {
                  const id = obj.id || obj.name;
                  return (
                    <div
                      key={id}
                      className="space-y-3 p-4 bg-neutral-700/30 rounded-xl border border-neutral-600/50"
                    >
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-neutral-400 font-medium">
                          {obj.name || "Campo de Texto"}
                        </label>
                      </div>
                      <Input
                        type="text"
                        value={editableTexts[id] || ""}
                        onChange={(e) => handleTextChange(id, e.target.value)}
                        maxLength={obj.maxChars || 50}
                        className="bg-neutral-800 border-neutral-600 text-sm h-9"
                      />
                      <div className="flex justify-between text-[9px] text-neutral-500 font-mono">
                        <span>Limite: {obj.maxChars || 50}</span>
                        <span>
                          {(editableTexts[id] || "").length}/
                          {obj.maxChars || 50}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-600/50">
                        <label className="text-xs text-neutral-400 font-medium">
                          Cor
                        </label>
                        <input
                          title="Color"
                          type="color"
                          value={obj.fill || "#000000"}
                          onChange={(e) =>
                            handleColorChange(id, e.target.value)
                          }
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {photoFrames.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest flex items-center gap-2">
                  <ImageIcon className="h-3 w-3" /> Fotos / Molduras
                </h3>
                {photoFrames.map((obj: any) => {
                  const id = obj.id || obj.name;
                  const hasImage = objects.some(
                    (o: any) => o.name === `uploaded-img-${id}`,
                  );

                  return (
                    <div
                      key={id}
                      className="space-y-3 p-4 bg-neutral-700/30 rounded-xl border border-neutral-600/50"
                    >
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-neutral-400 font-medium">
                          {obj.name || "Moldura de Foto"}
                        </label>
                        {hasImage && (
                          <span className="text-[10px] text-green-500 font-bold">
                            OK
                          </span>
                        )}
                      </div>

                      <Button
                        onClick={() =>
                          document.getElementById(`upload-${id}`)?.click()
                        }
                        className={`w-full text-xs h-9 font-bold ${
                          hasImage
                            ? "bg-neutral-700 hover:bg-neutral-600"
                            : "bg-rose-600 hover:bg-rose-700"
                        }`}
                      >
                        <Upload className="h-3.5 w-3.5 mr-2" />
                        {hasImage ? "Trocar Foto" : "Carregar Foto"}
                      </Button>
                      <input
                        title="Upload"
                        id={`upload-${id}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, id)}
                        className="hidden"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {shapeObjects.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest flex items-center gap-2">
                  <Palette className="h-3 w-3" /> Cores de Elementos
                </h3>
                {shapeObjects.map((obj: any) => {
                  const id = obj.id || obj.name;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-4 bg-neutral-700/30 rounded-xl border border-neutral-600/50"
                    >
                      <label className="text-xs text-neutral-400 font-medium">
                        {obj.name || "Elemento Visual"}
                      </label>
                      <input
                        title="Color"
                        type="color"
                        value={obj.fill || "#000000"}
                        onChange={(e) => handleColorChange(id, e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignTestPage;
