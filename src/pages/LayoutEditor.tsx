import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Search, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { layoutApiService } from "../services/layoutApiService";
import { normalizeGoogleDriveUrl } from "../utils/drive-normalize";

export function LayoutEditor() {
  const navigate = useNavigate();
  const [layouts, setLayouts] = useState<
    Array<{
      id: string;
      name: string;
      baseImageUrl?: string;
      previewImageUrl?: string;
      isPublished?: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadLayouts = useCallback(async () => {
    try {
      setLoading(true);
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";
      const response = await layoutApiService.listLayouts({ token });
      setLayouts(Array.isArray(response) ? response : response.data || []);
    } catch (error) {
      console.error("Erro ao carregar layouts:", error);
      toast.error("Erro ao carregar layouts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLayouts();
  }, [loadLayouts]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este layout?")) return;

    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";
      await layoutApiService.deleteLayout(id, token);
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neutral-950">
          Editor de Layouts
        </h1>
        <button
          onClick={() => navigate("/designs/new")}
          className="flex items-center gap-2 bg-neutral-600 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors"
        >
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
                <div className="w-full h-48 bg-neutral-50 overflow-hidden relative">
                  {layout.previewImageUrl || layout.baseImageUrl ? (
                    <img
                      src={normalizeGoogleDriveUrl(
                        (layout.previewImageUrl ||
                          layout.baseImageUrl) as string
                      )}
                      alt={layout.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 bg-neutral-100">
                      Sem preview
                    </div>
                  )}
                  {layout.isPublished && (
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                      Publicado
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-neutral-950 mb-2 truncate">
                    {layout.name}
                  </h3>
                  <div className="flex gap-2 justify-between">
                    <button
                      onClick={() => navigate(`/layouts/editor/${layout.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600 font-medium text-sm"
                    >
                      <Edit3 size={18} />
                      Editar
                    </button>
                    <button
                      title="Apagar"
                      onClick={() => handleDelete(layout.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
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
