import { useState, useEffect } from "react";
import { useApi } from "../services/api";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export function IntegratedProducts() {
  const api = useApi();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await api.getProducts();
      setProducts(response.products);
    } catch (error) {
      console.error("Erro ao carregar produtos integrados:", error);
      toast.error("Erro ao carregar produtos integrados");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja deletar este produto?")) return;

    try {
      await api.deleteProduct(id);
      setProducts(products.filter((prod) => prod.id !== id));
      toast.success("Produto deletado com sucesso");
    } catch (error) {
      console.error("Erro ao deletar produto:", error);
      toast.error("Erro ao deletar produto");
    }
  };

  const filteredProducts = products.filter(
    (prod) =>
      prod.name?.toLowerCase().includes(search.toLowerCase()) ||
      prod.description?.toLowerCase().includes(search.toLowerCase())
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
          Produtos Integrados
        </h1>
        <button className="flex items-center gap-2 bg-neutral-600 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors">
          <Plus size={20} />
          Novo Produto
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
              placeholder="Buscar produtos..."
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
                  Preço
                </th>
                <th className="text-left py-3 px-4 font-semibold text-neutral-950">
                  Componentes
                </th>
                <th className="text-right py-3 px-4 font-semibold text-neutral-950">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-neutral-500">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => (
                  <tr
                    key={prod.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="py-4 px-4 text-neutral-950 font-medium">
                      {prod.name}
                    </td>
                    <td className="py-4 px-4 text-neutral-700 text-sm">
                      {prod.description || "-"}
                    </td>
                    <td className="py-4 px-4 text-neutral-950 font-medium">
                      R$ {prod.price?.toFixed(2) || "0.00"}
                    </td>
                    <td className="py-4 px-4 text-neutral-700 text-sm">
                      {prod.components?.length || 0} componentes
                    </td>
                    <td className="py-4 px-4 text-right flex items-center justify-end gap-2">
                      <button
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(prod.id)}
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
