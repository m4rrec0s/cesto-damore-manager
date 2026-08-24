import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  Minus,
  Upload,
  Crop,
  XCircle,
  X,
  GripVertical,
  Type,
  AlertCircle,
  Loader2,
  WifiOff,
  Wifi,
  Printer,
  CheckCheck,
  RefreshCw,
  Image as ImageIcon,
  Send,
  MapPin,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/services/api";
import placeholderImg from "../assets/placeholder.png";

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

// Carrega todas as fontes referenciadas num estado do Fabric (ou JSON string)
const preloadFontsFromState = async (stateOrJson: any) => {
  try {
    const state =
      typeof stateOrJson === "string" ? JSON.parse(stateOrJson) : stateOrJson;
    if (!state || !state.objects) return;
    const fonts = new Set<string>();
    state.objects.forEach((obj: any) => {
      if (obj.fontFamily && obj.fontFamily !== "Arial") fonts.add(obj.fontFamily);
    });
    if (fonts.size > 0) {
      await Promise.all(Array.from(fonts).map((f) => loadGoogleFont(f)));
    }
  } catch (e) {
    // ignore parsing errors
    return;
  }
};

const addFramePlaceholdersToExport = async (
  exportCanvas: FabricCanvas,
) => {
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


interface LayoutSlot {
  id: string;
  label: string;
  position?: Record<string, unknown>;
  width?: number;
  height?: number;
  required: boolean;
  pageId?: string;
  pageIndex?: number;
}

interface DynamicLayoutOption {
  id: string;
  name: string;
  type?: string;
  previewImageUrl?: string | null;
  baseImageUrl?: string | null;
  fabricJsonState?: object | null;
  width?: number;
  height?: number;
  slots?: LayoutSlot[];
}

// Extrai os canvasState de cada página do layout (layouts multi-página guardam a arte
// em pages[].canvasState; layouts legados têm os objetos na raiz).
const getLayoutPageStates = (layout: DynamicLayoutOption): any[] => {
  const state =
    typeof layout.fabricJsonState === "string"
      ? JSON.parse(layout.fabricJsonState as unknown as string)
      : layout.fabricJsonState;
  if (!state) return [];
  if (Array.isArray(state.pages) && state.pages.length > 0) {
    return state.pages.map((p: any) => p?.canvasState ?? p);
  }
  return [state];
};

const getSlotAspect = (slot?: LayoutSlot): number | undefined => {
  if (!slot) return undefined;

  const position = slot.position || {};
  const width = Number(
    slot.width ?? position.width ?? position.w ?? position.frameWidth ?? position.frame_width,
  );
  const height = Number(
    slot.height ?? position.height ?? position.h ?? position.frameHeight ?? position.frame_height,
  );

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return width / height;
};

interface TextOptions {
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  underline?: boolean;
  textAlign?: string;
  fill?: string;
  charSpacing?: number;
  lineHeight?: number;
}

type JobStatus = "PENDING" | "SENT" | "RECEIVED" | "PRINTING" | "PRINTED" | "FAILED" | null;

const statusLabels: Record<Exclude<JobStatus, null>, string> = {
  PENDING: "Enfileirando...",
  SENT: "Enviado para o agente",
  RECEIVED: "Agente recebeu",
  PRINTING: "Imprimindo",
  PRINTED: "Impresso com sucesso",
  FAILED: "Falha na impressão",
};

/* ─── Crop Dialog ──────────────────────────────────────────────────────── */

type CropRect = { x: number; y: number; width: number; height: number };

function CropDialog({
  src,
  aspect,
  onApply,
  onClose,
}: {
  src: string;
  aspect?: number;
  onApply: (cropped: Blob) => void;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 100, height: 100 });
  const [dragMode, setDragMode] = useState<"draw" | "move" | "resize-ne" | "resize-se" | "resize-sw" | "resize-nw" | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState<CropRect | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaSize, setAreaSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setAreaSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clampCrop = (next: CropRect): CropRect => {
    const width = Math.max(1, Math.min(next.width, naturalSize.w));
    const height = Math.max(1, Math.min(next.height, naturalSize.h));
    return {
      x: Math.max(0, Math.min(next.x, naturalSize.w - width)),
      y: Math.max(0, Math.min(next.y, naturalSize.h - height)),
      width,
      height,
    };
  };

  const buildInitialCrop = (nw: number, nh: number): CropRect => {
    if (!aspect || aspect <= 0) return { x: 0, y: 0, width: nw, height: nh };

    const imageAspect = nw / nh;
    let width = nw;
    let height = nh;

    if (imageAspect > aspect) {
      height = nh;
      width = height * aspect;
    } else {
      width = nw;
      height = width / aspect;
    }

    return {
      x: (nw - width) / 2,
      y: (nh - height) / 2,
      width,
      height,
    };
  };

  const handleLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setNaturalSize({ w: nw, h: nh });
    const rect = img.getBoundingClientRect();
    setDisplaySize({ w: rect.width, h: rect.height });
    setCrop(buildInitialCrop(nw, nh));
  };

  const toNatural = (clientX: number, clientY: number) => {
    const rect = imgRef.current?.getBoundingClientRect();
    const width = rect?.width || displaySize.w || 1;
    const height = rect?.height || displaySize.h || 1;
    const left = rect?.left || 0;
    const top = rect?.top || 0;

    return {
      x: Math.max(0, Math.min(naturalSize.w, ((clientX - left) / width) * naturalSize.w)),
      y: Math.max(0, Math.min(naturalSize.h, ((clientY - top) / height) * naturalSize.h)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = toNatural(e.clientX, e.clientY);
    setDragMode("draw");
    setDragStart(p);
    setStartCrop(null);
    setCrop({ x: p.x, y: p.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragMode) return;
    const p = toNatural(e.clientX, e.clientY);

    if (dragMode === "move" && startCrop) {
      setCrop(
        clampCrop({
          ...startCrop,
          x: startCrop.x + p.x - dragStart.x,
          y: startCrop.y + p.y - dragStart.y,
        }),
      );
      return;
    }

    // Resize modes
    if (dragMode?.startsWith("resize-") && startCrop) {
      let newCrop = { ...startCrop };
      const dx = p.x - dragStart.x;
      const dy = p.y - dragStart.y;

      if (dragMode === "resize-se") {
        newCrop.width = Math.max(1, startCrop.width + dx);
        newCrop.height = Math.max(1, startCrop.height + dy);
      } else if (dragMode === "resize-sw") {
        newCrop.x = Math.max(0, startCrop.x + dx);
        newCrop.width = Math.max(1, startCrop.width - dx);
        newCrop.height = Math.max(1, startCrop.height + dy);
      } else if (dragMode === "resize-ne") {
        newCrop.y = Math.max(0, startCrop.y + dy);
        newCrop.width = Math.max(1, startCrop.width + dx);
        newCrop.height = Math.max(1, startCrop.height - dy);
      } else if (dragMode === "resize-nw") {
        newCrop.x = Math.max(0, startCrop.x + dx);
        newCrop.y = Math.max(0, startCrop.y + dy);
        newCrop.width = Math.max(1, startCrop.width - dx);
        newCrop.height = Math.max(1, startCrop.height - dy);
      }

      if (aspect && aspect > 0) {
        const currentAspect = newCrop.width / newCrop.height;
        if (Math.abs(currentAspect - aspect) > 0.01) {
          if (dragMode === "resize-se") {
            newCrop.height = newCrop.width / aspect;
          } else if (dragMode === "resize-sw") {
            newCrop.height = newCrop.width / aspect;
          } else if (dragMode === "resize-ne") {
            newCrop.width = newCrop.height * aspect;
          } else if (dragMode === "resize-nw") {
            newCrop.width = newCrop.height * aspect;
          }
        }
      }

      setCrop(clampCrop(newCrop));
      return;
    }

    const rawW = Math.abs(p.x - dragStart.x);
    const rawH = Math.abs(p.y - dragStart.y);
    let w = rawW;
    let h = rawH;

    if (aspect && aspect > 0 && rawW > 0 && rawH > 0) {
      if (rawW / rawH > aspect) {
        w = rawH * aspect;
      } else {
        h = rawW / aspect;
      }
    }

    const x = p.x >= dragStart.x ? dragStart.x : dragStart.x - w;
    const y = p.y >= dragStart.y ? dragStart.y : dragStart.y - h;
    setCrop(clampCrop({ x, y, width: w, height: h }));
  };

  const handleMouseUp = () => {
    setDragMode(null);
    setStartCrop(null);
  };

  const handleMoveStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode("move");
    setDragStart(toNatural(e.clientX, e.clientY));
    setStartCrop(crop);
  };

  const applyCrop = async () => {
    const img = imgRef.current;
    if (!img || crop.width < 1 || crop.height < 1) return;
    const c = document.createElement("canvas");
    c.width = crop.width;
    c.height = crop.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    onApply(blob);
  };

  const cropOverlay = {
    left: `${(crop.x / naturalSize.w) * 100}%`,
    top: `${(crop.y / naturalSize.h) * 100}%`,
    width: `${(crop.width / naturalSize.w) * 100}%`,
    height: `${(crop.height / naturalSize.h) * 100}%`,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 flex h-[min(760px,calc(100dvh-2rem))] w-[min(900px,calc(100vw-2rem))] flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Recortar imagem</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          ref={areaRef}
          className="relative mb-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-950 cursor-crosshair select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="relative max-h-full max-w-full">
            <img
              ref={imgRef}
              src={src}
              onLoad={handleLoad}
              className="block object-contain"
              style={{
                maxWidth: areaSize.w > 0 ? areaSize.w : undefined,
                maxHeight: areaSize.h > 0 ? areaSize.h : undefined,
              }}
              alt="Crop"
              draggable={false}
            />
            {naturalSize.w > 0 && (
              <>
                <div
                  className={`absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]`}
                  style={cropOverlay}
                  onMouseDown={handleMoveStart}
                >
                  <div className="absolute inset-0 border border-dashed border-white/60" />
                  <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white">
                    <GripVertical className="h-3 w-3" />
                    Mover
                  </div>

                  {/* Resize handles */}
                  {[
                    { corner: "nw", cursor: "nwse-resize", top: "-4px", left: "-4px" },
                    { corner: "ne", cursor: "nesw-resize", top: "-4px", right: "-4px" },
                    { corner: "sw", cursor: "nesw-resize", bottom: "-4px", left: "-4px" },
                    { corner: "se", cursor: "nwse-resize", bottom: "-4px", right: "-4px" },
                  ].map(({ corner, cursor, ...pos }) => (
                    <div
                      key={corner}
                      className="absolute h-2 w-2 rounded-full bg-white shadow-lg hover:h-3 hover:w-3 transition-all"
                      style={{
                        cursor,
                        ...pos,
                        transform: "translate(-50%, -50%)",
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragMode(`resize-${corner}` as any);
                        setDragStart(toNatural(e.clientX, e.clientY));
                        setStartCrop(crop);
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={applyCrop} disabled={crop.width < 1 || crop.height < 1}>
            <Crop className="mr-1 h-4 w-4" />
            Aplicar recorte
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Layout Card (vertical / rectangular) ─────────────────────────────── */

function LayoutCard({
  layout,
  selected,
  onSelect,
}: {
  layout: DynamicLayoutOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-center gap-4 overflow-hidden rounded-xl border-2 bg-white p-3 text-left transition-all duration-200 ${
        selected
          ? "border-rose-500 shadow-md shadow-rose-100 ring-1 ring-rose-200"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {(layout.previewImageUrl || layout.baseImageUrl) && (
          <img
            src={layout.previewImageUrl || layout.baseImageUrl || ""}
            alt={layout.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-semibold text-slate-900">{layout.name}</div>
        <div className="mt-1 text-xs text-slate-500">
          {layout.width && layout.height ? `${layout.width}x${layout.height}` : ""}
          {" "}
          {layout.slots?.length || 0} slot(s)
        </div>
      </div>
      {selected && (
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rose-500">
          <CheckCircle2 className="h-4 w-4 text-white" />
        </div>
      )}
    </button>
  );
}

/* ─── Slot Uploader with Crop ──────────────────────────────────────────── */

function SlotUploader({
  slotId,
  label,
  required,
  file,
  preview,
  onFile,
  onCropOpen,
}: {
  slotId: string;
  label: string;
  required: boolean;
  file?: File;
  preview?: string;
  onFile: (f?: File) => void;
  onCropOpen: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-900">
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </div>
        {file && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCropOpen}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Recortar imagem"
            >
              <Crop className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onFile()}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title="Remover imagem"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <label
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-slate-400 transition-all hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-500`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        {preview ? (
          <img src={preview} alt={label} className="h-40 w-full rounded-lg object-cover object-center shadow-inner" />
        ) : (
          <>
            <Upload className="h-8 w-8 opacity-40" />
            <span className="font-medium">Clique ou arraste</span>
            <span className="text-xs text-slate-300">PNG, JPG ou WebP</span>
          </>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
    </div>
  );
}

/* ─── Text Edit Dialog ─────────────────────────────────────────────────── */

/* ─── Selected Layout Panel ────────────────────────────────────────────── */

function LayoutPanel({
  layout,
  slotFiles,
  slotPreviews,
  slotTextOptions,
  onSlotFile,
  onSlotTextChange,
  onRemoveLayout,
  layoutIndex,
  setCropTarget,
  setSlotPreviews,
  setSlotFiles,
}: {
  layout: DynamicLayoutOption;
  slotFiles: Record<string, File | undefined>;
  slotPreviews: Record<string, string | undefined>;
  slotTextOptions: Record<string, TextOptions>;
  onSlotFile: (layoutId: string, slotId: string, file?: File) => void;
  onSlotTextChange: (layoutId: string, slotId: string, options: TextOptions) => void;
  onRemoveLayout: () => void;
  layoutIndex: number;
  setCropTarget: (target: { layoutId: string; slotId: string } | null) => void;
  setSlotPreviews: (val: any) => void;
  setSlotFiles: (val: any) => void;
}) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // Um canvas Fabric por página do layout (multi-página empilha os previews)
  const pageCanvasesRef = useRef<any[]>([]);
  const [previewReady, setPreviewReady] = useState(false);

  // Retorna os objetos isCustomizable (texto) do fabricJsonState do layout (todas as páginas)
  const getCustomizableTextObjects = (): Array<{ id: string; name: string; label: string; text?: string; maxChars?: number; fontFamily?: string; fontSize?: number }> => {
    const pageStates = getLayoutPageStates(layout);
    const result: Array<{ id: string; name: string; label: string; text?: string; maxChars?: number; fontFamily?: string; fontSize?: number }> = [];
    const seen = new Set<string>();
    for (const pageState of pageStates) {
      const objects = Array.isArray((pageState as any)?.objects) ? (pageState as any).objects as any[] : [];
      for (const obj of objects) {
        const typeNorm = (obj.type || "").toLowerCase();
        if (
          obj.isCustomizable === true &&
          (typeNorm === "i-text" || typeNorm === "textbox" || typeNorm === "text")
        ) {
          const key = obj.id || obj.name;
          if (key && !seen.has(key)) {
            seen.add(key);
            result.push({
              id: key,
              name: obj.name || key,
              label: obj.name || key,
              text: obj.text,
              maxChars: obj.maxChars || 50,
              fontFamily: obj.fontFamily || "Arial",
              fontSize: obj.fontSize || 14
            });
          }
        }
      }
    }
    return result;
  };

  // Inicializa um canvas Fabric por página do fabricJsonState
  useEffect(() => {
    if (!layout.fabricJsonState || !canvasContainerRef.current) return;

    let isMounted = true;

    const initCanvases = async () => {
      try {
        const { Canvas, FabricImage } = await import("fabric");

        if (!isMounted || !canvasContainerRef.current) return;

        // Limpar canvases anteriores
        for (const oldCanvas of pageCanvasesRef.current) {
          try { oldCanvas.dispose(); } catch { /* ignore */ }
        }
        pageCanvasesRef.current = [];

        canvasContainerRef.current.innerHTML = "";

        const w = layout.width || 378;
        const h = layout.height || 567;

        // Calcular zoom para preencher o container
        const containerWidth = canvasContainerRef.current.clientWidth || 400;
        const zoom = Math.min(containerWidth / w, 0.8);

        const pageStates = getLayoutPageStates(layout);

        for (const pageState of pageStates) {
          const canvasEl = document.createElement("canvas");
          canvasContainerRef.current.appendChild(canvasEl);

          const canvas = new Canvas(canvasEl, {
            backgroundColor: "#ffffff",
            selection: false,
            interactive: false,
            preserveObjectStacking: true,
          }) as any;

          // fabric v6: loadFromJSON retorna Promise (o 2º param é reviver por objeto,
          // não callback de conclusão — aguardar a Promise evita processar só o 1º objeto)
          await canvas.loadFromJSON(pageState);

          // IMPORTANTE: loadFromJSON reseta as dimensões lógicas para as do JSON.
          // Aplicar dimensões SEMPRE depois do load, ou só o quadrante superior
          // esquerdo renderiza (slots 2+ somem no preview multi-slot).
          // Dimensões do canvas - usar 2x para qualidade
          canvas.setDimensions(
            { width: w * 2, height: h * 2 },
            { backstoreOnly: true }
          );

          // Dimensões visuais - aplicar zoom
          canvas.setDimensions(
            { width: `${w * zoom}px`, height: `${h * zoom}px` },
            { cssOnly: true }
          );

          canvas.setViewportTransform([2, 0, 0, 2, 0, 0]);

          // Páginas multi-página guardam só os frames no canvasState; a arte vem de previewImageUrl
          const pageHasArt = Array.isArray(pageState?.objects) &&
            pageState.objects.some((o: any) => (o.type || "").toLowerCase() === "image");
          if (!pageHasArt && layout.previewImageUrl) {
            try {
              const baseArt = await (FabricImage as any).fromURL(layout.previewImageUrl, {
                crossOrigin: "anonymous",
              });
              baseArt.set({
                left: 0,
                top: 0,
                originX: "left",
                originY: "top",
                scaleX: w / (baseArt.width || w),
                scaleY: h / (baseArt.height || h),
                selectable: false,
                evented: false,
                objectCaching: false,
                name: "preview-base-art",
              });
              canvas.add(baseArt);
              canvas.sendObjectToBack(baseArt);
            } catch { /* ignora — preview sem arte de fundo */ }
          }

          // Desabilitar qualquer interação e renderizar
          for (const obj of canvas.getObjects() as any[]) {
            obj.set({
              selectable: false,
              evented: false,
              lockMovementX: true,
              lockMovementY: true,
              lockScalingX: true,
              lockScalingY: true,
              lockRotation: true,
              hasControls: false,
              hoverCursor: "default",
            });

            if (obj.isFrame) {
              obj.set({ fill: "transparent", stroke: "transparent", opacity: 0 });
            }
          }

          canvas.renderAll();
          pageCanvasesRef.current.push(canvas);
        }

        if (isMounted) {
          setPreviewReady(true);
        }
      } catch (err) {
        console.error("Erro ao inicializar canvas preview:", err);
      }
    };

    initCanvases();

    return () => {
      isMounted = false;
    };
  }, [layout]);

  // Atualizar preview quando imagens mudam
  useEffect(() => {
    if (pageCanvasesRef.current.length === 0 || !previewReady) return;

    const updatePreview = async () => {
      const { FabricImage, Rect, Circle } = await import("fabric");
      const allSlots = layout.slots || [];

      for (const [pageIndex, canvas] of pageCanvasesRef.current.entries()) {
        const objects = canvas.getObjects() as any[];
        const frames = objects.filter(
          (object: any) =>
            object.isFrame ||
            object.customData?.isFrame ||
            object.name?.toLowerCase().includes("frame"),
        );

        // Limpar imagens antigas
        const oldImages = objects.filter((o: any) => o.name?.startsWith("preview-img-"));
        oldImages.forEach((img: any) => canvas.remove(img));

        // Slots desta página (layouts legados sem pageIndex pertencem à página 0)
        const pageSlots = allSlots
          .map((slot, index) => ({ slot, globalIndex: index }))
          .filter(({ slot }) => (slot.pageIndex ?? 0) === pageIndex);

        // Adicionar novas imagens
        for (const [slotIndex, { slot }] of pageSlots.entries()) {
          const preview = slotPreviews[`${layout.id}:${slot.id}`];
          if (!preview) continue;

          // Encontra o frame correspondente - tenta múltiplas estratégias
          let frame = objects.find((o: any) =>
            o.isFrame && (o.id === slot.id || o.name === slot.label || o.name === slot.id)
          );

          // Se não encontrar por isFrame, procurar por tipo/nome
          if (!frame) {
            frame = objects.find((o: any) =>
              (o.type === "rect" || o.type === "Rect" || o.name?.includes("frame")) &&
              (o.id === slot.id || o.name === slot.label || o.name === slot.id)
            );
          }

          if (!frame) {
            frame = frames[slotIndex];
          }

          if (!frame) {
            console.warn(`⚠️ Frame não encontrado para slot ${slot.id}`);
            continue;
          }

          try {
            const img = await (FabricImage as any).fromURL(preview, {
              crossOrigin: "anonymous",
            });

            const frameRect = frame.getBoundingRect();
            const imgW = img.width || 1;
            const imgH = img.height || 1;
            const coverScale = Math.max(frameRect.width / imgW, frameRect.height / imgH);

            img.set({
              left: frameRect.left + frameRect.width / 2,
              top: frameRect.top + frameRect.height / 2,
              originX: "center",
              originY: "center",
              scaleX: coverScale,
              scaleY: coverScale,
              angle: frame.angle || 0,
              selectable: false,
              evented: false,
              objectCaching: false,
              name: `preview-img-${slot.id}`,
            });

            // Criar clipPath
            try {
              let mask: any;
              if (frame.type === "circle") {
                const Circle_ = Circle;
                mask = new Circle_({
                  radius: frame.radius || frame.width / 2,
                  scaleX: frame.scaleX,
                  scaleY: frame.scaleY,
                  originX: "center",
                  originY: "center",
                  left: frameRect.left + frameRect.width / 2,
                  top: frameRect.top + frameRect.height / 2,
                  angle: frame.angle || 0,
                  absolutePositioned: true,
                });
              } else {
                const Rect_ = Rect;
                mask = new Rect_({
                  width: frame.width,
                  height: frame.height,
                  rx: frame.rx,
                  ry: frame.ry,
                  scaleX: frame.scaleX,
                  scaleY: frame.scaleY,
                  originX: "center",
                  originY: "center",
                  left: frameRect.left + frameRect.width / 2,
                  top: frameRect.top + frameRect.height / 2,
                  angle: frame.angle || 0,
                  absolutePositioned: true,
                });
              }
              img.set("clipPath", mask);
            } catch (err) {
              console.warn("⚠️ Erro ao criar clipPath:", err);
            }

            canvas.add(img);
            canvas.moveObjectTo(img, canvas.getObjects().indexOf(frame) + 1);
          } catch (err) {
            console.error("❌ Erro ao adicionar imagem ao preview:", err);
          }
        }

        // Atualizar textos
        for (const obj of canvas.getObjects() as any[]) {
          if (!obj.isCustomizable) continue;
          if (!["textbox", "i-text", "text"].includes(obj.type?.toLowerCase())) continue;

          const objKey = obj.id || obj.name;
          if (!objKey) continue;
          const textKey = `${layout.id}:${objKey}`;
          const opts = slotTextOptions[textKey];
          if (opts?.text !== undefined) {
            obj.set("text", opts.text);
          }
        }

        canvas.renderAll();
      }
    };

    updatePreview();
  }, [slotPreviews, slotTextOptions, layout, previewReady]);

  const customizableTextObjects = getCustomizableTextObjects();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-xs font-bold text-white`}>
            {layoutIndex + 1}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">{layout.name}</div>
            <div className="text-xs text-slate-500">
              {layout.width && layout.height ? `${layout.width}x${layout.height}` : ""}
              {" "}
              {layout.slots?.length || 0} slot(s)
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemoveLayout}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Remover layout"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      {/* Conteúdo em 2 colunas em desktop, 1 coluna em mobile */}
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        {/* Coluna 1: Preview */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">Preview</div>
          <div className="rounded-lg border border-slate-200 bg-white shadow-inner p-4 flex items-center justify-center">
            <div
              ref={canvasContainerRef}
              className="flex w-full flex-col items-center gap-3 pointer-events-none"
              style={{ touchAction: "none" }}
            />
          </div>
        </div>

        {/* Coluna 2: Inputs de slots e textos */}
        <div className="space-y-5">
          {/* Upload de slots */}
          {(layout.slots || []).length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-3">Fotos</div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                {(layout.slots || []).map((slot) => {
                  const preview = slotPreviews[`${layout.id}:${slot.id}`];
                  const file = slotFiles[`${layout.id}:${slot.id}`];
                  const aspect = getSlotAspect(slot);
                  
                  return (
                    <div key={slot.id} className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-slate-600">
                        {slot.label}
                        {slot.required && <span className="text-rose-500"> *</span>}
                      </label>
                      <div
                        className={`cursor-pointer aspect-square rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all ${
                          preview
                            ? "border-rose-400 bg-rose-50"
                            : "border-dashed border-slate-300 bg-slate-50 hover:border-rose-300"
                        }`}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.onchange = (e) => {
                            const f = (e.target as HTMLInputElement).files?.[0];
                            if (f) {
                              const url = URL.createObjectURL(f);
                              setSlotPreviews((prev: any) => ({ ...prev, [`${layout.id}:${slot.id}`]: url }));
                              setSlotFiles((prev: any) => ({ ...prev, [`${layout.id}:${slot.id}`]: f }));
                              setCropTarget({ layoutId: layout.id, slotId: slot.id });
                            }
                          };
                          input.click();
                        }}
                      >
                        {preview ? (
                          <img src={preview} alt={slot.label} className="w-full h-full object-cover" />
                        ) : (
                          <Upload className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campos de texto isCustomizable */}
          {customizableTextObjects.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Type className="h-4 w-4 text-rose-500" />
                <span className="text-xs font-medium text-slate-600">Textos personalizáveis</span>
              </div>
              <div className="space-y-3">
                {customizableTextObjects.map((obj) => {
                  const key = `${layout.id}:${obj.id}`;
                  const currentText = slotTextOptions[key]?.text ?? obj.text ?? "";
                  const maxChars = obj.maxChars || 50;
                  const isLongText = maxChars > 20;

                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-600">
                          {obj.label}
                        </label>
                        {obj.fontFamily && (
                          <span className="text-[10px] text-slate-400" style={{ fontFamily: obj.fontFamily }}>
                            {obj.fontFamily}
                          </span>
                        )}
                      </div>
                      {isLongText ? (
                        <textarea
                          value={currentText}
                          onChange={(e) =>
                            onSlotTextChange(layout.id, obj.id, {
                              ...(slotTextOptions[key] ?? {}),
                              text: e.target.value.slice(0, maxChars),
                            })
                          }
                          maxLength={maxChars}
                          placeholder={`Digite o texto (máx ${maxChars} caracteres)`}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100 resize-none min-h-20"
                          style={{ fontFamily: obj.fontFamily || "Arial" }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentText}
                          onChange={(e) =>
                            onSlotTextChange(layout.id, obj.id, {
                              ...(slotTextOptions[key] ?? {}),
                              text: e.target.value.slice(0, maxChars),
                            })
                          }
                          maxLength={maxChars}
                          placeholder={`Digite o texto (máx ${maxChars} caracteres)`}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                          style={{ fontFamily: obj.fontFamily || "Arial" }}
                        />
                      )}
                      <div className="text-right text-xs text-slate-400">
                        <span className={currentText.length === maxChars ? "font-medium text-rose-500" : ""}>
                          {currentText.length}/{maxChars}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────── */

export function ManualPrintOrder() {
  const api = useApi();
  const navigate = useNavigate();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [includeSummary, setIncludeSummary] = useState(false);
  const [summaryCustomerEmail, setSummaryCustomerEmail] = useState("");
  const [summaryCustomerPhone, setSummaryCustomerPhone] = useState("");
  const [summaryCustomerDocument, setSummaryCustomerDocument] = useState("");
  const [summaryDeliveryMethod, setSummaryDeliveryMethod] = useState("pickup");
  const [summaryDeliveryAddress, setSummaryDeliveryAddress] = useState("");
  const [summaryDeliveryComplement, setSummaryDeliveryComplement] = useState("");
  const [summaryDeliveryCity, setSummaryDeliveryCity] = useState("");
  const [summaryDeliveryState, setSummaryDeliveryState] = useState("");
  const [summaryDeliveryZipCode, setSummaryDeliveryZipCode] = useState("");
  const [summaryDeliveryRecipientPhone, setSummaryDeliveryRecipientPhone] = useState("");
  const [summaryDeliveryDate, setSummaryDeliveryDate] = useState("");
  const [summaryPaymentOrderMethod, setSummaryPaymentOrderMethod] = useState("pix");
  const [summaryPaymentConfirmedMethod, setSummaryPaymentConfirmedMethod] = useState("pix");
  const [summaryAmountItems, setSummaryAmountItems] = useState("");
  const [summaryAmountShipping, setSummaryAmountShipping] = useState("");
  const [summaryAmountDiscount, setSummaryAmountDiscount] = useState("");
  const [summaryAmountTotal, setSummaryAmountTotal] = useState("");
  const [summaryProductId, setSummaryProductId] = useState("");
  const [summaryProducts, setSummaryProducts] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [storeInfo, setStoreInfo] = useState<{ address: string; mapsUrl: string } | null>(null);
  const [devices, setDevices] = useState<Array<{ deviceId: string; deviceName: string; isDefault: boolean; isActive: boolean }>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [layouts, setLayouts] = useState<DynamicLayoutOption[]>([]);
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<string[]>([]);
  const [slotFiles, setSlotFiles] = useState<Record<string, File | undefined>>({});
  const [slotPreviews, setSlotPreviews] = useState<Record<string, string | undefined>>({});
  const [slotTextOptions, setSlotTextOptions] = useState<Record<string, TextOptions>>({});
  const [agentConnected, setAgentConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [printJobId, setPrintJobId] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<{ layoutId: string; slotId: string } | null>(null);

  const selectedLayouts = useMemo(
    () => layouts.filter((l) => selectedLayoutIds.includes(l.id)),
    [layouts, selectedLayoutIds],
  );

  // Checa se algum slot obrigatório de imagem está vazio
  const hasMissingRequired = useMemo(() => {
    return selectedLayouts.some((layout) =>
      (layout.slots || []).some(
        (slot) => slot.required && !slotFiles[`${layout.id}:${slot.id}`],
      ),
    );
  }, [selectedLayouts, slotFiles]);

  // Carrega endereço da loja (para retirada na loja) e dispositivos de impressão
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const info = await api.getStoreInfo();
        if (!cancelled && info) setStoreInfo(info);
      } catch {
        // ignora — sem endereço da loja
      }
      try {
        const devs = await api.getPrintDevices();
        if (!cancelled) setDevices(devs);
      } catch {
        // ignora — sem dispositivos
      }
    };
    load();
    return () => { cancelled = true; };
  }, [api]);

  // Carrega layouts disponíveis
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const data = await api.getDynamicLayouts();
        if (!cancelled) {
          const items: DynamicLayoutOption[] = (data || [])
            .filter((l: any) => l.type === "frame") // Apenas quadros
            .map((l: any) => ({
              id: l.id,
              name: l.name,
              type: l.type,
              previewImageUrl: l.previewImageUrl || l.preview_image_url || null,
              baseImageUrl: l.baseImageUrl || l.base_image_url || null,
              fabricJsonState: l.fabricJsonState || l.fabric_json_state || null,
              width: l.width,
              height: l.height,
              slots: (l.slots || []).map((s: any, index: number, slots: any[]) => ({
                id: s.id,
                label: s.label || s.name || s.id,
                position: s.position || s.placeholderPosition || {},
                width: s.width,
                height: s.height,
                required: s.required ?? true,
                pageId: s.pageId,
                pageIndex: s.pageIndex,
                // Legacy frames often share "photo-frame" as name. State keys
                // must remain unique so each uploaded file keeps its own slot.
                ...(slots.filter((candidate) => candidate.id === s.id).length > 1
                  ? { id: `manual_slot_${index + 1}` }
                  : {}),
              })),
            }));
          setLayouts(items);
        }
      } catch (err) {
        console.error("❌ Erro ao carregar layouts:", err);
        if (!cancelled) toast.error("Erro ao carregar layouts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // Verifica status do agente de impressão
  useEffect(() => {
    const checkAgent = async () => {
      try {
        const status = await api.getAgentStatus();
        setAgentConnected(status.connected);
        setDeviceName(status.deviceName);
      } catch {
        setAgentConnected(false);
      }
    };
    checkAgent();
    const interval = setInterval(checkAgent, 15_000);
    return () => clearInterval(interval);
  }, [api]);

  // Polling do status do job após submit
  useEffect(() => {
    if (!printJobId || jobStatus === "PRINTED" || jobStatus === "FAILED") {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const result = await api.getPrintJobStatus(printJobId);
        setJobStatus(result.status as JobStatus);
        if (result.lastError) setJobError(result.lastError);
        if (result.status === "PRINTED" || result.status === "FAILED") {
          clearInterval(pollingRef.current!);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [printJobId, jobStatus, api]);

  // Handler: arquivo de slot alterado — abre crop automaticamente
  const handleSlotFile = useCallback((layoutId: string, slotId: string, file?: File) => {
    const key = `${layoutId}:${slotId}`;
    setSlotFiles((prev) => ({ ...prev, [key]: file }));
    if (file) {
      const url = URL.createObjectURL(file);
      setSlotPreviews((prev) => ({ ...prev, [key]: url }));
      // Abre o crop automaticamente
      setCropTarget({ layoutId, slotId });
    } else {
      setSlotPreviews((prev) => {
        const next = { ...prev };
        if (next[key]) URL.revokeObjectURL(next[key]!);
        delete next[key];
        return next;
      });
    }
  }, []);

  // Handler: opções de texto alteradas
  const handleSlotTextChange = useCallback(
    (layoutId: string, slotId: string, options: TextOptions) => {
      const key = `${layoutId}:${slotId}`;
      setSlotTextOptions((prev) => ({ ...prev, [key]: options }));
    },
    [],
  );

  // Toggle seleção de layout
  const handleToggleLayout = useCallback((layoutId: string) => {
    setSelectedLayoutIds((prev) =>
      prev.includes(layoutId) ? prev.filter((id) => id !== layoutId) : [...prev, layoutId],
    );
  }, []);

  // Carrega fabricJsonState completo quando um layout é selecionado
  useEffect(() => {
    const loadCompleteLayouts = async () => {
      for (const layoutId of selectedLayoutIds) {
        const existing = layouts.find(l => l.id === layoutId);
        if (existing && !existing.fabricJsonState) {
          try {
            const complete = await api.getLayoutById(layoutId);
            setLayouts(prev =>
              prev.map(l => l.id === layoutId ? { ...l, ...complete } : l)
            );

            // Extrai textos padrão dos objetos customizáveis
            if (complete.fabricJsonState && Array.isArray((complete.fabricJsonState as any).objects)) {
              const objects = (complete.fabricJsonState as any).objects as any[];
              for (const obj of objects) {
                if (
                  obj.isCustomizable === true &&
                  (obj.type?.toLowerCase() === "textbox" || obj.type?.toLowerCase() === "i-text" || obj.type?.toLowerCase() === "text") &&
                  obj.text
                ) {
                  const key = `${layoutId}:${obj.id || obj.name}`;
                  setSlotTextOptions(prev => {
                    if (!prev[key]) {
                      return { ...prev, [key]: { text: obj.text } };
                    }
                    return prev;
                  });
                }
              }
            }
          } catch (err) {
            console.error("❌ Erro ao carregar layout completo:", err);
          }
        }
      }
    };
    if (selectedLayoutIds.length > 0) {
      loadCompleteLayouts();
    }
  }, [selectedLayoutIds, api, layouts]);

  // Gera a arte final para um layout: carrega o fabricJsonState num canvas off-screen,
  useEffect(() => {
    api.getProducts({ perPage: 100 }).then((data) => {
      const products = (data.products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.variants?.[0]?.price || p.price || 0),
      }));
      setSummaryProducts(products);
    }).catch(() => setSummaryProducts([]));
  }, [api]);

  // Injeta as imagens nos frames e os textos nos objetos isCustomizable e exporta um PNG por página
  const generateArtworkPages = async (layout: DynamicLayoutOption): Promise<Blob[]> => {
    if (!layout.fabricJsonState) return [];

    const { StaticCanvas, FabricImage, Rect, Circle } = await import("fabric");

    const w = layout.width || 378;
    const h = layout.height || 567;
    const allSlots = layout.slots || [];
    const pageStates = getLayoutPageStates(layout);

    let insertedSlots = 0;
    const blobs: Blob[] = [];

    for (const [pageIndex, canvasState] of pageStates.entries()) {
      const exportCanvas = new StaticCanvas(document.createElement("canvas"), {
        preserveObjectStacking: true,
        enableRetinaScaling: false,
      }) as any;

      await preloadFontsFromState(canvasState);
      await exportCanvas.loadFromJSON(canvasState);
      // JSON salva coordenadas no tamanho original. Qualidade vem do multiplier na exportação,
      // sem alterar coordenadas dos objetos ou do frame.
      exportCanvas.setDimensions({ width: w, height: h });
      exportCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      exportCanvas.set({ backgroundColor: "#ffffff" });

      // Páginas multi-página guardam só os frames no canvasState; a arte vem de previewImageUrl
      const pageHasArt = Array.isArray(canvasState?.objects) &&
        canvasState.objects.some((o: any) => (o.type || "").toLowerCase() === "image");
      if (!pageHasArt && layout.previewImageUrl) {
        try {
          const baseArt = (await (FabricImage as any).fromURL(layout.previewImageUrl, {
            crossOrigin: "anonymous",
          })) as any;
          baseArt.set({
            left: 0,
            top: 0,
            originX: "left",
            originY: "top",
            scaleX: w / (baseArt.width || w),
            scaleY: h / (baseArt.height || h),
            selectable: false,
            evented: false,
            objectCaching: false,
            name: "export-base-art",
          });
          exportCanvas.add(baseArt);
          exportCanvas.sendObjectToBack(baseArt);
        } catch { /* ignora — exporta sem arte de fundo */ }
      }

      const objects: any[] = exportCanvas.getObjects();
      const frames = objects.filter(
        (object: any) =>
          object.isFrame ||
          object.customData?.isFrame ||
          object.name?.toLowerCase().includes("frame"),
      );

      // Frames são máscaras de edição. Mantê-los visíveis cobria a foto na exportação.
      for (const object of objects) {
        if (object.isFrame) {
          object.set({ fill: "transparent", stroke: "transparent", opacity: 0 });
        }
      }

      // Slots desta página (layouts legados sem pageIndex pertencem à página 0)
      const pageSlots = allSlots
        .map((slot, index) => ({ slot, globalIndex: index }))
        .filter(({ slot }) => (slot.pageIndex ?? 0) === pageIndex);

      // 1. Injetar imagens nos frames - usando múltiplas estratégias como no LayoutPanel
      for (const [slotIndex, { slot }] of pageSlots.entries()) {
        const file = slotFiles[`${layout.id}:${slot.id}`];
        if (!file) continue;

        // Encontra o frame correspondente - tenta múltiplas estratégias
        let frame = objects.find((o: any) =>
          (o.isFrame || o.customData?.isFrame) &&
          (o.id === slot.id || o.name === slot.label || o.name === slot.id),
        );

        // Se não encontrar por isFrame, procurar por tipo/nome
        if (!frame) {
          frame = objects.find((o: any) =>
            (o.type === "rect" || o.type === "Rect" || o.name?.toLowerCase().includes("frame")) &&
            (o.id === slot.id || o.name === slot.label || o.name === slot.id),
          );
        }

        // API gera slots a partir dos frames na mesma ordem; cobre layouts legados sem id.
        if (!frame) {
          frame = frames[slotIndex];
        }

        if (!frame) {
          throw new Error(`Frame não encontrado para slot ${slot.label}`);
        }

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target!.result as string);
          reader.readAsDataURL(file);
        });

        const img = (await (FabricImage as any).fromURL(dataUrl, {
          crossOrigin: "anonymous",
        })) as any;

        const frameRect = frame.getBoundingRect();
        const imgW = img.width || 1;
        const imgH = img.height || 1;
        const coverScale = Math.max(frameRect.width / imgW, frameRect.height / imgH);

        img.set({
          left: frameRect.left + frameRect.width / 2,
          top: frameRect.top + frameRect.height / 2,
          originX: "center",
          originY: "center",
          scaleX: coverScale,
          scaleY: coverScale,
          angle: frame.angle || 0,
          selectable: false,
          evented: false,
          objectCaching: false,
        });

        try {
          let mask: any;
          if (frame.type === "circle") {
            mask = new Circle({
              radius: frame.radius || frame.width / 2,
              scaleX: frame.scaleX,
              scaleY: frame.scaleY,
              originX: "center",
              originY: "center",
              left: frameRect.left + frameRect.width / 2,
              top: frameRect.top + frameRect.height / 2,
              angle: frame.angle || 0,
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
              left: frameRect.left + frameRect.width / 2,
              top: frameRect.top + frameRect.height / 2,
              angle: frame.angle || 0,
              absolutePositioned: true,
            });
          }
          img.set("clipPath", mask);
        } catch { /* ignore */ }

        img.set("name", `uploaded-img-${slot.id}`);
        const idx = exportCanvas.getObjects().indexOf(frame);
        if (idx >= 0) {
          exportCanvas.insertAt?.(idx + 1, img) ?? exportCanvas.add(img);
        } else {
          exportCanvas.add(img);
        }
        exportCanvas.bringObjectToFront(frame);
        insertedSlots += 1;
      }

      // 2. Aplicar textos nos objetos isCustomizable
      for (const obj of exportCanvas.getObjects() as any[]) {
        if (!obj.isCustomizable) continue;
        if (obj.type !== "textbox" && obj.type !== "i-text" && obj.type !== "text") continue;
        const objKey = obj.id || obj.name;
        if (!objKey) continue;
        const textKey = `${layout.id}:${objKey}`;
        const opts = slotTextOptions[textKey];
        if (!opts) continue;
        if (opts.text !== undefined) obj.set("text", opts.text);
        if (opts.fontFamily) obj.set("fontFamily", opts.fontFamily);
        if (opts.fontSize) obj.set("fontSize", opts.fontSize);
        if (opts.fontWeight) obj.set("fontWeight", opts.fontWeight);
        if (opts.fontStyle) obj.set("fontStyle", opts.fontStyle);
        if (opts.underline !== undefined) obj.set("underline", opts.underline);
        if (opts.textAlign) obj.set("textAlign", opts.textAlign);
        if (opts.fill) obj.set("fill", opts.fill);
        if (opts.charSpacing !== undefined) obj.set("charSpacing", opts.charSpacing);
        if (opts.lineHeight !== undefined) obj.set("lineHeight", opts.lineHeight);
      }

      exportCanvas.renderAll();

      const dataUrlPage: string = exportCanvas.toDataURL({
        format: "png",
        multiplier: 2,
        enableRetinaScaling: false,
      });

      exportCanvas.dispose?.();

      const res = await fetch(dataUrlPage);
      blobs.push(await res.blob());
    }

    const uploadedSlotCount = allSlots.filter(
      (slot) => slotFiles[`${layout.id}:${slot.id}`],
    ).length;
    if (insertedSlots !== uploadedSlotCount) {
      throw new Error("Nem todas as fotos foram inseridas na arte final");
    }

    return blobs;
  };

  // Submit do pedido manual
  const handleSubmit = async () => {
    if (selectedLayouts.length === 0) {
      toast.error("Selecione ao menos um layout");
      return;
    }
    if (!summaryProductId) {
      toast.error("Selecione o produto associado");
      return;
    }
    if (hasMissingRequired) {
      toast.error("Preencha todas as imagens obrigatórias");
      return;
    }

    setSubmitting(true);
    setJobStatus("PENDING");
    setJobError(null);

    try {
      const formData = new FormData();

      if (customerName.trim()) formData.append("customerName", customerName.trim());
      formData.append("productId", summaryProductId);
      if (giftMessage.trim()) formData.append("giftMessage", giftMessage.trim());
      if (selectedDeviceId) formData.append("deviceId", selectedDeviceId);

      // Resumo de impressão (opcional)
      if (includeSummary) {
        formData.append("includeSummary", "true");
        if (customerName.trim()) formData.append("summaryCustomerName", customerName.trim());
        if (summaryCustomerEmail.trim()) formData.append("summaryCustomerEmail", summaryCustomerEmail.trim());
        if (summaryCustomerPhone.trim()) formData.append("summaryCustomerPhone", summaryCustomerPhone.trim());
        if (summaryCustomerDocument.trim()) formData.append("summaryCustomerDocument", summaryCustomerDocument.trim());
        formData.append("summaryDeliveryMethod", summaryDeliveryMethod);
        if (summaryDeliveryAddress.trim()) formData.append("summaryDeliveryAddress", summaryDeliveryAddress.trim());
        if (summaryDeliveryComplement.trim()) formData.append("summaryDeliveryComplement", summaryDeliveryComplement.trim());
        if (summaryDeliveryCity.trim()) formData.append("summaryDeliveryCity", summaryDeliveryCity.trim());
        if (summaryDeliveryState.trim()) formData.append("summaryDeliveryState", summaryDeliveryState.trim());
        if (summaryDeliveryZipCode.trim()) formData.append("summaryDeliveryZipCode", summaryDeliveryZipCode.trim());
        if (summaryDeliveryRecipientPhone.trim()) formData.append("summaryDeliveryRecipientPhone", summaryDeliveryRecipientPhone.trim());
        if (summaryDeliveryDate) formData.append("summaryDeliveryDate", summaryDeliveryDate);
        formData.append("summaryPaymentOrderMethod", summaryPaymentOrderMethod);
        formData.append("summaryPaymentConfirmedMethod", summaryPaymentConfirmedMethod);
        if (summaryAmountItems) formData.append("summaryAmountItems", summaryAmountItems);
        if (summaryAmountShipping) formData.append("summaryAmountShipping", summaryAmountShipping);
        if (summaryAmountDiscount) formData.append("summaryAmountDiscount", summaryAmountDiscount);
        if (summaryAmountTotal) formData.append("summaryAmountTotal", summaryAmountTotal);
      }

      // Usar apenas o primeiro layout selecionado (backend suporta um layout por pedido)
      const layout = selectedLayouts[0];
      formData.append("layoutId", layout.id);

      // Gerar artes compostas (uma PNG por página) e enviar como composedImage
      // (as mesmas imagens alimentam o resumo no backend, evitando campo base64 gigante
      // no FormData que estoura o fieldSize do Multer)
      const artworkBlobs = await generateArtworkPages(layout);
      artworkBlobs.forEach((blob, pageIndex) => {
        formData.append(
          "composedImage",
          new File([blob], `artwork-${layout.id}-${pageIndex}.png`, { type: "image/png" }),
          `artwork-${layout.id}-${pageIndex}.png`,
        );
      });

      if (!artworkBlobs.length) {
        throw new Error("Não foi possível gerar a arte final");
      }

      const result = await api.createManualPrintOrder(formData);

      if (result.ok) {
        setJobStatus(result.status as JobStatus ?? "SENT");
        if (result.printJobId) setPrintJobId(result.printJobId);
        toast.success("Pedido enviado para impressão!");
      } else {
        throw new Error("Resposta inválida do servidor");
      }
    } catch (err: any) {
      setJobStatus("FAILED");
      setJobError(err?.message || "Erro ao enviar pedido");
      toast.error(err?.message || "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset do formulário
  const handleReset = () => {
    setCustomerName("");
    setGiftMessage("");
    setIncludeSummary(false);
    setSummaryCustomerEmail("");
    setSummaryCustomerPhone("");
    setSummaryCustomerDocument("");
    setSummaryDeliveryMethod("pickup");
    setSummaryDeliveryAddress("");
    setSummaryDeliveryComplement("");
    setSummaryDeliveryCity("");
    setSummaryDeliveryState("");
    setSummaryDeliveryZipCode("");
    setSummaryDeliveryRecipientPhone("");
    setSummaryDeliveryDate("");
    setSummaryPaymentOrderMethod("pix");
    setSummaryPaymentConfirmedMethod("pix");
    setSummaryAmountItems("");
    setSummaryAmountShipping("");
    setSummaryAmountDiscount("");
    setSummaryAmountTotal("");
    setSummaryProductId("");
    setSelectedLayoutIds([]);
    setSlotFiles({});
    setSlotPreviews({});
    setSlotTextOptions({});
    setJobStatus(null);
    setJobError(null);
    setPrintJobId(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
        <span className="ml-3 text-sm text-slate-500">Carregando layouts...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedido Manual de Impressão</h1>
          <p className="mt-1 text-sm text-slate-500">
            Selecione um layout, envie as fotos e personalize o texto.
          </p>
        </div>
        {/* Status do agente */}
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${
            agentConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          {agentConnected ? (
            <>
              <Wifi className="h-4 w-4" />
              {deviceName || "Agente conectado"}
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              Agente desconectado
            </>
          )}
        </div>
      </div>

      {/* Dados do pedido */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-800">Dados do pedido</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Nome do cliente
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex: Maria Silva"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Mensagem do cartão
            </label>
            <textarea
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              placeholder="Ex: Feliz Aniversário!"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100 resize-none min-h-20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Produto associado</label>
            <select
              value={summaryProductId}
              onChange={(e) => {
                const selected = summaryProducts.find((p) => p.id === e.target.value);
                setSummaryProductId(e.target.value);
                if (selected) {
                  setSummaryAmountItems(selected.price.toFixed(2));
                  const shipping = Number(summaryAmountShipping) || 0;
                  const discount = Number(summaryAmountDiscount) || 0;
                  setSummaryAmountTotal((selected.price + shipping - discount).toFixed(2));
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
            >
              <option value="">Selecione um produto</option>
              {summaryProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - R$ {product.price.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Resumo de impressão (opcional) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Resumo de impressão</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-400"
            />
            <span className="text-sm font-medium text-slate-700">Gerar resumo do pedido (DOCX A4)</span>
          </label>
        </div>

        {includeSummary && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-medium text-rose-700 mb-3">Dados do cliente (para o resumo)</p>
              <p className="mb-3 rounded-lg bg-rose-100/60 px-3 py-2 text-xs text-rose-600">
                Nome do cliente: <span className="font-medium">{customerName || "—"}</span> (usado dos dados do pedido)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">E-mail</label>
                  <input
                    type="email"
                    value={summaryCustomerEmail}
                    onChange={(e) => setSummaryCustomerEmail(e.target.value)}
                    placeholder="maria@email.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Telefone</label>
                  <input
                    type="tel"
                    value={summaryCustomerPhone}
                    onChange={(e) => setSummaryCustomerPhone(e.target.value)}
                    placeholder="(11) 99999-0001"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">CPF/CNPJ</label>
                  <input
                    type="text"
                    value={summaryCustomerDocument}
                    onChange={(e) => setSummaryCustomerDocument(e.target.value)}
                    placeholder="123.456.789-00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-medium text-blue-700 mb-3">Entrega</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Método</label>
                  <select
                    value={summaryDeliveryMethod}
                    onChange={(e) => setSummaryDeliveryMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  >
                    <option value="pickup">Retirada na loja</option>
                    <option value="delivery">Entrega</option>
                    <option value="shipping">Envio</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Data prevista</label>
                  <input
                    type="date"
                    value={summaryDeliveryDate}
                    onChange={(e) => setSummaryDeliveryDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                {summaryDeliveryMethod === "pickup" ? (
                  <div className="sm:col-span-2">
                    <div className="rounded-lg border border-blue-100 bg-white/70 p-3">
                      <p className="mb-1 text-xs font-medium text-blue-700">Endereço da loja</p>
                      <p className="text-sm text-slate-800">
                        {storeInfo?.address || "Rua José de Alencar, 480, Prata, Campina Grande - PB, 58400-515"}
                      </p>
                      {storeInfo?.mapsUrl && (
                        <a
                          href={storeInfo.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Abrir no Google Maps
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Endereço</label>
                      <input
                        type="text"
                        value={summaryDeliveryAddress}
                        onChange={(e) => setSummaryDeliveryAddress(e.target.value)}
                        placeholder="Rua das Flores, 123"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Complemento</label>
                      <input
                        type="text"
                        value={summaryDeliveryComplement}
                        onChange={(e) => setSummaryDeliveryComplement(e.target.value)}
                        placeholder="Apto 45"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Cidade</label>
                      <input
                        type="text"
                        value={summaryDeliveryCity}
                        onChange={(e) => setSummaryDeliveryCity(e.target.value)}
                        placeholder="São Paulo"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Estado</label>
                      <input
                        type="text"
                        value={summaryDeliveryState}
                        onChange={(e) => setSummaryDeliveryState(e.target.value)}
                        placeholder="SP"
                        maxLength={2}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">CEP</label>
                      <input
                        type="text"
                        value={summaryDeliveryZipCode}
                        onChange={(e) => setSummaryDeliveryZipCode(e.target.value)}
                        placeholder="01001-000"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Telefone do destinatário</label>
                      <input
                        type="tel"
                        value={summaryDeliveryRecipientPhone}
                        onChange={(e) => setSummaryDeliveryRecipientPhone(e.target.value)}
                        placeholder="(11) 99999-0001"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-700 mb-3">Pagamento</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Método do pedido</label>
                  <select
                    value={summaryPaymentOrderMethod}
                    onChange={(e) => setSummaryPaymentOrderMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  >
                    <option value="pix">PIX</option>
                    <option value="credit_card">Cartão de crédito</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Método confirmado</label>
                  <select
                    value={summaryPaymentConfirmedMethod}
                    onChange={(e) => setSummaryPaymentConfirmedMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  >
                    <option value="pix">PIX</option>
                    <option value="credit_card">Cartão de crédito</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-medium text-emerald-700 mb-3">Valores (R$)</p>
               <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Itens</label>
                  <input
                    type="number"
                    step="0.01"
                    value={summaryAmountItems}
                    onChange={(e) => { const v = e.target.value; setSummaryAmountItems(v); const items = Number(v) || 0; const shipping = Number(summaryAmountShipping) || 0; const discount = Number(summaryAmountDiscount) || 0; setSummaryAmountTotal((items + shipping - discount).toFixed(2)); }}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Frete</label>
                  <input
                    type="number"
                    step="0.01"
                    value={summaryAmountShipping}
                    onChange={(e) => { const v = e.target.value; setSummaryAmountShipping(v); const items = Number(summaryAmountItems) || 0; const shipping = Number(v) || 0; const discount = Number(summaryAmountDiscount) || 0; setSummaryAmountTotal((items + shipping - discount).toFixed(2)); }}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Desconto</label>
                  <input
                    type="number"
                    step="0.01"
                    value={summaryAmountDiscount}
                    onChange={(e) => { const v = e.target.value; setSummaryAmountDiscount(v); const items = Number(summaryAmountItems) || 0; const shipping = Number(summaryAmountShipping) || 0; const discount = Number(v) || 0; setSummaryAmountTotal((items + shipping - discount).toFixed(2)); }}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Total</label>
                  <input
                    type="number"
                    step="0.01"
                    value={summaryAmountTotal}
                    onChange={(e) => setSummaryAmountTotal(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Seleção de layouts */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-800">
          Layouts disponíveis
        </h2>
        {layouts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
            <ImageIcon className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum layout encontrado</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {layouts.map((layout) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                selected={selectedLayoutIds.includes(layout.id)}
                onSelect={() => handleToggleLayout(layout.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Painéis dos layouts selecionados */}
      {selectedLayouts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-800">
            Personalização — {selectedLayouts.length} layout(s) selecionado(s)
          </h2>
          {selectedLayouts.map((layout, index) => (
            <LayoutPanel
              key={layout.id}
              layout={layout}
              layoutIndex={index}
              slotFiles={slotFiles}
              slotPreviews={slotPreviews}
              slotTextOptions={slotTextOptions}
              onSlotFile={handleSlotFile}
              onSlotTextChange={handleSlotTextChange}
              onRemoveLayout={() => handleToggleLayout(layout.id)}
              setCropTarget={setCropTarget}
              setSlotPreviews={setSlotPreviews}
              setSlotFiles={setSlotFiles}
            />
          ))}
        </div>
      )}

      {/* Crop Dialog Global */}
      {cropTarget && (() => {
        const layout = layouts.find(l => l.id === cropTarget.layoutId);
        const slot = layout?.slots?.find(s => s.id === cropTarget.slotId);
        const src = slotPreviews[`${cropTarget.layoutId}:${cropTarget.slotId}`];
        
        if (!src || !layout || !slot) return null;

        return (
          <CropDialog
            src={src}
            aspect={getSlotAspect(slot)}
            onApply={(blob) => {
              const file = new File([blob], `cropped-${cropTarget.slotId}.png`, {
                type: "image/png",
              });
              handleSlotFile(cropTarget.layoutId, cropTarget.slotId, file);
              setCropTarget(null);
            }}
            onClose={() => setCropTarget(null)}
          />
        );
      })()}

      {/* Status do job */}
      {jobStatus && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            jobStatus === "PRINTED"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : jobStatus === "FAILED"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          {jobStatus === "PRINTED" ? (
            <CheckCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
          ) : jobStatus === "FAILED" ? (
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          ) : (
            <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin" />
          )}
          <div className="flex-1">
            <p className="font-medium text-sm">{statusLabels[jobStatus]}</p>
            {jobError && (
              <p className="mt-1 text-xs opacity-80">{jobError}</p>
            )}
          </div>
          {(jobStatus === "PRINTED" || jobStatus === "FAILED") && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-black/5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Novo pedido
            </button>
          )}
        </div>
      )}

      {/* Opções de desenvolvedor */}
      {!jobStatus && (
        <details className="group rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-5">
          <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-slate-600">
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Opções de desenvolvedor
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Dispositivo de impressão
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
              >
                <option value="">Dispositivo padrão configurado</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.deviceName || d.deviceId}
                    {d.isDefault ? " (padrão)" : ""}
                    {d.isActive ? " • online" : " • offline"}
                  </option>
                ))}
              </select>
              {devices.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  Nenhum dispositivo cadastrado encontrado.
                </p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Por padrão o pedido usa o dispositivo padrão. Aqui você pode escolher para qual
                dispositivo cadastrado enviar esta impressão.
              </p>
            </div>
          </div>
        </details>
      )}

      {/* Botão de submit */}
      {!jobStatus && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">
            {selectedLayouts.length === 0
              ? "Selecione ao menos um layout acima"
              : hasMissingRequired
              ? "Preencha todas as imagens obrigatórias"
              : `${selectedLayouts.length} layout(s) prontos para imprimir`}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              selectedLayouts.length === 0 ||
              hasMissingRequired ||
              !agentConnected
            }
            className="flex items-center gap-2 bg-rose-500 px-6 hover:bg-rose-600 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? "Enviando..." : "Enviar para impressão"}
          </Button>
        </div>
      )}
    </div>
  );
}
