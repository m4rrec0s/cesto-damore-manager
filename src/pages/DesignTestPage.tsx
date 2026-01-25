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
import { customizationStorage } from "@/utils/customizationStorage";
import { Textarea } from "@/components/ui/textarea";

const CM_TO_PX = 37.795;
const INTERNAL_DPI_MULTIPLIER = 2;

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
  const [workspaceZoom, setWorkspaceZoom] = useState(0.8);
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
  const [storageQuota, setStorageQuota] = useState<{
    percentage: number;
    used: number;
    limit: number;
  }>({
    percentage: 0,
    used: 0,
    limit: 0,
  });

  // Aplicar zoom ao canvas do fabric
  useEffect(() => {
    // Verificar se o canvas está inicializado e tem os elementos DOM necessários
    if (activeCanvas && activeCanvas.elements?.lower) {
      const width = layout?.width || 378;
      const height = layout?.height || 567;

      // 1. Ajustar a resolução interna (Backstore)
      activeCanvas.setDimensions(
        {
          width: width * INTERNAL_DPI_MULTIPLIER,
          height: height * INTERNAL_DPI_MULTIPLIER,
        },
        { backstoreOnly: true },
      );

      // 2. Ajustar o tamanho visual (CSS) para alinhar upper e lower canvas
      activeCanvas.setDimensions(
        {
          width: `${width * workspaceZoom}px`,
          height: `${height * workspaceZoom}px`,
        },
        { cssOnly: true },
      );

      // 3. Aplicar zoom interno fixo para nitidez (DPI 2x)
      // Resetamos o viewportTransform para garantir que o design não fique "fugindo" ou recortado
      activeCanvas.setViewportTransform([
        INTERNAL_DPI_MULTIPLIER,
        0,
        0,
        INTERNAL_DPI_MULTIPLIER,
        0,
        0,
      ]);

      // Sincronizar coordenadas de interação
      activeCanvas.calcOffset();
      activeCanvas.getObjects().forEach((obj: any) => {
        if (obj.setCoords) obj.setCoords();
      });

      activeCanvas.renderAll();
    }
  }, [workspaceZoom, activeCanvas, layout?.width, layout?.height]);

  // Persistir imagens locais (apenas URLs, não base64)
  useEffect(() => {
    if (layoutId && Object.keys(localImages).length > 0) {
      // Garantir que não há base64 antes de salvar
      const cleanedImages: Record<string, string> = {};
      for (const [key, value] of Object.entries(localImages)) {
        if (typeof value === "string" && !value.startsWith("data:")) {
          cleanedImages[key] = value;
        }
      }
      if (Object.keys(cleanedImages).length > 0) {
        localStorage.setItem(
          `design-local-imgs-${layoutId}`,
          JSON.stringify(cleanedImages),
        );
      }
    }
  }, [localImages, layoutId]);

  // Monitorar quota de armazenamento
  useEffect(() => {
    const quota = customizationStorage.getStorageQuota();
    setStorageQuota(quota);

    if (quota.percentage > 80) {
      console.warn(
        `⚠️ LocalStorage em ${quota.percentage.toFixed(1)}% de capacidade`,
      );
      toast.warning(
        `Armazenamento em ${quota.percentage.toFixed(0)}% de capacidade`,
      );
    }
  }, [localImages]);

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
        const { Canvas, FabricObject } = await import("fabric");

        if (!mountedRef.current) return;

        // Configurações globais de qualidade
        FabricObject.ownDefaults.objectCaching = false;
        FabricObject.ownDefaults.minScaleLimit = 0.05;

        // Limpar o container e criar novo elemento canvas
        const container = canvasContainerRef.current!;
        container.innerHTML = "";

        const canvasElement = document.createElement("canvas");
        container.appendChild(canvasElement);

        const width = layout.width || 378;
        const height = layout.height || 567;

        c = new Canvas(canvasElement, {
          backgroundColor: "#ffffff",
          selection: false,
          interactive: false,
          enableRetinaScaling: false,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
        });

        // Configurar dimensões internas (High DPI)
        c.setDimensions(
          {
            width: width * INTERNAL_DPI_MULTIPLIER,
            height: height * INTERNAL_DPI_MULTIPLIER,
          },
          { backstoreOnly: true },
        );

        // Configurar dimensões visuais (O zoom da área de trabalho é via CSS)
        c.setDimensions(
          {
            width: `${width * workspaceZoom}px`,
            height: `${height * workspaceZoom}px`,
          },
          { cssOnly: true },
        );

        if (layout.fabricJsonState) {
          const state =
            typeof layout.fabricJsonState === "string"
              ? JSON.parse(layout.fabricJsonState)
              : layout.fabricJsonState;

          // Converter i-text para textbox e desativar objectCaching para qualidade
          if (state && state.objects) {
            state.objects = state.objects.map((obj: any) => {
              const updatedObj = { ...obj, objectCaching: false };
              if (updatedObj.type === "i-text") {
                updatedObj.type = "textbox";
                if (!updatedObj.width) updatedObj.width = 200;
              }
              return updatedObj;
            });
          }

          try {
            await c.loadFromJSON(state);
          } catch (jsonErr) {
            console.error("Erro ao carregar estado do canvas:", jsonErr);
          }

          // Garantir o zoom interno fixo (DPI) APÓS o carregamento do JSON
          c.setViewportTransform([
            INTERNAL_DPI_MULTIPLIER,
            0,
            0,
            INTERNAL_DPI_MULTIPLIER,
            0,
            0,
          ]);

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

              if (obj.type === "i-text" || obj.type === "textbox") {
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
    if (obj && (obj.type === "i-text" || obj.type === "textbox")) {
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

    // Garantir URL absoluta para carregamento externo
    let finalUrl = dataUrl;
    if (finalUrl.startsWith("/")) {
      finalUrl = `${import.meta.env.VITE_API_URL}${finalUrl}`;
    }

    const img = await FabricImage.fromURL(finalUrl);

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
      objectCaching: false,
    });

    // Criar uma máscara baseada no tipo e propriedades do frame original
    let mask: any;

    if (frame.type === "circle") {
      mask = new (await import("fabric")).Circle({
        radius: frame.radius,
        scaleX: frame.scaleX,
        scaleY: frame.scaleY,
        originX: "center",
        originY: "center",
        left: center.x,
        top: center.y,
        absolutePositioned: true,
      });
    } else if (frame.type === "triangle") {
      mask = new (await import("fabric")).Triangle({
        width: frame.width,
        height: frame.height,
        scaleX: frame.scaleX,
        scaleY: frame.scaleY,
        originX: "center",
        originY: "center",
        left: center.x,
        top: center.y,
        absolutePositioned: true,
      });
    } else {
      mask = new Rect({
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
    }

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

    const toastId = toast.loading("Fazendo upload da imagem...");

    try {
      // Fazer upload para /temp via API
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/uploads/temp`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!uploadResponse.ok) {
        throw new Error("Erro ao fazer upload da imagem");
      }

      const uploadedData = await uploadResponse.json();
      let imageUrl = uploadedData.url || uploadedData.path;

      if (!imageUrl) {
        throw new Error("URL da imagem não retornada");
      }

      // Garantir que a URL seja absoluta para o Fabric.js
      if (imageUrl.startsWith("/")) {
        imageUrl = `${import.meta.env.VITE_API_URL}${imageUrl}`;
      }

      // Salvar URL no estado local (não base64!)
      setLocalImages((prev) => ({
        ...prev,
        [frameId]: imageUrl,
      }));

      // Carregar a imagem do URL
      await loadLocalImageToFrame(currentCanvas, frame, imageUrl);

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
      toast.success("Imagem enviada com sucesso!", { id: toastId });
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

      // Tentar com alta qualidade primeiro
      let dataUrl: string;
      try {
        dataUrl = currentCanvas.toDataURL({
          format: "png",
          multiplier: 5,
          enableRetinaScaling: true,
        });
      } catch (e) {
        console.warn("Erro ao gerar PNG de alta qualidade, usando fallback...");
        // Fallback para qualidade padrão
        dataUrl = currentCanvas.toDataURL({
          format: "jpeg",
          quality: 0.95,
        });
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${layout?.name.replace(/\s+/g, "_")}_personalizado_${new Date().toISOString().split("T")[0]}.png`;

      // Fallback para IE11 e navegadores antigos
      const win = window as unknown as {
        navigator: { msSaveBlob?: (blob: Blob, filename: string) => void };
      };
      if (typeof win.navigator?.msSaveBlob === "function") {
        const blob = new Blob([dataUrl], { type: "image/png" });
        win.navigator.msSaveBlob(blob, link.download);
      } else {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast.success("Imagem exportada com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao exportar imagem:", error);
      toast.error("Erro ao exportar imagem. Tente novamente.", { id: toastId });
    }
  };

  const handleSaveDraft = async () => {
    if (!layoutId) {
      toast.error("ID do layout não encontrado");
      return;
    }

    try {
      const currentCanvas = activeCanvas || fabricRef.current;
      if (!currentCanvas) {
        toast.error("Canvas não inicializado");
        return;
      }

      const customizationData = {
        textos: editableTexts,
        imagens: localImages,
        canvasState: currentCanvas.toJSON(),
        timestamp: Date.now(),
      };

      const result = customizationStorage.save(layoutId, customizationData);

      if (result.success) {
        toast.success(`Rascunho salvo! (${(result.size / 1024).toFixed(1)}KB)`);
      } else if ("error" in result) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Erro ao salvar rascunho:", error);
      toast.error("Erro ao salvar rascunho");
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
    (obj: any) =>
      obj.isCustomizable && (obj.type === "i-text" || obj.type === "textbox"),
  );
  const shapeObjects = objects.filter(
    (obj: any) =>
      obj.isCustomizable &&
      obj.type !== "i-text" &&
      obj.type !== "textbox" &&
      !obj.isFrame &&
      !obj.name?.startsWith("placeholder-"),
  );
  const photoFrames = objects.filter((obj: any) => obj.isFrame);

  return (
    <div className="min-h-screen overflow-hidden bg-neutral-900 text-white flex flex-col">
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
            {storageQuota.percentage > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="w-32 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      storageQuota.percentage > 80
                        ? "bg-red-500"
                        : storageQuota.percentage > 50
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.min(storageQuota.percentage, 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-neutral-400">
                  {storageQuota.percentage.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleSaveDraft}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="h-4 w-4 mr-2" />
            Salvar Rascunho
          </Button>
          <Button
            onClick={handleExportFinalImage}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Salvar Imagem Final
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-[1fr_20rem] max-h-fit">
        <div className="flex max-h-fit items-center justify-center p-8 bg-neutral-950 overflow-hidden ">
          <div
            className="bg-white rounded shadow-2xl relative"
            style={{
              width: (layout?.width || 378) * workspaceZoom,
              height: (layout?.height || 567) * workspaceZoom,
              transform: "none",
            }}
          >
            <div
              ref={canvasContainerRef}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        <div className="w-80 h-screen bg-neutral-800 border-l border-neutral-700 p-6 overflow-y-auto">
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
                      {obj.maxChars <= 20 ? (
                        <Input
                          type="text"
                          value={editableTexts[id] || ""}
                          onChange={(e) => handleTextChange(id, e.target.value)}
                          maxLength={obj.maxChars || 50}
                          className="bg-neutral-800 border-neutral-600 text-sm h-9"
                        />
                      ) : (
                        <Textarea
                          key={obj.id}
                          title="texto"
                          name="texto"
                          value={editableTexts[id] || ""}
                          onChange={(e) => handleTextChange(id, e.target.value)}
                          maxLength={obj.maxChars || 50}
                          className="bg-neutral-800 border-neutral-600 text-sm max-h-12 resize-none scrollbar-hide"
                        />
                      )}
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
