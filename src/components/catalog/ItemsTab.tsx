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

export function ItemsTab() {
  const api = useApi();
  const [items, setItems] = useState<Item[]>([]);
  const [additionals, setAdditionals] = useState<Additional[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [customizationFormData, setCustomizationFormData] = useState({
    name: "",
    type: "TEXT" as CustomizationTypeValue,
    price: 0,
    isRequired: false,
    customization_data: {} as any,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const fetchItemCustomizations = useCallback(
    async (itemId: string) => {
      try {
        setLoadingCustomizations(true);
        const data = await api.getCustomizations(itemId);
        setItemCustomizations(data || []);
      } catch (error) {
        console.error("Erro ao carregar customizações:", error);
      } finally {
        setLoadingCustomizations(false);
      }
    },
    [api],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
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
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      customization_data: custom.customization_data,
    });
    setIsCustomizationFormOpen(true);
  };

  const handleSaveCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      if (editingCustomization) {
        await api.updateCustomization(editingCustomization.id, {
          ...customizationFormData,
        });
        toast.success("Customização atualizada");
      } else {
        await api.createCustomization({
          ...customizationFormData,
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
    setLoading(true);
    try {
      if (editingItem) {
        await api.updateItem(
          editingItem.id,
          formData as any,
          imageFile || undefined,
        );
        toast.success("Item atualizado!");
      } else {
        await api.createItem(formData as any, imageFile || undefined);
        toast.success("Item criado!");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao salvar item"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este item?")) return;
    try {
      await api.deleteItem(id);
      toast.success("Item excluído!");
      fetchData();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao excluir item"));
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
                                className="group flex items-center justify-between p-4 bg-white border border-neutral-100 rounded-[1.5rem] shadow-sm hover:border-neutral-200 hover:shadow-md transition-all"
                              >
                                <div className="flex items-center gap-4">
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
                                    {custom.type === "BASE_LAYOUT" && (
                                      <Box size={20} />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-sm font-bold text-neutral-900 leading-tight">
                                        {custom.name}
                                      </h4>
                                      {custom.isRequired && (
                                        <span className="px-1.5 py-0.5 bg-red-50 text-red-500 rounded text-[8px] font-black uppercase">
                                          Obrigatório
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                        {custom.type === "TEXT"
                                          ? "Texto"
                                          : custom.type === "IMAGES"
                                            ? "Imagens/Fotos"
                                            : custom.type === "MULTIPLE_CHOICE"
                                              ? "Múltipla Escolha"
                                              : "Layout Base"}
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
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                          setItemCustomizations(
                                            itemCustomizations.filter(
                                              (c) => c.id !== custom.id,
                                            ),
                                          );
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
                    disabled={loading}
                    className="flex-1 py-4 bg-neutral-600 text-white font-bold rounded-2xl shadow-xl shadow-neutral-200 hover:bg-neutral-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCustomizationFormOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
                      Nome da Customização
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
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
                        Tipo de Campo
                      </label>
                      <select
                        title="Tipo de Campo"
                        value={customizationFormData.type}
                        onChange={(e) =>
                          setCustomizationFormData({
                            ...customizationFormData,
                            type: e.target.value as any,
                          })
                        }
                        className="w-full h-12 px-4 rounded-2xl border border-neutral-100 bg-neutral-50/30 font-bold focus:ring-2 focus:ring-neutral-500/10"
                      >
                        <option value="TEXT">Texto</option>
                        <option value="IMAGES">Imagens/Fotos</option>
                        <option value="MULTIPLE_CHOICE">
                          Múltipla Escolha
                        </option>
                        <option value="BASE_LAYOUT">Layout Base</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
                        Preço Base Adicional
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

                  {customizationFormData.type === "MULTIPLE_CHOICE" && (
                    <div className="space-y-4 pt-4 border-t border-neutral-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
                          Opções de Escolha
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
                            const options = currentData.options || [];
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
                          className="h-7 px-3 bg-neutral-600 text-white rounded-lg text-[10px] font-bold uppercase transition-all active:scale-95"
                        >
                          + Opção
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {(
                          customizationFormData.customization_data?.options ||
                          []
                        ).map((opt: any, idx: number) => (
                          <div
                            key={opt.id || idx}
                            className="flex gap-2 items-center bg-white p-2 rounded-xl border border-neutral-100 shadow-sm transition-all animate-in fade-in slide-in-from-right-2"
                          >
                            <Input
                              placeholder="Rótulo (ex: Azul, Grande...)"
                              value={opt.label}
                              onChange={(e) => {
                                const options = [
                                  ...customizationFormData.customization_data
                                    .options,
                                ];
                                options[idx].label = e.target.value;
                                setCustomizationFormData({
                                  ...customizationFormData,
                                  customization_data: {
                                    ...customizationFormData.customization_data,
                                    options,
                                  },
                                });
                              }}
                              className="flex-1 h-10 text-xs rounded-xl border-neutral-50 bg-neutral-50/30 font-bold"
                            />
                            <div className="relative w-20">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-neutral-400">
                                R$
                              </span>
                              <Input
                                type="number"
                                placeholder="0,00"
                                value={opt.price_modifier}
                                onChange={(e) => {
                                  const options = [
                                    ...customizationFormData.customization_data
                                      .options,
                                  ];
                                  options[idx].price_modifier = Number(
                                    e.target.value,
                                  );
                                  setCustomizationFormData({
                                    ...customizationFormData,
                                    customization_data: {
                                      ...customizationFormData.customization_data,
                                      options,
                                    },
                                  });
                                }}
                                className="pl-6 w-full h-10 text-[10px] rounded-xl border-neutral-50 bg-neutral-50/30 font-black"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const options =
                                  customizationFormData.customization_data.options.filter(
                                    (_: any, i: number) => i !== idx,
                                  );
                                setCustomizationFormData({
                                  ...customizationFormData,
                                  customization_data: {
                                    ...customizationFormData.customization_data,
                                    options,
                                  },
                                });
                              }}
                              className="h-8 w-8 text-neutral-300 hover:text-red-500 rounded-lg hover:bg-neutral-50 transition-all"
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        ))}
                        {(
                          customizationFormData.customization_data?.options ||
                          []
                        ).length === 0 && (
                          <p className="text-[10px] text-center py-4 text-neutral-300 font-bold italic">
                            Nenhuma opção adicionada
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-4 bg-neutral-50/50 rounded-2xl border border-neutral-100">
                    <div
                      className={clsx(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
                        customizationFormData.isRequired
                          ? "bg-neutral-600 border-neutral-600 text-white"
                          : "bg-white border-neutral-200",
                      )}
                      onClick={() =>
                        setCustomizationFormData({
                          ...customizationFormData,
                          isRequired: !customizationFormData.isRequired,
                        })
                      }
                    >
                      {customizationFormData.isRequired && <Check size={16} />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-neutral-900 leading-none">
                        Campo Obrigatório
                      </span>
                      <p className="text-[10px] text-neutral-400 font-medium mt-1">
                        O cliente não poderá finalizar o pedido sem preencher.
                      </p>
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
                    {editingCustomization ? "Salvar" : "Criar Customização"}
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
