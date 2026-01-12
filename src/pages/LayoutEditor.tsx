import { useState, useEffect, useCallback } from "react";
import { useApi } from "../services/api";
import { Plus, Trash2, Search, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import type { Layout, LayoutSlot } from "../types";
import { normalizeGoogleDriveUrl } from "../utils/drive-normalize";

/**
 * LayoutEditor - Sistema de Editor Visual para BASE_LAYOUT's
 * Similar ao Canva, permite criar layouts customizados com slots visuais
 *
 * Funcionalidades principais:
 * - Visualização de layouts base existentes
 * - Editor visual com drag & drop (esqueleto)
 * - Seleção de slots e customização
 * - Preview em tempo real
 */
export function LayoutEditor() {
  const api = useApi();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const loadLayouts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getLayouts();
      setLayouts(response);
    } catch (error) {
      console.error("Erro ao carregar layouts:", error);
      toast.error("Erro ao carregar layouts");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadLayouts();
  }, [loadLayouts]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este layout?")) return;

    try {
      await api.deleteLayout(id);
      setLayouts(layouts.filter((layout) => layout.id !== id));
      toast.success("Layout deletado com sucesso");
    } catch (error) {
      console.error("Erro ao deletar layout:", error);
      toast.error("Erro ao deletar layout");
    }
  };

  const filteredLayouts = layouts.filter((layout) =>
    layout.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-500"></div>
      </div>
    );
  }

  if (isEditing && selectedLayout) {
    return (
      <LayoutEditorCanvas
        layout={selectedLayout}
        onClose={() => {
          setIsEditing(false);
          setSelectedLayout(null);
          loadLayouts();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neutral-950">
          Editor de Layouts
        </h1>
        <button className="flex items-center gap-2 bg-neutral-600 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors">
          <Plus size={20} />
          Novo Layout
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-6">
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search
              size={20}
              className="absolute left-3 top-3 text-neutral-400"
            />
            <input
              type="text"
              placeholder="Buscar layouts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLayouts.length === 0 ? (
            <div className="col-span-full text-center py-8 text-neutral-500">
              Nenhum layout encontrado
            </div>
          ) : (
            filteredLayouts.map((layout) => (
              <div
                key={layout.id}
                className="border border-neutral-100 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                {layout.image_url && (
                  <div className="w-full h-48 bg-neutral-50 overflow-hidden">
                    <img
                      src={normalizeGoogleDriveUrl(layout.image_url)}
                      alt={layout.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-neutral-950 mb-2">
                    {layout.name}
                  </h3>
                  <p className="text-sm text-neutral-700 mb-4">
                    {layout.description || "Sem descrição"}
                  </p>
                  <div className="flex gap-2 justify-between">
                    <button
                      onClick={() => {
                        setSelectedLayout(layout);
                        setIsEditing(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                      title="Editar Layout"
                    >
                      <ZoomIn size={18} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(layout.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                      title="Deletar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * LayoutEditorCanvas - Editor Visual tipo Canva
 *
 * Esta é uma versão esqueleto do editor visual.
 * Funcionalidades a implementar:
 * - Renderização da imagem do layout
 * - Slots interativos para customização
 * - Drag & drop de elementos
 * - Preview em tempo real
 * - Salvamento de alterações
 */
function LayoutEditorCanvas({
  layout,
  onClose,
}: {
  layout: Layout;
  onClose: () => void;
}) {
  const [slots] = useState<LayoutSlot[]>(layout.slots || []);
  const [selectedSlot, setSelectedSlot] = useState<LayoutSlot | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSaveLayout = async () => {
    try {
      setSaving(true);
      // TODO: Implementar chamada à API para salvar layout
      // await api.updateLayout(layout.id, { slots });
      toast.success("Layout atualizado com sucesso");
      onClose();
    } catch (error) {
      console.error("Erro ao salvar layout:", error);
      toast.error("Erro ao salvar layout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neutral-950">
          Editando: {layout.name}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveLayout}
            disabled={saving}
            className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas Principal */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-neutral-100 p-6">
          <h2 className="text-lg font-semibold text-neutral-950 mb-4">
            Canvas de Edição
          </h2>
          <div className="relative bg-neutral-50 rounded-lg overflow-hidden border-2 border-dashed border-neutral-300">
            {layout.image_url ? (
              <div className="relative w-full aspect-square">
                <img
                  src={normalizeGoogleDriveUrl(layout.image_url)}
                  alt={layout.name}
                  className="w-full h-full object-contain"
                />
                {/* Slots renderizados sobre a imagem */}
                <div className="absolute inset-0">
                  {slots.map((slot, idx) => (
                    <div
                      key={slot.id || idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={`absolute border-2 cursor-pointer transition-all ${
                        selectedSlot?.id === slot.id
                          ? "border-blue-500 bg-blue-100/20"
                          : "border-green-500 bg-green-100/20 hover:border-green-600"
                      }`}
                      style={{
                        left: `${slot.x || 0}%`,
                        top: `${slot.y || 0}%`,
                        width: `${slot.width || 20}%`,
                        height: `${slot.height || 20}%`,
                      }}
                    >
                      <div className="text-xs font-semibold text-neutral-900 p-2">
                        {slot.name || `Slot ${idx}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square flex items-center justify-center text-neutral-500">
                Sem imagem de layout
              </div>
            )}
          </div>
          <p className="text-sm text-neutral-600 mt-4">
            💡 Clique nos slots verdes para selecionar e configurar
          </p>
        </div>

        {/* Painel de Propriedades */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-6">
          <h2 className="text-lg font-semibold text-neutral-950 mb-4">
            Propriedades
          </h2>

          {selectedSlot ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">
                  Nome do Slot
                </label>
                <input
                  type="text"
                  placeholder="Digite o nome do slot"
                  value={selectedSlot.name || ""}
                  onChange={(e) =>
                    setSelectedSlot({
                      ...selectedSlot,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-950 mb-2">
                  Tipo de Conteúdo
                </label>
                <select
                  title="Selecione o tipo de conteúdo"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500"
                >
                  <option>Texto</option>
                  <option>Imagem</option>
                  <option>Forma</option>
                  <option>Customização</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-neutral-950 mb-2">
                    X (%)
                  </label>
                  <input
                    type="number"
                    placeholder="X"
                    value={selectedSlot.x || 0}
                    onChange={(e) =>
                      setSelectedSlot({
                        ...selectedSlot,
                        x: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 border border-neutral-200 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-950 mb-2">
                    Y (%)
                  </label>
                  <input
                    type="number"
                    placeholder="Y"
                    value={selectedSlot.y || 0}
                    onChange={(e) =>
                      setSelectedSlot({
                        ...selectedSlot,
                        y: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 border border-neutral-200 rounded text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-neutral-950 mb-2">
                    Largura (%)
                  </label>
                  <input
                    type="number"
                    placeholder="Largura"
                    value={selectedSlot.width || 20}
                    onChange={(e) =>
                      setSelectedSlot({
                        ...selectedSlot,
                        width: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 border border-neutral-200 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-950 mb-2">
                    Altura (%)
                  </label>
                  <input
                    type="number"
                    placeholder="Altura"
                    value={selectedSlot.height || 20}
                    onChange={(e) =>
                      setSelectedSlot({
                        ...selectedSlot,
                        height: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 border border-neutral-200 rounded text-sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-neutral-600 text-sm">
              Selecione um slot para editar suas propriedades
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
