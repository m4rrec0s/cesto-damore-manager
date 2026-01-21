import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Upload,
  X,
  Tag,
  Loader2,
  Box,
  Check,
  ChevronDownIcon,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react";
import { useApi } from "../../services/api";
import type { Product, Category, Type, Item, ProductInput } from "../../types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { extractErrorMessage, formatCurrency } from "../../utils/format";
import clsx from "clsx";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";

export function ProductsTab() {
  const api = useApi();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    discount: 0,
    type_id: "",
    categories: [] as string[],
    production_time: 1,
    is_active: true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [components, setComponents] = useState<
    { item_id: string; quantity: number }[]
  >([]);
  const [additionals, setAdditionals] = useState<
    { item_id: string; custom_price: number }[]
  >([]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [categoriesData, typesData, itemsResponse] = await Promise.all([
        api.getCategories(),
        api.getTypes(),
        api.getItems(),
      ]);
      setCategories(categoriesData);
      setTypes(typesData);
      setItems(itemsResponse.items || []);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao carregar dados iniciais"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProducts({
        page: currentPage,
        perPage: 12,
        search: searchTerm || undefined,
      });
      setProducts(data.products || []);
      setPagination({
        totalPages: data.pagination?.totalPages || 1,
        total: data.pagination?.total || 0,
      });
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao carregar produtos"));
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenModal = async (product?: Product) => {
    if (product) {
      setLoadingProduct(true);
      setIsModalOpen(true);
      try {
        const fullProduct = await api.getProduct(product.id);
        setEditingProduct(fullProduct);
        setFormData({
          name: fullProduct.name,
          description: fullProduct.description || "",
          price: fullProduct.price,
          discount: fullProduct.discount || 0,
          type_id: fullProduct.type_id || fullProduct.type?.id || "",
          categories: fullProduct.categories?.map((c: Category) => c.id) || [],
          production_time: fullProduct.production_time || 1,
          is_active: fullProduct.is_active ?? true,
        });
        setImagePreview(fullProduct.image_url || "");
        setComponents(
          fullProduct.components?.map((c: any) => ({
            item_id: c.item_id,
            quantity: c.quantity || 1,
          })) || [],
        );
        setAdditionals(
          fullProduct.additionals?.map((a: any) => ({
            item_id: a.additional_id,
            custom_price: a.custom_price || a.additional?.base_price || 0,
          })) || [],
        );
      } catch (e) {
        toast.error("Erro ao carregar detalhes do produto");
        setIsModalOpen(false);
      } finally {
        setLoadingProduct(false);
      }
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        description: "",
        price: 0,
        discount: 0,
        type_id: types[0]?.id || "",
        categories: [],
        production_time: 1,
        is_active: true,
      });
      setComponents([]);
      setAdditionals([]);
      setImagePreview("");
      setImageFile(null);
      setIsModalOpen(true);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Partial<ProductInput> = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        discount: formData.discount,
        type_id: formData.type_id,
        production_time: formData.production_time,
        is_active: formData.is_active,
        categories: formData.categories as any,
        components: components.filter((c) => c.item_id),
        additionals: additionals.filter((a) => a.item_id),
      };

      if (editingProduct) {
        await api.updateProduct(
          editingProduct.id,
          payload as any,
          imageFile || undefined,
        );
        toast.success("Produto atualizado!");
      } else {
        await api.createProduct(payload as any, imageFile || undefined);
        toast.success("Produto criado!");
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao salvar produto"));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      await api.updateProduct(product.id, {
        is_active: !product.is_active,
      } as any);
      toast.success(
        `Produto ${product.is_active ? "desativado" : "ativado"} com sucesso!`,
      );
      fetchProducts();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao alterar status do produto"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteProduct(id);
      toast.success("Produto excluído!");
      fetchProducts();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao excluir produto"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            size={18}
          />
          <Input
            type="text"
            placeholder="Buscar por nome ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-100 rounded-2xl text-neutral-950 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500/20"
          />
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-neutral-600 text-white rounded-2xl font-bold shadow-lg shadow-neutral-200 hover:bg-neutral-700 transition-all active:scale-95"
        >
          <Plus size={20} />
          Novo Produto
        </Button>
      </div>

      {loading && products.length === 0 ? (
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
                  Produto
                </TableHead>
                <TableHead className="text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider">
                  Preço
                </TableHead>
                <TableHead className="text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider">
                  Categorias
                </TableHead>
                <TableHead className="text-right text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider pr-6">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  className={`border-neutral-50 hover:bg-neutral-50/30 transition-colors ${product.is_active ? "opacity-100" : "opacity-30"}`}
                >
                  <TableCell className="pl-6">
                    <div className="w-12 h-12 rounded-xl bg-neutral-50 overflow-hidden border border-neutral-100">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-200">
                          <Package size={20} />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-neutral-950">
                        {product.name}
                      </div>
                      {!product.is_active && (
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-500 border border-red-100 rounded text-[8px] font-black uppercase">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-900/60 line-clamp-1 truncate max-w-xs">
                      {product.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      {(product.discount || 0) > 0 ? (
                        <>
                          <span className="text-[10px] text-neutral-300 line-through font-bold">
                            {formatCurrency(product.price)}
                          </span>
                          <span className="text-sm font-black text-neutral-600">
                            {formatCurrency(
                              product.price *
                                (1 - (product.discount || 0) / 100),
                            )}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-black text-neutral-950">
                          {formatCurrency(product.price)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.categories?.map((cat) => (
                        <span
                          key={cat.id}
                          className="px-2 py-0.5 bg-neutral-50 text-neutral-500 border border-neutral-100 rounded-lg text-[9px] font-bold uppercase"
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(product)}
                        title={product.is_active ? "Desativar" : "Ativar"}
                        className={clsx(
                          "h-8 w-8 rounded-xl transition-colors",
                          product.is_active
                            ? "text-green-600 hover:text-red-500 hover:bg-neutral-50"
                            : "text-neutral-400 hover:text-green-600 hover:bg-neutral-50",
                        )}
                      >
                        {product.is_active ? (
                          <Eye size={16} />
                        ) : (
                          <EyeOff size={16} />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenModal(product)}
                        className="h-8 w-8 text-neutral-600 hover:text-neutral-700 hover:bg-neutral-50 rounded-xl"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-400 hover:text-neutral-500 hover:bg-neutral-50 rounded-xl"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Deseja excluir este produto?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Isso irá excluir
                              permanentemente seu produto dos nossos servidores.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => handleDelete(product.id)}
                            >
                              Continuar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#0d1216]/20 h-screen backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {loadingProduct ? (
                <div className="h-96 flex items-center justify-center">
                  <Loader2
                    className="animate-spin text-neutral-500"
                    size={48}
                  />
                </div>
              ) : (
                <>
                  <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-neutral-950 text-white rounded-2xl">
                          <Box size={20} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-neutral-950 tracking-tight">
                            {editingProduct ? "Editar Produto" : "Novo Produto"}
                          </h3>
                          <p className="text-neutral-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                            Gestão de catálogo • {formData.name || "Sem nome"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            is_active: !formData.is_active,
                          })
                        }
                        className={clsx(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2",
                          formData.is_active
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-red-50 text-red-600 border-red-100",
                        )}
                      >
                        {formData.is_active ? (
                          <>
                            <Eye size={14} /> Ativo
                          </>
                        ) : (
                          <>
                            <EyeOff size={14} /> Inativo
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => setIsModalOpen(false)}
                        className="p-3 hover:bg-neutral-100 rounded-2xl text-neutral-400 transition-colors"
                      >
                        <X size={24} />
                      </Button>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSave}
                    className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-neutral-50/30"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left Column: Basic Info & Image */}
                      <div className="lg:col-span-5 space-y-6">
                        <section className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
                          <div>
                            <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-3 px-1">
                              Capa do Produto
                            </label>
                            <div className="aspect-[4/3] relative rounded-[2rem] bg-neutral-50 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100/50 transition-all group overflow-hidden">
                              {imagePreview ? (
                                <>
                                  <img
                                    src={imagePreview}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Upload className="text-white" size={32} />
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center gap-3 text-neutral-300 group-hover:text-neutral-500 transition-colors">
                                  <Upload
                                    size={40}
                                    className="group-hover:-translate-y-1 transition-transform"
                                  />
                                  <span className="text-xs font-black uppercase tracking-widest text-center px-4">
                                    Upload de imagem
                                  </span>
                                </div>
                              )}
                              <input
                                title="Upload"
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
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

                          <div className="space-y-4">
                            <div>
                              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                                Nome do Produto
                              </label>
                              <Input
                                type="text"
                                value={formData.name}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    name: e.target.value,
                                  })
                                }
                                className="w-full px-5 py-4 bg-neutral-50/50 border-neutral-100 rounded-2xl text-neutral-950 font-bold focus:ring-neutral-950/5 transition-all"
                                placeholder="Ex: Cesta Romântica Premium"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                                  Preço de Venda
                                </label>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-400">
                                    R$
                                  </span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        price: parseFloat(e.target.value),
                                      })
                                    }
                                    className="w-full pl-10 pr-5 py-4 bg-neutral-50/50 border-neutral-100 rounded-2xl text-neutral-950 font-black focus:ring-neutral-950/5 transition-all"
                                    required
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                                  Desconto
                                </label>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    value={formData.discount}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        discount: parseInt(e.target.value),
                                      })
                                    }
                                    className="w-full px-5 py-4 bg-neutral-50/50 border-neutral-100 rounded-2xl text-neutral-950 font-black focus:ring-neutral-950/5 transition-all"
                                  />
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-400">
                                    %
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2 px-1">
                                Descrição Curta
                              </label>
                              <textarea
                                value={formData.description}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    description: e.target.value,
                                  })
                                }
                                className="w-full px-5 py-4 bg-neutral-50/50 border border-neutral-100 rounded-2xl text-neutral-950 font-medium focus:outline-none focus:ring-4 focus:ring-neutral-500/10 transition-all min-h-[120px] resize-none"
                                placeholder="Descreva os principais diferenciais do produto..."
                              />
                            </div>
                          </div>
                        </section>

                        <section className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-4">
                          <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                            <Tag size={12} /> Classificação e Logística
                          </label>
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-neutral-400/60 uppercase tracking-widest mb-2 px-1">
                                Tipo de Produto
                              </label>
                              <select
                                title="Selecione um tipo"
                                value={formData.type_id}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    type_id: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-4 bg-neutral-50/50 border border-neutral-100 rounded-2xl text-neutral-950 font-bold focus:outline-none focus:ring-4 focus:ring-neutral-500/10 transition-all appearance-none cursor-pointer"
                              >
                                {types.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-neutral-400/60 uppercase tracking-widest mb-2 px-1">
                                Tempo de Produção
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={formData.production_time}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      production_time: parseInt(e.target.value),
                                    })
                                  }
                                  className="w-full px-5 py-4 bg-neutral-50/50 border-neutral-100 rounded-2xl text-neutral-950 font-bold focus:ring-neutral-950/5 transition-all"
                                />
                                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-neutral-400 uppercase">
                                  Horas
                                </span>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>

                      {/* Right Column: Categories, Components & Additionals */}
                      <div className="lg:col-span-7 space-y-6">
                        <section className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm">
                          <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-4 px-1 flex items-center gap-2">
                            <Layers size={12} /> Categorias Vinculadas
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {categories.map((cat) => (
                              <Button
                                key={cat.id}
                                type={"button"}
                                onClick={() => {
                                  const exists = formData.categories.includes(
                                    cat.id,
                                  );
                                  setFormData({
                                    ...formData,
                                    categories: exists
                                      ? formData.categories.filter(
                                          (id) => id !== cat.id,
                                        )
                                      : [...formData.categories, cat.id],
                                  });
                                }}
                                className={clsx(
                                  "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                                  formData.categories.includes(cat.id)
                                    ? "bg-neutral-950 text-white border-neutral-950"
                                    : "bg-white text-neutral-400 border-neutral-100 hover:border-neutral-200",
                                )}
                              >
                                {cat.name}
                              </Button>
                            ))}
                          </div>
                        </section>

                        <section className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm">
                          <div className="flex justify-between items-center mb-4">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                              <Box size={12} /> Composição do Produto
                            </label>
                            <Button
                              type="button"
                              onClick={() =>
                                setComponents([
                                  ...components,
                                  { item_id: "", quantity: 1 },
                                ])
                              }
                              className="w-8 h-8 flex items-center justify-center bg-neutral-950 text-white rounded-xl hover:bg-neutral-800 transition-colors"
                            >
                              <Plus size={16} />
                            </Button>
                          </div>
                          <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
                            {components.length === 0 ? (
                              <div className="py-10 text-center border-2 border-dashed border-neutral-50 rounded-[2rem]">
                                <p className="text-[10px] text-neutral-300 font-black uppercase tracking-widest">
                                  Nenhum item na composição
                                </p>
                              </div>
                            ) : (
                              components.map((comp, idx) => {
                                const currentItem = items.find(
                                  (i) => i.id === comp.item_id,
                                );
                                return (
                                  <div
                                    key={idx}
                                    className="flex gap-3 items-center bg-neutral-50/50 p-3 rounded-2xl border border-neutral-100 group"
                                  >
                                    <div className="flex-1 relative">
                                      <select
                                        title="Selecione um item"
                                        value={comp.item_id}
                                        onChange={(e) => {
                                          const newComp = [...components];
                                          newComp[idx].item_id = e.target.value;
                                          setComponents(newComp);
                                        }}
                                        className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-950 appearance-none cursor-pointer focus:ring-2 ring-neutral-950/5 outline-none"
                                      >
                                        <option value="">
                                          {comp.item_id
                                            ? currentItem?.name || "Item"
                                            : "Selecionar Item..."}
                                        </option>
                                        {items.map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.name}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                                        <ChevronDownIcon size={14} />
                                      </div>
                                    </div>
                                    <div className="w-24">
                                      <Input
                                        type="number"
                                        min="1"
                                        value={comp.quantity}
                                        onChange={(e) => {
                                          const newComp = [...components];
                                          newComp[idx].quantity = parseInt(
                                            e.target.value,
                                          );
                                          setComponents(newComp);
                                        }}
                                        className="w-full px-3 py-2 bg-white border-neutral-200 rounded-xl text-xs font-black text-center"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      onClick={() =>
                                        setComponents(
                                          components.filter(
                                            (_, i) => i !== idx,
                                          ),
                                        )
                                      }
                                      className="p-2 text-neutral-300 hover:text-red-500 transition-colors"
                                    >
                                      <X size={16} />
                                    </Button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </section>

                        <section className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm">
                          <div className="flex justify-between items-center mb-4">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                              <Plus size={12} /> Sugestões de Upsell
                            </label>
                            <Button
                              type="button"
                              onClick={() =>
                                setAdditionals([
                                  ...additionals,
                                  { item_id: "", custom_price: 0 },
                                ])
                              }
                              className="w-8 h-8 flex items-center justify-center bg-neutral-950 text-white rounded-xl hover:bg-neutral-800 transition-colors"
                            >
                              <Plus size={16} />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
                            {additionals.length === 0 ? (
                              <div className="py-10 text-center border-2 border-dashed border-neutral-50 rounded-[2rem]">
                                <p className="text-[10px] text-neutral-300 font-black uppercase tracking-widest">
                                  Nenhum adicional sugerido
                                </p>
                              </div>
                            ) : (
                              additionals.map((add, idx) => {
                                const currentItem = items.find(
                                  (i) => i.id === add.item_id,
                                );
                                return (
                                  <div
                                    key={idx}
                                    className="flex gap-3 items-center bg-neutral-50/50 p-3 rounded-2xl border border-neutral-100"
                                  >
                                    <div className="flex-1 relative">
                                      <select
                                        title="Selecione um adicional"
                                        value={add.item_id}
                                        onChange={(e) => {
                                          const newAdd = [...additionals];
                                          newAdd[idx].item_id = e.target.value;
                                          setAdditionals(newAdd);
                                        }}
                                        className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-950 appearance-none cursor-pointer focus:ring-2 ring-neutral-950/5 outline-none"
                                      >
                                        <option value="">
                                          {add.item_id
                                            ? currentItem?.name || "Adicional"
                                            : "Selecionar Item..."}
                                        </option>
                                        {items.map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.name}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                                        <ChevronDownIcon size={14} />
                                      </div>
                                    </div>
                                    <div className="w-32 relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-neutral-400">
                                        R$
                                      </span>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={add.custom_price}
                                        onChange={(e) => {
                                          const newAdd = [...additionals];
                                          newAdd[idx].custom_price = parseFloat(
                                            e.target.value,
                                          );
                                          setAdditionals(newAdd);
                                        }}
                                        className="w-full pl-8 pr-3 py-2 bg-white border-neutral-200 rounded-xl text-xs font-black text-center"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      onClick={() =>
                                        setAdditionals(
                                          additionals.filter(
                                            (_, i) => i !== idx,
                                          ),
                                        )
                                      }
                                      className="p-2 text-neutral-300 hover:text-red-500 transition-colors"
                                    >
                                      <X size={16} />
                                    </Button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </section>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-8 sticky bottom-0 bg-neutral-50/0 pointer-events-none">
                      <div className="flex-1" />
                      <div className="flex gap-4 p-2 bg-white/80 backdrop-blur-md border border-neutral-200 rounded-[2rem] shadow-2xl pointer-events-auto">
                        <Button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          variant={"secondary"}
                          className="px-8 py-4 text-neutral-500 font-black text-xs uppercase tracking-widest hover:bg-neutral-50 rounded-[1.5rem] transition-all"
                        >
                          Descartar
                        </Button>
                        <Button
                          type="submit"
                          disabled={loading}
                          className="px-10 py-4 bg-neutral-950 text-white font-black text-xs uppercase tracking-widest rounded-[1.5rem] shadow-xl shadow-neutral-950/20 hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-3"
                        >
                          {loading ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <>
                              <Check size={18} /> <span>Salvar Alterações</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: pagination.totalPages }).map((_, i) => (
            <Button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={clsx(
                "w-10 h-10 rounded-xl font-bold transition-all",
                currentPage === i + 1
                  ? "bg-neutral-600 text-white shadow-lg"
                  : "bg-white text-neutral-950 border border-neutral-100 hover:bg-neutral-50",
              )}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
