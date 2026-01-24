import { useEffect, useState } from "react";
import { useApi } from "../services/api";
import {
  User,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FollowUpHistory {
  id: string;
  cliente_number: string;
  horas_followup: number;
  enviado_em: string;
  customer?: {
    name?: string;
  };
}

interface Customer {
  number: string;
  name?: string;
  follow_up: boolean;
  service_status?: string;
  last_message_sent?: string;
}

export function FollowUp() {
  const api = useApi();
  const [history, setHistory] = useState<FollowUpHistory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [historyData, customersData] = await Promise.all([
        api.getFollowUpHistory(),
        api.get("/customers", { params: { limit: 50 } }),
      ]);
      setHistory(historyData);
      setCustomers(customersData.data.customers || []);
    } catch (error) {
      toast.error("Erro ao carregar dados de follow-up");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (phone: string, currentStatus: boolean) => {
    try {
      await api.toggleFollowUp(phone, !currentStatus);
      toast.success(`Follow-up ${!currentStatus ? "ativado" : "desativado"}`);
      setCustomers((prev) =>
        prev.map((c) =>
          c.number === phone ? { ...c, follow_up: !currentStatus } : c,
        ),
      );
    } catch (error) {
      toast.error("Erro ao alterar status de follow-up");
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await api.triggerFollowUp();
      toast.success("Rotina de follow-up disparada com sucesso");
      setTimeout(loadData, 2000);
    } catch (error) {
      toast.error("Erro ao disparar follow-up");
    } finally {
      setTriggering(false);
    }
  };

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader className="animate-spin" />
      </div>
    );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-3">
            <RefreshCw size={32} />
            Gestão de Follow-up
          </h1>
          <p className="text-neutral-500">
            Controle o reengajamento automático de clientes
          </p>
        </div>
        <Button
          onClick={handleTrigger}
          disabled={triggering}
          className="bg-neutral-900 text-white gap-2 font-bold px-6 py-4 rounded-2xl shadow-xl shadow-neutral-900/20 disabled:opacity-50"
        >
          {triggering ? (
            <Loader className="animate-spin" size={20} />
          ) : (
            <RefreshCw size={20} />
          )}
          Forçar Verificação Agora
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lista de Clientes */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 px-2">
            <User size={20} className="text-neutral-400" />
            Configuração por Cliente
          </h2>
          <div className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto divide-y divide-neutral-50">
              {customers.map((customer) => (
                <div
                  key={customer.number}
                  className="p-5 flex items-center justify-between hover:bg-neutral-50/50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-neutral-900">
                      {customer.name || "Sem nome"}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {customer.number}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right mr-2">
                      <p className="text-[10px] font-black uppercase text-neutral-400">
                        Status
                      </p>
                      <p
                        className={`text-xs font-bold ${customer.follow_up ? "text-green-600" : "text-neutral-400"}`}
                      >
                        {customer.follow_up ? "ATIVADO" : "DESATIVADO"}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleToggle(customer.number, customer.follow_up)
                      }
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${customer.follow_up ? "bg-neutral-900" : "bg-neutral-200"}`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${customer.follow_up ? "translate-x-6" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Histórico de Envios */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 px-2">
            <CheckCircle size={20} className="text-neutral-400" />
            Histórico de Envios
          </h2>
          <div className="bg-neutral-50 rounded-[2.5rem] border border-neutral-100 p-2">
            <div className="max-h-[600px] overflow-y-auto space-y-2 p-1">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-neutral-100 flex items-center gap-4"
                >
                  <div
                    className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${h.horas_followup === 2 ? "bg-blue-50 text-blue-500" : h.horas_followup === 24 ? "bg-purple-50 text-purple-500" : "bg-amber-50 text-amber-500"}`}
                  >
                    <MessageCircle size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 truncate">
                      {h.customer?.name || h.cliente_number}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {h.horas_followup}h follow-up enviado em{" "}
                      {format(new Date(h.enviado_em), "dd/MM 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <CheckCircle size={18} className="text-green-500 shrink-0" />
                </div>
              ))}
              {history.length === 0 && (
                <div className="p-8 text-center text-neutral-400">
                  Nenhum envio registrado recentemente
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
