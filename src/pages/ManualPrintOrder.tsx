import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Crop,
  Loader2,
  Printer,
  RefreshCw,
  Upload,
  X,
  XCircle,
  Plus,
  Minus,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import useApi from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler imagem"));
    reader.readAsDataURL(file);
  });
}

async function composeLayoutPng(
  fabricJsonState: object,
  slotImages: Record<string, File>,
  layoutWidth: number,
  layoutHeight: number,
): Promise<Blob> {
  const { Canvas, FabricImage, Rect, Circle } = await import("fabric");
  const canvasEl = document.createElement("canvas");
  const canvas = new Canvas(canvasEl, {
    width: layoutWidth,
    height: layoutHeight,
    backgroundColor: "#ffffff",
    selection: false,
    preserveObjectStacking: true,
  });

  const state = JSON.parse(JSON.stringify(fabricJsonState));
  if (Array.isArray(state.objects)) {
    state.objects = state.objects.map((obj: any) => ({
      ...obj,
      type: obj.type === "i-text" || obj.type === "IText" ? "textbox" : obj.type,
      objectCaching: false,
      selectable: false,
      evented: false,
    }));
  }

  await canvas.loadFromJSON(state);

  for (const [slotId, file] of Object.entries(slotImages)) {
    const frame = canvas.getObjects().find((obj: any) => {
      const name = String(obj.name || "");
      return (
        obj.id === slotId ||
        name === slotId ||
        obj.customData?.slotId === slotId
      );
    }) as any;

    if (!frame) continue;

    const dataUrl = await fileToDataUrl(file);
    const image = await FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" });
    const frameWidth = Number(frame.width || 1) * Number(frame.scaleX || 1);
    const frameHeight = Number(frame.height || 1) * Number(frame.scaleY || 1);
    const center = frame.getCenterPoint();
    const imageWidth = Number(image.width || 1);
    const imageHeight = Number(image.height || 1);
    const scale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);

    frame.set({ fill: "transparent", stroke: "transparent", opacity: 0 });

    image.set({
      scaleX: scale,
      scaleY: scale,
      left: center.x,
      top: center.y,
      originX: "center",
      originY: "center",
      angle: frame.angle || 0,
      selectable: false,
      evented: false,
      objectCaching: false,
      name: `manual-uploaded-${slotId}`,
    });

    const clipPath =
      frame.type === "circle"
        ? new Circle({
            radius: frame.radius || frame.width / 2,
            scaleX: frame.scaleX,
            scaleY: frame.scaleY,
            originX: "center",
            originY: "center",
            left: center.x,
            top: center.y,
            angle: frame.angle || 0,
            absolutePositioned: true,
          })
        : new Rect({
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
            angle: frame.angle || 0,
            absolutePositioned: true,
          });

    image.set("clipPath", clipPath);
    canvas.add(image);
    canvas.moveObjectTo(image, canvas.getObjects().indexOf(frame) + 1);
  }

  canvas.renderAll();
  const dataUrl = canvas.toDataURL({ format: "png", multiplier: 4, enableRetinaScaling: false });
  canvas.dispose();
  const response = await fetch(dataUrl);
  return await response.blob();
}

/* ─── Types ────────────────────────────────────────────────────────────── */

type LayoutSlot = {
  id: string;
  label: string;
  position?: Record<string, unknown>;
  required: boolean;
};

type DynamicLayoutOption = {
  id: string;
  name: string;
  type?: string;
  previewImageUrl?: string | null;
  baseImageUrl?: string | null;
  fabricJsonState?: object | null;
  width?: number;
  height?: number;
  slots?: LayoutSlot[];
};

type JobStatus = "PENDING" | "SENT" | "RECEIVED" | "PRINTING" | "PRINTED" | "FAILED" | null;

const statusLabels: Record<Exclude<JobStatus, null>, string> = {
  PENDING: "Enfileirando...",
  SENT: "Enviado para o agente",
  RECEIVED: "Agente recebeu",
  PRINTING: "Imprimindo",
  PRINTED: "Impresso com sucesso",
  FAILED: "Falha na impressão",
};

function slotFieldName(slotId: string) {
  return `slot:${slotId}`;
}

/* ─── Crop Dialog ──────────────────────────────────────────────────────── */

type CropRect = { x: number; y: number; width: number; height: number };

function CropDialog({
  src,
  onApply,
  onClose,
}: {
  src: string;
  onApply: (cropped: Blob) => void;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 100, height: 100 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setNaturalSize({ w: nw, h: nh });
    const rect = img.getBoundingClientRect();
    setDisplaySize({ w: rect.width, h: rect.height });
    setOffset({ x: rect.left, y: rect.top });
    setCrop({ x: 0, y: 0, width: nw, height: nh });
  };

  const toNatural = (clientX: number, clientY: number) => ({
    x: Math.max(0, Math.min(naturalSize.w, ((clientX - offset.x) / displaySize.w) * naturalSize.w)),
    y: Math.max(0, Math.min(naturalSize.h, ((clientY - offset.y) / displaySize.h) * naturalSize.h)),
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = toNatural(e.clientX, e.clientY);
    setDragging(true);
    setDragStart(p);
    setCrop({ x: p.x, y: p.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const p = toNatural(e.clientX, e.clientY);
    const x = Math.min(dragStart.x, p.x);
    const y = Math.min(dragStart.y, p.y);
    const w = Math.abs(p.x - dragStart.x);
    const h = Math.abs(p.y - dragStart.y);
    setCrop({ x, y, width: w, height: h });
  };

  const handleMouseUp = () => setDragging(false);

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
      <div className="mx-4 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Recortar imagem</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className="relative mb-4 overflow-hidden rounded-lg border border-slate-200 cursor-crosshair select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img ref={imgRef} src={src} onLoad={handleLoad} className="block w-full" alt="Crop" draggable={false} />
          {naturalSize.w > 0 && (
            <>
              <div className="absolute inset-0 bg-black/40" />
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                style={cropOverlay}
              >
                <div className="absolute inset-0 border border-dashed border-white/60" />
              </div>
            </>
          )}
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
          {layout.width && layout.height ? `${layout.width}×${layout.height}` : ""}{" "}
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
        className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-slate-400 transition-all hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-500"
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

/* ─── Selected Layout Panel ────────────────────────────────────────────── */

function LayoutPanel({
  layout,
  slotFiles,
  slotPreviews,
  onSlotFile,
  onRemoveLayout,
  layoutIndex,
}: {
  layout: DynamicLayoutOption;
  slotFiles: Record<string, File | undefined>;
  slotPreviews: Record<string, string | undefined>;
  onSlotFile: (layoutId: string, slotId: string, file?: File) => void;
  onRemoveLayout: () => void;
  layoutIndex: number;
}) {
  const [cropTarget, setCropTarget] = useState<string | null>(null);

  const cropSrc = cropTarget ? slotPreviews[cropTarget] : undefined;

  const handleCropApply = async (blob: Blob) => {
    if (!cropTarget) return;
    const file = new File([blob], `cropped-${cropTarget}.png`, { type: "image/png" });
    onSlotFile(layout.id, cropTarget, file);
    setCropTarget(null);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-xs font-bold text-white">
            {layoutIndex + 1}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">{layout.name}</div>
            <div className="text-xs text-slate-400">
              {layout.width && layout.height ? `${layout.width}×${layout.height}` : ""} •{" "}
              {(layout.slots || []).length} slot(s)
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

      {/* Mini-preview do layout */}
      <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
        <div className="text-xs font-medium text-slate-500 mb-2">Preview</div>
        <div className="relative mx-auto h-48 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-inner">
          {(layout.previewImageUrl || layout.baseImageUrl) && (
            <img
              src={layout.previewImageUrl || layout.baseImageUrl || ""}
              alt={layout.name}
              className="h-full w-full object-cover opacity-60"
            />
          )}
          {/* Overlays das imagens nos slots */}
          {(layout.slots || []).map((slot) => {
            const preview = slotPreviews[slot.id];
            if (!preview) return null;
            return (
              <div key={slot.id} className="absolute inset-0">
                <img src={preview} alt={slot.label} className="h-full w-full object-cover" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload de slots */}
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {(layout.slots || []).map((slot) => (
          <SlotUploader
            key={slot.id}
            slotId={slot.id}
            label={slot.label}
            required={slot.required}
            file={slotFiles[slot.id]}
            preview={slotPreviews[slot.id]}
            onFile={(f) => onSlotFile(layout.id, slot.id, f)}
            onCropOpen={() => setCropTarget(slot.id)}
          />
        ))}
      </div>

      {cropTarget && cropSrc && (
        <CropDialog
          src={cropSrc}
          onApply={handleCropApply}
          onClose={() => setCropTarget(null)}
        />
      )}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────── */

export function ManualPrintOrder() {
  const api = useApi();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const allPreviewsRef = useRef<Record<string, string | undefined>>({});

  const [customerName, setCustomerName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [layouts, setLayouts] = useState<DynamicLayoutOption[]>([]);
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<string[]>([]);
  const [slotFiles, setSlotFiles] = useState<Record<string, File | undefined>>({});
  const [slotPreviews, setSlotPreviews] = useState<Record<string, string | undefined>>({});
  const [agentConnected, setAgentConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [printJobId, setPrintJobId] = useState<string | null>(null);

  const selectedLayouts = useMemo(
    () => layouts.filter((l) => selectedLayoutIds.includes(l.id)),
    [layouts, selectedLayoutIds],
  );

  const hasMissingRequired = useMemo(() => {
    return selectedLayouts.some((layout) =>
      (layout.slots || []).some((slot) => slot.required && !slotFiles[slot.id]),
    );
  }, [selectedLayouts, slotFiles]);

  const canSubmit =
    customerName.trim().length > 0 &&
    selectedLayouts.length > 0 &&
    !hasMissingRequired &&
    agentConnected &&
    !submitting;

  /* Load data */
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [layoutResponse, agentStatus] = await Promise.all([
          api.getDynamicLayouts({ type: "frame" }),
          api.getAgentStatus(),
        ]);
        if (!mounted) return;
        const layoutData = Array.isArray(layoutResponse?.data) ? layoutResponse.data : layoutResponse;
        setLayouts((Array.isArray(layoutData) ? layoutData : []).filter((l) => l.type === "frame"));
        setAgentConnected(Boolean(agentStatus.connected));
        setDeviceName(agentStatus.deviceName || null);
      } catch {
        toast.error("Erro ao carregar dados de impressão manual");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [api]);

  /* Cleanup previews on unmount */
  useEffect(() => {
    allPreviewsRef.current = slotPreviews;
  }, [slotPreviews]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      Object.values(allPreviewsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  /* Slot file management (keyed by layoutId:slotId) */
  const updateSlotFile = useCallback((layoutId: string, slotId: string, file?: File) => {
    const key = `${layoutId}:${slotId}`;
    setSlotFiles((prev) => ({ ...prev, [key]: file }));
    setSlotPreviews((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key]);
      return { ...prev, [key]: file ? URL.createObjectURL(file) : undefined };
    });
  }, []);

  /* Layout selection */
  const toggleLayout = useCallback((layoutId: string) => {
    setSelectedLayoutIds((prev) => {
      if (prev.includes(layoutId)) {
        return prev.filter((id) => id !== layoutId);
      }
      return [...prev, layoutId];
    });
  }, []);

  const removeLayout = useCallback((layoutId: string) => {
    setSelectedLayoutIds((prev) => prev.filter((id) => id !== layoutId));
  }, []);

  /* Polling */
  const startPolling = (orderId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const job = await api.getPrintJobStatus(orderId);
        setJobStatus(job.status as JobStatus);
        setJobError(job.lastError ?? null);
        if (["PRINTED", "FAILED"].includes(job.status)) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {
        /* still creating */
      }
    }, 2000);
  };

  /* Submit */
  const handleSubmit = async () => {
    if (selectedLayouts.length === 0 || !canSubmit) return;

    setSubmitting(true);
    setJobStatus("PENDING");
    setJobError(null);

    try {
      for (const layout of selectedLayouts) {
        const formData = new FormData();
        formData.append("customerName", customerName.trim());
        formData.append("layoutId", layout.id);
        if (giftMessage.trim()) formData.append("giftMessage", giftMessage.trim());

        const slotImageFiles: Record<string, File> = {};
        for (const slot of layout.slots || []) {
          const key = `${layout.id}:${slot.id}`;
          const file = slotFiles[key];
          if (file) slotImageFiles[slot.id] = file;
        }

        if (layout.fabricJsonState) {
          const composedImage = await composeLayoutPng(
            layout.fabricJsonState,
            slotImageFiles,
            layout.width || 1000,
            layout.height || 1500,
          );
          formData.append("composedImage", composedImage, `pedido-manual-${layout.id}-${Date.now()}.png`);
        } else {
          for (const [slotId, file] of Object.entries(slotImageFiles)) {
            formData.append(slotFieldName(slotId), file);
          }
        }

        const response = await api.createManualPrintOrder(formData);
        setPrintJobId(response.printJobId || null);
        setJobStatus((response.status as JobStatus) || "PENDING");
        startPolling(response.orderId);
      }

      toast.success(`${selectedLayouts.length} layout(s) enviado(s) para impressão`);
    } catch (error: any) {
      console.error("Erro ao enviar pedido manual", error);
      setJobStatus("FAILED");
      setJobError(error?.response?.data?.error || error.message || "Erro ao enviar impressão");
      toast.error("Erro ao gerar pedido manual");
    } finally {
      setSubmitting(false);
    }
  };

  const retryPrint = async () => {
    if (!printJobId) return;
    await api.retryPrintJob(printJobId);
    setJobStatus("PENDING");
    setJobError(null);
    startPolling(printJobId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/30 p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Pedido Manual</h1>
            <p className="text-sm text-slate-500">Artes de pedidos recebidos pelo WhatsApp</p>
          </div>
          <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            agentConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}>
            <span className={`h-2 w-2 rounded-full ${agentConnected ? "bg-emerald-500" : "bg-red-400"}`} />
            {agentConnected ? (
              <span>Agente conectado{deviceName && <span className="ml-1 font-semibold">— {deviceName}</span>}</span>
            ) : (
              "Agente desconectado"
            )}
          </div>
        </div>

        {/* 1. Cliente */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">1. Cliente</h2>
            <p className="text-sm text-slate-400">Nome usado na pasta do Drive e no job de impressão.</p>
          </div>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nome do cliente"
            className="max-w-md"
          />
        </section>

        {/* 2. Layouts */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">2. Layouts</h2>
            <p className="text-sm text-slate-400">
              Selecione uma ou mais artes para impressão.
              {selectedLayoutIds.length > 0 && (
                <span className="ml-1 font-medium text-rose-600">
                  {selectedLayoutIds.length} selecionado(s)
                </span>
              )}
            </p>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando layouts...
            </div>
          ) : layouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-slate-400">
              Nenhum layout disponível
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {layouts.map((layout) => (
                <LayoutCard
                  key={layout.id}
                  layout={layout}
                  selected={selectedLayoutIds.includes(layout.id)}
                  onSelect={() => toggleLayout(layout.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 3. Customização por Layout */}
        {selectedLayouts.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900">3. Personalização</h2>
              <p className="text-sm text-slate-400">
                Envie as fotos para cada layout. Use o botão de recorte para ajustar a imagem.
              </p>
            </div>
            <div className="flex flex-col gap-5">
              {selectedLayouts.map((layout, idx) => (
                <LayoutPanel
                  key={layout.id}
                  layout={layout}
                  layoutIndex={idx}
                  slotFiles={Object.fromEntries(
                    Object.entries(slotFiles)
                      .filter(([k]) => k.startsWith(`${layout.id}:`))
                      .map(([k, v]) => [k.split(":")[1], v]),
                  )}
                  slotPreviews={Object.fromEntries(
                    Object.entries(slotPreviews)
                      .filter(([k]) => k.startsWith(`${layout.id}:`))
                      .map(([k, v]) => [k.split(":")[1], v]),
                  )}
                  onSlotFile={(lid, sid, f) => updateSlotFile(lid, sid, f)}
                  onRemoveLayout={() => removeLayout(layout.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 4. Cartinha */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              {selectedLayouts.length > 0 ? "4" : "3"}. Cartinha
            </h2>
            <p className="text-sm text-slate-400">A mensagem será gerada como .docx separado.</p>
          </div>
          <Textarea
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value)}
            placeholder="Mensagem da cartinha (opcional)"
            className="min-h-28"
          />
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={!agentConnected ? "Agente de impressão desconectado" : undefined}
            className="bg-rose-500 hover:bg-rose-600"
          >
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Printer className="mr-1 h-4 w-4" />}
            {selectedLayouts.length > 1
              ? `Imprimir ${selectedLayouts.length} layouts`
              : "Gerar e Imprimir"}
          </Button>
          {jobStatus && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              {jobStatus === "PRINTED" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : jobStatus === "FAILED" ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              )}
              <span>{statusLabels[jobStatus]}</span>
            </div>
          )}
          {jobStatus === "FAILED" && printJobId && (
            <Button variant="outline" onClick={retryPrint}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Tentar novamente
            </Button>
          )}
        </div>
        {jobError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{jobError}</div>
        )}
      </div>
    </div>
  );
}
