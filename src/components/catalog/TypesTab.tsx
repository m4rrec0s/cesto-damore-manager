import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, Loader2, Tag, X } from "lucide-react";
import { useApi } from "../../services/api";
import type { Type } from "../../types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { extractErrorMessage } from "../../utils/format";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export function TypesTab() {
  const api = useApi();
  const [types, setTypes] = useState<Type[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<Type | null>(null);
  const [formData, setFormData] = useState({ name: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTypes();
      setTypes(data || []);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao carregar tipos"));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (type?: Type) => {
    if (type) {
      setEditingType(type);
      setFormData({ name: type.name });
    } else {
      setEditingType(null);
      setFormData({ name: "" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingType) {
        await api.updateType(editingType.id, formData);
        toast.success("Tipo atualizado!");
      } else {
        await api.createType(formData);
        toast.success("Tipo criado!");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao salvar tipo"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este tipo?")) return;
    try {
      await api.deleteType(id);
      toast.success("Tipo excluído!");
      fetchData();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao excluir tipo"));
    }
  };

  const filtered = types.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            size={18}
          />
          <Input
            type="text"
            placeholder="Buscar tipos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-100 rounded-2xl text-neutral-950 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500/20"
          />
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-neutral-600 text-white rounded-2xl font-bold shadow-lg shadow-neutral-200 hover:bg-neutral-700 transition-all active:scale-95"
        >
          <Plus size={20} />
          Novo Tipo
        </Button>
      </div>

      {loading && types.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-neutral-500" size={40} />
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-neutral-50">
                <TableHead className="text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider pl-6">
                  Nome do Tipo
                </TableHead>
                <TableHead className="text-right text-neutral-900/60 font-bold uppercase text-[10px] tracking-wider pr-6">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((type) => (
                <TableRow
                  key={type.id}
                  className="border-neutral-50 hover:bg-neutral-50/30 transition-colors"
                >
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center text-neutral-400">
                        <Tag size={16} />
                      </div>
                      <span className="font-bold text-neutral-950">
                        {type.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenModal(type)}
                        className="h-8 w-8 text-neutral-600 hover:text-neutral-700 hover:bg-neutral-50 rounded-xl"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(type.id)}
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-neutral-100 overflow-hidden"
            >
              <div className="p-6 border-b border-neutral-50 flex justify-between items-center bg-neutral-50/30">
                <h3 className="text-xl font-bold text-neutral-950">
                  {editingType ? "Editar Tipo" : "Novo Tipo"}
                </h3>
                <Button
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
                    Nome do Tipo
                  </label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    className="h-12 rounded-2xl border-neutral-100 bg-neutral-50/30 font-bold"
                    placeholder="Ex: Cestas, Buquês, Presentes..."
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    variant="ghost"
                    className="flex-1 h-12 rounded-2xl font-bold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 bg-neutral-600 hover:bg-neutral-700 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-neutral-100"
                  >
                    {loading ? "Salvando..." : "Salvar Tipo"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
