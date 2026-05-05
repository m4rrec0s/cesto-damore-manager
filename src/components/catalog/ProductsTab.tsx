import { useState, useEffect } from "react";
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
  const [reloading, setReloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  const getNumericValue = (value: string, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const validateProductForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Informe o nome do produto.";
    }

    if (!Number.isFinite(formData.price) || formData.price <= 0) {
      errors.price = "Informe um preço maior que zero.";
    }

    if (!formData.type_id) {
      errors.type_id = "Selecione um tipo de produto.";
    }

    if (formData.categories.length === 0) {
      errors.categories = "Selecione ao menos uma categoria.";
    }

    if (
      !Number.isFinite(formData.production_time) ||
      formData.production_time <= 0
    ) {
      errors.production_time = "Informe o tempo de produção em horas.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchInitialData = async (isReload = false) => {
    if (isReload) setReloading(true);
    else setLoading(true);
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
      setReloading(false);
    }
  };

  const fetchProducts = async (isReload = false) => {
    if (isReload) setReloading(true);
    else setLoading(true);
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
      setReloading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [currentPage, searchTerm]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchProducts(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [currentPage, searchTerm]);

  const handleOpenModal = async (product?: Product) => {
    setFormErrors({});
    setSubmitError("");

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
        toast.error(
          extractErrorMessage(e, "Erro ao carregar detalhes do produto"),
        );
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
    setSubmitError("");

    if (!validateProductForm()) {
      setSubmitError("Corrija os campos obrigatórios para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<ProductInput> = {
        name: formData.name.trim(),
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
      await fetchProducts(true);
    } catch (e) {
      const message = extractErrorMessage(e, "Erro ao salvar produto");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    setReloading(true);
    try {
      await api.updateProduct(product.id, {
        is_active: !product.is_active,
      } as any);
      toast.success(
        `Produto ${product.is_active ? "desativado" : "ativado"} com sucesso!`,
      );
      await fetchProducts(true);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao alterar status do produto"));
      setReloading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setReloading(true);
    try {
      await api.deleteProduct(id);
      toast.success("Produto excluído!");
      await fetchProducts(true);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao excluir produto"));
      setReloading(false);
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
      ) : reloading ? (
        <div className="flex items-center justify-center gap-3 py-20 bg-neutral-50/50 rounded-3xl border border-dashed border-neutral-100">
          <Loader2 className="animate-spin text-neutral-500" size={32} />
          <span className="text-sm font-medium text-neutral-400">
            Atualizando...
          </span>
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

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-neutral-100 bg-neutral-50/50">
              <span className="text-xs font-medium text-neutral-500">
                Mostrando página {currentPage} de {pagination.totalPages}{" "}
                (Total: {pagination.total})
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading || reloading}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(pagination.totalPages, p + 1),
                    )
                  }
                  disabled={
                    currentPage === pagination.totalPages ||
                    loading ||
                    reloading
                  }
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
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
              className="relative w-full max-w-5xl bg-white rounded-lg shadow-xl border border-neutral-300 overflow-hidden flex flex-col max-h-[90vh]"
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
                  <div className="p-4 sm:p-6 border-b border-neutral-200 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-neutral-900 text-white rounded">
                          <Box size={20} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-neutral-950">
                            {editingProduct ? "Editar Produto" : "Novo Produto"}
                          </h3>
                          <p className="text-neutral-500 text-xs mt-0.5">
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
                          "px-3 py-2 rounded text-xs font-semibold transition-all border flex items-center gap-2",
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
                        className="p-2 hover:bg-neutral-100 rounded text-neutral-500 transition-colors"
                      >
                        <X size={24} />
                      </Button>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSave}
                    className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-white"
                  >
                    <div className="mb-4 text-sm text-neutral-600">
                      Campos obrigatórios{" "}
                      <span className="text-red-600">*</span>
                    </div>
                    {submitError && (
                      <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {submitError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left Column: Basic Info & Image */}
                      <div className="lg:col-span-5 space-y-6">
                        <section className="bg-white p-4 sm:p-5 rounded-lg border border-neutral-200 space-y-5">
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">
                              Capa do Produto
                            </label>
                            <div className="aspect-[4/3] relative rounded-md bg-neutral-50 border border-dashed border-neutral-300 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100/50 transition-all group overflow-hidden">
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
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Nome do Produto{" "}
                                <span className="text-red-600">*</span>
                              </label>
                              <Input
                                type="text"
                                value={formData.name}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    name: e.target.value,
                                  });
                                  if (formErrors.name) {
                                    setFormErrors((prev) => ({
                                      ...prev,
                                      name: "",
                                    }));
                                  }
                                }}
                                className={clsx(
                                  "w-full border rounded-md px-3 py-2 text-sm",
                                  formErrors.name
                                    ? "border-red-500"
                                    : "border-neutral-300",
                                )}
                                placeholder="Ex: Cesta Romântica Premium"
                                required
                              />
                              {formErrors.name && (
                                <p className="mt-1 text-xs text-red-600">
                                  {formErrors.name}
                                </p>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                  Preço de Venda{" "}
                                  <span className="text-red-600">*</span>
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500">
                                    R$
                                  </span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) => {
                                      setFormData({
                                        ...formData,
                                        price: getNumericValue(e.target.value),
                                      });
                                      if (formErrors.price) {
                                        setFormErrors((prev) => ({
                                          ...prev,
                                          price: "",
                                        }));
                                      }
                                    }}
                                    className={clsx(
                                      "w-full pl-9 pr-3 py-2 border rounded-md text-sm",
                                      formErrors.price
                                        ? "border-red-500"
                                        : "border-neutral-300",
                                    )}
                                    required
                                  />
                                </div>
                                {formErrors.price && (
                                  <p className="mt-1 text-xs text-red-600">
                                    {formErrors.price}
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                  Desconto
                                </label>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    value={formData.discount}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        discount: getNumericValue(
                                          e.target.value,
                                          0,
                                        ),
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500">
                                    %
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
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
                                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm min-h-[120px] resize-none"
                                placeholder="Descreva os principais diferenciais do produto..."
                              />
                            </div>
                          </div>
                        </section>

                        <section className="bg-white p-4 sm:p-5 rounded-lg border border-neutral-200 space-y-4">
                          <label className="block text-sm font-medium text-neutral-700 px-1 flex items-center gap-2">
                            <Tag size={12} /> Classificação e Logística
                          </label>
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Tipo de Produto{" "}
                                <span className="text-red-600">*</span>
                              </label>
                              <select
                                title="Selecione um tipo"
                                value={formData.type_id}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    type_id: e.target.value,
                                  });
                                  if (formErrors.type_id) {
                                    setFormErrors((prev) => ({
                                      ...prev,
                                      type_id: "",
                                    }));
                                  }
                                }}
                                className={clsx(
                                  "w-full px-3 py-2 border rounded-md text-sm bg-white",
                                  formErrors.type_id
                                    ? "border-red-500"
                                    : "border-neutral-300",
                                )}
                              >
                                <option value="">Selecione...</option>
                                {types.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              {formErrors.type_id && (
                                <p className="mt-1 text-xs text-red-600">
                                  {formErrors.type_id}
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Tempo de Produção{" "}
                                <span className="text-red-600">*</span>
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={formData.production_time}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      production_time: getNumericValue(
                                        e.target.value,
                                        0,
                                      ),
                                    });
                                    if (formErrors.production_time) {
                                      setFormErrors((prev) => ({
                                        ...prev,
                                        production_time: "",
                                      }));
                                    }
                                  }}
                                  className={clsx(
                                    "w-full px-3 py-2 border rounded-md text-sm",
                                    formErrors.production_time
                                      ? "border-red-500"
                                      : "border-neutral-300",
                                  )}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500 uppercase">
                                  Horas
                                </span>
                              </div>
                              {formErrors.production_time && (
                                <p className="mt-1 text-xs text-red-600">
                                  {formErrors.production_time}
                                </p>
                              )}
                            </div>
                          </div>
                        </section>
                      </div>

                      {/* Right Column: Categories, Components & Additionals */}
                      <div className="lg:col-span-7 space-y-6">
                        <section
                          className={clsx(
                            "bg-white p-4 sm:p-5 rounded-lg border",
                            formErrors.categories
                              ? "border-red-400"
                              : "border-neutral-200",
                          )}
                        >
                          <label className="block text-sm font-medium text-neutral-700 mb-3 px-1 flex items-center gap-2">
                            <Layers size={12} /> Categorias Vinculadas
                            <span className="text-red-600">*</span>
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
                                  if (formErrors.categories) {
                                    setFormErrors((prev) => ({
                                      ...prev,
                                      categories: "",
                                    }));
                                  }
                                }}
                                className={clsx(
                                  "px-3 py-2 rounded text-xs font-medium transition-all border",
                                  formData.categories.includes(cat.id)
                                    ? "bg-neutral-900 text-white border-neutral-900"
                                    : "bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400",
                                )}
                              >
                                {cat.name}
                              </Button>
                            ))}
                          </div>
                          {formErrors.categories && (
                            <p className="mt-2 text-xs text-red-600">
                              {formErrors.categories}
                            </p>
                          )}
                        </section>

                        <section className="bg-white p-4 sm:p-5 rounded-lg border border-neutral-200">
                          <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-medium text-neutral-700 px-1 flex items-center gap-2">
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
                              <div className="py-10 text-center border border-dashed border-neutral-300 rounded-md">
                                <p className="text-xs text-neutral-500">
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
                                    className="flex gap-3 items-center bg-neutral-50 p-3 rounded-md border border-neutral-200 group"
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
                                        className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md text-sm text-neutral-950 appearance-none cursor-pointer focus:ring-2 ring-neutral-950/5 outline-none"
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
                                        className="w-full px-3 py-2 bg-white border-neutral-300 rounded-md text-sm text-center"
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

                        <section className="bg-white p-4 sm:p-5 rounded-lg border border-neutral-200">
                          <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-medium text-neutral-700 px-1 flex items-center gap-2">
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
                              <div className="py-10 text-center border border-dashed border-neutral-300 rounded-md">
                                <p className="text-xs text-neutral-500">
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
                                    className="flex gap-3 items-center bg-neutral-50 p-3 rounded-md border border-neutral-200"
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
                                        className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md text-sm text-neutral-950 appearance-none cursor-pointer focus:ring-2 ring-neutral-950/5 outline-none"
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
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500">
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
                                        className="w-full pl-8 pr-3 py-2 bg-white border-neutral-300 rounded-md text-sm text-center"
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

                    <div className="flex gap-4 pt-6 sticky bottom-0 bg-white pointer-events-none">
                      <div className="flex-1" />
                      <div className="flex gap-3 p-2 bg-white border border-neutral-200 rounded-md shadow pointer-events-auto">
                        <Button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          variant={"secondary"}
                          className="px-4 py-2 text-neutral-700 text-sm hover:bg-neutral-50 rounded"
                        >
                          Descartar
                        </Button>
                        <Button
                          type="submit"
                          disabled={submitting}
                          className="px-5 py-2 bg-neutral-900 text-white text-sm rounded hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {submitting ? (
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
    </div>
  );
}
