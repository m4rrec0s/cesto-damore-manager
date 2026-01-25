/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import {
  layoutApiService,
  elementBankService,
} from "@/services/layoutApiService";
import { externalElementsService } from "@/services/externalElementsService";
import { DesignSidebar } from "@/components/editor/DesignSidebar";
import { DesignToolbar } from "@/components/editor/DesignToolbar";
import { ObjectToolbar } from "@/components/editor/ObjectToolbar";
import { DesignPanels } from "@/components/editor/DesignPanels";
import styles from "./DesignEditorPage.module.css";

const CM_TO_PX = 37.795;
const INTERNAL_DPI_MULTIPLIER = 2; // Qualidade padrão Retina (2x)
// const VISUAL_BUFFER_DPI = 2; // REMOVIDO: Causa bugs de zoom

const generateId = () => Math.random().toString(36).substring(2, 11);

const CUSTOM_PROPS = [
  "name",
  "id",
  "selectable",
  "evented",
  "editable", // Importante persistir se o objeto é editável ou não
  "isCustomizable",
  "maxChars",
  "isFrame",
  "backgroundColor", // Garantir que salva background se estiver no objeto
  "customData",
  "rx",
  "ry",
  "stroke",
  "strokeWidth",
  "strokeDashArray",
  "radius",
  "width",
  "height",
  "splitByGrapheme",
  "objectCaching",
  "linkedFrameId",
  "imageSmoothing",
  "noScaleCache",
];

// Tipagem simplificada para evitar erros de linting "any"
interface FabricCanvas {
  setZoom: (v: number) => void;
  setDimensions: (
    dim: { width: string | number; height: string | number },
    opt?: any,
  ) => void;
  renderAll: () => void;
  requestRenderAll: () => void;
  discardActiveObject: () => void;
  setActiveObject: (obj: any) => void;
  add: (obj: any) => void;
  remove: (obj: any) => void;
  getObjects: () => any[];
  toObject: (props?: string[]) => any;
  toDataURL: (opt?: any) => string;
  loadFromJSON: (json: any) => Promise<void>;
  bringObjectToFront: (obj: any) => void;
  sendObjectToBack: (obj: any) => void;
  bringObjectForward: (obj: any) => void;
  sendObjectBackwards: (obj: any) => void;
  set: (keyOrObj: string | any, value?: any) => void;
  backgroundColor: string | any;
  on: (event: string, handler: (opt: any) => void) => void;
  off: (event: string, handler?: any) => void;
  get: (prop: string) => any;
  calcOffset: () => void;
  dispose: () => void;
  viewportTransform: number[];
  setViewportTransform: (v: number[]) => void;
}

interface FabricObject {
  id?: string;
  name?: string;
  type?: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  fill?: string;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: any;
  isFrame?: boolean;
  isCustomizable?: boolean;
  clone: (extraProps?: string[]) => Promise<any>;
  set: (keyOrObj: string | any, value?: any) => void;
  setCoords: () => void;
  getBoundingRect: () => {
    width: number;
    height: number;
    left: number;
    top: number;
  };
  scaleToWidth: (w: number) => void;
  scaleToHeight: (h: number) => void;
  [key: string]: any;
}

interface CustomWindow extends Window {
  __initialCanvasState?: any;
}

const loadGoogleFont = (fontFamily: string) => {
  if (document.getElementById(`font-${fontFamily.replace(/\s+/g, "-")}`))
    return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.id = `font-${fontFamily.replace(/\s+/g, "-")}`;
    link.rel = "stylesheet";
    // Adicionar display=swap e pesos para as novas fontes decorativas
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(
      /\s+/g,
      "+",
    )}:wght@400;700;900&display=swap`;
    link.onload = () => {
      // Aguardar o carregamento da fonte com timeout
      Promise.race([
        document.fonts.load(`1em "${fontFamily}"`),
        new Promise<void>((r) => setTimeout(r, 2000)),
      ])
        .then(() => resolve())
        .catch(() => resolve()); // Sempre resolver mesmo se falhar
    };
    link.onerror = () => {
      resolve(); // Resolver mesmo se erro (fonte pode carregar em background)
    };
    document.head.appendChild(link);
  });
};

const DesignEditorPage = () => {
  const { layoutId } = useParams<{ layoutId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(
    null,
  );
  const [designName, setDesignName] = useState("Novo Design");
  const [canvasBg, setCanvasBg] = useState("#ffffff");
  const [isTransparent, setIsTransparent] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: 10 * CM_TO_PX,
    height: 15 * CM_TO_PX,
  });
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [updateNonce, setUpdateNonce] = useState(0); // Trigger re-renders for selected object changes
  const [bankElements, setBankElements] = useState<
    Array<{ id: string; imageUrl: string; name: string }>
  >([]);
  const [userUploads, setUserUploads] = useState<
    Array<{ id: string; imageUrl: string }>
  >([]);
  const [workspaceZoom, setWorkspaceZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Refs para gerenciar o estado sem disparar re-renders desnecessários
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const namesSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (canvas && fabricRef.current) {
      const c = fabricRef.current;

      // REVERTIDO PARA ZOOM PADRÃO DO FABRIC
      // O modo "CSS Zoom" estava causando bugs de proporção e espaçamento.
      // Agora usamos controle nativo de zoom e dimensions com devicePixelRatio

      c.setDimensions({
        width: dimensions.width * workspaceZoom,
        height: dimensions.height * workspaceZoom,
      });

      c.setZoom(workspaceZoom);

      // Recalcular offsets para garantir cliques precisos
      setTimeout(() => {
        c.calcOffset();
        const objects = c.getObjects();
        objects.forEach((obj: any) => {
          if (obj.setCoords) obj.setCoords();
        });
        c.requestRenderAll();
      }, 50);
    }
  }, [canvas, dimensions, workspaceZoom]);

  // Initial data loading
  useEffect(() => {
    const loadLayoutData = async () => {
      if (!layoutId) {
        setLoading(false);
        return;
      }

      try {
        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("appToken") ||
          "";
        const layout = await layoutApiService.getLayout(layoutId, token);

        if (layout) {
          setDesignName(layout.name);
          if (layout.width && layout.height) {
            setDimensions({
              width: Math.round(layout.width),
              height: Math.round(layout.height),
            });
          }

          // Store state to load after canvas init
          if (layout.fabricJsonState) {
            const parsedState =
              typeof layout.fabricJsonState === "string"
                ? JSON.parse(layout.fabricJsonState)
                : layout.fabricJsonState;

            // Extrair background do JSON para o estado react (Persistência do Fundo)
            if (parsedState.backgroundColor) {
              setCanvasBg(parsedState.backgroundColor);
              setIsTransparent(parsedState.backgroundColor === "transparent");
            } else if (layout.backgroundColor) {
              setCanvasBg(layout.backgroundColor);
              setIsTransparent(layout.backgroundColor === "transparent");
            }

            // Converter i-text para textbox para suporte a quebra de linha
            // e garantir que objectCaching esteja desativado para qualidade no zoom
            if (parsedState.objects) {
              parsedState.objects = parsedState.objects.map(
                (obj: FabricObject) => {
                  const updatedObj = { ...obj, objectCaching: false };
                  if (updatedObj.type === "i-text") {
                    updatedObj.type = "textbox";
                    if (!updatedObj.width) updatedObj.width = 200;
                  }
                  return updatedObj;
                },
              );
            }

            (window as unknown as CustomWindow).__initialCanvasState =
              parsedState;

            // Pre-load fonts used in the layout
            if (parsedState.objects) {
              const fonts = new Set<string>();
              parsedState.objects.forEach((obj: FabricObject) => {
                if (obj.fontFamily && obj.fontFamily !== "Arial") {
                  fonts.add(obj.fontFamily);
                }
              });
              fonts.forEach((font) => loadGoogleFont(font));
            }
          }
        }
      } catch (err) {
        toast.error("Erro ao carregar layout");
      } finally {
        setLoading(false);
      }
    };

    loadLayoutData();
  }, [layoutId]);

  useEffect(() => {
    if (activePanel === "Uploads") {
      fetchUserUploads();
    }
  }, [activePanel]);

  // Load User Uploads
  const fetchUserUploads = async () => {
    try {
      const data = await elementBankService.listElements({
        category: "Uploads",
        limit: 100,
      });

      const elements = data?.elements || [];
      setUserUploads(
        elements.map((el: FabricObject) => ({
          id: el.id,
          imageUrl: el.imageUrl,
          name: el.name,
        })),
      );
    } catch (error) {
      console.error("Error fetching uploads", error);
    }
  };

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1); // To avoid stale closures in canvas events
  const isHistoryUpdate = useRef(false);

  // ... (previous refs)

  // Canvas initialization
  useEffect(() => {
    if (loading || !canvasRef.current) return;
    if (fabricRef.current) return;

    let activeCanvas: FabricCanvas | null = null;

    const initCanvas = async () => {
      try {
        const { Canvas, FabricObject: BaseFabricObject } =
          await import("fabric");

        // Global settings for quality
        (BaseFabricObject as any).ownDefaults.objectCaching = false;
        (BaseFabricObject as any).ownDefaults.minScaleLimit = 0.05;

        activeCanvas = new Canvas(canvasRef.current!, {
          preserveObjectStacking: true,
          enableRetinaScaling: true, // Mantém a nitidez em telas de alta densidade
          imageSmoothingEnabled: true,
          backgroundColor: isTransparent ? "transparent" : canvasBg,
        } as any) as unknown as FabricCanvas;

        fabricRef.current = activeCanvas;
        setCanvas(activeCanvas);

        // Forçar cálculo inicial de posição baseado na configuração do useEffect
        activeCanvas.calcOffset();

        const updateHistory = () => {
          if (
            !activeCanvas ||
            isHistoryUpdate.current ||
            isInternalUpdate.current
          )
            return;
          const obj = activeCanvas.toObject(CUSTOM_PROPS);
          if (!obj) return;
          const json = JSON.stringify(obj);

          setHistory((prev) => {
            const currentIdx = historyIndexRef.current;
            const newHistory = prev.slice(0, currentIdx + 1);
            newHistory.push(json);
            return newHistory;
          });

          setHistoryIndex((prev) => {
            const newIdx = historyIndexRef.current + 1;
            historyIndexRef.current = newIdx;
            return newIdx;
          });
        };

        // Event listeners
        const handleCanvasModified = () => {
          if (isInternalUpdate.current) return;
          setIsDirty(true);
          triggerAutoSave();
          updateHistory();
        };

        const handleSelection = (e: any) => {
          const sel = e.selected ? e.selected[0] : null;
          setSelectedObject(sel);
        };

        // Duplo-clique para editar Textbox (Estilo Canva: selecione primeiro, depois edite)
        const handleDoubleClick = (e: any) => {
          const target = e.target;
          if (target && target.type === "textbox") {
            target.set({ editable: true });
            target.enterEditing();
            target.selectAll();

            // Quando sair da edição, podemos desabilitar o 'editable' se quisermos o comportamento estrito
            // mas manter true é geralmente mais seguro para evitar bugs de cursor
            target.once("editing:exited", () => {
              // target.set({ editable: false });
            });
          }
        };

        activeCanvas.on("object:modified", handleCanvasModified);
        activeCanvas.on("object:added", handleCanvasModified);
        activeCanvas.on("object:removed", handleCanvasModified);
        activeCanvas.on("path:created", handleCanvasModified);

        activeCanvas.on("selection:created", handleSelection);
        activeCanvas.on("selection:updated", handleSelection);
        activeCanvas.on("selection:cleared", () => setSelectedObject(null));

        activeCanvas.on("mouse:dblclick", handleDoubleClick);

        // Add Zoom (Ctrl + Scroll)
        activeCanvas.on("mouse:wheel", (opt: any) => {
          if (!opt.e.ctrlKey) return;
          opt.e.preventDefault();
          opt.e.stopPropagation();

          const delta = opt.e.deltaY;
          setWorkspaceZoom((prev) => {
            let newZoom = prev * 0.999 ** delta;
            if (newZoom > 5) newZoom = 5;
            if (newZoom < 0.1) newZoom = 0.1;
            return newZoom;
          });
        });

        // Load initial state if exists
        const initialState = (window as unknown as CustomWindow)
          .__initialCanvasState;
        if (initialState) {
          try {
            isInternalUpdate.current = true;

            // Pre-carregar fontes do estado inicial
            if (initialState.objects) {
              const fontsToLoad = new Set<string>();
              initialState.objects.forEach((obj: FabricObject) => {
                if (obj.fontFamily && obj.fontFamily !== "Arial") {
                  fontsToLoad.add(obj.fontFamily);
                }
              });

              if (fontsToLoad.size > 0) {
                await Promise.all(
                  Array.from(fontsToLoad).map((f) => loadGoogleFont(f)),
                );
              }
            }

            try {
              // crossOrigin: 'anonymous' é importante para evitar erros de tainted canvas
              // ao exportar imagens que vêm de outro domínio (api)
              await activeCanvas.loadFromJSON(initialState);

              // Forçar aplicação do fundo do objeto layout (prioridade sobre o JSON do canvas)
              const finalBg = isTransparent
                ? "transparent"
                : initialState.backgroundColor || canvasBg;
              activeCanvas.set({ backgroundColor: finalBg });
            } catch (jsonErr) {
              console.error(
                "Erro ao carregar JSON do estado inicial:",
                jsonErr,
              );
              toast.error(
                "Alguns elementos do design podem não ter sido carregados",
              );
            }

            // Garantir que todos os objetos tenham coordenadas e cache corretos após carregar
            activeCanvas.getObjects().forEach((obj: FabricObject) => {
              if (!obj.id) obj.id = generateId();
              obj.set("objectCaching", false);

              if (obj.type === "image") {
                obj.set("imageSmoothing", true);
              }

              if (obj.type === "textbox") {
                obj.set("splitByGrapheme", false);
                obj.set("padding", 15);
                obj.set("editable", false);
                obj.set("perPixelTargetFind", false);
                obj.set("borderColor", "#3b82f6");
                obj.set("cornerColor", "#3b82f6");
                obj.set("cornerSize", 10);
                obj.set("borderScaleFactor", 2);
                obj.set("borderDashArray", null);
                (obj as any).initDimensions();
              }
              obj.setCoords();
            });

            activeCanvas.renderAll();
            // Init history
            const obj = activeCanvas.toObject(CUSTOM_PROPS);
            if (obj) {
              const json = JSON.stringify(obj);
              setHistory([json]);
              setHistoryIndex(0);
              historyIndexRef.current = 0;
            }

            delete (window as unknown as CustomWindow).__initialCanvasState;
            isInternalUpdate.current = false;
          } catch (e) {
            isInternalUpdate.current = false;
          }
        } else {
          // Init empty history
          const obj = activeCanvas.toObject(CUSTOM_PROPS);
          if (obj) {
            const json = JSON.stringify(obj);
            setHistory([json]);
            setHistoryIndex(0);
            historyIndexRef.current = 0;
          }
        }
      } catch (error) {
        console.error("Fabric init error:", error);
      } // silently fail
    };

    initCanvas();

    return () => {
      if (activeCanvas) {
        if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
        activeCanvas.dispose();
        fabricRef.current = null;
        setCanvas(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]); // Only re-init if loading state changes

  useEffect(() => {
    if (activePanel === "Elementos") {
      const fetchElements = async () => {
        try {
          // Primeiro tenta API interna
          const elementsData = await elementBankService
            .listElements({
              search: searchQuery,
            })
            .catch(() => null);

          let elements = elementsData?.elements || [];

          // Se API interna estiver vazia ou falhar, usa API externa
          if (!elements || elements.length === 0) {
            try {
              const externalElements =
                await externalElementsService.searchMultiple(
                  searchQuery || "design",
                );
              if (externalElements && externalElements.length > 0) {
                elements = externalElements;
              } else {
                throw new Error("No external elements found");
              }
            } catch (e) {
              elements = externalElementsService.getDefaultElements();
            }
          }

          setBankElements(Array.isArray(elements) ? elements : []);
        } catch (error) {
          // Fallback final
          setBankElements(externalElementsService.getDefaultElements());
        }
      };
      fetchElements();
    }
  }, [activePanel, searchQuery]);

  const handleResize = (w_cm: number, h_cm: number) => {
    const w = w_cm * CM_TO_PX;
    const h = h_cm * CM_TO_PX;
    setDimensions({ width: w, height: h });

    if (canvas) {
      // O useEffect principal cuidará de sincronizar as dimensões físicas e visuais
      // baseado no novo estado de 'dimensions'
      setIsDirty(true);
      triggerAutoSave(); // Salva as novas dimensões no banco
    }
  };

  const handleAddText = async (
    type: "title" | "subtitle" | "body" = "body",
    fontFamily = "Arial",
  ) => {
    const currentCanvas = (canvas || fabricRef.current) as FabricCanvas;
    if (!currentCanvas) {
      return;
    }

    if (fontFamily !== "Arial") {
      loadGoogleFont(fontFamily);
    }

    const { Textbox } = await import("fabric");

    let fontSize = 16;
    let fontWeight: string | number = "normal";
    let textStr = "Um pouquinho de texto";

    if (type === "title") {
      fontSize = 32;
      fontWeight = "bold";
      textStr = "Título";
    } else if (type === "subtitle") {
      fontSize = 24;
      fontWeight = "bold";
      textStr = "Subtítulo";
    }

    const text = new Textbox(textStr, {
      id: generateId(),
      left: dimensions.width / 2 - 100,
      top: dimensions.height / 2 - 10,
      width: 200,
      fontSize,
      fontWeight: fontWeight as any,
      fill: "#000000",
      fontFamily,
      // Configurações críticas para cursor alinhado com o Canva
      editable: false, // Começa como false para selecionar o componente primeiro
      selectable: true,
      evented: true,
      splitByGrapheme: false, // Voltando para FALSE para corrigir atalhos de palavras e seleção
      padding: 15,
      lineHeight: 1.3,
      textAlign: "left",
      // Quebra de linha por palavra
      wordWrap: true,
      // Evitar cache e distorção
      objectCaching: false,
      noScaleCache: true,
      strokeUniform: true,
      // Melhorar visual de seleção
      hasControls: true,
      hasBorders: true,
      transparentCorners: false,
      cornerColor: "#3b82f6",
      cornerStrokeColor: "#ffffff",
      cornerSize: 10,
      borderColor: "#3b82f6",
      borderScaleFactor: 2,
      borderDashArray: null, // Linha sólida para parecer mais profissional
      lockScalingY: false,
      isCustomizable: true,
      perPixelTargetFind: false, // False para facilitar seleção da caixa como um todo
      // Melhorar seleção de texto
      selectionBackgroundColor: "rgba(59, 130, 246, 0.3)",
      selectionColor: "#3b82f6",
    } as any) as unknown as FabricObject;

    try {
      currentCanvas.add(text);
      text.setCoords();
      currentCanvas.setActiveObject(text);
      currentCanvas.renderAll();
      setIsDirty(true);
      triggerAutoSave();
    } catch (error) {
      toast.error("Erro ao adicionar texto");
    }
  };

  const handleAddShape = async (
    type: "rect" | "circle" | "triangle" | "frame" | "frame-circle",
  ) => {
    const currentCanvas = (canvas || fabricRef.current) as FabricCanvas;
    if (!currentCanvas) {
      return;
    }

    try {
      const { Rect, Circle, Triangle } = await import("fabric");
      let shape: FabricObject;

      const props = {
        id: generateId(),
        left: dimensions.width / 2 - 50,
        top: dimensions.height / 2 - 50,
        fill: type.startsWith("frame") ? "rgba(244, 63, 94, 0.2)" : "#3b82f6",
        stroke: type.startsWith("frame") ? "#f43f5e" : "transparent",
        strokeWidth: type.startsWith("frame") ? 2 : 0,
        width: 100,
        height: 100,
        cornerSmoothing: 0.5,
      };

      if (type === "rect")
        shape = new Rect(props as any) as unknown as FabricObject;
      else if (type === "circle")
        shape = new Circle({
          ...props,
          radius: 50,
        } as any) as unknown as FabricObject;
      else if (type === "triangle")
        shape = new Triangle(props as any) as unknown as FabricObject;
      else if (type === "frame" || type === "frame-circle") {
        const frameCount =
          currentCanvas.getObjects().filter((o) => o.isFrame).length + 1;

        if (type === "frame-circle") {
          shape = new Circle({
            ...props,
            radius: 50,
            name: `Foto ${frameCount}`,
          }) as unknown as FabricObject;
        } else {
          shape = new Rect({
            ...props,
            name: `Foto ${frameCount}`,
            rx: 15,
            ry: 15,
          }) as unknown as FabricObject;
        }

        shape.set({
          opacity: 1,
          fill: "rgba(229, 231, 235, 1)", // bg-gray-200
          stroke: "#9ca3af", // border-gray-400
          strokeWidth: 2,
          strokeDashArray: [5, 5], // Dotted border for "placeholder" look
        });

        // Marcar como placeholder para imagem
        shape.isFrame = true;
        shape.isCustomizable = true; // Frames are customizable by default
      }

      currentCanvas.add(shape!);
      shape!.setCoords();
      currentCanvas.setActiveObject(shape!);
      currentCanvas.renderAll();
      setIsDirty(true);
      triggerAutoSave();
    } catch (error) {
      toast.error("Erro ao adicionar");
    }
  };

  const handleAddBankElement = async (imageUrl: string) => {
    const currentCanvas = (canvas || fabricRef.current) as FabricCanvas;
    if (!currentCanvas) {
      return;
    }

    try {
      const { FabricImage } = await import("fabric");

      let finalUrl = imageUrl;
      if (finalUrl.startsWith("/")) {
        finalUrl = `${import.meta.env.VITE_API_URL}${finalUrl}`;
      }

      const img = (await (FabricImage as any).fromURL(finalUrl, {
        crossOrigin: "anonymous",
      })) as unknown as FabricObject;

      const targetWidth = Math.min(dimensions.width * 0.7, 400);
      img.scaleToWidth(targetWidth);

      // Se um objeto está selecionado e é uma moldura, vincular a imagem a ela
      const imgId = generateId();
      let frameOpacity = 1;
      let linkedFrameId = null;
      if (selectedObject && (selectedObject as any).isFrame) {
        frameOpacity = selectedObject.opacity || 1;
        linkedFrameId = (selectedObject as any).id;
      }

      img.set({
        id: imgId,
        linkedFrameId,
        left: (dimensions.width - img.getBoundingRect().width) / 2,
        top: (dimensions.height - img.getBoundingRect().height) / 2,
        objectCaching: false,
        imageSmoothing: true,
        opacity: frameOpacity,
      });

      currentCanvas.add(img);
      img.setCoords();
      currentCanvas.setActiveObject(img);
      currentCanvas.renderAll();
      setIsDirty(true);
      triggerAutoSave();
    } catch (error) {
      toast.error("Erro ao adicionar elemento");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentCanvas = (canvas || fabricRef.current) as FabricCanvas;
    if (!currentCanvas) {
      return;
    }

    const toastId = toast.loading("Fazendo upload da imagem...");

    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";
      const uploadResult = await layoutApiService.uploadElementImage(
        file,
        token,
      );

      const imageUrl =
        uploadResult.imageUrl || uploadResult.image_url || uploadResult.url;
      if (!imageUrl) throw new Error("URL da imagem não recebida do servidor");

      // Garantir URL absoluta para o Fabric.js
      let absoluteUrl = imageUrl;
      if (absoluteUrl.startsWith("/")) {
        absoluteUrl = `${import.meta.env.VITE_API_URL}${absoluteUrl}`;
      }

      const { FabricImage } = await import("fabric");

      const img = (await (FabricImage as any).fromURL(absoluteUrl, {
        crossOrigin: "anonymous",
      })) as unknown as FabricObject;

      const targetWidth = Math.min(dimensions.width * 0.7, 400);
      img.scaleToWidth(targetWidth);

      // Se um objeto está selecionado e é uma moldura, vincular a imagem a ela
      const imgId = generateId();
      let frameOpacity = 1;
      let linkedFrameId = null;
      if (selectedObject && (selectedObject as any).isFrame) {
        frameOpacity = selectedObject.opacity || 1;
        linkedFrameId = (selectedObject as any).id;
      }

      img.set({
        id: imgId,
        linkedFrameId,
        left: (dimensions.width - img.getBoundingRect().width) / 2,
        top: (dimensions.height - img.getBoundingRect().height) / 2,
        objectCaching: false,
        imageSmoothing: true,
        opacity: frameOpacity,
      });

      currentCanvas.add(img);
      img.setCoords();
      currentCanvas.setActiveObject(img);
      currentCanvas.renderAll();

      setUserUploads((prev) => [
        { id: uploadResult.id || Date.now().toString(), imageUrl },
        ...prev,
      ]);

      setIsDirty(true);
      triggerAutoSave();
      fetchUserUploads(); // Refresh to get real IDs from DB
      toast.success("Imagem enviada!", { id: toastId });
    } catch (error) {
      toast.error("Erro ao fazer upload", { id: toastId });
    }
  };

  const handleDeleteUpload = async (id: string) => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("appToken") || "";
    try {
      await elementBankService.deleteElementBankItem(id, token);
      setUserUploads((prev) => prev.filter((u) => u.id !== id));
      toast.success("Imagem removida");
    } catch (error) {
      toast.error("Erro ao remover imagem");
    }
  };

  const handleSave = useCallback(
    async (isManual = true) => {
      const currentCanvas = (canvas || fabricRef.current) as FabricCanvas;
      if (!currentCanvas || !layoutId) return;

      setSaving(true);
      try {
        // Gerar preview apenas em salvamentos manuais para evitar "fadiga" e lentidão no auto-save
        let previewImageUrl: string | undefined;
        if (isManual) {
          try {
            // No Fabric 7, setViewportTransform([]) reseta a visualização para o topo
            // garantindo que o toDataURL capture tudo e não apenas o que está visível.
            const originalTransform = [
              ...(currentCanvas as any).viewportTransform,
            ];
            (currentCanvas as any).setViewportTransform([
              INTERNAL_DPI_MULTIPLIER,
              0,
              0,
              INTERNAL_DPI_MULTIPLIER,
              0,
              0,
            ]);

            previewImageUrl = currentCanvas.toDataURL({
              format: "png",
              quality: 1,
              // Multiplier para gerar um preview de tamanho razoável mas nítido
              // Se DPI=3, multiplier 0.1 gera ~30% do tamanho base
              multiplier: 0.6 / INTERNAL_DPI_MULTIPLIER,
              enableRetinaScaling: false,
            });

            (currentCanvas as any).setViewportTransform(originalTransform);
          } catch (err) {
            console.warn("Falha ao gerar preview:", err);
          }
        }

        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("appToken") ||
          "";

        await layoutApiService.updateLayout(layoutId, {
          name: designName,
          fabricJsonState: currentCanvas.toObject(CUSTOM_PROPS),
          width: Math.round(dimensions.width),
          height: Math.round(dimensions.height),
          previewImageUrl, // Se for auto-save, envia undefined e mantém o atual no banco
          token,
          isPublished: isManual ? true : undefined,
        });

        setIsDirty(false);
        if (isManual) toast.success("Design publicado e salvo!");
      } catch (error) {
        if (isManual) toast.error("Erro ao salvar design");
      } finally {
        setSaving(false);
      }
    },
    [canvas, layoutId, designName, dimensions.width, dimensions.height],
  );

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    autoSaveTimeout.current = setTimeout(() => {
      const currentCanvas = (canvas || fabricRef.current) as FabricCanvas;
      if (currentCanvas) {
        handleSave(false);
      }
    }, 3000); // 3 seconds of inactivity
  }, [canvas, handleSave]);

  const handleUndo = useCallback(async () => {
    if (historyIndex <= 0 || !canvas) return;
    const prevIndex = historyIndex - 1;
    const json = history[prevIndex];
    if (!json || json === "undefined") return;

    try {
      isInternalUpdate.current = true;
      isHistoryUpdate.current = true;
      const c = canvas as FabricCanvas;
      await c.loadFromJSON(JSON.parse(json));
      c.renderAll();

      setHistoryIndex(prevIndex);
      historyIndexRef.current = prevIndex; // Sync Ref

      isInternalUpdate.current = false;
      isHistoryUpdate.current = false;
      triggerAutoSave();
    } catch (e) {
      console.error("Undo error", e);
      isInternalUpdate.current = false;
      isHistoryUpdate.current = false;
    }
  }, [canvas, history, historyIndex, triggerAutoSave]);

  const handleRedo = useCallback(async () => {
    if (historyIndex >= history.length - 1 || !canvas) return;
    const nextIndex = historyIndex + 1;
    const json = history[nextIndex];
    if (!json || json === "undefined") return;

    try {
      isInternalUpdate.current = true;
      isHistoryUpdate.current = true;
      const c = canvas as FabricCanvas;
      await c.loadFromJSON(JSON.parse(json));
      c.renderAll();

      setHistoryIndex(nextIndex);
      historyIndexRef.current = nextIndex; // Sync Ref

      isInternalUpdate.current = false;
      isHistoryUpdate.current = false;
      triggerAutoSave();
    } catch (e) {
      isHistoryUpdate.current = false;
      isInternalUpdate.current = false;
    }
  }, [canvas, history, historyIndex, triggerAutoSave]);

  const handleClone = useCallback(async () => {
    if (!selectedObject || !canvas) return;

    try {
      const cloned = await (selectedObject as FabricObject).clone(CUSTOM_PROPS);
      cloned.set("left", (selectedObject as FabricObject).left + 15);
      cloned.set("top", (selectedObject as FabricObject).top + 15);

      // Ensure custom props are preserved
      CUSTOM_PROPS.forEach((prop) => {
        if ((selectedObject as FabricObject)[prop] !== undefined) {
          cloned[prop] = (selectedObject as FabricObject)[prop];
        }
      });

      const c = canvas as FabricCanvas;
      c.add(cloned);
      c.setActiveObject(cloned);
      c.renderAll();
      setIsDirty(true);
      triggerAutoSave();
    } catch (error) {
      console.error("Error cloning object:", error);
      toast.error("Erro ao duplicar objeto");
    }
  }, [canvas, selectedObject, triggerAutoSave]);

  const handleSaveDesignName = async (name: string) => {
    if (!layoutId || !name.trim()) return;

    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";

      await layoutApiService.updateLayout(layoutId, {
        name: name.trim(),
        token,
      });
    } catch (error) {
      toast.error("Erro ao salvar nome do design");
    }
  };

  const triggerNameAutoSave = (name: string) => {
    if (namesSaveTimeout.current) {
      clearTimeout(namesSaveTimeout.current);
    }
    namesSaveTimeout.current = setTimeout(() => {
      handleSaveDesignName(name);
    }, 1000); // 1 second after user stops typing
  };

  const handleExportHighQuality = async () => {
    const currentCanvas = (canvas || fabricRef.current) as FabricCanvas;
    if (!currentCanvas || !layoutId) return;

    const toastId = toast.loading("Gerando imagem em alta qualidade...");
    try {
      // Forçar fundo branco para evitar transparência
      const originalBg = currentCanvas.backgroundColor;
      currentCanvas.set("backgroundColor", "#ffffff");
      currentCanvas.renderAll();

      // Exportar com máxima qualidade
      const originalTransform = [...(currentCanvas as any).viewportTransform];
      (currentCanvas as any).setViewportTransform([
        INTERNAL_DPI_MULTIPLIER,
        0,
        0,
        INTERNAL_DPI_MULTIPLIER,
        0,
        0,
      ]);

      // Multiplier 5 relativo à escala base.
      // Como o canvas já está em 2x, multiplier deve ser 5 / 2 = 2.5
      const highQualityImage = currentCanvas.toDataURL({
        format: "png",
        multiplier: 5 / INTERNAL_DPI_MULTIPLIER,
        enableRetinaScaling: false,
      });

      (currentCanvas as any).setViewportTransform(originalTransform);

      // Restaurar fundo original
      currentCanvas.set("backgroundColor", originalBg);
      currentCanvas.renderAll();

      const link = document.createElement("a");
      link.href = highQualityImage;
      link.download = `${designName.replace(/\s+/g, "_")}_alta_qualidade.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Imagem exportada com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Error exporting high quality image:", error);
      toast.error("Erro ao exportar imagem em alta qualidade", { id: toastId });
    }
  };

  // Save name immediately on change/blur is tricky for input, usually on blur.
  // We can pass a onBlur handler to DesignToolbar

  const handleObjectUpdate = (key: string, value: unknown) => {
    if (!selectedObject || !canvas) return;

    if (key === "fontFamily" && typeof value === "string") {
      loadGoogleFont(value);
    }

    (selectedObject as FabricObject).set(key, value);
    if ((selectedObject as any).type === "textbox") {
      (selectedObject as any).initDimensions();
    }
    (selectedObject as FabricObject).setCoords();

    // Se a moldura teve opacidade alterada, aplicar a mesma opacidade às imagens vinculadas
    if ((selectedObject as any).isFrame && key === "opacity") {
      const frameOpacity = value as number;
      const allObjects = (canvas as FabricCanvas).getObjects();
      const frameId = (selectedObject as any).id;

      // Atualizar todas as imagens vinculadas a esta moldura
      allObjects.forEach((obj: any) => {
        if (obj.linkedFrameId === frameId && obj.type === "image") {
          obj.set("opacity", frameOpacity);
        }
      });
    }

    (canvas as FabricCanvas).renderAll();
    setIsDirty(true);
    triggerAutoSave();

    // Trigger update of UI by changing the nonce
    // We don't recreate the object to avoid breaking reference with Fabric
    setUpdateNonce((prev) => prev + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key === "y") {
          e.preventDefault();
          handleRedo();
        } else if (e.key === "d") {
          e.preventDefault();
          handleClone();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canvas,
    historyIndex,
    history,
    selectedObject,
    handleClone,
    handleRedo,
    handleUndo,
  ]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (canvas) {
        (canvas as FabricCanvas).calcOffset();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }
    window.addEventListener("resize", handleScroll);

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("resize", handleScroll);
    };
  }, [canvas]);

  const handleWorkspaceWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY;
      setWorkspaceZoom((prev) => {
        let newZoom = prev * 0.999 ** delta;
        if (newZoom > 5) newZoom = 5;
        if (newZoom < 0.1) newZoom = 0.1;
        return newZoom;
      });
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0d1216] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p>Inicializando editor...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="relative text-white h-screen flex flex-col bg-[#0d1216] overflow-hidden">
      <DesignToolbar
        designId={layoutId || null}
        designName={designName}
        setDesignName={(name) => {
          setDesignName(name);
          triggerNameAutoSave(name);
        }}
        onResize={handleResize}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={() => handleSave(true)}
        onExportHighQuality={handleExportHighQuality}
        saving={saving}
        loading={loading}
        user={user}
        isDirty={isDirty}
      />

      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50">
        <ObjectToolbar
          selectedObject={selectedObject}
          onDelete={() => {
            if (canvas && selectedObject) {
              (canvas as FabricCanvas).remove(selectedObject);
              (canvas as FabricCanvas).renderAll();
              setIsDirty(true);
              triggerAutoSave();
            }
          }}
          onClone={handleClone}
          onUpdate={handleObjectUpdate}
          updateNonce={updateNonce}
          onBringToFront={() => {
            if (selectedObject && canvas) {
              (canvas as FabricCanvas).bringObjectToFront(selectedObject);
              (canvas as FabricCanvas).renderAll();
              setIsDirty(true);
              triggerAutoSave();
            }
          }}
          onSendToBack={() => {
            if (selectedObject && canvas) {
              (canvas as FabricCanvas).sendObjectToBack(selectedObject);
              (canvas as FabricCanvas).renderAll();
              setIsDirty(true);
              triggerAutoSave();
            }
          }}
        />
      </div>
      <main className="flex-1 flex overflow-hidden">
        <DesignSidebar
          activePanel={activePanel}
          onAddText={() => handleAddText("body")}
          onTogglePanel={(panel) =>
            setActivePanel(activePanel === panel ? null : panel)
          }
        />

        <DesignPanels
          activePanel={activePanel}
          onClose={() => setActivePanel(null)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleAddShape={handleAddShape}
          handleAddText={handleAddText}
          bankElements={bankElements}
          userUploads={userUploads}
          onAddBankElement={handleAddBankElement}
          onImageUpload={handleImageUpload}
          onDeleteUpload={handleDeleteUpload}
          // Novos props para Phase 7
          canvas={canvas}
          selectedObjectId={selectedObject?.id || null}
          onSelectObject={(obj) => {
            if (canvas) {
              (canvas as FabricCanvas).setActiveObject(obj as FabricObject);
              (canvas as FabricCanvas).renderAll();
            }
          }}
          canvasBg={canvasBg}
          onCanvasBgChange={(color) => {
            setCanvasBg(color);
            setIsTransparent(false);
            if (canvas) {
              (canvas as FabricCanvas).set({ backgroundColor: color });
              (canvas as FabricCanvas).renderAll();
              setIsDirty(true);
              triggerAutoSave();
            }
          }}
          isTransparent={isTransparent}
          onToggleTransparency={(val) => {
            setIsTransparent(val);
            if (canvas) {
              (canvas as FabricCanvas).set({
                backgroundColor: val ? "transparent" : canvasBg,
              });
              (canvas as FabricCanvas).renderAll();
              setIsDirty(true);
              triggerAutoSave();
            }
          }}
        />

        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center bg-[#0d1216] relative p-8 overflow-auto custom-scrollbar"
          onClick={(e) => {
            if (e.target === e.currentTarget && canvas) {
              (canvas as FabricCanvas).discardActiveObject();
              (canvas as FabricCanvas).renderAll();
            }
          }}
          onWheel={handleWorkspaceWheel}
        >
          <div
            className={styles.designCanvas}
            style={
              {
                "--design-width": `${dimensions.width * workspaceZoom}px`,
                "--design-height": `${dimensions.height * workspaceZoom}px`,
                transform: "none",
                transformOrigin: "center center",
                transition: "none",
              } as unknown as React.CSSProperties
            }
          >
            <canvas ref={canvasRef} />
          </div>
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-neutral-900/80 px-3 py-1.5 rounded-full backdrop-blur-sm border border-neutral-700 text-[10px] text-neutral-300">
            <span>
              {Math.round((dimensions.width / CM_TO_PX) * 10) / 10} x{" "}
              {Math.round((dimensions.height / CM_TO_PX) * 10) / 10} cm
            </span>
            <span className="h-3 w-px bg-white/20 mx-1"></span>
            <span>{Math.round(workspaceZoom * 100)}%</span>
            <span className="h-3 w-px bg-white/20 mx-1"></span>
            <span>96 DPI</span>
          </div>
        </div>
      </main>
    </section>
  );
};

export default DesignEditorPage;
