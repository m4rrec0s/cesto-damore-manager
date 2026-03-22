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
import placeholderImg from "../assets/placeholder.png";
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

const CLONE_PROPS = CUSTOM_PROPS.filter((prop) => prop !== "id");
const RULER_SIZE = 24;
const SNAP_THRESHOLD = 8;
const GUIDE_DISPLAY_THRESHOLD = 64;
const GUIDE_COLOR = "#ec4899";
const MANUAL_GUIDE_COLOR = "#22c55e";

type GuideOrientation = "vertical" | "horizontal";

type GuideLine = {
  id: string;
  orientation: GuideOrientation;
  position: number;
  kind: "snap" | "manual" | "measure";
  label?: string;
};

type GuideBadge = {
  id: string;
  orientation: GuideOrientation;
  position: number;
  label: string;
};

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

// Carrega todas as fontes referenciadas num estado do Fabric (ou JSON string)
const preloadFontsFromState = async (stateOrJson: any) => {
  try {
    const state =
      typeof stateOrJson === "string" ? JSON.parse(stateOrJson) : stateOrJson;
    if (!state || !state.objects) return;
    const fonts = new Set<string>();
    state.objects.forEach((obj: any) => {
      if (obj.fontFamily && obj.fontFamily !== "Arial")
        fonts.add(obj.fontFamily);
    });
    if (fonts.size > 0) {
      await Promise.all(Array.from(fonts).map((f) => loadGoogleFont(f)));
    }
  } catch (e) {
    // ignore parsing errors
    return;
  }
};

const addFramePlaceholdersToExport = async (exportCanvas: FabricCanvas) => {
  const { FabricImage } = await import("fabric");
  const objects = exportCanvas.getObjects() as FabricObject[];
  const frameObjects = objects.filter((obj) => obj.isFrame);

  if (frameObjects.length === 0) return;

  for (const frame of frameObjects) {
    const hasLinkedImage = objects.some(
      (obj) => obj.type === "image" && obj.linkedFrameId === frame.id,
    );

    if (hasLinkedImage) continue;

    const placeholder = (await (FabricImage as any).fromURL(placeholderImg, {
      crossOrigin: "anonymous",
    })) as FabricObject;

    const frameRect = frame.getBoundingRect();
    const placeholderWidth = (placeholder as any).width || 1;
    const placeholderHeight = (placeholder as any).height || 1;
    const coverScale = Math.max(
      frameRect.width / placeholderWidth,
      frameRect.height / placeholderHeight,
    );

    placeholder.set({
      left: frameRect.left + frameRect.width / 2,
      top: frameRect.top + frameRect.height / 2,
      originX: "center",
      originY: "center",
      scaleX: coverScale,
      scaleY: coverScale,
      angle: (frame as any).angle || 0,
      flipX: (frame as any).flipX || false,
      flipY: (frame as any).flipY || false,
      skewX: (frame as any).skewX || 0,
      skewY: (frame as any).skewY || 0,
      opacity: frame.opacity ?? 1,
      selectable: false,
      evented: false,
      objectCaching: false,
    });

    try {
      const clipPath = await frame.clone();
      (clipPath as any).absolutePositioned = true;
      placeholder.clipPath = clipPath as any;
    } catch (error) {
      // Se o clone falhar, ainda exportamos o placeholder sem clipPath.
    }

    placeholder.set(
      "name",
      `preview-placeholder-${frame.id || frame.name || Date.now()}`,
    );
    const frameIndex = exportCanvas.getObjects().indexOf(frame);
    if (frameIndex >= 0) {
      (exportCanvas as any).insertAt?.(frameIndex, placeholder);
    } else {
      exportCanvas.add(placeholder);
    }
    exportCanvas.bringObjectToFront(frame);
  }
};

const createDesignPreviewDataUrl = async (
  sourceCanvas: FabricCanvas,
  exportWidth: number,
  exportHeight: number,
  multiplier = 1,
) => {
  const { StaticCanvas } = await import("fabric");
  const serialized = sourceCanvas.toObject(CUSTOM_PROPS);
  const exportCanvas = new StaticCanvas(document.createElement("canvas"), {
    preserveObjectStacking: true,
    enableRetinaScaling: false,
    imageSmoothingEnabled: true,
  }) as unknown as FabricCanvas & { dispose?: () => void };

  try {
    await exportCanvas.loadFromJSON(serialized);
    exportCanvas.setDimensions(
      {
        width: Math.round(exportWidth),
        height: Math.round(exportHeight),
      },
      { cssOnly: false },
    );
    exportCanvas.set({
      backgroundColor: sourceCanvas.backgroundColor,
    });
    exportCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    await addFramePlaceholdersToExport(exportCanvas);
    exportCanvas.renderAll();

    const dataUrl = exportCanvas.toDataURL({
      format: "png",
      multiplier,
      enableRetinaScaling: false,
    });

    return dataUrl;
  } finally {
    exportCanvas.dispose?.();
  }
};

const formatDistance = (px: number) => {
  const safePx = Math.max(0, Math.round(px));
  const cm = safePx / CM_TO_PX;
  return `${safePx}px · ${cm.toFixed(safePx >= 100 ? 1 : 2)}cm`;
};

const clampToRange = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getBoundingRectSafe = (obj: FabricObject) => {
  const rect = obj.getBoundingRect();
  const left = rect.left ?? obj.left ?? 0;
  const top = rect.top ?? obj.top ?? 0;
  const width = rect.width ?? obj.width ?? 0;
  const height = rect.height ?? obj.height ?? 0;

  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    right: left + width,
    bottom: top + height,
  };
};

type AxisTarget = {
  label: "start" | "center" | "end";
  position: number;
};

type AxisCandidate = {
  label: string;
  position: number;
  source?: string;
};

type AxisMatch = {
  delta: number;
  candidate: AxisCandidate;
  target: AxisTarget;
  abs: number;
};

type AxisEvaluation = {
  bestSnap: AxisMatch | null;
  bestDisplay: AxisMatch | null;
};

const evaluateAxis = (
  target: AxisTarget[],
  candidates: AxisCandidate[],
  snapThreshold: number,
  displayThreshold: number,
): AxisEvaluation => {
  let bestSnap: AxisMatch | null = null;
  let bestDisplay: AxisMatch | null = null;

  target.forEach((targetLine) => {
    candidates.forEach((candidate) => {
      const delta = candidate.position - targetLine.position;
      const abs = Math.abs(delta);

      if (abs <= displayThreshold) {
        if (!bestDisplay || abs < bestDisplay.abs) {
          bestDisplay = { delta, candidate, target: targetLine, abs };
        }
      }

      if (abs <= snapThreshold) {
        if (!bestSnap || abs < bestSnap.abs) {
          bestSnap = { delta, candidate, target: targetLine, abs };
        }
      }
    });
  });

  return { bestSnap, bestDisplay };
};

const buildAxisCandidates = (
  rects: Array<{ left: number; top: number; width: number; height: number }>,
  canvasSize: number,
  orientation: GuideOrientation,
  manualGuides: GuideLine[],
) => {
  const candidates: AxisCandidate[] = [];

  if (orientation === "vertical") {
    candidates.push(
      { label: "canvas-left", position: 0, source: "canvas" },
      { label: "canvas-center", position: canvasSize / 2, source: "canvas" },
      { label: "canvas-right", position: canvasSize, source: "canvas" },
    );
    manualGuides
      .filter((guide) => guide.orientation === "vertical")
      .forEach((guide) =>
        candidates.push({
          label: guide.label || "guide",
          position: guide.position,
          source: "manual",
        }),
      );
    rects.forEach((rect, index) => {
      candidates.push(
        { label: `obj-${index}-left`, position: rect.left, source: "object" },
        {
          label: `obj-${index}-center`,
          position: rect.left + rect.width / 2,
          source: "object",
        },
        {
          label: `obj-${index}-right`,
          position: rect.left + rect.width,
          source: "object",
        },
      );
    });
  } else {
    candidates.push(
      { label: "canvas-top", position: 0, source: "canvas" },
      { label: "canvas-center", position: canvasSize / 2, source: "canvas" },
      { label: "canvas-bottom", position: canvasSize, source: "canvas" },
    );
    manualGuides
      .filter((guide) => guide.orientation === "horizontal")
      .forEach((guide) =>
        candidates.push({
          label: guide.label || "guide",
          position: guide.position,
          source: "manual",
        }),
      );
    rects.forEach((rect, index) => {
      candidates.push(
        { label: `obj-${index}-top`, position: rect.top, source: "object" },
        {
          label: `obj-${index}-center`,
          position: rect.top + rect.height / 2,
          source: "object",
        },
        {
          label: `obj-${index}-bottom`,
          position: rect.top + rect.height,
          source: "object",
        },
      );
    });
  }

  return candidates;
};

const applySnapDelta = (
  object: FabricObject,
  rect: ReturnType<typeof getBoundingRectSafe>,
  deltaX: number,
  deltaY: number,
) => {
  if (deltaX) {
    object.set("left", (object.left || 0) + deltaX);
  }

  if (deltaY) {
    object.set("top", (object.top || 0) + deltaY);
  }

  object.setCoords();
  return {
    left: rect.left + deltaX,
    top: rect.top + deltaY,
  };
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
  const [productionTime, setProductionTime] = useState(0);
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
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [rulersEnabled, setRulersEnabled] = useState(true);
  const [manualGuides, setManualGuides] = useState<GuideLine[]>([]);
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [guideBadges, setGuideBadges] = useState<GuideBadge[]>([]);
  const [guideDragState, setGuideDragState] = useState<{
    orientation: GuideOrientation;
    position: number;
  } | null>(null);

  // Refs para gerenciar o estado sem disparar re-renders desnecessários
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const namesSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInternalUpdate = useRef(false);
  const manualGuidesRef = useRef<GuideLine[]>([]);
  const snapEnabledRef = useRef(snapEnabled);
  const rulersEnabledRef = useRef(rulersEnabled);
  const guideDragRef = useRef<{
    orientation: GuideOrientation;
    position: number;
  } | null>(null);
  // Track last pointer position (in canvas viewport coordinates) to center zoom on mouse
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  // Keep a ref for zoom to read inside event handlers without stale closures
  const workspaceZoomRef = useRef<number>(workspaceZoom);
  const stageRef = useRef<HTMLDivElement>(null);

  const clamp = (v: number, a: number, b: number) =>
    Math.max(a, Math.min(b, v));

  // Smooth zoom animation helper
  const smoothZoom = useCallback(
    (targetZoom: number, center: { x: number; y: number }, duration = 180) => {
      const container = containerRef.current;
      const startZoom = workspaceZoomRef.current || workspaceZoom;
      if (!container) {
        setWorkspaceZoom(targetZoom);
        return;
      }

      // Avoid scheduling if close enough
      if (Math.abs(targetZoom - startZoom) < 0.0001) {
        setWorkspaceZoom(targetZoom);
        return;
      }

      const start = performance.now();
      const contentX = (container.scrollLeft + center.x) / startZoom;
      const contentY = (container.scrollTop + center.y) / startZoom;

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      let rafId: number;

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = easeOutCubic(t);
        const currentZoom = startZoom + (targetZoom - startZoom) * eased;

        // Update zoom state and scroll to keep focal point
        setWorkspaceZoom(currentZoom);

        const newScrollLeft = Math.max(
          0,
          Math.round(contentX * currentZoom - center.x),
        );
        const newScrollTop = Math.max(
          0,
          Math.round(contentY * currentZoom - center.y),
        );

        container.scrollLeft = newScrollLeft;
        container.scrollTop = newScrollTop;

        const c = fabricRef.current;
        if (c) {
          c.calcOffset();
          c.requestRenderAll();
        }

        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          // final snap
          setWorkspaceZoom(targetZoom);
          container.scrollLeft = Math.max(
            0,
            Math.round(contentX * targetZoom - center.x),
          );
          container.scrollTop = Math.max(
            0,
            Math.round(contentY * targetZoom - center.y),
          );
          if (c) {
            c.calcOffset();
            c.renderAll();
          }
        }
      };

      rafId = requestAnimationFrame(step);

      // Return cancel function if needed
      return () => cancelAnimationFrame(rafId);
    },
    [workspaceZoom],
  );

  useEffect(() => {
    manualGuidesRef.current = manualGuides;
  }, [manualGuides]);

  useEffect(() => {
    snapEnabledRef.current = snapEnabled;
  }, [snapEnabled]);

  useEffect(() => {
    rulersEnabledRef.current = rulersEnabled;
  }, [rulersEnabled]);

  const clearGuideOverlay = useCallback(() => {
    setGuides([]);
    setGuideBadges([]);
  }, []);

  useEffect(() => {
    if (!snapEnabled) {
      clearGuideOverlay();
    }
  }, [clearGuideOverlay, snapEnabled]);

  const updateGuideOverlay = useCallback(
    (target: FabricObject) => {
      if (!canvas) return;

      const currentCanvas = canvas as FabricCanvas;
      const targetRect = getBoundingRectSafe(target);
      const manualGuides = rulersEnabledRef.current
        ? manualGuidesRef.current
        : [];

      const otherRects = currentCanvas
        .getObjects()
        .filter((obj: FabricObject) => obj !== target)
        .map((obj: FabricObject) => getBoundingRectSafe(obj));

      const verticalCandidates = buildAxisCandidates(
        otherRects,
        dimensions.width,
        "vertical",
        manualGuides,
      );
      const horizontalCandidates = buildAxisCandidates(
        otherRects,
        dimensions.height,
        "horizontal",
        manualGuides,
      );

      const verticalTargets: AxisTarget[] = [
        { label: "start", position: targetRect.left },
        { label: "center", position: targetRect.centerX },
        { label: "end", position: targetRect.right },
      ];

      const horizontalTargets: AxisTarget[] = [
        { label: "start", position: targetRect.top },
        { label: "center", position: targetRect.centerY },
        { label: "end", position: targetRect.bottom },
      ];

      const verticalMatch = evaluateAxis(
        verticalTargets,
        verticalCandidates,
        SNAP_THRESHOLD,
        GUIDE_DISPLAY_THRESHOLD,
      );
      const horizontalMatch = evaluateAxis(
        horizontalTargets,
        horizontalCandidates,
        SNAP_THRESHOLD,
        GUIDE_DISPLAY_THRESHOLD,
      );

      const nextGuides: GuideLine[] = [];
      const nextBadges: GuideBadge[] = [];

      let deltaX = 0;
      let deltaY = 0;

      if (verticalMatch.bestDisplay) {
        const linePos = verticalMatch.bestDisplay.candidate.position;
        nextGuides.push({
          id: `v-${linePos}-${verticalMatch.bestDisplay.target.label}`,
          orientation: "vertical",
          position: linePos,
          kind: verticalMatch.bestSnap ? "snap" : "measure",
        });
        nextBadges.push({
          id: `vb-${linePos}-${verticalMatch.bestDisplay.target.label}`,
          orientation: "vertical",
          position: linePos,
          label: formatDistance(verticalMatch.bestDisplay.abs),
        });
      }

      if (horizontalMatch.bestDisplay) {
        const linePos = horizontalMatch.bestDisplay.candidate.position;
        nextGuides.push({
          id: `h-${linePos}-${horizontalMatch.bestDisplay.target.label}`,
          orientation: "horizontal",
          position: linePos,
          kind: horizontalMatch.bestSnap ? "snap" : "measure",
        });
        nextBadges.push({
          id: `hb-${linePos}-${horizontalMatch.bestDisplay.target.label}`,
          orientation: "horizontal",
          position: linePos,
          label: formatDistance(horizontalMatch.bestDisplay.abs),
        });
      }

      if (snapEnabledRef.current && verticalMatch.bestSnap) {
        deltaX = verticalMatch.bestSnap.delta;
      }

      if (snapEnabledRef.current && horizontalMatch.bestSnap) {
        deltaY = horizontalMatch.bestSnap.delta;
      }

      if (deltaX || deltaY) {
        applySnapDelta(target, targetRect, deltaX, deltaY);
      } else {
        target.setCoords();
      }

      setGuides(nextGuides);
      setGuideBadges(nextBadges);
      currentCanvas.renderAll();
    },
    [canvas, dimensions.height, dimensions.width],
  );

  const getCanvasPointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return null;

      const rect = canvasEl.getBoundingClientRect();
      const zoom = workspaceZoomRef.current || 1;
      return {
        x: clampToRange((clientX - rect.left) / zoom, 0, dimensions.width),
        y: clampToRange((clientY - rect.top) / zoom, 0, dimensions.height),
      };
    },
    [dimensions.height, dimensions.width],
  );

  const addManualGuide = useCallback((guide: GuideLine) => {
    setManualGuides((prev) => [
      ...prev.filter((item) => item.id !== guide.id),
      guide,
    ]);
  }, []);

  const startGuideDrag = useCallback(
    (orientation: GuideOrientation, event: React.MouseEvent) => {
      if (!rulersEnabledRef.current) return;
      event.preventDefault();
      event.stopPropagation();

      const point = getCanvasPointFromClient(event.clientX, event.clientY);
      if (!point) return;

      const position = orientation === "vertical" ? point.x : point.y;
      const dragState = { orientation, position };
      guideDragRef.current = dragState;
      setGuideDragState(dragState);
      setGuideBadges([]);
      setGuides([
        {
          id: "guide-preview",
          orientation,
          position,
          kind: "manual",
          label: `${Math.round(position)}px`,
        },
      ]);
    },
    [getCanvasPointFromClient],
  );

  useEffect(() => {
    if (!guideDragState) return;

    const handleMove = (event: MouseEvent) => {
      const point = getCanvasPointFromClient(event.clientX, event.clientY);
      if (!point || !guideDragRef.current) return;

      const nextPosition =
        guideDragRef.current.orientation === "vertical" ? point.x : point.y;
      guideDragRef.current = {
        ...guideDragRef.current,
        position: nextPosition,
      };
      setGuides([
        {
          id: "guide-preview",
          orientation: guideDragRef.current.orientation,
          position: nextPosition,
          kind: "manual",
          label: `${Math.round(nextPosition)}px`,
        },
      ]);
    };

    const handleUp = () => {
      const dragState = guideDragRef.current;
      if (dragState) {
        addManualGuide({
          id: `manual-${Date.now()}`,
          orientation: dragState.orientation,
          position: dragState.position,
          kind: "manual",
        });
      }

      guideDragRef.current = null;
      setGuideDragState(null);
      clearGuideOverlay();
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    addManualGuide,
    clearGuideOverlay,
    getCanvasPointFromClient,
    guideDragState,
  ]);

  useEffect(() => {
    // Keep ref in sync to use in event handlers
    workspaceZoomRef.current = workspaceZoom;

    if (canvas && fabricRef.current) {
      const c = fabricRef.current;

      // REVERTIDO PARA ZOOM PADRÃO DO FABRIC
      // O modo "CSS Zoom" estava causando bugs de proporção e espaçamento.
      // Agora usamos controle nativo de zoom e dimensions com devicePixelRatio

      // Ensure the internal canvas backing store matches base dimensions (no scaling)
      c.setDimensions(
        {
          width: Math.round(dimensions.width),
          height: Math.round(dimensions.height),
        },
        { cssOnly: false },
      );

      // Compute device pixel ratio and apply high-quality backing store + viewport transform
      const DPR = Math.max(1, Math.round(window.devicePixelRatio || 1));

      // Backing store should be scaled by DPR * workspaceZoom for crisp visuals
      const backingWidth = Math.round(dimensions.width * DPR * workspaceZoom);
      const backingHeight = Math.round(dimensions.height * DPR * workspaceZoom);

      // set backing store only
      c.setDimensions(
        {
          width: backingWidth,
          height: backingHeight,
        },
        { backstoreOnly: true },
      );

      // Update CSS display size so the wrapper/scroll area matches current zoom.
      c.setDimensions(
        {
          width: Math.round(dimensions.width * workspaceZoom),
          height: Math.round(dimensions.height * workspaceZoom),
        },
        { cssOnly: true },
      );

      // Set viewport transform to map backing store -> css correctly (scale = DPR * workspaceZoom)
      try {
        (c as any).setViewportTransform([
          DPR * workspaceZoom,
          0,
          0,
          DPR * workspaceZoom,
          0,
          0,
        ]);
      } catch (err) {
        // ignore
      }

      // Recalcular offsets e viewports para garantir cliques precisos
      c.calcOffset();
      if ((c as any).calcViewportBoundaries)
        (c as any).calcViewportBoundaries();

      // Se estivermos editando um textbox, reentrar na edição para corrigir caret/posição após zoom
      const active = (c as any).getActiveObject?.() as any;
      if (active && active.type === "textbox" && active.isEditing) {
        try {
          const selStart = active.selectionStart;
          const selEnd = active.selectionEnd;
          active.exitEditing();
          active.enterEditing();
          active.selectionStart = selStart;
          active.selectionEnd = selEnd;
        } catch (e) {
          // ignore
        }
      }

      const objects = c.getObjects();
      objects.forEach((obj: any) => {
        if (obj.setCoords) obj.setCoords();
      });

      c.requestRenderAll();

      // Adicionar um timeout adicional para recalcular offsets após o render
      setTimeout(() => {
        c.calcOffset();
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
          setDimensions({
            width: Math.round(layout.width),
            height: Math.round(layout.height),
          });
          setProductionTime(layout.productionTime || 0);

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
          enableRetinaScaling: false, // Desativar para gerenciar DPI manualmente e evitar desalinhamentos
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

        activeCanvas.on("object:added", handleCanvasModified);
        activeCanvas.on("object:removed", handleCanvasModified);
        activeCanvas.on("path:created", handleCanvasModified);
        activeCanvas.on("object:modified", () => {
          clearGuideOverlay();
          handleCanvasModified();
        });
        activeCanvas.on("object:scaling", (e: any) => {
          const target = e?.target as FabricObject | undefined;
          if (target) updateGuideOverlay(target);
        });
        activeCanvas.on("object:moving", (e: any) => {
          const target = e?.target as FabricObject | undefined;
          if (target) updateGuideOverlay(target);
        });

        activeCanvas.on("selection:created", handleSelection);
        activeCanvas.on("selection:updated", handleSelection);
        activeCanvas.on("selection:cleared", () => {
          setSelectedObject(null);
          clearGuideOverlay();
        });

        activeCanvas.on("mouse:dblclick", handleDoubleClick);

        // Garantir que cliques em Textboxes selecionem a caixa primeiro
        activeCanvas.on("mouse:down", (opt: any) => {
          const c = fabricRef.current;
          const target = opt.target;
          if (c) {
            if (target && target.type === "textbox" && !target.isEditing) {
              c.setActiveObject(target);
            }
            // Recalcular offset em cada mouse down para evitar desalinhamentos
            c.calcOffset();
          }
        });

        // Atualizar posição do ponteiro em movimento para centralizar zoom no mouse
        activeCanvas.on("mouse:move", (opt: any) => {
          if (opt && opt.pointer) {
            lastPointerRef.current = opt.pointer;
          }
        });

        // Capture wheel but prevent Fabric zoom — we'll handle zoom in the container to keep scroll behavior
        activeCanvas.on("mouse:wheel", (opt: any) => {
          if (!opt || !opt.e) return;
          if (opt.e.ctrlKey) {
            opt.e.preventDefault();
            opt.e.stopPropagation();
            // Capture pointer to be used by the container handler
            if (opt.pointer) lastPointerRef.current = opt.pointer;
          }
        });

        // Adicionar evento after:render para recalcular offsets dinamicamente
        activeCanvas.on("after:render", () => {
          const c = fabricRef.current;
          if (c) c.calcOffset();
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
                obj.set("padding", 10); // Reduzido ligeiramente para facilitar seleção interna
                obj.set("editable", false);
                obj.set("perPixelTargetFind", false); // Mudado para false: torna a bounding box inteira clicável, resolvendo seleção só no texto
                obj.set("breakWords", true);
                obj.set("wrap", "word");
                obj.set("hoverCursor", "move");
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

            // Re-run textbox init after a tick to ensure fonts/DPR have settled
            setTimeout(async () => {
              if (!activeCanvas) return;

              try {
                await Promise.race([
                  (document as any).fonts?.ready || Promise.resolve(),
                  new Promise((r) => setTimeout(r, 800)),
                ]);
              } catch (err) {
                // ignore
              }

              activeCanvas.getObjects().forEach((o: any) => {
                if (o.type === "textbox") {
                  // preserve center while initDimensions can change width/height
                  let center: { x: number; y: number } | null = null;
                  try {
                    center = o.getCenterPoint ? o.getCenterPoint() : null;
                  } catch (err) {
                    center = null;
                  }

                  if (typeof o.padding === "undefined") o.set("padding", 10);
                  try {
                    if (o.initDimensions) o.initDimensions();
                  } catch (e) {
                    /* ignore */
                  }

                  if (center && o.setPositionByOrigin) {
                    try {
                      o.setPositionByOrigin(center, "center", "center");
                    } catch (err) {
                      // ignore
                    }
                  }

                  if (o.setCoords) o.setCoords();
                }
              });
              // Ensure canvas offsets are recalculated after dimension updates
              activeCanvas.calcOffset();
              activeCanvas.renderAll();
            }, 0);

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
      await loadGoogleFont(fontFamily);
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
      // Quebra de linha por palavra e prevenção de overflow
      wordWrap: true,
      breakWords: true, // Quebra palavras longas para evitar sair da caixa
      wrap: "word",
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
      perPixelTargetFind: false, // Mudado para false: torna a bounding box inteira clicável
      hoverCursor: "move", // Cursor de movimento ao hover
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
            previewImageUrl = await createDesignPreviewDataUrl(
              currentCanvas,
              dimensions.width,
              dimensions.height,
              1,
            );
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
          productionTime,
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
    [
      canvas,
      layoutId,
      designName,
      dimensions.width,
      dimensions.height,
      productionTime,
    ],
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

      // Preload fonts referenced in this history state to avoid reflow/caret problems
      await preloadFontsFromState(json);

      await c.loadFromJSON(JSON.parse(json));

      // Re-init textboxes and offsets to ensure dimensions and pointer mapping are correct
      c.getObjects().forEach((obj: any) => {
        if (obj.type === "textbox") {
          try {
            obj.initDimensions && obj.initDimensions();
          } catch (e) {
            /* ignore */
          }
          if (typeof obj.padding === "undefined") obj.set("padding", 10);
        }
        obj.set("objectCaching", false);
        obj.setCoords && obj.setCoords();
      });
      c.calcOffset();
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

      // Preload fonts for this state before restoring
      await preloadFontsFromState(json);

      await c.loadFromJSON(JSON.parse(json));

      // Re-init textboxes and offsets
      c.getObjects().forEach((obj: any) => {
        if (obj.type === "textbox") {
          try {
            obj.initDimensions && obj.initDimensions();
          } catch (e) {
            /* ignore */
          }
          if (typeof obj.padding === "undefined") obj.set("padding", 10);
        }
        obj.set("objectCaching", false);
        obj.setCoords && obj.setCoords();
      });
      c.calcOffset();
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
      const cloned = await (selectedObject as FabricObject).clone(CLONE_PROPS);
      const newId = generateId();
      cloned.set("left", (selectedObject as FabricObject).left + 15);
      cloned.set("top", (selectedObject as FabricObject).top + 15);
      cloned.set("id", newId);
      (cloned as any).objectId = newId;

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
      const highQualityImage = await createDesignPreviewDataUrl(
        currentCanvas,
        dimensions.width,
        dimensions.height,
        5,
      );

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
      // Load the font and re-initialize dimensions after it has loaded to ensure proper wrapping
      loadGoogleFont(value).then(() => {
        if ((selectedObject as any).type === "textbox") {
          (selectedObject as any).initDimensions();
        }
        (selectedObject as FabricObject).setCoords();
        (canvas as FabricCanvas)?.renderAll();
        setIsDirty(true);
        triggerAutoSave();
        setUpdateNonce((prev) => prev + 1);
      });
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

    // Se a moldura teve rotação alterada, aplicar a mesma rotação às imagens vinculadas
    if ((selectedObject as any).isFrame && key === "angle") {
      const frameAngle = value as number;
      const allObjects = (canvas as FabricCanvas).getObjects();
      const frameId = (selectedObject as any).id;

      // Atualizar todas as imagens vinculadas a esta moldura
      allObjects.forEach((obj: any) => {
        if (obj.linkedFrameId === frameId && obj.type === "image") {
          obj.set("angle", frameAngle);
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
    let wheelHandler: ((e: WheelEvent) => void) | undefined;
    if (container) {
      container.addEventListener("scroll", handleScroll);

      // Attach non-passive wheel listener to allow preventDefault
      wheelHandler = (ev: WheelEvent) => {
        if (!(ev.ctrlKey || ev.metaKey)) return;
        ev.preventDefault();

        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        const rect = canvasEl.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;

        const oldZoom = workspaceZoomRef.current || workspaceZoom;
        const delta = ev.deltaY;
        const newZoom = clamp(oldZoom * 0.999 ** delta, 0.1, 5);

        const relX = container.scrollLeft + x;
        const relY = container.scrollTop + y;

        const newScrollLeft = Math.max(
          0,
          Math.round((relX / oldZoom) * newZoom - x),
        );
        const newScrollTop = Math.max(
          0,
          Math.round((relY / oldZoom) * newZoom - y),
        );

        // Apply new zoom smoothly
        smoothZoom(newZoom, { x, y });
      };

      container.addEventListener("wheel", wheelHandler, { passive: false });
    }
    window.addEventListener("resize", handleScroll);

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
        if (wheelHandler)
          container.removeEventListener("wheel", wheelHandler as EventListener);
      }
      window.removeEventListener("resize", handleScroll);
    };
  }, [canvas, workspaceZoom, smoothZoom]);

  const handleWorkspaceWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;

    e.preventDefault();

    const container = containerRef.current;
    const canvasEl = canvasRef.current;
    if (!container || !canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const oldZoom = workspaceZoomRef.current || workspaceZoom;
    const delta = e.deltaY;
    const newZoom = clamp(oldZoom * 0.999 ** delta, 0.1, 5);

    // Compute scroll so the point under the cursor stays fixed
    const relX = container.scrollLeft + x;
    const relY = container.scrollTop + y;

    const newScrollLeft = Math.max(
      0,
      Math.round((relX / oldZoom) * newZoom - x),
    );
    const newScrollTop = Math.max(
      0,
      Math.round((relY / oldZoom) * newZoom - y),
    );

    // Apply the zoom (updates CSS size through React state)
    setWorkspaceZoom(newZoom);

    // After React updates the DOM, apply the new scroll to keep the focal point
    setTimeout(() => {
      container.scrollLeft = newScrollLeft;
      container.scrollTop = newScrollTop;

      const c = fabricRef.current;
      if (c) {
        c.calcOffset();
        c.requestRenderAll();
      }
    }, 0);
  };

  const canvasCssWidth = Math.round(dimensions.width * workspaceZoom);
  const canvasCssHeight = Math.round(dimensions.height * workspaceZoom);
  const rulerOffset = rulersEnabled ? RULER_SIZE : 0;
  const stageWidth = canvasCssWidth + rulerOffset;
  const stageHeight = canvasCssHeight + rulerOffset;
  const visibleGuides = rulersEnabled
    ? [...manualGuides, ...guides]
    : [...guides];

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
        snapEnabled={snapEnabled}
        onSnapEnabledChange={setSnapEnabled}
        rulersEnabled={rulersEnabled}
        onRulersEnabledChange={setRulersEnabled}
        saving={saving}
        loading={loading}
        user={user}
        isDirty={isDirty}
        productionTime={productionTime}
        setProductionTime={(time) => {
          setProductionTime(time);
          setIsDirty(true);
          triggerAutoSave();
        }}
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
        >
          <div
            ref={stageRef}
            className="relative shrink-0"
            style={{
              width: `${stageWidth}px`,
              height: `${stageHeight}px`,
            }}
          >
            {rulersEnabled && (
              <>
                <div
                  className="absolute left-0 top-0 z-30 flex h-6 w-full select-none overflow-hidden border-b border-r border-neutral-700 bg-neutral-950/95 text-[9px] text-neutral-400"
                  onMouseDown={(e) => startGuideDrag("vertical", e)}
                >
                  <div
                    className="relative h-full shrink-0 border-r border-neutral-700 bg-neutral-950/95"
                    style={{ width: `${RULER_SIZE}px` }}
                  />
                  <div className="relative h-full flex-1">
                    {Array.from({
                      length: Math.ceil(dimensions.width / 10) + 1,
                    }).map((_, idx) => {
                      const step = idx * 10;
                      const isMajor = step % 50 === 0;
                      const label =
                        step % 100 === 0 ? `${Math.round(step)}px` : "";
                      return (
                        <div
                          key={`top-tick-${step}`}
                          className="absolute bottom-0 flex flex-col items-center"
                          style={{
                            left: `${step * workspaceZoom}px`,
                          }}
                        >
                          <span
                            className={`w-px bg-neutral-500 ${
                              isMajor ? "h-4" : "h-2"
                            }`}
                          />
                          {label && (
                            <span className="mb-0.5 translate-y-0.5 whitespace-nowrap text-[8px] text-neutral-500">
                              {label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="absolute left-0 top-0 z-30 flex h-full w-6 select-none flex-col overflow-hidden border-r border-neutral-700 bg-neutral-950/95 text-[9px] text-neutral-400"
                  style={{ top: `${RULER_SIZE}px` }}
                  onMouseDown={(e) => startGuideDrag("horizontal", e)}
                >
                  {Array.from({
                    length: Math.ceil(dimensions.height / 10) + 1,
                  }).map((_, idx) => {
                    const step = idx * 10;
                    const isMajor = step % 50 === 0;
                    const label =
                      step % 100 === 0 ? `${Math.round(step)}px` : "";
                    return (
                      <div
                        key={`left-tick-${step}`}
                        className="absolute left-0 flex items-center"
                        style={{
                          top: `${step * workspaceZoom}px`,
                        }}
                      >
                        <span
                          className={`h-px bg-neutral-500 ${
                            isMajor ? "w-4" : "w-2"
                          }`}
                        />
                        {label && (
                          <span className="ml-0.5 -translate-y-0.5 whitespace-nowrap text-[8px] text-neutral-500">
                            {label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div
              className={styles.designCanvas}
              style={
                {
                  "--design-width": `${canvasCssWidth}px`,
                  "--design-height": `${canvasCssHeight}px`,
                  transform: "none",
                  transformOrigin: "center center",
                  transition: "none",
                  marginLeft: `${rulerOffset}px`,
                  marginTop: `${rulerOffset}px`,
                } as unknown as React.CSSProperties
              }
            >
              <canvas ref={canvasRef} />
            </div>

            <div className="pointer-events-none absolute inset-0 z-20">
              {visibleGuides.map((guide) => {
                const isVertical = guide.orientation === "vertical";
                const color =
                  guide.kind === "manual" ? MANUAL_GUIDE_COLOR : GUIDE_COLOR;
                const linePos = rulerOffset + guide.position * workspaceZoom;

                return (
                  <div key={guide.id}>
                    <div
                      className="absolute"
                      style={
                        isVertical
                          ? {
                              left: `${linePos}px`,
                              top: `${rulerOffset}px`,
                              height: `${canvasCssHeight}px`,
                              borderLeft: `2px dashed ${color}`,
                            }
                          : {
                              left: `${rulerOffset}px`,
                              top: `${linePos}px`,
                              width: `${canvasCssWidth}px`,
                              borderTop: `2px dashed ${color}`,
                            }
                      }
                    />
                    {guide.label && (
                      <div
                        className="absolute rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-lg backdrop-blur-sm"
                        style={
                          isVertical
                            ? {
                                left: `${linePos}px`,
                                top: `${rulerOffset + 6}px`,
                                transform: "translateX(-50%)",
                                backgroundColor: "rgba(17, 24, 39, 0.92)",
                                borderColor: color,
                                color: "#fff",
                              }
                            : {
                                left: `${rulerOffset + 6}px`,
                                top: `${linePos}px`,
                                transform: "translateY(-50%)",
                                backgroundColor: "rgba(17, 24, 39, 0.92)",
                                borderColor: color,
                                color: "#fff",
                              }
                        }
                      >
                        {guide.label}
                      </div>
                    )}
                  </div>
                );
              })}

              {guideBadges.map((badge) => {
                const isVertical = badge.orientation === "vertical";
                const linePos = rulerOffset + badge.position * workspaceZoom;

                return (
                  <div
                    key={badge.id}
                    className="absolute rounded-full border border-pink-300 bg-pink-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg"
                    style={
                      isVertical
                        ? {
                            left: `${linePos}px`,
                            top: `${rulerOffset + 26}px`,
                            transform: "translateX(-50%)",
                          }
                        : {
                            left: `${rulerOffset + 26}px`,
                            top: `${linePos}px`,
                            transform: "translateY(-50%)",
                          }
                    }
                  >
                    {badge.label}
                  </div>
                );
              })}
            </div>
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
