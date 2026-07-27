import { useEffect, useState } from "react";
import {
  Loader,
  Plus,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Layers,
  Settings,
  X,
  Save,
  GripVertical,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "../services/api";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Componente para item sortável de seção
function SortableSectionItem({
  section,
  onEdit,
  onDelete,
  onManageItems,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 flex items-center gap-3 bg-neutral-50/50 rounded-xl hover:bg-neutral-50 transition-colors border border-neutral-100 ${
        isDragging ? "bg-blue-50 !shadow-lg !border-blue-200" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1.5 text-neutral-400 hover:text-neutral-600 cursor-grab active:cursor-grabbing rounded-lg hover:bg-neutral-100 shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
        <Layers className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-neutral-950 truncate text-sm">{section.title}</h4>
        <div className="flex items-center gap-2">
          <p className="text-xs text-neutral-500 truncate">
            {section.section_type}
          </p>
          {section.section_type === "CUSTOM_PRODUCTS" && (
            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">
              {section.items?.length || 0} produtos
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {section.section_type === "CUSTOM_PRODUCTS" && (
          <Button
            onClick={() => onManageItems(section)}
            variant="ghost" size="icon"
            title="Gerenciar Produtos"
          >
            <Package className="w-4 h-4" />
          </Button>
        )}
        <Button
          onClick={() => onEdit(section)}
          variant="ghost" size="icon"
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => onDelete(section.id)}
          variant="ghost" size="icon"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function SortableProductItem({ item, product, onRemove }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white p-3 rounded-xl border flex items-center gap-3 ${
        isDragging ? "shadow-lg border-blue-200" : "border-neutral-100"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing rounded-lg hover:bg-neutral-100 shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-10 h-10 bg-neutral-100 rounded-lg shrink-0 overflow-hidden">
        {product?.image_url && (
          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-neutral-900 truncate">
          {product?.name || "Produto não encontrado"}
        </p>
        <p className="text-xs text-neutral-500">
          R$ {product?.price?.toFixed(2)}
        </p>
      </div>
      <Button
        onClick={() => onRemove(item.id)}
        variant="ghost" size="icon"
        className="text-red-400 hover:text-red-600"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function Feed() {
  const api = useApi();
  const [data, setData] = useState({
    banners: [] as any[],
    sections: [] as any[],
    configurations: [] as any[],
    sectionTypes: [] as any[],
    products: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [bannerForm, setBannerForm] = useState({
    title: "",
    subtitle: "",
    link_url: "",
    display_order: 0,
    is_active: true,
    feed_config_id: "",
    image: null as File | null,
    image_preview: "",
  });

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [sectionForm, setSectionForm] = useState({
    title: "",
    section_type: "",
    display_order: 0,
    is_visible: true,
    feed_config_id: "",
    max_items: 6,
  });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [configForm, setConfigForm] = useState({
    name: "",
    is_active: true,
  });

  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [managingSection, setManagingSection] = useState<any>(null);
  const [searchProduct, setSearchProduct] = useState("");
  const [modalProducts, setModalProducts] = useState<any[]>([]);
  const [modalPagination, setModalPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFeedData();
  }, []);

  useEffect(() => {
    if (isItemsModalOpen && managingSection) {
      const updated = data.sections.find((s) => s.id === managingSection.id);
      if (updated) setManagingSection(updated);
    }
  }, [data.sections, isItemsModalOpen]);

  useEffect(() => {
    if (isItemsModalOpen) {
      const timer = setTimeout(() => {
        loadModalProducts(1, searchProduct);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchProduct, isItemsModalOpen]);

  const selectedConfig = data.configurations.find(
    (c) => c.id === selectedConfigId,
  );
  const configBanners = data.banners.filter(
    (b) => b.feed_config_id === selectedConfigId,
  );
  const configSections = data.sections.filter(
    (s) => s.feed_config_id === selectedConfigId,
  );

  const loadFeedData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [banners, sections, configs, sectionTypes, products] =
        await Promise.all([
          api.get("/admin/feed/banners"),
          api.get("/admin/feed/sections"),
          api.get("/admin/feed/configurations"),
          api.getSectionTypes(),
          api.getProducts({ perPage: 1000 }),
        ]);

      const newData = {
        banners: banners.data,
        sections: sections.data,
        configurations: configs.data,
        sectionTypes: sectionTypes,
        products: products.products || [],
      };

      setData(newData);

      if (!selectedConfigId && newData.configurations.length > 0) {
        const active = newData.configurations.find((c: any) => c.is_active);
        setSelectedConfigId(active?.id || newData.configurations[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar feed:", error);
      toast.error("Erro ao carregar dados do feed");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este banner?")) return;
    try {
      await api.deleteFeedBanner(id);
      toast.success("Banner excluído com sucesso");
      loadFeedData();
    } catch (error) {
      toast.error("Erro ao excluir banner");
    }
  };

  const handleDeleteSection = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta seção?")) return;
    try {
      await api.deleteFeedSection(id);
      toast.success("Seção excluída com sucesso");
      loadFeedData();
    } catch (error) {
      toast.error("Erro ao excluir seção");
    }
  };

  const handleDragEndSections = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const allSections = [...data.sections];
      const filteredIds = configSections.map((s: any) => s.id);
      const filteredSections = allSections.filter((s) =>
        filteredIds.includes(s.id),
      );
      const oldIndex = filteredSections.findIndex((s) => s.id === active.id);
      const newIndex = filteredSections.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(filteredSections, oldIndex, newIndex);
      const updates = reordered.map((section, index) => ({
        ...section,
        display_order: index,
      }));
      const updatedAll = allSections.map(
        (s) =>
          updates.find((u) => u.id === s.id) || s,
      );
      setData({ ...data, sections: updatedAll } as any);
      for (const section of updates) {
        try {
          await api.updateFeedSection(section.id, {
            display_order: section.display_order,
          });
        } catch (error) {
          console.error(
            `Erro ao atualizar ordem da seção ${section.id}:`,
            error,
          );
        }
      }
      toast.success("Ordem atualizada com sucesso");
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (
      window.confirm(
        "Atenção: Excluir uma configuração deletará todos os seus banners e seções. Continuar?",
      )
    ) {
      try {
        await api.deleteFeedConfiguration(id);
        toast.success("Configuração excluída com sucesso");
        setSelectedConfigId(null);
        loadFeedData();
      } catch (error) {
        toast.error("Erro ao excluir configuração");
      }
    }
  };

  const openBannerModal = (banner?: any) => {
    if (banner) {
      setEditingBanner(banner);
      setBannerForm({
        title: banner.title || "",
        subtitle: banner.subtitle || "",
        link_url: banner.link_url || "",
        display_order: banner.display_order || 0,
        is_active: banner.is_active ?? true,
        feed_config_id:
          banner.feed_config_id || selectedConfigId || data.configurations[0]?.id || "",
        image: null,
        image_preview: banner.image_url || "",
      });
    } else {
      setEditingBanner(null);
      setBannerForm({
        title: "",
        subtitle: "",
        link_url: "",
        display_order: data.banners.length,
        is_active: true,
        feed_config_id: selectedConfigId || data.configurations[0]?.id || "",
        image: null,
        image_preview: "",
      });
    }
    setIsBannerModalOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.feed_config_id) {
      toast.error("Selecione uma configuração de feed");
      return;
    }
    if (!editingBanner && !bannerForm.image) {
      toast.error("A imagem é obrigatória para novos banners");
      return;
    }
    try {
      setSaving(true);
      const { image, image_preview, ...payload } = bannerForm;
      if (editingBanner) {
        await api.updateFeedBanner(
          editingBanner.id,
          payload,
          image || undefined,
        );
        toast.success("Banner atualizado com sucesso");
      } else {
        await api.createFeedBanner(payload, image || undefined);
        toast.success("Banner criado com sucesso");
      }
      setIsBannerModalOpen(false);
      loadFeedData();
    } catch (error) {
      console.error("Erro ao salvar banner:", error);
      toast.error("Erro ao salvar banner");
    } finally {
      setSaving(false);
    }
  };

  const openSectionModal = (section?: any) => {
    if (section) {
      setEditingSection(section);
      setSectionForm({
        title: section.title || "",
        section_type: section.section_type || "",
        display_order: section.display_order || 0,
        is_visible: section.is_visible ?? true,
        feed_config_id:
          section.feed_config_id || selectedConfigId || data.configurations[0]?.id || "",
        max_items: section.max_items || 6,
      });
    } else {
      setEditingSection(null);
      setSectionForm({
        title: "",
        section_type: data.sectionTypes[0]?.value || "RECOMMENDED_PRODUCTS",
        display_order: data.sections.length,
        is_visible: true,
        feed_config_id: selectedConfigId || data.configurations[0]?.id || "",
        max_items: 6,
      });
    }
    setIsSectionModalOpen(true);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingSection) {
        await api.updateFeedSection(editingSection.id, sectionForm);
        toast.success("Seção atualizada com sucesso");
      } else {
        await api.createFeedSection(sectionForm);
        toast.success("Seção criada com sucesso");
      }
      setIsSectionModalOpen(false);
      loadFeedData();
    } catch (error) {
      toast.error("Erro ao salvar seção");
    } finally {
      setSaving(false);
    }
  };

  const openConfigModal = (config?: any) => {
    if (config) {
      setEditingConfig(config);
      setConfigForm({
        name: config.name || "",
        is_active: config.is_active ?? true,
      });
    } else {
      setEditingConfig(null);
      setConfigForm({
        name: "",
        is_active: true,
      });
    }
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingConfig) {
        await api.updateFeedConfiguration(editingConfig.id, configForm);
        toast.success("Configuração atualizada com sucesso");
      } else {
        await api.createFeedConfiguration(configForm as any);
        toast.success("Configuração criada com sucesso");
      }
      setIsConfigModalOpen(false);
      loadFeedData();
    } catch (error) {
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const openManageItems = (section: any) => {
    setManagingSection(section);
    setIsItemsModalOpen(true);
    setSearchProduct("");
    loadModalProducts(1, "");
  };

  const loadModalProducts = async (page: number, search: string) => {
    try {
      setIsSearchingProducts(true);
      const response = await api.getProducts({
        page,
        perPage: 8,
        search,
      });
      setModalProducts(response.products);
      setModalPagination({
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        total: response.pagination.total,
      });
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      toast.error("Não foi possível carregar os produtos");
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const handleAddItemToSection = async (product: any) => {
    try {
      await api.post(`/admin/feed/sections/${managingSection.id}/items`, {
        feed_section_id: managingSection.id,
        item_type: "product",
        item_id: product.id,
        display_order: managingSection.items?.length || 0,
      });
      toast.success("Produto adicionado com sucesso");
      await loadFeedData(true);
    } catch (error) {
      toast.error("Erro ao adicionar produto");
    }
  };

  const handleRemoveItemFromSection = async (itemId: string) => {
    try {
      await api.delete(`/admin/feed/section-items/${itemId}`);
      toast.success("Produto removido com sucesso");
      await loadFeedData(true);
    } catch (error) {
      toast.error("Erro ao remover produto");
    }
  };

  const handleDragEndItems = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = [...(managingSection?.items || [])];
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    const updated = { ...managingSection!, items: reordered };
    setManagingSection(updated);
    for (const [index, item] of reordered.entries()) {
      try {
        await api.updateFeedSectionItem(item.id, { display_order: index });
      } catch (error) {
        console.error(`Erro ao atualizar ordem do item ${item.id}:`, error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-neutral-500 mx-auto mb-4" />
          <p className="text-neutral-700">Carregando Feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 gap-4 md:gap-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-950">
            Gerenciamento de Feed
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 mt-0.5 md:mt-1">
            Configurações de banners e seções da página inicial
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingConfig(null);
            setConfigForm({ name: "", is_active: true });
            setIsConfigModalOpen(true);
          }}
          variant="outline" className="font-medium w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Configuração
        </Button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-y-auto">
        {/* Sidebar: Config List */}
        <div className="w-full lg:w-64 xl:w-72 shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
          {data.configurations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-6">
                <Settings className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                <p className="text-sm text-neutral-500 font-medium">
                  Nenhuma configuração
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Crie sua primeira configuração de feed
                </p>
              </div>
            </div>
          ) : (
            data.configurations.map((config) => {
              const bCount = data.banners.filter(
                (b) => b.feed_config_id === config.id,
              ).length;
              const sCount = data.sections.filter(
                (s) => s.feed_config_id === config.id,
              ).length;
              const isSelected = selectedConfigId === config.id;
              return (
                <button
                  key={config.id}
                  onClick={() => setSelectedConfigId(config.id)}
                  className={`shrink-0 lg:w-full text-left p-3 lg:p-4 rounded-xl lg:rounded-2xl border-2 transition-all ${
                    isSelected
                      ? "border-neutral-900 bg-neutral-50 shadow-sm"
                      : "border-transparent bg-white hover:bg-neutral-50 hover:border-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-bold text-neutral-950 truncate text-sm">
                      {config.name}
                    </h3>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        config.is_active
                          ? "bg-green-50 text-green-600"
                          : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      {config.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>{bCount} banner{bCount !== 1 ? "s" : ""}</span>
                    <span>{sCount} seçã{sCount !== 1 ? "ões" : "o"}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Main: Config Detail */}
        <div className="flex-1 bg-white rounded-xl md:rounded-[2rem] border border-neutral-100 shadow-sm flex flex-col min-w-0">
          {!selectedConfig ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center">
                <Settings className="w-16 h-16 text-neutral-200 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-neutral-900 mb-2">
                  Selecione uma configuração
                </h2>
                <p className="text-neutral-400 text-sm">
                  Escolha uma configuração ao lado para gerenciar seus banners e seções
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Config Header */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-neutral-950 truncate">
                      {selectedConfig.name}
                    </h2>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        selectedConfig.is_active
                          ? "bg-green-50 text-green-600"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {selectedConfig.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => {
                      setEditingConfig(selectedConfig);
                      setConfigForm({
                        name: selectedConfig.name || "",
                        is_active: selectedConfig.is_active ?? true,
                      });
                      setIsConfigModalOpen(true);
                    }}
                    variant="ghost" size="icon"
                  >
                    <Edit2 className="w-5 h-5" />
                  </Button>
                  <Button
                    onClick={() => handleDeleteConfig(selectedConfig.id)}
                    variant="ghost" size="icon"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1">
                {/* Banners */}
                <div className="border-b border-neutral-100">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <h3 className="font-bold text-neutral-800 flex items-center gap-2 text-sm">
                      <ImageIcon className="w-4 h-4 text-rose-500" />
                      Banners ({configBanners.length})
                    </h3>
                    <Button
                      onClick={() => openBannerModal()}
                      variant="outline" size="sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </Button>
                  </div>
                  {configBanners.length === 0 ? (
                    <div className="px-6 pb-4">
                      <div className="border-2 border-dashed border-neutral-100 rounded-xl p-8 text-center">
                        <ImageIcon className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                        <p className="text-sm text-neutral-400 font-medium">
                          Nenhum banner nesta configuração
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 pb-4 space-y-2">
                      {configBanners.map((banner) => (
                        <div
                          key={banner.id}
                          className="p-3 flex items-center gap-3 bg-neutral-50/50 rounded-xl hover:bg-neutral-50 transition-colors border border-neutral-100"
                        >
                          <div className="w-28 h-16 bg-neutral-100 rounded-lg overflow-hidden shrink-0">
                            {banner.image_url ? (
                              <img
                                src={banner.image_url}
                                alt={banner.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-300">
                                <ImageIcon className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-neutral-900 truncate text-sm">
                              {banner.title || "Sem título"}
                            </h4>
                            <p className="text-xs text-neutral-500 truncate">
                              {banner.subtitle || "Sem subtítulo"}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span
                                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                                  banner.is_active
                                    ? "bg-green-50 text-green-600"
                                    : "bg-red-50 text-red-600"
                                }`}
                              >
                                {banner.is_active ? "Ativo" : "Inativo"}
                              </span>
                              <span className="text-[10px] text-neutral-400 uppercase font-bold">
                                Ordem: {banner.display_order}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              onClick={() => openBannerModal(banner)}
                              variant="ghost" size="icon"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteBanner(banner.id)}
                              variant="ghost" size="icon"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sections */}
                <div>
                  <div className="px-6 py-4 flex items-center justify-between">
                    <h3 className="font-bold text-neutral-800 flex items-center gap-2 text-sm">
                      <Layers className="w-4 h-4 text-blue-500" />
                      Seções ({configSections.length})
                    </h3>
                    <Button
                      onClick={() => openSectionModal()}
                      variant="outline" size="sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </Button>
                  </div>
                  {configSections.length === 0 ? (
                    <div className="px-6 pb-6">
                      <div className="border-2 border-dashed border-neutral-100 rounded-xl p-8 text-center">
                        <Layers className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                        <p className="text-sm text-neutral-400 font-medium">
                          Nenhuma seção nesta configuração
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 pb-6 space-y-2">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEndSections}
                      >
                        <SortableContext
                          items={configSections.map((s: any) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {configSections.map((section) => (
                            <SortableSectionItem
                              key={section.id}
                              section={section}
                              onEdit={openSectionModal}
                              onDelete={handleDeleteSection}
                              onManageItems={openManageItems}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Banner Modal */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl md:rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <h2 className="text-xl font-bold text-neutral-950">
                {editingBanner ? "Editar Banner" : "Novo Banner"}
              </h2>
              <Button
                onClick={() => setIsBannerModalOpen(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </Button>
            </div>
            <form onSubmit={handleSaveBanner} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Configuração de Feed
                  </label>
                  <select
                    title="Configuração de Feed"
                    value={bannerForm.feed_config_id}
                    onChange={(e) =>
                      setBannerForm({
                        ...bannerForm,
                        feed_config_id: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    required
                  >
                    <option value="">Selecione...</option>
                    {data.configurations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Título</label>
                  <input
                    type="text"
                    value={bannerForm.title}
                    onChange={(e) =>
                      setBannerForm({ ...bannerForm, title: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    placeholder="Ex: Ofertas de Verão"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Subtítulo</label>
                  <input
                    type="text"
                    value={bannerForm.subtitle}
                    onChange={(e) =>
                      setBannerForm({ ...bannerForm, subtitle: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    placeholder="Ex: Até 50% de desconto"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Link (URL)</label>
                  <input
                    type="text"
                    value={bannerForm.link_url}
                    onChange={(e) =>
                      setBannerForm({ ...bannerForm, link_url: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    placeholder="Ex: /produtos/promocao"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Ordem</label>
                  <input
                    title="Ordem"
                    type="number"
                    value={bannerForm.display_order}
                    onChange={(e) =>
                      setBannerForm({
                        ...bannerForm,
                        display_order: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    required
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={bannerForm.is_active}
                      onChange={(e) =>
                        setBannerForm({
                          ...bannerForm,
                          is_active: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    <span className="text-sm font-bold text-neutral-700 group-hover:text-neutral-900 transition-colors">
                      Banner Ativo
                    </span>
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Imagem do Banner</label>
                  <div className="mt-1 flex items-center gap-4">
                    {bannerForm.image_preview && (
                      <div className="w-24 h-16 rounded-lg overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200">
                        <img
                          src={bannerForm.image_preview}
                          className="w-full h-full object-cover"
                          alt="Pré-visualização do Banner"
                        />
                      </div>
                    )}
                    <label className="flex-1">
                      <div className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-neutral-200 rounded-xl hover:border-neutral-900 hover:bg-neutral-50 transition-all cursor-pointer group">
                        <ImageIcon className="w-6 h-6 text-neutral-400 group-hover:text-neutral-900 mb-1" />
                        <span className="text-xs font-bold text-neutral-500 group-hover:text-neutral-900">
                          Clique para selecionar
                        </span>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setBannerForm({
                              ...bannerForm,
                              image: file,
                              image_preview: URL.createObjectURL(file),
                            });
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  variant="ghost" className="flex-1 font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  variant="outline" className="flex-1 font-bold"
                >
                  {saving ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {editingBanner ? "Salvar Alterações" : "Criar Banner"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section Modal */}
      {isSectionModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl md:rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <h2 className="text-xl font-bold text-neutral-950">
                {editingSection ? "Editar Seção" : "Nova Seção"}
              </h2>
              <Button
                onClick={() => setIsSectionModalOpen(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </Button>
            </div>
            <form onSubmit={handleSaveSection} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Configuração de Feed
                  </label>
                  <select
                    title="Configuração de Feed"
                    value={sectionForm.feed_config_id}
                    onChange={(e) =>
                      setSectionForm({
                        ...sectionForm,
                        feed_config_id: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    required
                  >
                    <option value="">Selecione...</option>
                    {data.configurations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Título da Seção</label>
                  <input
                    type="text"
                    value={sectionForm.title}
                    onChange={(e) =>
                      setSectionForm({ ...sectionForm, title: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    placeholder="Ex: Produtos em Destaque"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Tipo de Seção</label>
                  <select
                    title="Tipo de seção"
                    value={sectionForm.section_type}
                    onChange={(e) =>
                      setSectionForm({
                        ...sectionForm,
                        section_type: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    required
                  >
                    <option value="">Selecione...</option>
                    {data.sectionTypes.map((type: any) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Ordem</label>
                  <input
                    title="Ordem"
                    type="number"
                    value={sectionForm.display_order}
                    onChange={(e) =>
                      setSectionForm({
                        ...sectionForm,
                        display_order: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Máx. Itens</label>
                  <input
                    title="Máx. Itens"
                    type="number"
                    value={sectionForm.max_items}
                    onChange={(e) =>
                      setSectionForm({
                        ...sectionForm,
                        max_items: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    required
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    id="is_visible"
                    checked={sectionForm.is_visible}
                    onChange={(e) =>
                      setSectionForm({
                        ...sectionForm,
                        is_visible: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                  />
                  <label
                    htmlFor="is_visible"
                    className="text-sm font-bold text-neutral-700 group-hover:text-neutral-900 transition-colors cursor-pointer"
                  >
                    Seção Visível
                  </label>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  onClick={() => setIsSectionModalOpen(false)}
                  variant="ghost" className="flex-1 font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  variant="outline" className="flex-1 font-bold"
                >
                  {saving ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {editingSection ? "Salvar Alterações" : "Criar Seção"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl md:rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <h2 className="text-xl font-bold text-neutral-950">
                {editingConfig ? "Editar Configuração" : "Nova Configuração"}
              </h2>
              <Button
                onClick={() => setIsConfigModalOpen(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </Button>
            </div>
            <form onSubmit={handleSaveConfig} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Nome da Configuração</label>
                  <input
                    type="text"
                    value={configForm.name}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, name: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
                    placeholder="Ex: Natal 2024"
                    required
                  />
                </div>
                <div className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    id="config_active"
                    checked={configForm.is_active}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                  />
                  <label
                    htmlFor="config_active"
                    className="text-sm font-bold text-neutral-700 group-hover:text-neutral-900 transition-colors cursor-pointer"
                  >
                    Configuração Ativa
                  </label>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  variant="ghost" className="flex-1 font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  variant="outline" className="flex-1 font-bold"
                >
                  {saving ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {editingConfig ? "Salvar Alterações" : "Criar Configuração"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gerenciar Produtos Modal */}
      {isItemsModalOpen && managingSection && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl md:rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <div>
                <h2 className="text-xl font-bold text-neutral-950">
                  Gerenciar Produtos: {managingSection.title}
                </h2>
                <p className="text-sm text-neutral-500">
                  Adicione ou remova produtos desta seção personalizada
                </p>
              </div>
              <Button
                onClick={() => setIsItemsModalOpen(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden flex divide-x divide-neutral-100">
              <div className="w-1/2 flex flex-col bg-neutral-50/30">
                <div className="p-4 border-b border-neutral-100 flex justify-between items-center">
                  <h3 className="font-bold text-neutral-800 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    Produtos na Seção ({managingSection.items?.length || 0})
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {managingSection.items?.length === 0 ? (
                    <div className="text-center py-10 opacity-50 text-neutral-500">
                      Nenhum produto adicionado.
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEndItems}
                    >
                      <SortableContext
                        items={managingSection.items.map((i: any) => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {managingSection.items?.map((item: any) => {
                          const product = data.products.find(
                            (p) => p.id === item.item_id,
                          );
                          return (
                            <SortableProductItem
                              key={item.id}
                              item={item}
                              product={product}
                              onRemove={handleRemoveItemFromSection}
                            />
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
              <div className="w-1/2 flex flex-col">
                <div className="p-4 border-b border-neutral-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-neutral-100 border-none rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
                  {isSearchingProducts ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                      <Loader className="w-8 h-8 animate-spin text-neutral-400" />
                    </div>
                  ) : modalProducts.length === 0 ? (
                    <div className="text-center py-10 opacity-50 text-neutral-500">
                      Nenhum produto encontrado.
                    </div>
                  ) : (
                    modalProducts
                      .filter(
                        (p) =>
                          !managingSection.items?.some(
                            (item: any) => item.item_id === p.id,
                          ),
                      )
                      .map((product) => (
                        <div
                          key={product.id}
                          className="hover:bg-neutral-50 p-3 rounded-xl flex items-center gap-3 transition-colors border border-transparent hover:border-neutral-100"
                        >
                          <div className="w-10 h-10 bg-neutral-100 rounded-lg shrink-0 overflow-hidden">
                            {product.image_url && (
                              <img
                                src={product.image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-neutral-900 truncate">
                              {product.name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              R$ {product.price?.toFixed(2)}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleAddItemToSection(product)}
                            variant="outline" size="icon"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                  )}
                </div>
                {modalPagination.totalPages > 1 && (
                  <div className="p-4 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                    <p className="text-xs text-neutral-500 font-medium">
                      Página {modalPagination.page} de{" "}
                      {modalPagination.totalPages}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        onClick={() =>
                          loadModalProducts(
                            modalPagination.page - 1,
                            searchProduct,
                          )
                        }
                        disabled={modalPagination.page === 1}
                        className="p-2 hover:bg-neutral-200 rounded-lg disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() =>
                          loadModalProducts(
                            modalPagination.page + 1,
                            searchProduct,
                          )
                        }
                        disabled={
                          modalPagination.page === modalPagination.totalPages
                        }
                        className="p-2 hover:bg-neutral-200 rounded-lg disabled:opacity-30 transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
