import { useState, useEffect, useCallback } from "react";
import { useApi } from "../services/api";
import type { ItemsResponse, Item } from "../services/api";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export function Items() {
  const api = useApi();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const response: ItemsResponse = await api.getItems();
      setItems(response.items);
    } catch (error) {
      console.error("Erro ao carregar itens:", error);
      toast.error("Erro ao carregar itens");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este item?")) return;

    try {
      await api.deleteItem(id);
      setItems(items.filter((item) => item.id !== id));
      toast.success("Item deletado com sucesso");
    } catch (error) {
      console.error("Erro ao deletar item:", error);
      toast.error("Erro ao deletar item");
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase())
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
        <h1 className="text-3xl font-bold text-neutral-950">Itens</h1>
        <button className="flex items-center gap-2 bg-neutral-600 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors">
          <Plus size={20} />
          Novo Item
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
              placeholder="Buscar itens..."
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
                  Descrição
                </th>
                <th className="text-left py-3 px-4 font-semibold text-neutral-950">
                  Estoque
                </th>
                <th className="text-right py-3 px-4 font-semibold text-neutral-950">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-neutral-500">
                    Nenhum item encontrado
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="py-4 px-4 text-neutral-950 font-medium">
                      {item.name}
                    </td>
                    <td className="py-4 px-4 text-neutral-700 text-sm">
                      {item.description || "-"}
                    </td>
                    <td className="py-4 px-4 text-neutral-900">
                      {item.stock_quantity || 0}
                    </td>
                    <td className="py-4 px-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => {}}
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
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
