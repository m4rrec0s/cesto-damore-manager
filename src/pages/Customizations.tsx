import { useState, useEffect } from "react";
import { useApi } from "../services/api";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export function Customizations() {
  const api = useApi();
  const [customizations, setCustomizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCustomizations();
  }, []);

  const loadCustomizations = async () => {
    try {
      setLoading(true);
      const response = await api.getCustomizations();
      setCustomizations(response);
    } catch (error) {
      console.error("Erro ao carregar customizações:", error);
      toast.error("Erro ao carregar customizações");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar esta customização?"))
      return;

    try {
      await api.deleteCustomization(id);
      setCustomizations(customizations.filter((custom) => custom.id !== id));
      toast.success("Customização deletada com sucesso");
    } catch (error) {
      console.error("Erro ao deletar customização:", error);
      toast.error("Erro ao deletar customização");
    }
  };

  const filteredCustomizations = customizations.filter(
    (custom) =>
      custom.name?.toLowerCase().includes(search.toLowerCase()) ||
      custom.type?.toLowerCase().includes(search.toLowerCase())
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
        <h1 className="text-3xl font-bold text-neutral-950">Customizações</h1>
        <button className="flex items-center gap-2 bg-neutral-600 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors">
          <Plus size={20} />
          Nova Customização
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
              placeholder="Buscar customizações..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left py-3 px-4 font-semibold text-neutral-950">
                  Nome
                </th>
                <th className="text-left py-3 px-4 font-semibold text-neutral-950">
                  Tipo
                </th>
                <th className="text-left py-3 px-4 font-semibold text-neutral-950">
                  Item
                </th>
                <th className="text-right py-3 px-4 font-semibold text-neutral-950">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomizations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-neutral-500">
                    Nenhuma customização encontrada
                  </td>
                </tr>
              ) : (
                filteredCustomizations.map((custom) => (
                  <tr
                    key={custom.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="py-4 px-4 text-neutral-950 font-medium">
                      {custom.name}
                    </td>
                    <td className="py-4 px-4 text-neutral-700 text-sm">
                      {custom.type || "-"}
                    </td>
                    <td className="py-4 px-4 text-neutral-700 text-sm">
                      {custom.item_id || "-"}
                    </td>
                    <td className="py-4 px-4 text-right flex items-center justify-end gap-2">
                      <button
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(custom.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                        title="Deletar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
