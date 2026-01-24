import { useEffect, useState, useRef } from "react";
import { useApi } from "../services/api";
import { MessageCircle, Loader, User, Clock, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIAgentMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  created_at: string;
}

interface AIAgentSession {
  id: string;
  customer_phone: string;
  is_blocked: boolean;
  expires_at: string;
  created_at: string;
  customer?: {
    name: string;
  };
  _count: {
    messages: number;
  };
}

export function Service() {
  const api = useApi();
  const [sessions, setSessions] = useState<AIAgentSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<AIAgentSession | null>(null);
  const [messages, setMessages] = useState<AIAgentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadHistory(selectedSession.id);
    }
  }, [selectedSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await api.getSessions();
      setSessions(data);
    } catch (error) {
      console.error("Erro ao carregar sessões:", error);
      toast.error("Erro ao carregar sessões de atendimento");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (sessionId: string) => {
    try {
      setLoadingMessages(true);
      const data = await api.getSessionHistory(sessionId);
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      toast.error("Erro ao carregar histórico da conversa");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleBlock = async () => {
    if (!selectedSession) return;

    try {
      await api.blockSession(selectedSession.id);
      toast.success("Atendimento bloqueado (transferido para humano)");
      loadSessions(); // Reload sessions to update status
      setSelectedSession(prev => prev ? { ...prev, is_blocked: true } : null);
    } catch (error) {
      console.error("Erro ao bloquear atendimento:", error);
      toast.error("Erro ao bloquear atendimento");
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
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden bg-white rounded-2xl shadow-sm border border-neutral-100 m-4">
      {/* Sidebar - Sessões */}
      <div className="w-80 border-r border-neutral-100 flex flex-col">
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <MessageCircle size={20} className="text-neutral-500" />
            Atendimentos IA
          </h2>
          <p className="text-xs text-neutral-500 mt-1">Sessões ativas no momento</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-neutral-400 text-sm">Nenhuma sessão ativa</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`w-full p-4 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-50 ${selectedSession?.id === session.id ? "bg-neutral-100/50" : ""
                  }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-neutral-900 flex items-center gap-2 truncate">
                    <User size={14} className="text-neutral-400 shrink-0" />
                    {session.customer?.name || session.customer_phone || "Cliente"}
                  </span>
                  {session.is_blocked && (
                    <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0">
                      HUMANO
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 mt-2">
                  <Clock size={12} />
                  <span>{format(new Date(session.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  <span className="mx-1">•</span>
                  <span>{session._count.messages} msg</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Area - Chat */}
      <div className="flex-1 flex flex-col bg-neutral-50/30">
        {selectedSession ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-neutral-100 flex items-center justify-between shadow-sm z-10">
              <div>
                <h2 className="font-bold text-neutral-900">
                  {selectedSession.customer?.name || selectedSession.customer_phone}
                </h2>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className={`w-2 h-2 rounded-full ${selectedSession.is_blocked ? "bg-amber-400" : "bg-green-400"}`} />
                  {selectedSession.is_blocked ? "Em atendimento humano" : "IA Atendendo"}
                </div>
              </div>

              {!selectedSession.is_blocked && (
                <Button
                  onClick={handleBlock}
                  variant="outline"
                  className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50 gap-2 font-bold"
                >
                  <Lock size={16} />
                  Bloquear IA (Assumir)
                </Button>
              )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="w-8 h-8 animate-spin text-neutral-300" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-neutral-400">
                  Histórico vazio
                </div>
              ) : (
                messages
                  .filter(m => m.role === "user" || m.role === "assistant")
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === "user"
                            ? "bg-neutral-900 text-white rounded-tr-none"
                            : "bg-white text-neutral-800 border border-neutral-100 rounded-tl-none"
                          }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <div
                          className={`text-[10px] mt-1 ${msg.role === "user" ? "text-neutral-400" : "text-neutral-400"
                            }`}
                        >
                          {format(new Date(msg.created_at), "HH:mm")}
                        </div>
                      </div>
                    </div>
                  ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {selectedSession.is_blocked && (
              <div className="p-4 m-6 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-amber-900">
                  <p className="font-bold">IA Bloqueada</p>
                  <p className="opacity-80">Este atendimento foi transferido para o suporte humano. As respostas automáticas estão desativadas para esta sessão.</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-400 flex-col gap-4">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-neutral-100 flex items-center justify-center">
              <MessageCircle size={32} className="text-neutral-200" />
            </div>
            <p>Selecione um atendimento para visualizar</p>
          </div>
        )}
      </div>
    </div>
  );
}
