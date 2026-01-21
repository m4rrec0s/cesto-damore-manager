import { useRef, useState, useEffect } from "react";
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

const CUSTOM_PROPS = [
  "name",
  "id",
  "selectable",
  "evented",
  "isCustomizable",
  "maxChars",
  "isFrame",
  "customData",
  "rx",
  "ry",
  "stroke",
  "strokeWidth",
  "strokeDashArray",
  "radius",
];

const loadGoogleFont = (fontFamily: string) => {
  if (document.getElementById(`font-${fontFamily.replace(/\s+/g, "-")}`))
    return Promise.resolve();

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = `font-${fontFamily.replace(/\s+/g, "-")}`;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(
      /\s+/g,
      "+",
    )}:wght@400;700&display=swap`;
    link.onload = () => {
      // @ts-ignore
      document.fonts.load(`1em "${fontFamily}"`).then(resolve).catch(resolve);
    };
    link.onerror = reject;
    document.head.appendChild(link);
  });
};

const DesignEditorPage = () => {
  const { layoutId } = useParams<{ layoutId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canvas, setCanvas] = useState<unknown>(null);
  const [selectedObject, setSelectedObject] = useState<unknown>(null);
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<unknown>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const namesSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInternalUpdate = useRef(false); // To avoid triggering auto-save on initial load or internal updates

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
          if (layout.backgroundColor) {
            setCanvasBg(layout.backgroundColor);
            setIsTransparent(layout.backgroundColor === "transparent");
          }
          // Store state to load after canvas init
          if (layout.fabricJsonState) {
            const parsedState =
              typeof layout.fabricJsonState === "string"
                ? JSON.parse(layout.fabricJsonState)
                : layout.fabricJsonState;

            (window as any).__initialCanvasState = parsedState;

            // Pre-load fonts used in the layout
            if (parsedState.objects) {
              const fonts = new Set<string>();
              parsedState.objects.forEach((obj: any) => {
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
        elements.map((el: any) => ({
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

    let activeCanvas: any = null;

    const initCanvas = async () => {
      try {
        const { Canvas } = await import("fabric");

        activeCanvas = new Canvas(canvasRef.current!, {
          width: dimensions.width,
          height: dimensions.height,
          backgroundColor: isTransparent ? "transparent" : canvasBg,
          preserveObjectStacking: true,
          renderOnAddRemove: true,
        });

        fabricRef.current = activeCanvas;
        setCanvas(activeCanvas);

        const updateHistory = () => {
          if (isHistoryUpdate.current || isInternalUpdate.current) return;
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

        activeCanvas.on("object:modified", handleCanvasModified);
        activeCanvas.on("object:added", handleCanvasModified);
        activeCanvas.on("object:removed", handleCanvasModified);
        activeCanvas.on("path:created", handleCanvasModified);

        activeCanvas.on("selection:created", handleSelection);
        activeCanvas.on("selection:updated", handleSelection);
        activeCanvas.on("selection:cleared", () => setSelectedObject(null));

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
        const initialState = (window as any).__initialCanvasState;
        if (initialState) {
          try {
            isInternalUpdate.current = true;

            // Pre-carregar fontes do estado inicial
            if (initialState.objects) {
              const fontsToLoad = new Set<string>();
              initialState.objects.forEach((obj: any) => {
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

            await activeCanvas.loadFromJSON(initialState);
            activeCanvas.renderAll();
            // Init history
            const obj = activeCanvas.toObject(CUSTOM_PROPS);
            if (obj) {
              const json = JSON.stringify(obj);
              setHistory([json]);
              setHistoryIndex(0);
              historyIndexRef.current = 0;
            }

            delete (window as any).__initialCanvasState;
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
          let elementsData = await elementBankService
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
      (
        canvas as {
          setDimensions: (d: { width: number; height: number }) => void;
          renderAll: () => void;
          setZoom: (z: number) => void;
          setViewportTransform: (v: number[]) => void;
        }
      ).setDimensions({ width: w, height: h });

      // Reset zoom/viewport to ensure visibility
      const c = canvas as any;
      c.setViewportTransform([1, 0, 0, 1, 0, 0]);

      (canvas as { renderAll: () => void }).renderAll();
      setIsDirty(true);
      triggerAutoSave(); // Save new dimensions
    }
  };

  const handleAddText = async (
    type: "title" | "subtitle" | "body" = "body",
    fontFamily = "Arial",
  ) => {
    const currentCanvas = (canvas || fabricRef.current) as any;
    if (!currentCanvas) {
      return;
    }

    if (fontFamily !== "Arial") {
      loadGoogleFont(fontFamily);
    }

    const { IText } = await import("fabric");

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

    const text = new IText(textStr, {
      left: dimensions.width / 2 - 50,
      top: dimensions.height / 2 - 10,
      fontSize,
      fontWeight: fontWeight as any,
      fill: "#000000",
      fontFamily,
    });

    try {
      currentCanvas.add(text);
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
    const currentCanvas = (canvas || fabricRef.current) as any;
    if (!currentCanvas) {
      return;
    }

    try {
      const { Rect, Circle, Triangle } = await import("fabric");
      let shape: any;

      const props = {
        left: dimensions.width / 2 - 50,
        top: dimensions.height / 2 - 50,
        fill: type.startsWith("frame") ? "rgba(244, 63, 94, 0.2)" : "#3b82f6",
        stroke: type.startsWith("frame") ? "#f43f5e" : "transparent",
        strokeWidth: type.startsWith("frame") ? 2 : 0,
        width: 100,
        height: 100,
        cornerSmoothing: 0.5,
      };

      if (type === "rect") shape = new Rect(props);
      else if (type === "circle") shape = new Circle({ ...props, radius: 50 });
      else if (type === "triangle") shape = new Triangle(props);
      else if (type === "frame" || type === "frame-circle") {
        const frameCount =
          currentCanvas.getObjects().filter((o: any) => o.isFrame).length + 1;

        if (type === "frame-circle") {
          shape = new Circle({
            ...props,
            radius: 50,
            name: `Foto ${frameCount}`,
          });
        } else {
          shape = new Rect({
            ...props,
            name: `Foto ${frameCount}`,
            rx: 15,
            ry: 15,
          });
        }

        shape.set({
          opacity: 1,
          fill: "rgba(229, 231, 235, 1)", // bg-gray-200
          stroke: "#9ca3af", // border-gray-400
          strokeWidth: 2,
          strokeDashArray: [5, 5], // Dotted border for "placeholder" look
        });

        // Marcar como placeholder para imagem
        (shape as any).isFrame = true;
        (shape as any).isCustomizable = true; // Frames are customizable by default
      }

      currentCanvas.add(shape);
      currentCanvas.setActiveObject(shape);
      currentCanvas.renderAll();
      setIsDirty(true);
      triggerAutoSave();
    } catch (error) {
      toast.error("Erro ao adicionar");
    }
  };

  const handleAddBankElement = async (imageUrl: string) => {
    const currentCanvas = (canvas || fabricRef.current) as any;
    if (!currentCanvas) {
      return;
    }

    try {
      const { FabricImage } = await import("fabric");

      const img = await FabricImage.fromURL(imageUrl, {
        crossOrigin: "anonymous",
      });

      img.scaleToWidth(150);
      img.set({
        left: dimensions.width / 2 - 75,
        top: dimensions.height / 2 - 75,
      });

      currentCanvas.add(img);
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

    const currentCanvas = (canvas || fabricRef.current) as any;
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

      const { FabricImage } = await import("fabric");

      const img = await FabricImage.fromURL(imageUrl, {
        crossOrigin: "anonymous",
      });

      img.scaleToWidth(200);
      img.set({
        left: dimensions.width / 2 - 100,
        top: dimensions.height / 2 - 100,
      });

      currentCanvas.add(img);
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

  const triggerAutoSave = () => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    autoSaveTimeout.current = setTimeout(() => {
      const currentCanvas = canvas || fabricRef.current;
      if (currentCanvas) {
        handleSave(false);
      }
    }, 3000); // 3 seconds of inactivity
  };

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

  const handleSave = async (isManual = true) => {
    const currentCanvas = canvas || fabricRef.current;
    if (!currentCanvas || !layoutId) return;

    setSaving(true);
    try {
      // Gerar preview da imagem do canvas
      let previewImageUrl: string | undefined;
      try {
        previewImageUrl = (currentCanvas as any).toDataURL({
          format: "png",
          quality: 0.8,
          multiplier: 0.3, // Reduzir tamanho para thumbnail
        });
      } catch (err) {
        // Continuar sem preview se falhar
      }

      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";

      await layoutApiService.updateLayout(layoutId, {
        name: designName,
        fabricJsonState: (currentCanvas as any).toObject(CUSTOM_PROPS),
        width: Math.round(dimensions.width),
        height: Math.round(dimensions.height),
        previewImageUrl,
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
  };

  const handleExportHighQuality = async () => {
    const currentCanvas = (canvas || fabricRef.current) as any;
    if (!currentCanvas || !layoutId) return;

    const toastId = toast.loading("Gerando imagem em alta qualidade...");
    try {
      // Forçar fundo branco para evitar transparência
      const originalBg = currentCanvas.backgroundColor;
      currentCanvas.set("backgroundColor", "#ffffff");
      currentCanvas.renderAll();

      // Exportar com máxima qualidade (5x o tamanho original para melhor resolução)
      const highQualityImage = currentCanvas.toDataURL({
        format: "png",
        multiplier: 5,
        enableRetinaScaling: true,
      });

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

    (selectedObject as any).set(key, value);
    (canvas as { renderAll: () => void }).renderAll();
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
  }, [canvas, historyIndex, history, selectedObject]);

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

  const handleUndo = async () => {
    if (historyIndex <= 0 || !canvas) return;
    const prevIndex = historyIndex - 1;
    const json = history[prevIndex];
    if (!json || json === "undefined") return;

    try {
      isInternalUpdate.current = true;
      isHistoryUpdate.current = true;
      await (canvas as any).loadFromJSON(JSON.parse(json));
      (canvas as any).renderAll();

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
  };

  const handleRedo = async () => {
    if (historyIndex >= history.length - 1 || !canvas) return;
    const nextIndex = historyIndex + 1;
    const json = history[nextIndex];
    if (!json || json === "undefined") return;

    try {
      isInternalUpdate.current = true;
      isHistoryUpdate.current = true;
      await (canvas as any).loadFromJSON(JSON.parse(json));
      (canvas as any).renderAll();

      setHistoryIndex(nextIndex);
      historyIndexRef.current = nextIndex; // Sync Ref

      isInternalUpdate.current = false;
      isHistoryUpdate.current = false;
      triggerAutoSave();
    } catch (e) {
      isHistoryUpdate.current = false;
      isInternalUpdate.current = false;
    }
  };

  const handleClone = () => {
    if (!selectedObject || !canvas) return;

    (selectedObject as any).clone((cloned: any) => {
      cloned.set({
        left: (selectedObject as any).left + 15,
        top: (selectedObject as any).top + 15,
      });

      // Ensure custom props are preserved
      CUSTOM_PROPS.forEach((prop) => {
        if ((selectedObject as any)[prop] !== undefined) {
          cloned[prop] = (selectedObject as any)[prop];
        }
      });

      (canvas as any).add(cloned);
      (canvas as any).setActiveObject(cloned);
      (canvas as any).renderAll();
      setIsDirty(true);
      triggerAutoSave();
    }, CUSTOM_PROPS);
  };

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
              (canvas as any).remove(selectedObject);
              (canvas as any).renderAll();
              setIsDirty(true);
              triggerAutoSave();
            }
          }}
          onClone={handleClone}
          onUpdate={handleObjectUpdate}
          updateNonce={updateNonce}
          onBringToFront={() => {
            if (selectedObject && canvas) {
              (canvas as any).bringObjectToFront(selectedObject);
              (canvas as { renderAll: () => void }).renderAll();
              setIsDirty(true);
              triggerAutoSave();
            }
          }}
          onSendToBack={() => {
            if (selectedObject && canvas) {
              (canvas as any).sendObjectToBack(selectedObject);
              (canvas as { renderAll: () => void }).renderAll();
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
          selectedObjectId={(selectedObject as any)?.id || null}
          onSelectObject={(obj) => {
            if (canvas) {
              (canvas as any).setActiveObject(obj);
              (canvas as any).renderAll();
            }
          }}
          canvasBg={canvasBg}
          onCanvasBgChange={(color) => {
            setCanvasBg(color);
            setIsTransparent(false);
            if (canvas) {
              (canvas as any).set("backgroundColor", color);
              (canvas as any).renderAll();
              setIsDirty(true);
              triggerAutoSave();
            }
          }}
          isTransparent={isTransparent}
          onToggleTransparency={(val) => {
            setIsTransparent(val);
            if (canvas) {
              (canvas as any).set(
                "backgroundColor",
                val ? "transparent" : canvasBg,
              );
              (canvas as any).renderAll();
              setIsDirty(true);
              triggerAutoSave();
            }
          }}
        />

        <div
          className="flex-1 flex items-center justify-center bg-[#0d1216] relative p-8 overflow-auto custom-scrollbar"
          onClick={(e) => {
            if (e.target === e.currentTarget && canvas) {
              (canvas as any).discardActiveObject();
              (canvas as any).renderAll();
            }
          }}
          onWheel={handleWorkspaceWheel}
        >
          <div
            className={styles.designCanvas}
            style={
              {
                "--design-width": `${dimensions.width}px`,
                "--design-height": `${dimensions.height}px`,
                transform: `scale(${workspaceZoom})`,
                transformOrigin: "center center",
                transition: "transform 0.1s ease-out",
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
