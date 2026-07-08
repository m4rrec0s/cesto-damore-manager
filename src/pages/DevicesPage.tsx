import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  Monitor,
  RefreshCw,
  Save,
  Star,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import useApi from "../services/api";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

/* ─── Types ────────────────────────────────────────────────────────────── */

interface DevicePrinter {
  name: string;
  status: number;
  role?: 'photo' | 'letter' | null;
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

interface DevicePrinterConfig {
  photo: string;
  letter: string;
}

interface PrintSettings {
  paperSize?: string;
  orientation?: string;
  fitToPage?: boolean;
  customFlags?: string;
}

interface DevicePrintSettings {
  photoSettings?: PrintSettings;
  letterSettings?: PrintSettings;
}

/* ─── Constants ────────────────────────────────────────────────────────── */

const PRINTER_STATUS: Record<
  number,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  0: { label: "Pronta", variant: "default" },
  1: { label: "Pausada", variant: "secondary" },
  2: { label: "Erro", variant: "destructive" },
  3: { label: "Removendo", variant: "outline" },
  8: { label: "Economia", variant: "secondary" },
};

/* ─── Component ────────────────────────────────────────────────────────── */

export function DevicesPage() {
  const api = useApi();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  // Per-device printer config
  const [deviceConfigs, setDeviceConfigs] = useState<
    Record<string, DevicePrinterConfig>
  >({});
  const [savingPrinter, setSavingPrinter] = useState(false);

  // Per-device print settings
  const [devicePrintSettings, setDevicePrintSettings] = useState<
    Record<string, DevicePrintSettings>
  >({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Per-device paper sizes (loaded from device printer)
  const [paperSizes, setPaperSizes] = useState<
    Record<string, Record<string, Array<{ name: string; kind: number; width: number; height: number }>>>
  >({});

  /* ─── Fetch devices ──────────────────────────────────────────────────── */

  const fetchDevices = useCallback(async () => {
    try {
      const res = await api.get("/print-agent/devices");
      const data = res.data as Device[];
      setDevices(data);
      // Pre-populate printer configs from all devices
      const configs: Record<string, DevicePrinterConfig> = {};
      const settings: Record<string, DevicePrintSettings> = {};
      for (const d of data) {
        const photoPrinter = d.printers?.find((p) => p.role === 'photo');
        const letterPrinter = d.printers?.find((p) => p.role === 'letter');
        configs[d.deviceId] = {
          photo: photoPrinter?.name ?? "",
          letter: letterPrinter?.name ?? "",
        };
        // Load print settings from backend
        try {
          const settingsData = await api.getPrinterConfig(d.deviceId);
          settings[d.deviceId] = {
            photoSettings: settingsData.photoSettings ?? undefined,
            letterSettings: settingsData.letterSettings ?? undefined,
          };
        } catch {
          settings[d.deviceId] = {};
        }
      }
      setDeviceConfigs(configs);
      setDevicePrintSettings(settings);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  /* ─── SSE for real-time updates ──────────────────────────────────────── */

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "";
    const apiKey =
      import.meta.env.VITE_API_KEY ||
      import.meta.env.VITE_AI_AGENT_API_KEY ||
      import.meta.env.VITE_AI_API_KEY ||
      "";
    const params = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : "";
    const source = new EventSource(`${baseUrl}/print-agent/devices/stream${params}`);
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
        // Sync printer configs if printers changed
        if (update.printers) {
          const photoPrinter = update.printers.find((p: any) => p.role === 'photo');
          const letterPrinter = update.printers.find((p: any) => p.role === 'letter');
          setDeviceConfigs((prev) => ({
            ...prev,
            [update.deviceId]: {
              photo: photoPrinter?.name ?? prev[update.deviceId]?.photo ?? "",
              letter: letterPrinter?.name ?? prev[update.deviceId]?.letter ?? "",
            },
          }));
        }
      } catch {
        /* ignore */
      }
    };
    return () => source.close();
  }, []);

  /* ─── Load printer config for a device ───────────────────────────────── */

  const loadDevicePrinterConfig = useCallback(
    async (deviceId: string) => {
      try {
        // Get config from the device's printers field
        const device = devices.find((d) => d.deviceId === deviceId)
        if (!device) return
        
        const photoPrinter = device.printers.find((p) => p.role === 'photo')
        const letterPrinter = device.printers.find((p) => p.role === 'letter')
        
        setDeviceConfigs((prev) => ({
          ...prev,
          [deviceId]: {
            photo: photoPrinter?.name ?? "",
            letter: letterPrinter?.name ?? "",
          },
        }));
      } catch {
        /* silent */
      }
    },
    [devices],
  );

  /* ─── Load paper sizes from device printer ──────────────────────────── */

  const loadPaperSizesForDevice = useCallback(
    async (deviceId: string, printerName: string, role: string) => {
      if (!printerName) return;
      try {
        const res = await api.getPaperSizes(deviceId, printerName);
        setPaperSizes((prev) => ({
          ...prev,
          [deviceId]: {
            ...prev[deviceId],
            [role]: res.paperSizes ?? [],
          },
        }));
      } catch {
        // Device offline or printer not available — silently ignore
      }
    },
    [api],
  );

  /* ─── Handle expand device ───────────────────────────────────────────── */

  const handleExpandDevice = useCallback(
    (deviceId: string) => {
      if (expandedDevice === deviceId) {
        setExpandedDevice(null);
        return;
      }
      setExpandedDevice(deviceId);
      loadDevicePrinterConfig(deviceId);
      // Load paper sizes for assigned printers
      const config = deviceConfigs[deviceId];
      if (config?.photo) loadPaperSizesForDevice(deviceId, config.photo, "photo");
      if (config?.letter) loadPaperSizesForDevice(deviceId, config.letter, "letter");
    },
    [expandedDevice, loadDevicePrinterConfig, deviceConfigs, loadPaperSizesForDevice],
  );

  /* ─── Save printer config for a device ───────────────────────────────── */

  const savePrinterForRole = async (
    deviceId: string,
    role: "photo" | "letter",
    printerName: string,
  ) => {
    setSavingPrinter(true);
    try {
      await api.savePrinterConfig(role, {
        printerName,
        isActive: true,
        deviceId,
      });
      
      // Update local device state to reflect the new role assignment
      setDevices((prev) =>
        prev.map((d) => {
          if (d.deviceId !== deviceId) return d
          
          // Remove this role from any other printer
          const updatedPrinters = d.printers.map((p) => {
            if (p.name === printerName) {
              return { ...p, role }
            }
            if (p.role === role) {
              return { ...p, role: null }
            }
            return p
          })
          
          // If printer doesn't exist in the list, add it
          if (!updatedPrinters.find((p) => p.name === printerName)) {
            updatedPrinters.push({ name: printerName, status: 0, role })
          }
          
          return { ...d, printers: updatedPrinters }
        })
      )
      
      // Update config state
      setDeviceConfigs((prev) => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          [role]: printerName,
        },
      }));

      // Load paper sizes for the newly assigned printer
      loadPaperSizesForDevice(deviceId, printerName, role);
      
      toast.success(
        `Impressora de ${role === "photo" ? "fotos" : "cartinhas"} salva para este dispositivo`,
      );
    } catch {
      toast.error("Erro ao salvar impressora");
    } finally {
      setSavingPrinter(false);
    }
  };

  /* ─── Delete printer config for a device ─────────────────────────────── */

  const deletePrinterForRole = async (
    deviceId: string,
    role: "photo" | "letter",
  ) => {
    try {
      await api.deletePrinterConfig(role, deviceId);
      
      // Update local device state to remove the role
      setDevices((prev) =>
        prev.map((d) => {
          if (d.deviceId !== deviceId) return d
          
          const updatedPrinters = d.printers.map((p) => {
            if (p.role === role) {
              return { ...p, role: null }
            }
            return p
          })
          
          return { ...d, printers: updatedPrinters }
        })
      )
      
      // Update config state
      setDeviceConfigs((prev) => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          [role]: "",
        },
      }));
      
      toast.success("Configuração removida");
    } catch {
      toast.error("Erro ao remover configuração");
    }
  };

  /* ─── Save print settings for a role ────────────────────────────────── */

  const savePrintSettings = async (
    deviceId: string,
    role: "photo" | "letter",
    settings: PrintSettings,
  ) => {
    try {
      setSavingSettings(true);
      await api.savePrintSettings(role, { settings, deviceId });

      setDevicePrintSettings((prev) => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          [role === "photo" ? "photoSettings" : "letterSettings"]: settings,
        },
      }));

      toast.success(
        `Configurações de impressão salvas para ${role === "photo" ? "fotos" : "cartinhas"}`,
      );
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSavingSettings(false);
    }
  };

  /* ─── Set default device ─────────────────────────────────────────────── */

  const setDefault = async (deviceId: string) => {
    await api.put(`/print-agent/devices/${deviceId}/default`, {});
    setDevices((prev) =>
      prev.map((d) => ({ ...d, isDefault: d.deviceId === deviceId })),
    );
    toast.success("Dispositivo padrão atualizado");
  };

  /* ─── Remove device ──────────────────────────────────────────────────── */

  const removeDevice = async (deviceId: string) => {
    if (!confirm("Remover este dispositivo?")) return;
    await api.delete(`/print-agent/devices/${deviceId}`);
    setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
    toast.success("Dispositivo removido");
  };

  /* ─── Render ─────────────────────────────────────────────────────────── */

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
          onClick={fetchDevices}
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
            const deviceConfig = deviceConfigs[device.deviceId] || {
              photo: "",
              letter: "",
            };
            const devicePrinters =
              device.printers?.map((p) => p.name) || [];

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
                  onClick={() => handleExpandDevice(device.deviceId)}
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
                    {!device.isDefault && (
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
                    {/* Printer list from device */}
                    {Array.isArray(device.printers) &&
                      device.printers.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-neutral-500 mb-2">
                            IMPRESSORAS DETECTADAS
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

                    {/* Printer role config for this device */}
                    {device.isActive && (
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
                                  value={deviceConfig.photo}
                                  onChange={(e) =>
                                    setDeviceConfigs((prev) => ({
                                      ...prev,
                                      [device.deviceId]: {
                                        ...prev[device.deviceId],
                                        photo: e.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Selecionar...</option>
                                  {devicePrinters.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!deviceConfig.photo || savingPrinter}
                                  onClick={() =>
                                    savePrinterForRole(
                                      device.deviceId,
                                      "photo",
                                      deviceConfig.photo,
                                    )
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
                                  value={deviceConfig.letter}
                                  onChange={(e) =>
                                    setDeviceConfigs((prev) => ({
                                      ...prev,
                                      [device.deviceId]: {
                                        ...prev[device.deviceId],
                                        letter: e.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Selecionar...</option>
                                  {devicePrinters.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!deviceConfig.letter || savingPrinter}
                                  onClick={() =>
                                    savePrinterForRole(
                                      device.deviceId,
                                      "letter",
                                      deviceConfig.letter,
                                    )
                                  }
                                >
                                  <Save size={14} />
                                </Button>
                              </div>
                            </div>
                          </div>
                      </div>
                    )}

                    {/* Print settings config for this device */}
                    {device.isActive && (
                      <div>
                        <p className="text-xs font-semibold text-neutral-500 mb-2">
                          CONFIGURAÇÕES DE IMPRESSÃO
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {/* Photo settings */}
                          <div className="space-y-1.5">
                            <label className="text-xs text-neutral-500">
                              Fotos & Quadros
                            </label>
                            <div className="grid gap-1.5">
                              <select
                                className="text-sm border rounded-lg px-3 py-1.5"
                                value={devicePrintSettings[device.deviceId]?.photoSettings?.paperSize ?? ""}
                                onChange={(e) => {
                                  const current = devicePrintSettings[device.deviceId]?.photoSettings ?? {};
                                  savePrintSettings(device.deviceId, "photo", {
                                    ...current,
                                    paperSize: e.target.value || undefined,
                                  });
                                }}
                              >
                                <option value="">Tamanho padrão</option>
                                {(paperSizes[device.deviceId]?.photo ?? []).map((ps) => (
                                  <option key={ps.name} value={ps.name}>
                                    {ps.name} ({ps.width}x{ps.height})
                                  </option>
                                ))}
                                {(paperSizes[device.deviceId]?.photo ?? []).length === 0 && deviceConfig.photo && (
                                  <>
                                    <option value="PR (4x6)">PR (4x6)</option>
                                    <option value="A4">A4</option>
                                    <option value="Letter">Letter</option>
                                  </>
                                )}
                              </select>
                              <select
                                className="text-sm border rounded-lg px-3 py-1.5"
                                value={devicePrintSettings[device.deviceId]?.photoSettings?.orientation ?? "auto"}
                                onChange={(e) => {
                                  const current = devicePrintSettings[device.deviceId]?.photoSettings ?? {};
                                  savePrintSettings(device.deviceId, "photo", {
                                    ...current,
                                    orientation: e.target.value,
                                  });
                                }}
                              >
                                <option value="auto">Orientação automática</option>
                                <option value="landscape">Paisagem (landscape)</option>
                                <option value="portrait">Retrato (portrait)</option>
                              </select>
                              <label className="flex items-center gap-2 text-xs text-neutral-500">
                                <input
                                  type="checkbox"
                                  className="rounded"
                                  checked={devicePrintSettings[device.deviceId]?.photoSettings?.fitToPage ?? false}
                                  onChange={(e) => {
                                    const current = devicePrintSettings[device.deviceId]?.photoSettings ?? {};
                                    savePrintSettings(device.deviceId, "photo", {
                                      ...current,
                                      fitToPage: e.target.checked,
                                    });
                                  }}
                                />
                                Ajustar à página (fit)
                              </label>
                            </div>
                          </div>
                          {/* Letter settings */}
                          <div className="space-y-1.5">
                            <label className="text-xs text-neutral-500">
                              Cartinhas
                            </label>
                            <div className="grid gap-1.5">
                              <select
                                className="text-sm border rounded-lg px-3 py-1.5"
                                value={devicePrintSettings[device.deviceId]?.letterSettings?.paperSize ?? ""}
                                onChange={(e) => {
                                  const current = devicePrintSettings[device.deviceId]?.letterSettings ?? {};
                                  savePrintSettings(device.deviceId, "letter", {
                                    ...current,
                                    paperSize: e.target.value || undefined,
                                  });
                                }}
                              >
                                <option value="">Tamanho padrão</option>
                                {(paperSizes[device.deviceId]?.letter ?? []).map((ps) => (
                                  <option key={ps.name} value={ps.name}>
                                    {ps.name} ({ps.width}x{ps.height})
                                  </option>
                                ))}
                                {(paperSizes[device.deviceId]?.letter ?? []).length === 0 && deviceConfig.letter && (
                                  <>
                                    <option value="A4">A4</option>
                                    <option value="Letter">Letter</option>
                                    <option value="PR (4x6)">PR (4x6)</option>
                                  </>
                                )}
                              </select>
                              <select
                                className="text-sm border rounded-lg px-3 py-1.5"
                                value={devicePrintSettings[device.deviceId]?.letterSettings?.orientation ?? "auto"}
                                onChange={(e) => {
                                  const current = devicePrintSettings[device.deviceId]?.letterSettings ?? {};
                                  savePrintSettings(device.deviceId, "letter", {
                                    ...current,
                                    orientation: e.target.value,
                                  });
                                }}
                              >
                                <option value="auto">Orientação automática</option>
                                <option value="landscape">Paisagem (landscape)</option>
                                <option value="portrait">Retrato (portrait)</option>
                              </select>
                              <label className="flex items-center gap-2 text-xs text-neutral-500">
                                <input
                                  type="checkbox"
                                  className="rounded"
                                  checked={devicePrintSettings[device.deviceId]?.letterSettings?.fitToPage ?? false}
                                  onChange={(e) => {
                                    const current = devicePrintSettings[device.deviceId]?.letterSettings ?? {};
                                    savePrintSettings(device.deviceId, "letter", {
                                      ...current,
                                      fitToPage: e.target.checked,
                                    });
                                  }}
                                />
                                Ajustar à página (fit)
                              </label>
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
