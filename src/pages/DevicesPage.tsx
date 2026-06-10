import { useEffect, useState, useCallback } from "react";
import { useApi } from "../services/api";
import {
  Monitor,
  Wifi,
  WifiOff,
  Star,
  Trash2,
  RefreshCw,
  ChevronDown,
  Save,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

interface DevicePrinter {
  name: string;
  status: number;
}

interface Device {
  deviceId: string;
  deviceName: string;
  ip: string;
  printers: DevicePrinter[];
  connectedAt: string;
  lastSeenAt: string;
  isDefault: boolean;
  isActive: boolean;
}

const PRINTER_STATUS: Record<
  number,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  0: { label: "Idle", variant: "default" },
  1: { label: "Pausada", variant: "secondary" },
  2: { label: "Erro", variant: "destructive" },
  3: { label: "Removendo", variant: "outline" },
  8: { label: "Economia", variant: "secondary" },
};

export function DevicesPage() {
  const api = useApi();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  // Printer config state (global — syncs to default device)
  const [photoPrinter, setPhotoPrinter] = useState("");
  const [letterPrinter, setLetterPrinter] = useState("");
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [savingPrinter, setSavingPrinter] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await api.get("/print-agent/devices");
      setDevices(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadPrinterConfig = useCallback(async () => {
    try {
      const [printersRes, configRes] = await Promise.all([
        api.getAvailablePrinters(),
        api.getPrinterConfig(),
      ]);
      setAvailablePrinters(printersRes.printers);
      const cfg = configRes as Record<string, any>;
      setPhotoPrinter(cfg.photo?.printerName ?? "");
      setLetterPrinter(cfg.letter?.printerName ?? "");
    } catch {
      /* silent */
    }
  }, [api]);

  useEffect(() => {
    fetchDevices();
    loadPrinterConfig();
  }, [fetchDevices, loadPrinterConfig]);

  // SSE for real-time updates
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "";
    const source = new EventSource(`${baseUrl}/print-agent/devices/stream`);
    source.onmessage = (e) => {
      try {
        const update: Partial<Device> & { deviceId: string } = JSON.parse(
          e.data,
        );
        setDevices((prev) =>
          prev.map((d) =>
            d.deviceId === update.deviceId ? { ...d, ...update } : d,
          ),
        );
      } catch {
        /* ignore */
      }
    };
    return () => source.close();
  }, [api]);

  const setDefault = async (deviceId: string) => {
    await api.put(`/print-agent/devices/${deviceId}/default`, {});
    setDevices((prev) =>
      prev.map((d) => ({ ...d, isDefault: d.deviceId === deviceId })),
    );
    toast.success("Dispositivo padrão atualizado");
  };

  const removeDevice = async (deviceId: string) => {
    if (!confirm("Remover este dispositivo?")) return;
    await api.delete(`/print-agent/devices/${deviceId}`);
    setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
    toast.success("Dispositivo removido");
  };

  const savePrinterForRole = async (
    role: "photo" | "letter",
    printerName: string,
  ) => {
    setSavingPrinter(true);
    try {
      await api.savePrinterConfig(role, { printerName, isActive: true });
      toast.success(
        `Impressora de ${role === "photo" ? "fotos" : "cartinhas"} salva`,
      );
    } catch {
      toast.error("Erro ao salvar impressora");
    } finally {
      setSavingPrinter(false);
    }
  };

  const onlineCount = devices.filter((d) => d.isActive).length;

  return (
    <div className="p-6 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Dispositivos</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {onlineCount} online de {devices.length} total
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchDevices();
            loadPrinterConfig();
          }}
          disabled={loading}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </div>

      {devices.length === 0 && !loading ? (
        <div className="text-center py-16 text-neutral-400">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum dispositivo conectado ainda</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {devices.map((device) => {
            const isExpanded = expandedDevice === device.deviceId;
            return (
              <div
                key={device.deviceId}
                className={`rounded-xl border transition-all ${
                  device.isActive
                    ? "bg-white border-neutral-200"
                    : "bg-neutral-50 border-neutral-100 opacity-70"
                }`}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer"
                  onClick={() =>
                    setExpandedDevice(isExpanded ? null : device.deviceId)
                  }
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      device.isActive
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-neutral-100 text-neutral-400"
                    }`}
                  >
                    {device.isActive ? (
                      <Wifi size={20} />
                    ) : (
                      <WifiOff size={20} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">
                        {device.deviceName}
                      </span>
                      {device.isDefault && (
                        <Badge
                          variant="default"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Padrão
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      IP: {device.ip || "—"} •{" "}
                      {new Date(device.lastSeenAt).toLocaleString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!device.isDefault && device.isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Definir como padrão"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDefault(device.deviceId);
                        }}
                      >
                        <Star size={14} />
                      </Button>
                    )}
                    {!device.isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        title="Remover"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDevice(device.deviceId);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                    <ChevronDown
                      size={16}
                      className={`text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-neutral-100 p-4 space-y-4">
                    {/* Printer list */}
                    {Array.isArray(device.printers) &&
                      device.printers.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-neutral-500 mb-2">
                            IMPRESSORAS CONECTADAS
                          </p>
                          <div className="flex gap-1.5 flex-wrap">
                            {device.printers.map((p) => {
                              const info =
                                PRINTER_STATUS[p.status] ?? PRINTER_STATUS[0];
                              return (
                                <Badge
                                  key={p.name}
                                  variant={info.variant}
                                  className="text-[10px]"
                                >
                                  {p.name} ({info.label})
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* Printer role config — only for default device */}
                    {device.isDefault && device.isActive && (
                      <div>
                        <p className="text-xs font-semibold text-neutral-500 mb-2">
                          CONFIGURAÇÃO DE IMPRESSORAS
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-xs text-neutral-500">
                              Fotos & Quadros
                            </label>
                            <div className="flex gap-2">
                              <select
                                className="flex-1 text-sm border rounded-lg px-3 py-1.5"
                                value={photoPrinter}
                                onChange={(e) =>
                                  setPhotoPrinter(e.target.value)
                                }
                              >
                                <option value="">Selecionar...</option>
                                {availablePrinters.map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!photoPrinter || savingPrinter}
                                onClick={() =>
                                  savePrinterForRole("photo", photoPrinter)
                                }
                              >
                                <Save size={14} />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-neutral-500">
                              Cartinhas
                            </label>
                            <div className="flex gap-2">
                              <select
                                className="flex-1 text-sm border rounded-lg px-3 py-1.5"
                                value={letterPrinter}
                                onChange={(e) =>
                                  setLetterPrinter(e.target.value)
                                }
                              >
                                <option value="">Selecionar...</option>
                                {availablePrinters.map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!letterPrinter || savingPrinter}
                                onClick={() =>
                                  savePrinterForRole("letter", letterPrinter)
                                }
                              >
                                <Save size={14} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
