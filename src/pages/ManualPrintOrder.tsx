import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Printer, RefreshCw, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import useApi from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

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

    if (!frame) {
      console.warn("Slot não encontrado no fabricJsonState", { slotId });
      continue;
    }

    const dataUrl = await fileToDataUrl(file);
    const image = await FabricImage.fromURL(dataUrl, {
      crossOrigin: "anonymous",
    });
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
  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier: 4,
    enableRetinaScaling: false,
  });
  canvas.dispose();

  const response = await fetch(dataUrl);
  return await response.blob();
}

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

export function ManualPrintOrder() {
  const api = useApi();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slotPreviewsRef = useRef<Record<string, string | undefined>>({});
  const [customerName, setCustomerName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [layouts, setLayouts] = useState<DynamicLayoutOption[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState("");
  const [slotFiles, setSlotFiles] = useState<Record<string, File | undefined>>({});
  const [slotPreviews, setSlotPreviews] = useState<Record<string, string | undefined>>({});
  const [agentConnected, setAgentConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [printJobId, setPrintJobId] = useState<string | null>(null);

  const selectedLayout = useMemo(
    () => layouts.find((layout) => layout.id === selectedLayoutId),
    [layouts, selectedLayoutId],
  );

  const missingRequiredSlots = useMemo(
    () => (selectedLayout?.slots || []).filter((slot) => slot.required && !slotFiles[slot.id]),
    [selectedLayout, slotFiles],
  );

  const canSubmit =
    customerName.trim().length > 0 &&
    Boolean(selectedLayout) &&
    missingRequiredSlots.length === 0 &&
    agentConnected &&
    !submitting;

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
        setLayouts((Array.isArray(layoutData) ? layoutData : []).filter((layout) => layout.type === "frame"));
        setAgentConnected(Boolean(agentStatus.connected));
      } catch (error) {
        toast.error("Erro ao carregar dados de impressão manual");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [api]);

  useEffect(() => {
    slotPreviewsRef.current = slotPreviews;
  }, [slotPreviews]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      Object.values(slotPreviewsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const updateSlotFile = (slotId: string, file?: File) => {
    setSlotFiles((prev) => ({ ...prev, [slotId]: file }));
    setSlotPreviews((prev) => {
      if (prev[slotId]) URL.revokeObjectURL(prev[slotId]);
      return { ...prev, [slotId]: file ? URL.createObjectURL(file) : undefined };
    });
  };

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
        // Job pode ainda estar sendo criado (404); manter polling.
      }
    }, 2000);
  };

  const handleSubmit = async () => {
    if (!selectedLayout || !canSubmit) return;

    const formData = new FormData();
    formData.append("customerName", customerName.trim());
    formData.append("layoutId", selectedLayout.id);
    if (giftMessage.trim()) formData.append("giftMessage", giftMessage.trim());

    setSubmitting(true);
    setJobStatus("PENDING");
    setJobError(null);

    try {
      const slotImageFiles: Record<string, File> = {};
      for (const slot of selectedLayout.slots || []) {
        const file = slotFiles[slot.id];
        if (file) slotImageFiles[slot.id] = file;
      }

      if (selectedLayout.fabricJsonState) {
        const composedImage = await composeLayoutPng(
          selectedLayout.fabricJsonState,
          slotImageFiles,
          selectedLayout.width || 1000,
          selectedLayout.height || 1500,
        );
        formData.append("composedImage", composedImage, `pedido-manual-${Date.now()}.png`);
      } else {
        for (const [slotId, file] of Object.entries(slotImageFiles)) {
          formData.append(slotFieldName(slotId), file);
        }
      }

      const response = await api.createManualPrintOrder(formData);
      setPrintJobId(response.printJobId || null);
      setJobStatus((response.status as JobStatus) || "PENDING");
      startPolling(response.orderId);
      toast.success("Pedido manual enviado para impressão");
    } catch (error: any) {
      console.error("Erro ao enviar pedido manual", {
        error,
        status: error?.response?.status,
        responseData: error?.response?.data,
        customerName: customerName.trim(),
        layoutId: selectedLayout.id,
        layoutName: selectedLayout.name,
        slotIds: (selectedLayout.slots || []).map((slot) => slot.id),
        sentFileFields: Array.from(formData.keys()).filter(
          (key) => key === "composedImage" || key.startsWith("slot:"),
        ),
        agentConnected,
      });
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Pedido Manual</h1>
            <p className="text-sm text-slate-500">Artes de pedidos recebidos pelo WhatsApp</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
            <span className={agentConnected ? "text-emerald-600" : "text-red-600"}>
              {agentConnected ? "Agente conectado" : "Agente desconectado"}
            </span>
          </div>
        </div>

        <section className="grid gap-4 rounded-lg border bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">1. Cliente</h2>
            <p className="text-sm text-slate-500">Nome usado na pasta do Drive e no job de impressão.</p>
          </div>
          <Input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Nome do cliente"
            className="max-w-md"
          />
        </section>

        <section className="grid gap-4 rounded-lg border bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">2. Layout</h2>
            <p className="text-sm text-slate-500">Selecione a arte base que receberá as fotos.</p>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando layouts...
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {layouts.map((layout) => {
                const selected = layout.id === selectedLayoutId;
                return (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => {
                      setSelectedLayoutId(layout.id);
                      setSlotFiles({});
                      Object.values(slotPreviewsRef.current).forEach((url) => {
                        if (url) URL.revokeObjectURL(url);
                      });
                      setSlotPreviews({});
                    }}
                    className={`overflow-hidden rounded-lg border bg-white text-left transition ${
                      selected ? "border-rose-500 ring-2 ring-rose-100" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="aspect-[4/3] bg-slate-100">
                      {(layout.previewImageUrl || layout.baseImageUrl) && (
                        <img
                          src={layout.previewImageUrl || layout.baseImageUrl || ""}
                          alt={layout.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <div className="line-clamp-2 text-sm font-medium text-slate-900">{layout.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{layout.slots?.length || 0} slot(s)</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedLayout && (
          <section className="grid gap-4 rounded-lg border bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">3. Fotos</h2>
              <p className="text-sm text-slate-500">Envie cada imagem no slot correto.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(selectedLayout.slots || []).map((slot) => (
                <div key={slot.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-900">
                      {slot.label}
                      {slot.required && <span className="ml-1 text-rose-600">*</span>}
                    </div>
                    {slotFiles[slot.id] && (
                      <button
                        type="button"
                        onClick={() => updateSlotFile(slot.id)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Remover imagem"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <label
                    className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 transition hover:border-rose-300 hover:bg-rose-50"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files?.[0];
                      if (file) updateSlotFile(slot.id, file);
                    }}
                  >
                    {slotPreviews[slot.id] ? (
                      <img src={slotPreviews[slot.id]} alt={slot.label} className="h-52 w-full rounded-md object-cover object-center" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6" />
                        <span>Clique ou arraste a imagem aqui</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) updateSlotFile(slot.id, file);
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-4 rounded-lg border bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">4. Cartinha</h2>
            <p className="text-sm text-slate-500">A mensagem será gerada como .docx separado.</p>
          </div>
          <Textarea
            value={giftMessage}
            onChange={(event) => setGiftMessage(event.target.value)}
            placeholder="Mensagem da cartinha (opcional)"
            className="min-h-32"
          />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSubmit} disabled={!canSubmit} title={!agentConnected ? "Agente de impressão desconectado" : undefined}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Gerar e Imprimir
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
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          )}
        </div>
        {jobError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{jobError}</div>}
      </div>
    </div>
  );
}
