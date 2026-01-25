import { useEffect, useState } from "react";
import { useApi } from "../services/api";
import { Calendar, Plus, Trash2, Edit2, Loader } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Holiday {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  closure_type: string;
  duration_hours?: number;
  description?: string;
  is_active: boolean;
}

function extractDateString(dateString: string): string {
  return dateString.split("T")[0];
}

function parseDateString(dateString: string): Date {
  const datePart = extractDateString(dateString);
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function Holidays() {
  const api = useApi();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    closure_type: "TOTAL",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      const data = await api.getHolidays();
      setHolidays(data);
    } catch (error) {
      toast.error("Erro ao carregar feriados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingHoliday) {
        await api.updateHoliday(editingHoliday.id, formData);
        toast.success("Feriado atualizado");
      } else {
        await api.createHoliday(formData);
        toast.success("Feriado criado");
      }
      setIsModalOpen(false);
      setEditingHoliday(null);
      setFormData({
        name: "",
        start_date: "",
        end_date: "",
        closure_type: "TOTAL",
        description: "",
        is_active: true,
      });
      loadHolidays();
    } catch (error) {
      toast.error("Erro ao salvar feriado");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este feriado?")) return;
    try {
      await api.deleteHoliday(id);
      toast.success("Feriado excluído");
      loadHolidays();
    } catch (error) {
      toast.error("Erro ao excluir feriado");
    }
  };

  const openEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      start_date: extractDateString(holiday.start_date),
      end_date: extractDateString(holiday.end_date),
      closure_type: holiday.closure_type,
      description: holiday.description || "",
      is_active: holiday.is_active,
    });
    setIsModalOpen(true);
  };

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader className="animate-spin" />
      </div>
    );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-3">
            <Calendar size={32} />
            Gestão de Feriados
          </h1>
          <p className="text-neutral-500">
            Controle períodos de fechamento da loja
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingHoliday(null);
            setFormData({
              name: "",
              start_date: "",
              end_date: "",
              closure_type: "TOTAL",
              description: "",
              is_active: true,
            });
            setIsModalOpen(true);
          }}
          className="bg-neutral-900 text-white gap-2 font-bold px-6 py-4 rounded-2xl"
        >
          <Plus size={20} />
          Adicionar Feriado
        </Button>
      </div>

      <div className="grid gap-4">
        {holidays.map((holiday) => (
          <div
            key={holiday.id}
            className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-400">
                <Calendar size={24} />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 text-lg">
                  {holiday.name}
                </h3>
                <div className="flex gap-4 text-sm text-neutral-500">
                  <span>
                    De:{" "}
                    {format(parseDateString(holiday.start_date), "dd/MM/yyyy")}
                  </span>
                  <span>
                    Até:{" "}
                    {format(parseDateString(holiday.end_date), "dd/MM/yyyy")}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${holiday.closure_type === "TOTAL" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}
              >
                {holiday.closure_type}
              </span>
              <button
                onClick={() => openEdit(holiday)}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
              >
                <Edit2 size={18} className="text-neutral-500" />
              </button>
              <button
                onClick={() => handleDelete(holiday.id)}
                className="p-2 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 size={18} className="text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black mb-6">
              {editingHoliday ? "Editar Feriado" : "Novo Feriado"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                  Nome
                </label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Carnaval, Natal, Páscoa"
                  className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Início
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    title="Início"
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Fim
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    title="Fim"
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                  Tipo de Fechamento
                </label>
                <select
                  value={formData.closure_type}
                  onChange={(e) =>
                    setFormData({ ...formData, closure_type: e.target.value })
                  }
                  title="Tipo de fechamento da loja"
                  className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                >
                  <option value="TOTAL">TOTAL</option>
                  <option value="PARTIAL">PARCIAL</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-neutral-100 text-neutral-600 py-4 font-bold rounded-2xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-neutral-900 text-white py-4 font-bold rounded-2xl shadow-lg shadow-neutral-900/20"
                >
                  Salvar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
