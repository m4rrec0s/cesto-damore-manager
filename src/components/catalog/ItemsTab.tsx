import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  X,
  Loader2,
  Box,
  Check,
  Settings2,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";
import { useApi } from "../../services/api";
import type {
  Item,
  Additional,
  Customization,
  CustomizationTypeValue,
} from "../../types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { extractErrorMessage, formatCurrency } from "../../utils/format";
import clsx from "clsx";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Input } from "../ui/input";

type CropFormatKey =
  | "FREE"
  | "1:1"
  | "16:9"
  | "4:3"
  | "A4_PORTRAIT"
  | "A4_LANDSCAPE"
  | "CUSTOM";

type CropUnit = "px" | "cm";

const getAspectRatioByFormat = (
  format: CropFormatKey,
  width?: number,
  height?: number,
): number | undefined => {
  switch (format) {
    case "1:1":
      return 1;
    case "16:9":
      return 16 / 9;
    case "4:3":
      return 4 / 3;
    case "A4_PORTRAIT":
      return 210 / 297;
    case "A4_LANDSCAPE":
      return 297 / 210;
    case "CUSTOM":
      if (!width || !height || width <= 0 || height <= 0) return undefined;
      return width / height;
    default:
      return undefined;
  }
};

const getDefaultCustomizationDataByType = (
  type: CustomizationTypeValue,
): Record<string, unknown> => {
  switch (type) {
    case "TEXT":
      return { fields: [] };
    case "MULTIPLE_CHOICE":
      return { options: [] };
    case "DYNAMIC_LAYOUT":
      return { layouts: [] };
    case "IMAGES":
      return {
        dynamic_layout: { max_images: 10 },
        image_crop: {
          format: "1:1",
          aspect_ratio: 1,
          unit: "px",
          width: 1000,
          height: 1000,
        },
      };
    default:
      return {};
  }
};

const normalizeCustomizationPayload = (payload: {
  name: string;
  type: CustomizationTypeValue;
  price: number;
  isRequired: boolean;
  customization_data: Record<string, unknown>;
}) => ({
  ...payload,
  customization_data: {
    ...getDefaultCustomizationDataByType(payload.type),
    ...(payload.customization_data || {}),
  },
});

export function ItemsTab() {
  const api = useApi();
  const [items, setItems] = useState<Item[]>([]);
  const [additionals, setAdditionals] = useState<Additional[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemCustomizations, setItemCustomizations] = useState<Customization[]>(
    [],
  );
  const [loadingCustomizations, setLoadingCustomizations] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    stock_quantity: 0,
    base_price: 0,
    allows_customization: false,
  });

  const [isCustomizationFormOpen, setIsCustomizationFormOpen] = useState(false);
  const [editingCustomization, setEditingCustomization] =
    useState<Customization | null>(null);
  const [customizationFormData, setCustomizationFormData] = useState<{
    name: string;
    type: CustomizationTypeValue;
    price: number;
    isRequired: boolean;
    customization_data: Record<string, unknown>;
  }>({
    name: "",
    type: "TEXT" as CustomizationTypeValue,
    price: 0,
    isRequired: false,
    customization_data: {},
  });
  const [availableLayouts, setAvailableLayouts] = useState<
    Record<string, unknown>[]
  >([]);
  const [loadingLayouts, setLoadingLayouts] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const fetchItemCustomizations = useCallback(
    async (itemId: string) => {
      try {
        setLoadingCustomizations(true);
        const data = await api.getCustomizations(itemId);
        setItemCustomizations(data || []);
        return data || [];
      } catch (error) {
        console.error("Erro ao carregar customizações:", error);
        return [];
      } finally {
        setLoadingCustomizations(false);
      }
    },
    [api],
  );

  const fetchAvailableLayouts = async () => {
    try {
      setLoadingLayouts(true);
      const data = await api.getDynamicLayouts();
      const layouts = Array.isArray(data)
        ? data
        : data?.layouts || data?.data || [];
      console.log("✅ Layouts carregados:", layouts.length, layouts);
      setAvailableLayouts(layouts);
    } catch (error) {
      console.error("❌ Erro ao carregar layouts:", error);
      toast.error("Erro ao carregar designs");
      setAvailableLayouts([]);
    } finally {
      setLoadingLayouts(false);
    }
  };

  const fetchData = async (isReload = false) => {
    if (isReload) setReloading(true);
    else setLoading(true);
    try {
      const [itemsResponse, additionalsResponse] = await Promise.all([
        api.getItems(),
        api.getAdditionals(),
      ]);
      setItems(itemsResponse.items || []);
      setAdditionals(
        additionalsResponse.additionals || additionalsResponse || [],
      );
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao carregar dados"));
      setItems([]);
      setAdditionals([]);
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAvailableLayouts();
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchData(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleOpenModal = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || "",
        stock_quantity: item.stock_quantity,
        base_price: item.base_price,
        allows_customization: item.allows_customization,
      });
      setImagePreview(item.image_url || "");
      fetchItemCustomizations(item.id);
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        description: "",
        stock_quantity: 0,
        base_price: 0,
        allows_customization: false,
      });
      setImagePreview("");
      setItemCustomizations([]);
    }
    setIsModalOpen(true);
  };

  const handleAddCustomization = () => {
    setEditingCustomization(null);
    setCustomizationFormData({
      name: "",
      type: "TEXT",
      price: 0,
      isRequired: false,
      customization_data: { fields: [] },
    });
    setIsCustomizationFormOpen(true);
  };

  const handleEditCustomization = (custom: Customization) => {
    setEditingCustomization(custom);
    setCustomizationFormData({
      name: custom.name,
      type: custom.type,
      price: custom.price,
      isRequired: custom.isRequired,
      customization_data: {
        ...getDefaultCustomizationDataByType(custom.type),
        ...(custom.customization_data || {}),
      },
    });
    setIsCustomizationFormOpen(true);
  };

  const handleSaveCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const normalizedPayload = normalizeCustomizationPayload(
        customizationFormData,
      );

      if (editingCustomization) {
        await api.updateCustomization(editingCustomization.id, {
          ...normalizedPayload,
        });
        toast.success("Customização atualizada");
      } else {
        await api.createCustomization({
          ...normalizedPayload,
          item_id: editingItem.id,
        });
        toast.success("Customização criada");
      }
      setIsCustomizationFormOpen(false);
      fetchItemCustomizations(editingItem.id);
    } catch (error) {
      toast.error("Erro ao salvar customização");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingItem) {
        await api.updateItem(
          editingItem.id,
          formData as unknown as Record<string, unknown>,
          imageFile || undefined,
        );
        toast.success("Item atualizado!");
      } else {
        await api.createItem(
          formData as unknown as Record<string, unknown>,
          imageFile || undefined,
        );
        toast.success("Item criado!");
      }
      setIsModalOpen(false);
      await fetchData(true);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao salvar item"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este item?")) return;
    setReloading(true);
    try {
      await api.deleteItem(id);
      toast.success("Item excluído!");
      await fetchData(true);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao excluir item"));
      setReloading(false);
    }
  };

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar itens ou componentes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-100 rounded-2xl text-neutral-950 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500/20 transition-all"
          />
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-neutral-600 text-white rounded-2xl font-bold shadow-lg shadow-neutral-200 hover:bg-neutral-700 transition-all active:scale-95"
        >
          <Plus size={20} />
          Novo Item
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-neutral-500" size={40} />
        </div>
      ) : reloading ? (
        <div className="flex items-center justify-center gap-3 py-20 bg-neutral-50/50 rounded-3xl border border-dashed border-neutral-100">
          <Loader2 className="animate-spin text-neutral-500" size={32} />
          <span className="text-sm font-medium text-neutral-400">Atualizando...</span>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-neutral-50">
                <TableHead className="w-20 text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider pl-6">
                  Imagem
                </TableHead>
                <TableHead className="text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider">
                  Item
                </TableHead>
                <TableHead className="text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider">
                  Preço
                </TableHead>
                <TableHead className="text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider">
                  Estoque
                </TableHead>
                <TableHead className="text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-right text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider pr-6">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-neutral-50 hover:bg-neutral-50/30 transition-colors"
                >
                  <TableCell className="pl-6">
                    <div className="w-12 h-12 rounded-xl bg-neutral-50 overflow-hidden border border-neutral-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-200">
                          <Box size={20} />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-neutral-950">
                      {item.name}
                    </div>
                    <div className="text-xs text-neutral-900/60 line-clamp-1">
                      {item.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-black text-neutral-600">
                      {formatCurrency(item.base_price)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={clsx(
                        "font-bold text-xs",
                        item.stock_quantity > 0
                          ? "text-emerald-600"
                          : "text-neutral-500",
                      )}
                    >
                      {item.stock_quantity} un
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {item.allows_customization && (
                        <span className="px-2 py-0.5 bg-neutral-50 text-neutral-500 border border-neutral-100 rounded-lg text-[9px] font-bold uppercase">
                          Customizável
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenModal(item)}
                        className="h-8 w-8 text-neutral-600 hover:text-neutral-700 hover:bg-neutral-50 rounded-xl"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 w-8 text-neutral-400 hover:text-neutral-500 hover:bg-neutral-50 rounded-xl"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Item Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#0d1216]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl border border-neutral-100 overflow-hidden"
            >
              <div className="p-8 border-b border-neutral-50 flex justify-between items-center bg-neutral-50/30">
                <h3 className="text-xl font-bold text-neutral-950">
                  {editingItem
                    ? "Editar Item / Componente"
                    : "Novo Item / Componente"}
                </h3>
                <Button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X size={24} />
                </Button>
              </div>

              <form
                onSubmit={handleSave}
                className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                        Nome do Item
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-neutral-50/50 border border-neutral-100 rounded-2xl text-neutral-950 font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-500/20"
                        placeholder="Ex: Cesta de Vime M"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                        Descrição
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-neutral-50/50 border border-neutral-100 rounded-2xl text-neutral-950 font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-500/20 min-h-25 resize-none"
                        placeholder="Detalhes sobre o material ou dimensões..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                          Preço Base
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.base_price}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              base_price: parseFloat(e.target.value),
                            })
                          }
                          className="w-full px-4 py-3 bg-neutral-50/50 border border-neutral-100 rounded-2xl text-neutral-950 font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-500/20"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                          Estoque
                        </label>
                        <Input
                          type="number"
                          value={formData.stock_quantity}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stock_quantity: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-4 py-3 bg-neutral-50/50 border border-neutral-100 rounded-2xl text-neutral-950 font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-500/20"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                        Imagem
                      </label>
                      <div className="aspect-video relative rounded-2xl bg-neutral-50 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-neutral-100/50 transition-colors">
                        {imagePreview ? (
                          <img
                            title="Imagem do Item"
                            src={imagePreview}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-neutral-300">
                            <Upload size={32} />
                            <span className="text-xs font-bold">Upload</span>
                          </div>
                        )}
                        <input
                          title="Anexe a imagem"
                          type="file"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setImageFile(file);
                              setImagePreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div
                          className={clsx(
                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                            formData.allows_customization
                              ? "bg-neutral-500 border-neutral-500 text-white"
                              : "border-neutral-200 group-hover:border-neutral-400",
                          )}
                        >
                          {formData.allows_customization && <Check size={16} />}
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={formData.allows_customization}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                allows_customization: e.target.checked,
                              })
                            }
                          />
                        </div>
                        <span className="text-sm font-bold text-neutral-950">
                          Permite Customização
                        </span>
                      </label>
                      <p className="text-[10px] text-neutral-400 mt-2 ml-9">
                        Habilita o envio de textos ou imagens para este item na
                        hora da compra.
                      </p>
                    </div>

                    {formData.allows_customization && editingItem && (
                      <div className="mt-8 pt-8 border-t border-neutral-100">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1">
                              Customizações
                            </label>
                            <p className="text-[10px] text-neutral-400 font-bold px-1 mt-1">
                              Campos que o cliente deve preencher
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleAddCustomization}
                            className="h-8 px-4 bg-neutral-600 text-white hover:bg-neutral-700 rounded-xl flex items-center gap-2 font-bold text-[10px] uppercase shadow-md shadow-neutral-100 transition-all active:scale-95"
                          >
                            <Plus size={14} strokeWidth={3} />
                            Adicionar
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {loadingCustomizations ? (
                            <div className="flex flex-col items-center justify-center py-10 bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-100">
                              <Loader2
                                className="animate-spin text-neutral-300 mb-2"
                                size={24}
                              />
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                Carregando...
                              </span>
                            </div>
                          ) : itemCustomizations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 bg-neutral-50/50 rounded-[2rem] border-2 border-dashed border-neutral-100 group hover:border-neutral-200 transition-all">
                              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-neutral-200 mb-4 group-hover:scale-110 transition-transform">
                                <Settings2 size={24} />
                              </div>
                              <p className="text-xs text-neutral-400 font-bold">
                                Nenhuma customização configurada
                              </p>
                              <p className="text-[10px] text-neutral-300 font-medium mt-1">
                                Adicione campos como textos, fotos ou escolhas.
                              </p>
                            </div>
                          ) : (
                            itemCustomizations.map((custom) => (
                              <div
                                key={custom.id}
                                className="group flex items-start justify-between gap-3 p-4 bg-white border border-neutral-100 rounded-[1.5rem] shadow-sm hover:border-neutral-200 hover:shadow-md transition-all"
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-400 group-hover:bg-neutral-600 group-hover:text-white transition-colors">
                                    {custom.type === "TEXT" && (
                                      <span className="font-bold text-xs">
                                        Aa
                                      </span>
                                    )}
                                    {custom.type === "IMAGES" && (
                                      <Box size={20} />
                                    )}
                                    {custom.type === "MULTIPLE_CHOICE" && (
                                      <Box size={20} />
                                    )}
                                    {custom.type === "DYNAMIC_LAYOUT" && (
                                      <Box size={20} />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="min-w-0 text-sm font-bold text-neutral-900 leading-tight wrap-break-word">
                                        {custom.name}
                                      </h4>
                                      {custom.isRequired && (
                                        <span className="shrink-0 px-1.5 py-0.5 bg-red-50 text-red-500 rounded text-[8px] font-black uppercase">
                                          Obrigatório
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                        {custom.type === "TEXT"
                                          ? "Texto"
                                          : custom.type === "IMAGES"
                                            ? "Imagens/Fotos"
                                            : custom.type === "MULTIPLE_CHOICE"
                                              ? "Múltipla Escolha"
                                              : "Designs"}
                                      </p>
                                      {custom.price > 0 && (
                                        <>
                                          <span className="w-1 h-1 rounded-full bg-neutral-200" />
                                          <p className="text-[10px] font-bold text-emerald-600 uppercase">
                                            + {formatCurrency(custom.price)}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-xl"
                                    onClick={() =>
                                      handleEditCustomization(custom)
                                    }
                                  >
                                    <Edit2 size={16} />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (
                                        window.confirm(
                                          "Excluir esta customização?",
                                        )
                                      ) {
                                        try {
                                          await api.deleteCustomization(
                                            custom.id,
                                          );
                                          if (editingItem?.id) {
                                            const refreshedCustomizations =
                                              await fetchItemCustomizations(
                                                editingItem.id,
                                              );
                                            const stillExists =
                                              refreshedCustomizations.some(
                                                (c: Customization) =>
                                                  c.id === custom.id,
                                              );

                                            if (stillExists) {
                                              throw new Error(
                                                "A customização não foi removida no servidor.",
                                              );
                                            }

                                            setItemCustomizations(
                                              refreshedCustomizations,
                                            );
                                          } else {
                                            setItemCustomizations((prev) =>
                                              prev.filter(
                                                (c) => c.id !== custom.id,
                                              ),
                                            );
                                          }
                                          toast.success(
                                            "Customização removida",
                                          );
                                        } catch (err) {
                                          toast.error(
                                            "Erro ao remover customização",
                                          );
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {!editingItem && formData.allows_customization && (
                      <div className="mt-8 p-6 bg-neutral-50 rounded-[2rem] border border-neutral-100 text-center">
                        <Settings2
                          className="mx-auto mb-2 text-neutral-300"
                          size={24}
                        />
                        <p className="text-xs text-neutral-500 font-bold">
                          Personalização disponível após salvar
                        </p>
                        <p className="text-[10px] text-neutral-400 font-medium mt-1">
                          Crie o item primeiro para adicionar campos de
                          customização.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-10 border-t border-neutral-50 mt-10">
                  <Button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 border border-neutral-100 text-neutral-900 font-bold rounded-2xl hover:bg-neutral-50 transition-colors"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-4 bg-neutral-600 text-white font-bold rounded-2xl shadow-xl shadow-neutral-200 hover:bg-neutral-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCustomizationFormOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomizationFormOpen(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-neutral-50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-neutral-900">
                    {editingCustomization
                      ? "Editar Customização"
                      : "Nova Customização"}
                  </h3>
                  <p className="text-xs text-neutral-400 font-bold mt-1">
                    Configure como o cliente irá personalizar este item
                  </p>
                </div>
                <Button
                  title="Fechar modal"
                  onClick={() => setIsCustomizationFormOpen(false)}
                  className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X size={20} />
                </Button>
              </div>

              <form onSubmit={handleSaveCustomization}>
                <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-neutral-600 uppercase tracking-widest">
                      📝 Nome da Customização
                    </label>
                    <Input
                      required
                      placeholder="Ex: Nome da Criança, Mensagem do Cartão..."
                      value={customizationFormData.name}
                      onChange={(e) =>
                        setCustomizationFormData({
                          ...customizationFormData,
                          name: e.target.value,
                        })
                      }
                      className="h-12 rounded-2xl border-neutral-100 bg-neutral-50/30 font-bold focus:ring-neutral-500/10 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-neutral-600 uppercase tracking-widest">
                        🎨 Tipo
                      </label>
                      <select
                        title="Tipo de Campo"
                        value={customizationFormData.type}
                        onChange={(e) =>
                          setCustomizationFormData({
                            ...customizationFormData,
                            type: e.target.value as CustomizationTypeValue,
                            customization_data:
                              getDefaultCustomizationDataByType(
                                e.target.value as CustomizationTypeValue,
                              ),
                          })
                        }
                        className="w-full h-12 px-4 rounded-2xl border border-neutral-100 bg-neutral-50/30 font-bold focus:ring-2 focus:ring-neutral-500/10"
                      >
                        <option value="TEXT">📄 Texto</option>
                        <option value="IMAGES">🖼️ Imagens</option>
                        <option value="MULTIPLE_CHOICE">
                          ☑️ Múltipla Escolha
                        </option>
                        <option value="DYNAMIC_LAYOUT">
                          🎭 Designs Dinâmicos
                        </option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-neutral-600 uppercase tracking-widest">
                        💰 Preço Adicional
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={customizationFormData.price}
                        onChange={(e) =>
                          setCustomizationFormData({
                            ...customizationFormData,
                            price: Number(e.target.value),
                          })
                        }
                        className="h-12 rounded-2xl border-neutral-100 bg-neutral-50/30 font-bold focus:ring-neutral-500/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Opções específicas por tipo */}
                  <div className="border-t border-neutral-100 pt-4">
                    {customizationFormData.type === "MULTIPLE_CHOICE" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-black text-neutral-600 uppercase tracking-widest">
                            ☑️ Opções de Escolha
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const currentData =
                                customizationFormData.customization_data || {
                                  options: [],
                                };
                              const options =
                                ((currentData as Record<string, unknown>)
                                  .options as Record<string, unknown>[]) || [];
                              setCustomizationFormData({
                                ...customizationFormData,
                                customization_data: {
                                  ...currentData,
                                  options: [
                                    ...options,
                                    {
                                      id: crypto.randomUUID(),
                                      label: "",
                                      price_modifier: 0,
                                    },
                                  ],
                                },
                              });
                            }}
                            className="h-8 px-2 bg-neutral-600 text-white rounded-lg text-[10px] font-bold"
                          >
                            + Adicionar
                          </Button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                          {(
                            ((
                              customizationFormData.customization_data as Record<
                                string,
                                unknown
                              >
                            )?.options as Record<string, unknown>[]) || []
                          ).map((opt: Record<string, unknown>, idx: number) => (
                            <div
                              key={(opt.id as string) || idx}
                              className="flex gap-2 items-center bg-white p-3 rounded-xl border border-neutral-100"
                            >
                              <Input
                                placeholder="Rótulo (ex: Azul...)"
                                value={(opt.label as string) || ""}
                                onChange={(e) => {
                                  const options = [
                                    ...((customizationFormData
                                      .customization_data?.options as Record<
                                      string,
                                      unknown
                                    >[]) || []),
                                  ];
                                  options[idx] = {
                                    ...options[idx],
                                    label: e.target.value,
                                  };
                                  setCustomizationFormData({
                                    ...customizationFormData,
                                    customization_data: {
                                      ...customizationFormData.customization_data,
                                      options,
                                    },
                                  });
                                }}
                                className="flex-1 h-9 text-xs rounded-xl border-neutral-50"
                              />
                              <div className="relative w-20">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                                  R$
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  value={(opt.price_modifier as number) || 0}
                                  onChange={(e) => {
                                    const options = [
                                      ...((customizationFormData
                                        .customization_data?.options as Record<
                                        string,
                                        unknown
                                      >[]) || []),
                                    ];
                                    options[idx] = {
                                      ...options[idx],
                                      price_modifier: Number(e.target.value),
                                    };
                                    setCustomizationFormData({
                                      ...customizationFormData,
                                      customization_data: {
                                        ...customizationFormData.customization_data,
                                        options,
                                      },
                                    });
                                  }}
                                  className="pl-6 w-full h-9 text-xs"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const options = (
                                    customizationFormData.customization_data
                                      ?.options as Record<string, unknown>[]
                                  ).filter(
                                    (_: Record<string, unknown>, i: number) =>
                                      i !== idx,
                                  );
                                  setCustomizationFormData({
                                    ...customizationFormData,
                                    customization_data: {
                                      ...customizationFormData.customization_data,
                                      options,
                                    },
                                  });
                                }}
                                className="h-8 w-8 text-red-400 hover:text-red-600"
                              >
                                <X size={16} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {customizationFormData.type === "DYNAMIC_LAYOUT" && (
                      <div className="space-y-3">
                        <label className="text-xs font-black text-neutral-600 uppercase tracking-widest block">
                          🎭 Seleção de Designs Dinâmicos
                        </label>

                        {loadingLayouts ? (
                          <p className="text-sm text-neutral-400 py-4">
                            ⏳ Carregando designs...
                          </p>
                        ) : availableLayouts.length === 0 ? (
                          <p className="text-sm text-neutral-400 py-4">
                            ⚠️ Nenhum design encontrado
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                            {availableLayouts.map(
                              (layout: Record<string, unknown>) => {
                                const selectedLayouts =
                                  (customizationFormData.customization_data
                                    ?.layouts as Record<string, unknown>[]) ||
                                  [];
                                const isSelected = selectedLayouts.some(
                                  (l: Record<string, unknown>) =>
                                    l.id === layout.id,
                                );

                                return (
                                  <div
                                    key={layout.id as string}
                                    onClick={() => {
                                      const newLayouts = isSelected
                                        ? selectedLayouts.filter(
                                            (l: Record<string, unknown>) =>
                                              l.id !== layout.id,
                                          )
                                        : [
                                            ...selectedLayouts,
                                            layout as Record<string, unknown>,
                                          ];
                                      setCustomizationFormData({
                                        ...customizationFormData,
                                        customization_data: {
                                          ...customizationFormData.customization_data,
                                          layouts: newLayouts,
                                        },
                                      });
                                    }}
                                    className={clsx(
                                      "flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all",
                                      isSelected
                                        ? "bg-neutral-50 border-neutral-600"
                                        : "bg-white border-neutral-100 hover:border-neutral-200",
                                    )}
                                  >
                                    <div className="w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 bg-white border-neutral-200">
                                      {isSelected && (
                                        <Check
                                          size={14}
                                          className="text-neutral-600"
                                        />
                                      )}
                                    </div>
                                    <span className="text-xs font-bold text-neutral-700 truncate">
                                      {layout.name as string}
                                    </span>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {customizationFormData.type === "IMAGES" && (
                      <div className="space-y-4">
                        <label className="text-xs font-black text-neutral-600 uppercase tracking-widest block">
                          🖼️ Formato de Recorte (IMAGE)
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                              Máximo de imagens
                            </label>
                            <Input
                              type="number"
                              min={1}
                              max={20}
                              value={
                                Number(
                                  (
                                    customizationFormData.customization_data as Record<
                                      string,
                                      unknown
                                    >
                                  )?.dynamic_layout &&
                                    ((
                                      (
                                        customizationFormData.customization_data as Record<
                                          string,
                                          unknown
                                        >
                                      ).dynamic_layout as Record<
                                        string,
                                        unknown
                                      >
                                    ).max_images as number),
                                ) || 10
                              }
                              onChange={(e) => {
                                const currentData =
                                  customizationFormData.customization_data ||
                                  {};
                                const currentDynamic =
                                  ((currentData as Record<string, unknown>)
                                    .dynamic_layout as Record<
                                    string,
                                    unknown
                                  >) || {};

                                setCustomizationFormData({
                                  ...customizationFormData,
                                  customization_data: {
                                    ...currentData,
                                    dynamic_layout: {
                                      ...currentDynamic,
                                      max_images: Math.max(
                                        1,
                                        Number(e.target.value) || 1,
                                      ),
                                    },
                                  },
                                });
                              }}
                              className="h-10 rounded-xl border-neutral-100"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                              Formato
                            </label>
                            <select
                              title="Formato de recorte"
                              value={
                                ((
                                  (
                                    customizationFormData.customization_data as Record<
                                      string,
                                      unknown
                                    >
                                  )?.image_crop as Record<string, unknown>
                                )?.format as string) || "1:1"
                              }
                              onChange={(e) => {
                                const format = e.target.value as CropFormatKey;
                                const currentData =
                                  customizationFormData.customization_data ||
                                  {};
                                const currentCrop =
                                  ((currentData as Record<string, unknown>)
                                    .image_crop as Record<string, unknown>) ||
                                  {};

                                const width = Number(currentCrop.width) || 1000;
                                const height =
                                  Number(currentCrop.height) || 1000;
                                const aspectRatio = getAspectRatioByFormat(
                                  format,
                                  width,
                                  height,
                                );

                                setCustomizationFormData({
                                  ...customizationFormData,
                                  customization_data: {
                                    ...currentData,
                                    image_crop: {
                                      ...currentCrop,
                                      format,
                                      aspect_ratio: aspectRatio,
                                    },
                                  },
                                });
                              }}
                              className="w-full h-10 px-3 rounded-xl border border-neutral-100 bg-neutral-50/30 text-sm font-semibold"
                            >
                              <option value="FREE">Livre</option>
                              <option value="1:1">1:1</option>
                              <option value="16:9">16:9</option>
                              <option value="4:3">4:3</option>
                              <option value="A4_PORTRAIT">A4 Retrato</option>
                              <option value="A4_LANDSCAPE">A4 Paisagem</option>
                              <option value="CUSTOM">Customizado</option>
                            </select>
                          </div>
                        </div>

                        {(((
                          (
                            customizationFormData.customization_data as Record<
                              string,
                              unknown
                            >
                          )?.image_crop as Record<string, unknown>
                        )?.format as string) || "1:1") === "CUSTOM" && (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                                Largura
                              </label>
                              <Input
                                type="number"
                                min={1}
                                value={Number(
                                  ((
                                    (
                                      customizationFormData.customization_data as Record<
                                        string,
                                        unknown
                                      >
                                    )?.image_crop as Record<string, unknown>
                                  )?.width as number) || 1000,
                                )}
                                onChange={(e) => {
                                  const width = Math.max(
                                    1,
                                    Number(e.target.value) || 1,
                                  );
                                  const currentData =
                                    customizationFormData.customization_data ||
                                    {};
                                  const currentCrop =
                                    ((currentData as Record<string, unknown>)
                                      .image_crop as Record<string, unknown>) ||
                                    {};
                                  const height =
                                    Number(currentCrop.height) || 1000;

                                  setCustomizationFormData({
                                    ...customizationFormData,
                                    customization_data: {
                                      ...currentData,
                                      image_crop: {
                                        ...currentCrop,
                                        width,
                                        aspect_ratio: getAspectRatioByFormat(
                                          "CUSTOM",
                                          width,
                                          height,
                                        ),
                                      },
                                    },
                                  });
                                }}
                                className="h-10 rounded-xl border-neutral-100"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                                Altura
                              </label>
                              <Input
                                type="number"
                                min={1}
                                value={Number(
                                  ((
                                    (
                                      customizationFormData.customization_data as Record<
                                        string,
                                        unknown
                                      >
                                    )?.image_crop as Record<string, unknown>
                                  )?.height as number) || 1000,
                                )}
                                onChange={(e) => {
                                  const height = Math.max(
                                    1,
                                    Number(e.target.value) || 1,
                                  );
                                  const currentData =
                                    customizationFormData.customization_data ||
                                    {};
                                  const currentCrop =
                                    ((currentData as Record<string, unknown>)
                                      .image_crop as Record<string, unknown>) ||
                                    {};
                                  const width =
                                    Number(currentCrop.width) || 1000;

                                  setCustomizationFormData({
                                    ...customizationFormData,
                                    customization_data: {
                                      ...currentData,
                                      image_crop: {
                                        ...currentCrop,
                                        height,
                                        aspect_ratio: getAspectRatioByFormat(
                                          "CUSTOM",
                                          width,
                                          height,
                                        ),
                                      },
                                    },
                                  });
                                }}
                                className="h-10 rounded-xl border-neutral-100"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1 block">
                                Unidade
                              </label>
                              <select
                                title="Unidade do formato customizado"
                                value={
                                  ((
                                    (
                                      customizationFormData.customization_data as Record<
                                        string,
                                        unknown
                                      >
                                    )?.image_crop as Record<string, unknown>
                                  )?.unit as CropUnit) || "px"
                                }
                                onChange={(e) => {
                                  const unit = e.target.value as CropUnit;
                                  const currentData =
                                    customizationFormData.customization_data ||
                                    {};
                                  const currentCrop =
                                    ((currentData as Record<string, unknown>)
                                      .image_crop as Record<string, unknown>) ||
                                    {};

                                  setCustomizationFormData({
                                    ...customizationFormData,
                                    customization_data: {
                                      ...currentData,
                                      image_crop: {
                                        ...currentCrop,
                                        unit,
                                      },
                                    },
                                  });
                                }}
                                className="w-full h-10 px-3 rounded-xl border border-neutral-100 bg-neutral-50/30 text-sm font-semibold"
                              >
                                <option value="px">px</option>
                                <option value="cm">cm</option>
                              </select>
                            </div>
                          </div>
                        )}

                        <p className="text-[11px] text-neutral-500">
                          Esse formato será aplicado no frontend automaticamente
                          com base no JSON da customização.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Configurações gerais */}
                  <div className="border-t border-neutral-100 pt-4 space-y-3">
                    <div
                      className={clsx(
                        "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                        customizationFormData.isRequired
                          ? "bg-neutral-50 border-neutral-600"
                          : "bg-white border-neutral-100 hover:border-neutral-200",
                      )}
                      onClick={() =>
                        setCustomizationFormData({
                          ...customizationFormData,
                          isRequired: !customizationFormData.isRequired,
                        })
                      }
                    >
                      <div
                        className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          customizationFormData.isRequired
                            ? "bg-neutral-600 border-neutral-600 text-white"
                            : "bg-white border-neutral-200",
                        )}
                      >
                        {customizationFormData.isRequired && (
                          <Check size={14} />
                        )}
                      </div>
                      <span className="text-sm font-bold text-neutral-700">
                        ✅ Campo obrigatório
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-neutral-50 flex gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsCustomizationFormOpen(false)}
                    className="flex-1 h-12 rounded-2xl font-bold text-neutral-500"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl font-bold transition-all active:scale-95"
                  >
                    {editingCustomization ? "✏️ Atualizar" : "✨ Criar"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ItemsTab;
