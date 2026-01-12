import { useState, useEffect } from "react";
import { useApi } from "../services/api";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export function Types() {
  const api = useApi();
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    try {
      setLoading(true);
      const response = await api.getTypes();
      setTypes(response);
    } catch (error) {
      console.error("Erro ao carregar tipos:", error);
      toast.error("Erro ao carregar tipos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este tipo?")) return;

    try {
      await api.deleteType(id);
      setTypes(types.filter((type) => type.id !== id));
      toast.success("Tipo deletado com sucesso");
    } catch (error) {
      console.error("Erro ao deletar tipo:", error);
      toast.error("Erro ao deletar tipo");
    }
  };

  const filteredTypes = types.filter((type) =>
    type.name?.toLowerCase().includes(search.toLowerCase())
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
        <h1 className="text-3xl font-bold text-neutral-950">
          Tipos de Produtos
        </h1>
        <button className="flex items-center gap-2 bg-neutral-600 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors">
          <Plus size={20} />
          Novo Tipo
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
              placeholder="Buscar tipos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTypes.length === 0 ? (
            <div className="col-span-full text-center py-8 text-neutral-500">
              Nenhum tipo encontrado
            </div>
          ) : (
            filteredTypes.map((type) => (
              <div
                key={type.id}
                className="border border-neutral-100 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-neutral-950 mb-3">
                  {type.name}
                </h3>
                <div className="flex gap-2 justify-end">
                  <button
                    className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(type.id)}
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
