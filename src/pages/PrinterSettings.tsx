import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Loader2,
  Printer,
  Send,
  Wifi,
  WifiOff,
  Package,
  LayoutGrid,
  Check,
  X,
} from "lucide-react";

type Tab = "config" | "simulator";
type PollingState =
  | "idle"
  | "pending"
  | "sent"
  | "received"
  | "printing"
  | "printed"
  | "failed";

const POLLING_STATUS_MAP: Record<string, PollingState> = {
  PENDING: "pending",
  SENT: "sent",
  RECEIVED: "received",
  PRINTING: "printing",
  PRINTED: "printed",
  FAILED: "failed",
};

const POLLING_LABELS: Record<PollingState, string> = {
  idle: "",
  pending: "Enfileirando job...",
  sent: "Enviado para o agente...",
  received: "Agente recebeu — baixando arquivos...",
  printing: "Imprimindo...",
  printed: "✓ Impresso com sucesso",
  failed: "✗ Falhou",
};

const POLLING_INTERVAL = 2000;

interface CustomizationFormValue {
  itemId: string;
  customizationId: string;
  type: string;
  value: string;
}

interface SelectedProduct {
  productId: string;
  quantity: number;
  customizations: CustomizationFormValue[];
}

export function PrinterSettings() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>("config");

  // Shared
  const [agentConnected, setAgentConnected] = useState(false);

  // === Tab: Config ===
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [agentOnline, setAgentOnline] = useState(false);
  const [photoPrinter, setPhotoPrinter] = useState("");
  const [letterPrinter, setLetterPrinter] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingLetter, setSavingLetter] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // === Tab: Simulator ===
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selected, setSelected] = useState<Record<string, SelectedProduct>>({});
  const [giftMessage, setGiftMessage] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [pollingState, setPollingState] = useState<PollingState>("idle");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [availableLayouts, setAvailableLayouts] = useState<any[]>([]);
  const [showLayoutPicker, setShowLayoutPicker] = useState<string | null>(null);
  const [layoutImageSlots, setLayoutImageSlots] = useState<
    Record<string, Record<string, string>>
  >({});

  // Load agent status periodically
  useEffect(() => {
    const fetch = async () => {
      try {
        const status = await api.getAgentStatus();
        setAgentConnected(status.connected);
      } catch {
        setAgentConnected(false);
      }
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [api]);

  // Load printers and config
  const loadPrinterData = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const [printersRes, configRes] = await Promise.all([
        api.getAvailablePrinters(),
        api.getPrinterConfig(),
      ]);
      setAvailablePrinters(printersRes.printers);
      setAgentOnline(printersRes.agentConnected);
      const cfg = configRes as Record<string, any>;
      setPhotoPrinter(cfg.photo?.printerName ?? "");
      setLetterPrinter(cfg.letter?.printerName ?? "");
    } catch {
      toast.error("Erro ao carregar configuração de impressoras");
    } finally {
      setLoadingConfig(false);
    }
  }, [api]);

  useEffect(() => {
    loadPrinterData();
  }, [loadPrinterData]);

  // Load products and layouts for simulator
  useEffect(() => {
    if (tab !== "simulator") return;
    setLoadingProducts(true);
    Promise.all([
      api.getSimulateProducts(),
      api.getDynamicLayouts(),
    ])
      .then(([prodRes, layouts]) => {
        setProducts(prodRes.products || []);
        setAvailableLayouts(
          Array.isArray(layouts) ? layouts : layouts?.layouts || layouts?.data || [],
        );
      })
      .catch(() => toast.error("Erro ao carregar dados"))
      .finally(() => setLoadingProducts(false));
  }, [tab, api]);

  const handleSavePrinter = async (
    role: "photo" | "letter",
    printerName: string,
  ) => {
    const setSaving = role === "photo" ? setSavingPhoto : setSavingLetter;
    setSaving(true);
    try {
      await api.savePrinterConfig(role, { printerName, isActive: true });
      toast.success(
        `Impressora ${role === "photo" ? "de fotos" : "de cartinhas"} salva`,
      );
      await loadPrinterData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrinter = async (role: "photo" | "letter") => {
    try {
      await api.deletePrinterConfig(role);
      toast.success("Configuração removida");
      await loadPrinterData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao remover");
    }
  };

  // Toggle product selection
  const toggleProduct = (product: any) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[product.id]) {
        delete next[product.id];
      } else {
        // Gather all customizations from components and additionals
        const customizations: CustomizationFormValue[] = [];
        const seen = new Set<string>();

        const addCust = (item: any) => {
          if (!item.customizations) return;
          for (const c of item.customizations) {
            const key = `${item.id}-${c.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            customizations.push({
              itemId: item.id,
              customizationId: c.id,
              type: c.type,
              value: "",
            });
          }
        };

        for (const comp of product.components || []) {
          if (comp.item) addCust(comp.item);
        }
        for (const add of product.additionals || []) {
          if (add.additional) addCust(add.additional);
        }

        next[product.id] = {
          productId: product.id,
          quantity: 1,
          customizations,
        };
      }
      return next;
    });
  };

  // Update customization value
  const updateCustValue = (
    productId: string,
    customizationId: string,
    value: string,
  ) => {
    setSelected((prev) => {
      const sel = prev[productId];
      if (!sel) return prev;
      return {
        ...prev,
        [productId]: {
          ...sel,
          customizations: sel.customizations.map((c) =>
            c.customizationId === customizationId ? { ...c, value } : c,
          ),
        },
      };
    });
  };

  // Get customization input based on type
  const renderCustInput = (
    productId: string,
    cust: CustomizationFormValue,
    custDef: any,
  ) => {
    const value = cust.value;

    if (cust.type === "TEXT") {
      return (
        <Textarea
          placeholder={
            custDef?.description || custDef?.name || "Digite o texto"
          }
          value={value}
          onChange={(e) =>
            updateCustValue(productId, cust.customizationId, e.target.value)
          }
          rows={2}
          className="text-sm"
        />
      );
    }

    if (cust.type === "MULTIPLE_CHOICE") {
      const options: any[] =
        custDef?.customization_data?.options ||
        custDef?.customization_data?.choices ||
        [];
      return (
        <select
          className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm"
          value={value}
          onChange={(e) =>
            updateCustValue(productId, cust.customizationId, e.target.value)
          }
        >
          <option value="">Selecione...</option>
          {options.map((opt: any, i: number) => {
            const optValue = typeof opt === "string" ? opt : opt.label || opt.name || opt.id;
            return (
              <option key={i} value={optValue}>
                {optValue}
              </option>
            );
          })}
        </select>
      );
    }

    if (cust.type === "IMAGES") {
      return (
        <div className="text-xs text-neutral-400 italic">
          Imagens: use o fluxo normal de upload no pedido real
        </div>
      );
    }

    if (cust.type === "DYNAMIC_LAYOUT") {
      const rawLayouts: any[] =
        custDef?.customization_data?.layouts || [];
      const configuredLayouts = rawLayouts.length > 0
        ? rawLayouts.map((l: any) => {
            const full = availableLayouts.find((al: any) => al.id === l.id);
            return full ? { ...l, fabricJsonState: full.fabricJsonState } : l;
          })
        : availableLayouts;
      const selectedLayout = configuredLayouts.find(
        (l: any) => l.name === value,
      );

      return (
        <div className="space-y-2">
          {!value && configuredLayouts.length > 0 && (
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-700 underline"
              onClick={() => setShowLayoutPicker(cust.customizationId)}
            >
              Escolher layout
            </button>
          )}
          {!value && configuredLayouts.length === 0 && (
            <div className="text-xs text-neutral-400 italic">
              Nenhum layout configurado para esta customização
            </div>
          )}
          {value && selectedLayout && (
            <div className="bg-neutral-50 border border-neutral-200 rounded p-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedLayout.previewImageUrl && (
                    <img
                      src={selectedLayout.previewImageUrl}
                      alt={selectedLayout.name}
                      className="w-10 h-10 object-cover rounded"
                    />
                  )}
                  <span className="text-sm font-medium text-neutral-700">
                    {selectedLayout.name}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-neutral-400 hover:text-red-500"
                  onClick={() =>
                    updateCustValue(productId, cust.customizationId, "")
                  }
                >
                  <X size={14} />
                </button>
              </div>
              {(() => {
                const imageSlots: any[] = [];
                const objs =
                  selectedLayout.fabricJsonState?.objects || [];
                for (const obj of objs) {
                  if (obj.type === "image" && !obj.src?.includes("baseImageUrl")) {
                    imageSlots.push(obj);
                  }
                }
                if (imageSlots.length > 0) {
                  return (
                    <div className="space-y-1.5 pt-1 border-t border-neutral-200">
                      <span className="text-xs font-medium text-neutral-500">
                        {imageSlots.length} slot(ns) para foto
                      </span>
                      {imageSlots.map((slot: any, i: number) => {
                        const slotId = slot.id || `slot_${i}`;
                        const slots = layoutImageSlots[cust.customizationId] || {};
                        return (
                          <div key={slotId}>
                            <label className="text-xs text-neutral-500 block mb-0.5">
                              {slot.name || `Slot ${i + 1}`}
                            </label>
                            <Input
                              placeholder="URL da imagem (opcional)"
                              className="text-xs h-8"
                              value={slots[slotId] || ""}
                              onChange={(e) => {
                                setLayoutImageSlots((prev) => ({
                                  ...prev,
                                  [cust.customizationId]: {
                                    ...(prev[cust.customizationId] || {}),
                                    [slotId]: e.target.value,
                                  },
                                }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
          {showLayoutPicker === cust.customizationId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl max-w-lg w-full max-h-[70vh] overflow-y-auto p-4 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">
                    Selecione um layout
                  </span>
                  <button
                    type="button"
                    className="text-neutral-400 hover:text-neutral-600"
                    onClick={() => setShowLayoutPicker(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
                {configuredLayouts.length === 0 && (
                  <div className="text-sm text-neutral-400 py-4 text-center">
                    Nenhum layout configurado para esta customização
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {configuredLayouts.map((layout: any) => (
                    <button
                      key={layout.id}
                      type="button"
                      className="border border-neutral-200 rounded-lg p-3 text-left hover:border-neutral-400 transition-colors"
                      onClick={() => {
                        updateCustValue(
                          productId,
                          cust.customizationId,
                          layout.name,
                        );
                        setShowLayoutPicker(null);
                      }}
                    >
                      {layout.previewImageUrl && (
                        <img
                          src={layout.previewImageUrl}
                          alt={layout.name}
                          className="w-full h-24 object-cover rounded mb-1"
                        />
                      )}
                      <span className="text-sm font-medium text-neutral-700">
                        {layout.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <Input
        placeholder={custDef?.name || "Valor"}
        value={value}
        onChange={(e) =>
          updateCustValue(productId, cust.customizationId, e.target.value)
        }
        className="text-sm"
      />
    );
  };

  const handleSimulate = async () => {
    const selectedItems = Object.values(selected);
    if (selectedItems.length === 0) return;

    setSimulating(true);
    setPollingState("pending");
    try {
      const res = await api.simulatePrototype({
        items: selectedItems.map((s) => ({
          productId: s.productId,
          quantity: s.quantity,
          customizations: s.customizations
            .filter((c) => c.value.trim())
            .map((c) => {
              if (c.type === "DYNAMIC_LAYOUT") {
                const slots = layoutImageSlots[c.customizationId] || {};
                const slotUrls = Object.fromEntries(
                  Object.entries(slots).filter(([_, url]) => url.trim()),
                );
                return {
                  ...c,
                  value: JSON.stringify({
                    layoutName: c.value,
                    slotImages: slotUrls,
                  }),
                };
              }
              return c;
            }),
        })),
        giftMessage: giftMessage || undefined,
      });

      if (!res.ok || !res.orderId) {
        setPollingState("failed");
        toast.error("Simulação falhou");
        return;
      }

      pollingRef.current = setInterval(async () => {
        try {
          const job = await api.getPrintJobStatus(res.orderId!);
          const s = POLLING_STATUS_MAP[job.status] || "pending";
          setPollingState(s);
          if (s === "printed" || s === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            if (s === "printed") toast.success("Impressão concluída!");
            else toast.error(job.lastError || "Falha na impressão");
          }
        } catch {
          // Job pode ainda estar sendo criado (404); manter polling.
        }
      }, POLLING_INTERVAL);
    } catch (err: any) {
      setPollingState("failed");
      toast.error(err.response?.data?.error || "Erro ao simular");
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const statusColor = agentConnected ? "bg-emerald-500" : "bg-red-500";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-3">
          <Printer size={32} />
          Impressoras
        </h1>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span
            className={`w-2.5 h-2.5 rounded-full ${statusColor} inline-block`}
          />
          {agentConnected ? "Agente online" : "Agente offline"}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        <button
          onClick={() => setTab("config")}
          className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
            tab === "config"
              ? "bg-white text-neutral-900 border border-b-white border-neutral-200 -mb-px"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          Configuração
        </button>
        <button
          onClick={() => {
            window.location.href = "/impressao/manual";
          }}
          className="px-4 py-2 text-sm font-medium transition-colors rounded-t-lg text-neutral-500 hover:text-neutral-700"
        >
          Pedido Manual
        </button>
      </div>

      {/* TAB: Configuration */}
      {tab === "config" && (
        <div className="space-y-6">
          {loadingConfig ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin w-6 h-6 text-neutral-400" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Printer size={18} />
                    Fotos e Quadros
                    <span className="text-xs font-normal text-neutral-400">
                      (A6 / 10×15cm)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {agentOnline ? (
                    <select
                      className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm"
                      value={photoPrinter}
                      onChange={(e) => setPhotoPrinter(e.target.value)}
                    >
                      <option value="">Selecione uma impressora</option>
                      {availablePrinters.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Nome da impressora"
                      value={photoPrinter}
                      onChange={(e) => setPhotoPrinter(e.target.value)}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSavePrinter("photo", photoPrinter)}
                      disabled={savingPhoto || !photoPrinter.trim()}
                    >
                      {savingPhoto ? (
                        <Loader2 className="animate-spin w-4 h-4 mr-1" />
                      ) : null}
                      Salvar
                    </Button>
                    {photoPrinter && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeletePrinter("photo")}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Printer size={18} />
                    Cartinhas
                    <span className="text-xs font-normal text-neutral-400">
                      (A4)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {agentOnline ? (
                    <select
                      className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm"
                      value={letterPrinter}
                      onChange={(e) => setLetterPrinter(e.target.value)}
                    >
                      <option value="">Selecione uma impressora</option>
                      {availablePrinters.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Nome da impressora"
                      value={letterPrinter}
                      onChange={(e) => setLetterPrinter(e.target.value)}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSavePrinter("letter", letterPrinter)}
                      disabled={savingLetter || !letterPrinter.trim()}
                    >
                      {savingLetter ? (
                        <Loader2 className="animate-spin w-4 h-4 mr-1" />
                      ) : null}
                      Salvar
                    </Button>
                    {letterPrinter && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeletePrinter("letter")}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* TAB: Simulator */}
      {tab === "simulator" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package size={18} />
                Protótipo de Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingProducts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin w-6 h-6 text-neutral-400" />
                </div>
              ) : (
                <>
                  {/* Product selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {products.map((product: any) => {
                      const isSelected = !!selected[product.id];
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => toggleProduct(product)}
                          className={`text-left rounded-lg border p-3 transition-all ${
                            isSelected
                              ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
                              : "border-neutral-200 hover:border-neutral-300"
                          }`}
                        >
                          <div className="font-semibold text-sm text-neutral-800">
                            {product.name}
                          </div>
                          <div className="text-xs text-neutral-400 mt-1">
                            R$ {product.price?.toFixed(2) ?? "0,00"}
                          </div>
                          {isSelected && (
                            <div className="text-xs text-emerald-600 mt-1 font-medium">
                              ✓ Selecionado
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Customization forms for selected products */}
                  {Object.keys(selected).length > 0 && (
                    <div className="space-y-4">
                      {Object.entries(selected).map(([productId, sel]) => {
                        const product = products.find(
                          (p: any) => p.id === productId,
                        );
                        return (
                          <div
                            key={productId}
                            className="border border-neutral-200 rounded-lg p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-neutral-800">
                                {product?.name || productId}
                              </span>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-neutral-500">
                                  Qtd:
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={99}
                                  className="w-16 h-8 text-sm"
                                  value={sel.quantity}
                                  onChange={(e) => {
                                    const q = Math.max(
                                      1,
                                      parseInt(e.target.value) || 1,
                                    );
                                    setSelected((prev) => ({
                                      ...prev,
                                      [productId]: { ...sel, quantity: q },
                                    }));
                                  }}
                                />
                              </div>
                            </div>

                            {sel.customizations.length > 0 && (
                              <div className="space-y-2 pl-2 border-l-2 border-neutral-100">
                                {sel.customizations.map((cust) => {
                                  // Find customization definition from product data
                                  const allComps = [
                                    ...(product?.components || []).map(
                                      (c: any) => c.item,
                                    ),
                                    ...(product?.additionals || []).map(
                                      (a: any) => a.additional,
                                    ),
                                  ];
                                  const item = allComps.find(
                                    (i: any) => i?.id === cust.itemId,
                                  );
                                  const custDef = item?.customizations?.find(
                                    (c: any) => c.id === cust.customizationId,
                                  );
                                  return (
                                    <div key={cust.customizationId}>
                                      <label className="text-xs font-medium text-neutral-600 block mb-1">
                                        {custDef?.name ||
                                          cust.customizationId.slice(0, 8)}
                                        {custDef?.isRequired ? " *" : ""}
                                      </label>
                                      {renderCustInput(
                                        productId,
                                        cust,
                                        custDef,
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Gift message */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">
                      Mensagem da Cartinha
                      <span className="text-xs text-neutral-400 ml-1">
                        (opcional)
                      </span>
                    </label>
                    <Textarea
                      placeholder="Texto da cartinha que será gerada em .docx"
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Simulate button */}
                  <div className="flex items-center gap-3">
                    <Button
                      disabled={
                        Object.keys(selected).length === 0 ||
                        !agentConnected ||
                        simulating
                      }
                      onClick={handleSimulate}
                    >
                      {simulating ? (
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      {simulating
                        ? "Simulando..."
                        : "Simular Impressão"}
                    </Button>

                    {!agentConnected && (
                      <span className="flex items-center gap-1.5 text-xs text-red-600">
                        <WifiOff className="w-3 h-3" />
                        Agente offline — simulador desabilitado
                      </span>
                    )}
                  </div>

                  {/* Polling status */}
                  {pollingState !== "idle" && (
                    <div
                      className={`rounded-md px-3 py-2 text-sm font-medium text-center ${
                        pollingState === "printed"
                          ? "bg-emerald-50 text-emerald-700"
                          : pollingState === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {pollingState === "pending" ||
                      pollingState === "sent" ||
                      pollingState === "received" ||
                      pollingState === "printing" ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="animate-spin w-4 h-4" />
                          {POLLING_LABELS[pollingState]}
                        </span>
                      ) : (
                        POLLING_LABELS[pollingState]
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
