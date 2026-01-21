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
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "../services/api";
import { Button } from "@/components/ui/button";

type Tab = "banners" | "sections" | "configurations";

export function Feed() {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<Tab>("banners");
  const [data, setData] = useState({
    banners: [] as any[],
    sections: [] as any[],
    configurations: [] as any[],
    sectionTypes: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  // Modal states
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

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFeedData();
  }, []);

  const loadFeedData = async () => {
    try {
      setLoading(true);
      const [banners, sections, configs, sectionTypes] = await Promise.all([
        api.get("/admin/feed/banners"),
        api.get("/admin/feed/sections"),
        api.get("/admin/feed/configurations"),
        api.getSectionTypes(),
      ]);

      setData({
        banners: banners.data,
        sections: sections.data,
        configurations: configs.data,
        sectionTypes: sectionTypes,
      });
    } catch (error) {
      console.error("Erro ao carregar feed:", error);
      toast.error("Erro ao carregar dados do feed");
    } finally {
      setLoading(false);
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

  const handleDeleteConfig = async (id: string) => {
    if (
      window.confirm(
        "Atenção: Excluir uma configuração deletará todos os seus banners e seções. Continuar?",
      )
    ) {
      try {
        await api.deleteFeedConfiguration(id);
        toast.success("Configuração excluída com sucesso");
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
          banner.feed_config_id || data.configurations[0]?.id || "",
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
        feed_config_id: data.configurations[0]?.id || "",
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
          section.feed_config_id || data.configurations[0]?.id || "",
        max_items: section.max_items || 6,
      });
    } else {
      setEditingSection(null);
      setSectionForm({
        title: "",
        section_type: data.sectionTypes[0]?.value || "RECOMMENDED_PRODUCTS",
        display_order: data.sections.length,
        is_visible: true,
        feed_config_id: data.configurations[0]?.id || "",
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
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-neutral-950">
          Gerenciamento de Feed
        </h1>
        <Button
          onClick={() => {
            if (activeTab === "banners") openBannerModal();
            if (activeTab === "sections") openSectionModal();
            if (activeTab === "configurations") openConfigModal();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          {activeTab === "banners"
            ? "Novo Banner"
            : activeTab === "sections"
              ? "Nova Seção"
              : "Nova Configuração"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-neutral-100 rounded-2xl w-fit">
        <Button
          onClick={() => setActiveTab("banners")}
          className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "banners"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Banners ({data.banners.length})
          </div>
        </Button>
        <Button
          onClick={() => setActiveTab("sections")}
          className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "sections"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Seções ({data.sections.length})
          </div>
        </Button>
        <Button
          onClick={() => setActiveTab("configurations")}
          className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "configurations"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações ({data.configurations.length})
          </div>
        </Button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
        {activeTab === "banners" && (
          <div className="divide-y divide-neutral-50">
            {data.banners.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-neutral-400">Nenhum banner cadastrado.</p>
              </div>
            ) : (
              data.banners.map((banner) => (
                <div
                  key={banner.id}
                  className="p-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="w-32 h-20 bg-neutral-100 rounded-lg overflow-hidden shrink-0">
                    {banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-neutral-950 truncate">
                      {banner.title || "Sem título"}
                    </h4>
                    <p className="text-sm text-neutral-500 truncate">
                      {banner.subtitle || "Sem subtítulo"}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${banner.is_active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
                      >
                        {banner.is_active ? "Ativo" : "Inativo"}
                      </span>
                      <span className="text-[10px] text-neutral-400 uppercase font-bold">
                        Ordem: {banner.display_order}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => openBannerModal(banner)}
                      className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-5 h-5" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteBanner(banner.id)}
                      className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "sections" && (
          <div className="divide-y divide-neutral-50">
            {data.sections.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-neutral-400">Nenhuma seção cadastrada.</p>
              </div>
            ) : (
              data.sections.map((section) => (
                <div
                  key={section.id}
                  className="p-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-500 shrink-0">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-neutral-950 truncate">
                      {section.title}
                    </h4>
                    <p className="text-sm text-neutral-500 truncate">
                      {section.section_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => openSectionModal(section)}
                      className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-5 h-5" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteSection(section.id)}
                      className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "configurations" && (
          <div className="divide-y divide-neutral-50">
            {data.configurations.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-neutral-400">
                  Nenhuma configuração cadastrada.
                </p>
              </div>
            ) : (
              data.configurations.map((config) => (
                <div
                  key={config.id}
                  className="p-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-500 shrink-0">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-neutral-950 truncate">
                      {config.name}
                    </h4>
                    <p className="text-sm text-neutral-500 truncate">
                      {config.is_active ? "Configuração Ativa" : "Inativa"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => openConfigModal(config)}
                      className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-5 h-5" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteConfig(config.id)}
                      className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Banner Modal */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Título
                  </label>
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Subtítulo
                  </label>
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Link (URL)
                  </label>
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Ordem
                  </label>
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Imagem do Banner
                  </label>
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
                  className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Título da Seção
                  </label>
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Tipo de Seção
                  </label>
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Ordem
                  </label>
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Máx. Itens
                  </label>
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
                  className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
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
                  <label className="block text-sm font-bold text-neutral-700 mb-1">
                    Nome da Configuração
                  </label>
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
                  className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
    </div>
  );
}
