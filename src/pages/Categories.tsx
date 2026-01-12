import { useState, useEffect } from "react";
import { useApi } from "../services/api";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export function Categories() {
  const api = useApi();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await api.getCategories();
      setCategories(response);
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar esta categoria?"))
      return;

    try {
      await api.deleteCategory(id);
      setCategories(categories.filter((cat) => cat.id !== id));
      toast.success("Categoria deletada com sucesso");
    } catch (error) {
      console.error("Erro ao deletar categoria:", error);
      toast.error("Erro ao deletar categoria");
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-neutral-950">Categorias</h1>
        <button className="flex items-center gap-2 bg-neutral-600 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors">
          <Plus size={20} />
          Nova Categoria
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
              placeholder="Buscar categorias..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.length === 0 ? (
            <div className="col-span-full text-center py-8 text-neutral-500">
              Nenhuma categoria encontrada
            </div>
          ) : (
            filteredCategories.map((category) => (
              <div
                key={category.id}
                className="border border-neutral-100 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-neutral-950 mb-3">
                  {category.name}
                </h3>
                <div className="flex gap-2 justify-end">
                  <button
                    className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                    title="Deletar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
