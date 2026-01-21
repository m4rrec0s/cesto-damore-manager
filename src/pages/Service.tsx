import { useEffect, useState } from "react";
import { useApi } from "../services/api";
import { MessageCircle, Loader } from "lucide-react";
import { toast } from "sonner";

export function Service() {
  const api = useApi();
  const [stats, setStats] = useState({
    pendingMessages: 0,
    customers: 0,
    followUps: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServiceData();
  }, []);

  const loadServiceData = async () => {
    try {
      setLoading(true);
      // TODO: Implementar chamadas à API de atendimento
      // const data = await api.getServiceStats();
      // setStats(data);
    } catch (error) {
      console.error("Erro ao carregar dados de atendimento:", error);
      toast.error("Erro ao carregar dados de atendimento");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-neutral-500 mx-auto mb-4" />
          <p className="text-neutral-700">Carregando Atendimento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold text-neutral-950">
        Gerenciamento de Atendimento
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageCircle className="text-neutral-500" size={24} />
            <h3 className="text-lg font-semibold text-neutral-950">
              Mensagens Pendentes
            </h3>
          </div>
          <p className="text-3xl font-bold text-neutral-600 mb-4">
            {stats.pendingMessages}
          </p>
          <button className="w-full px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors">
            Ver Mensagens
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-6">
          <h3 className="text-lg font-semibold text-neutral-950 mb-2">
            Clientes
          </h3>
          <p className="text-3xl font-bold text-neutral-600 mb-4">
            {stats.customers}
          </p>
          <button className="w-full px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors">
            Gerenciar Clientes
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-6">
          <h3 className="text-lg font-semibold text-neutral-950 mb-2">
            Follow-ups
          </h3>
          <p className="text-3xl font-bold text-neutral-600 mb-4">
            {stats.followUps}
          </p>
          <button className="w-full px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors">
            Agendar Follow-ups
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-950 mb-2">ℹ️ Informação</h3>
        <p className="text-blue-800 text-sm">
          O gerenciamento de atendimento será integrado com o N8N para automação
          de mensagens e follow-ups.
        </p>
      </div>
    </div>
  );
}
