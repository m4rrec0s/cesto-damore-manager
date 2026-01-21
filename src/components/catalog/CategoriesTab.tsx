import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Tag, Loader2, Search } from "lucide-react";
import { useApi } from "../../services/api";
import type { Category } from "../../types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { extractErrorMessage } from "../../utils/format";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export function CategoriesTab() {
  const api = useApi();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao carregar categorias"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, { name });
        toast.success("Categoria atualizada!");
      } else {
        await api.createCategory({ name });
        toast.success("Categoria criada!");
      }
      setName("");
      setEditingCategory(null);
      setIsModalOpen(false);
      fetchCategories();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao salvar categoria"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    try {
      await api.deleteCategory(id);
      toast.success("Categoria excluída!");
      fetchCategories();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao excluir categoria"));
    }
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar categorias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-100 rounded-2xl text-neutral-950 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500/20"
          />
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setName("");
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-2.5 bg-neutral-600 text-white rounded-2xl font-bold shadow-lg shadow-neutral-200 hover:bg-neutral-700 transition-all active:scale-95"
        >
          <Plus size={20} />
          Nova Categoria
        </button>
      </div>

      {loading && categories.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-neutral-500" size={40} />
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-neutral-50">
                <TableHead className="w-16 text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider pl-6">
                  Ícone
                </TableHead>
                <TableHead className="text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider">
                  Nome da Categoria
                </TableHead>
                <TableHead className="text-right text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider pr-6">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((category) => (
                <TableRow
                  key={category.id}
                  className="border-neutral-50 hover:bg-neutral-50/30 transition-colors group"
                >
                  <TableCell className="pl-6">
                    <div className="p-2.5 bg-neutral-50 rounded-xl text-neutral-500 w-fit">
                      <Tag size={18} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <h4 className="font-bold text-neutral-950">
                      {category.name}
                    </h4>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingCategory(category);
                          setName(category.name);
                          setIsModalOpen(true);
                        }}
                        className="h-8 w-8 text-neutral-600 hover:text-neutral-700 hover:bg-neutral-50 rounded-xl"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category.id)}
                        className="h-8 w-8 text-neutral-400 hover:text-neutral-500 hover:bg-neutral-50 rounded-xl"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#0d1216]/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 p-8"
            >
              <h3 className="text-xl font-bold text-neutral-950 mb-6">
                {editingCategory ? "Editar Categoria" : "Nova Categoria"}
              </h3>
              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-neutral-900/60 mb-2 uppercase tracking-wider pl-1">
                    Nome da Categoria
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50/50 border border-neutral-100 rounded-2xl text-neutral-900 font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-500/20"
                    placeholder="Ex: Presentes, Flores..."
                    required
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 border border-neutral-100 text-neutral-900 font-bold rounded-2xl hover:bg-neutral-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="flex-1 py-3 bg-neutral-600 text-white font-bold rounded-2xl shadow-lg shadow-neutral-200 hover:bg-neutral-700 transition-all disabled:opacity-50"
                  >
                    {loading ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
