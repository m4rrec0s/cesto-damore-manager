import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useApi } from "../services/api";
import {
  MessageCircle,
  Loader,
  User,
  Clock,
  Lock,
  Unlock,
  ShieldAlert,
  Trash2,
  ChevronUp,
  ArrowLeft,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIAgentMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  created_at: string;
}

interface AIAgentSession {
  id: string;
  customer_phone: string | null;
  is_blocked: boolean;
  expires_at: string;
  created_at: string;
  customer?: {
    name: string;
  };
  _count: {
    messages: number;
  };
  lastMessage?: {
    content: string;
    type: "human" | "ai";
    created_at: string;
  };
}

interface HistoryResponse {
  messages: AIAgentMessage[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface SessionUpdatedEvent {
  session_id: string;
  delta_messages: number;
}

interface NewMessageEvent {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  created_at: string;
}

type SessionFilter = "all" | "lab" | "prod";

export function Service() {
  const api = useApi();
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState<AIAgentSession[]>([]);
  const [messages, setMessages] = useState<AIAgentMessage[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [bumpedSessionId, setBumpedSessionId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const routeSessionIdRef = useRef<string | undefined>(routeSessionId);
  const refreshActiveSessionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const sessionsStreamRetryRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sessionStreamRetryRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === routeSessionId) || null,
    [sessions, routeSessionId],
  );

  const isLabSession = (sessionId: string, customerPhone?: string | null) => {
    const normalized = sessionId.toLowerCase();
    if (
      normalized.startsWith("session-lab-") ||
      normalized.startsWith("lab-") ||
      normalized.includes("-lab-") ||
      normalized.includes("_lab_")
    ) {
      return true;
    }

    // fallback: sessões com letras no id e sem telefone tendem a ser ambientes LAB
    if (!customerPhone && /^session-[a-z]/i.test(sessionId)) {
      return true;
    }

    return false;
  };

  const filteredSessions = useMemo(() => {
    if (sessionFilter === "all") return sessions;
    if (sessionFilter === "lab")
      return sessions.filter((session) =>
        isLabSession(session.id, session.customer_phone),
      );
    return sessions.filter(
      (session) => !isLabSession(session.id, session.customer_phone),
    );
  }, [sessions, sessionFilter]);

  useEffect(() => {
    routeSessionIdRef.current = routeSessionId;
  }, [routeSessionId]);

  useEffect(() => {
    loadSessions(true);
  }, []);

  useEffect(() => {
    if (!routeSessionId) {
      setMessages([]);
      setTotalMessages(0);
      setHasMore(false);
      return;
    }

    setPage(1);
    knownMessageIdsRef.current.clear();
    setMessages([]);
    loadHistory(routeSessionId, 1, false, false);
  }, [routeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages.length]);

  useEffect(() => {
    connectSessionsStream();

    return () => {
      if (sessionsStreamRetryRef.current) {
        clearTimeout(sessionsStreamRetryRef.current);
      }
    };
  }, [api]);

  useEffect(() => {
    if (!routeSessionId) return;

    connectSessionStream(routeSessionId);

    return () => {
      if (sessionStreamRetryRef.current) {
        clearTimeout(sessionStreamRetryRef.current);
      }
    };
  }, [api, routeSessionId]);

  useEffect(() => {
    if (!routeSessionId) return;

    const timer = setInterval(() => {
      void loadHistory(routeSessionId, 1, false, true);
    }, 8000);

    return () => clearInterval(timer);
  }, [routeSessionId]);

  useEffect(() => {
    return () => {
      if (refreshActiveSessionTimeoutRef.current) {
        clearTimeout(refreshActiveSessionTimeoutRef.current);
      }
    };
  }, []);

  const bumpSession = (sessionId: string) => {
    setBumpedSessionId(sessionId);
    setTimeout(() => {
      setBumpedSessionId((prev) => (prev === sessionId ? null : prev));
    }, 350);
  };

  const scheduleActiveSessionRefresh = () => {
    if (refreshActiveSessionTimeoutRef.current) {
      clearTimeout(refreshActiveSessionTimeoutRef.current);
    }

    refreshActiveSessionTimeoutRef.current = setTimeout(() => {
      const activeId = routeSessionIdRef.current;
      if (!activeId) return;
      void loadHistory(activeId, 1, false, true);
    }, 400);
  };

  const connectSessionsStream = () => {
    const source = new EventSource(api.getServiceSessionsStreamUrl());

    source.addEventListener("session:updated", (event) => {
      try {
        const payload = JSON.parse(
          (event as MessageEvent).data,
        ) as SessionUpdatedEvent;

        setSessions((prev) => {
          const idx = prev.findIndex(
            (session) => session.id === payload.session_id,
          );

          if (idx === -1) {
            void loadSessions(false);
            return prev;
          }

          const copy = [...prev];
          const session = copy[idx];
          const updated = {
            ...session,
            _count: {
              messages:
                (session._count?.messages || 0) + (payload.delta_messages || 1),
            },
          };

          copy.splice(idx, 1);
          copy.unshift(updated);
          bumpSession(payload.session_id);
          return copy;
        });

        if (routeSessionIdRef.current === payload.session_id) {
          scheduleActiveSessionRefresh();
        }
      } catch (error) {
        console.error("Erro ao processar evento de sessão:", error);
      }
    });

    source.onerror = () => {
      source.close();

      sessionsStreamRetryRef.current = setTimeout(() => {
        connectSessionsStream();
      }, 1200);
    };
  };

  const connectSessionStream = (sessionId: string) => {
    const source = new EventSource(api.getServiceSessionStreamUrl(sessionId));

    source.addEventListener("message:new", (event) => {
      try {
        const payload = JSON.parse(
          (event as MessageEvent).data,
        ) as NewMessageEvent;

        if (payload.session_id !== routeSessionIdRef.current) {
          return;
        }

        if (payload.role !== "user" && payload.role !== "assistant") {
          return;
        }

        if (knownMessageIdsRef.current.has(payload.id)) {
          return;
        }

        knownMessageIdsRef.current.add(payload.id);
        setMessages((prev) => [...prev, payload]);
        setTotalMessages((prev) => prev + 1);
      } catch (error) {
        console.error("Erro ao processar evento de mensagem:", error);
      }
    });

    source.onerror = () => {
      source.close();
      scheduleActiveSessionRefresh();

      sessionStreamRetryRef.current = setTimeout(() => {
        if (routeSessionIdRef.current === sessionId) {
          connectSessionStream(sessionId);
        }
      }, 1200);
    };
  };

  const loadSessions = async (showLoader: boolean) => {
    try {
      if (showLoader) {
        setSessionsLoading(true);
      }

      const data = await api.getServiceSessions();
      setSessions(data);

      if (!routeSessionIdRef.current) {
        const phoneParam = searchParams.get("phone");

        if (phoneParam) {
          const matchingSession = data.find(
            (session: AIAgentSession) => session.customer_phone === phoneParam,
          );

          if (matchingSession) {
            navigate(`/service/${matchingSession.id}`, { replace: true });
            toast.success(
              `Chat do cliente ${matchingSession.customer?.name || phoneParam} carregado`,
            );
          } else {
            toast.error(
              `Nenhuma sessão encontrada para o telefone ${phoneParam}`,
            );
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar sessões:", error);
      if (showLoader) {
        toast.error("Erro ao carregar sessões de atendimento");
      }
    } finally {
      if (showLoader) {
        setSessionsLoading(false);
      }
    }
  };

  const loadHistory = async (
    currentSessionId: string,
    currentPage: number,
    append: boolean,
    silent: boolean,
  ) => {
    try {
      if (!silent) {
        setLoadingMessages(true);
      }

      const data = (await api.getServiceSessionMessages(
        currentSessionId,
        currentPage,
        40,
      )) as HistoryResponse;

      const incomingMessages = (data.messages || []).filter(
        (msg) => msg.role === "user" || msg.role === "assistant",
      );

      incomingMessages.forEach((msg) => knownMessageIdsRef.current.add(msg.id));

      setMessages((prev) =>
        append ? [...incomingMessages, ...prev] : incomingMessages,
      );
      setPage(currentPage);
      setHasMore(Boolean(data.pagination?.hasMore));
      setTotalMessages(data.pagination?.total || incomingMessages.length);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      if (!silent) {
        toast.error("Erro ao carregar histórico da conversa");
      }
    } finally {
      if (!silent) {
        setLoadingMessages(false);
      }
    }
  };

  const handleSelectSession = (session: AIAgentSession) => {
    navigate(`/service/${session.id}`);
  };

  const handleLoadMore = async () => {
    if (!routeSessionId || !hasMore || loadingMessages) return;
    await loadHistory(routeSessionId, page + 1, true, false);
  };

  const handleBlock = async () => {
    if (!selectedSession) return;

    try {
      await api.blockSession(selectedSession.id);
      toast.success("Atendimento bloqueado (transferido para humano)");
      setSessions((prev) =>
        prev.map((session) =>
          session.id === selectedSession.id
            ? { ...session, is_blocked: true }
            : session,
        ),
      );
    } catch (error) {
      console.error("Erro ao bloquear atendimento:", error);
      toast.error("Erro ao bloquear atendimento");
    }
  };

  const handleUnblock = async () => {
    if (!selectedSession) return;

    try {
      await api.unblockSession(selectedSession.id);
      toast.success("Atendimento desbloqueado (IA ativada)");
      setSessions((prev) =>
        prev.map((session) =>
          session.id === selectedSession.id
            ? { ...session, is_blocked: false }
            : session,
        ),
      );
    } catch (error) {
      console.error("Erro ao desbloquear atendimento:", error);
      toast.error("Erro ao desbloquear atendimento");
    }
  };

  const handleClearHistory = async () => {
    if (!selectedSession) return;

    try {
      await api.clearSessionHistory(selectedSession.id);
      toast.success("Histórico da sessão limpo com sucesso");
      knownMessageIdsRef.current.clear();
      setMessages([]);
      setHasMore(false);
      setTotalMessages(0);
      setSessions((prev) =>
        prev.map((session) =>
          session.id === selectedSession.id
            ? { ...session, _count: { messages: 0 } }
            : session,
        ),
      );
    } catch (error) {
      console.error("Erro ao limpar histórico:", error);
      toast.error("Erro ao limpar histórico da sessão");
    }
  };

  const showMobileChat = Boolean(routeSessionId);

  return (
    <div className="h-full min-h-0 w-full bg-slate-100 flex flex-col md:flex-row">
      <aside
        className={`md:flex md:w-88 md:min-w-88 border-r border-slate-200 bg-white flex-col min-h-0 ${
          showMobileChat ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-5 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MessageCircle size={18} className="text-slate-600" />
            Atendimento IA
          </h2>
          <p className="text-xs text-slate-500 mt-1">Sessões ativas</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSessionFilter("all")}
              className={`text-[11px] px-2 py-1 rounded-full border ${
                sessionFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setSessionFilter("lab")}
              className={`text-[11px] px-2 py-1 rounded-full border ${
                sessionFilter === "lab"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-emerald-700 border-emerald-200"
              }`}
            >
              LAB
            </button>
            <button
              type="button"
              onClick={() => setSessionFilter("prod")}
              className={`text-[11px] px-2 py-1 rounded-full border ${
                sessionFilter === "prod"
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              Produção
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {sessionsLoading ? (
            <div className="p-8 text-center">
              <Loader className="w-5 h-5 animate-spin text-slate-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Carregando sessões...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Nenhuma sessão disponível para este filtro
            </div>
          ) : (
            filteredSessions.map((session) => {
              const selected = selectedSession?.id === session.id;
              const bumped = bumpedSessionId === session.id;
              const lab = isLabSession(session.id, session.customer_phone);

              return (
                <motion.button
                  layout
                  transition={{
                    type: "spring",
                    stiffness: 460,
                    damping: 36,
                    mass: 0.7,
                  }}
                  animate={bumped ? { scale: 1.015 } : { scale: 1 }}
                  type="button"
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`w-full p-4 text-left border-b border-slate-100 ${
                    selected
                      ? lab
                        ? "bg-emerald-50"
                        : "bg-slate-100"
                      : lab
                        ? "bg-emerald-50/40 hover:bg-emerald-50"
                        : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          session.is_blocked ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      />
                      <span className="font-medium text-slate-900 truncate">
                        {session.customer?.name ||
                          session.customer_phone ||
                          "Cliente"}
                      </span>
                      {lab && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">
                          <FlaskConical size={10} />
                          LAB
                        </span>
                      )}
                    </div>
                    <User size={14} className="text-slate-400 shrink-0" />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                    {session.lastMessage && session._count.messages > 0 ? (
                      <div className="flex flex-col gap-1">
                        <span
                          className={`truncate ${
                            session.lastMessage.type === "human"
                              ? "text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          <MessageCircle
                            size={12}
                            className="inline mb-0.5 mr-1"
                          />
                          {session.lastMessage.content.substring(0, 40)}
                          {session.lastMessage.content.length > 40 ? "..." : ""}
                        </span>
                        <span className="blok flex gap-1">
                          <Clock size={12} />
                          {formatDistanceToNow(
                            new Date(session.lastMessage.created_at),
                            {
                              locale: ptBR,
                              addSuffix: true,
                            },
                          )}
                        </span>
                      </div>
                    ) : null}
                    <span className="whitespace-nowrap">
                      {session._count.messages} msg
                    </span>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </aside>

      <section
        className={`flex-1 flex-col bg-slate-50 min-h-0 flex ${
          showMobileChat ? "flex" : "hidden md:flex"
        }`}
      >
        {selectedSession ? (
          <>
            <header className="px-4 md:px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  className="md:hidden px-2"
                  onClick={() => navigate("/service")}
                >
                  <ArrowLeft size={16} />
                </Button>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">
                    {selectedSession.customer?.name ||
                      selectedSession.customer_phone ||
                      "Cliente"}
                  </h3>
                  {isLabSession(
                    selectedSession.id,
                    selectedSession.customer_phone,
                  ) && (
                    <p className="text-[11px] mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-800 px-2 py-0.5 w-fit">
                      <FlaskConical size={10} />
                      Sessão LAB
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {totalMessages} mensagens na sessão
                  </p>
                  <p className="text-xs text-slate-400">
                    Criada em{" "}
                    {format(new Date(selectedSession.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleClearHistory}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 gap-2 px-3"
                >
                  <Trash2 size={15} />
                  <span className="hidden md:inline">Limpar</span>
                </Button>

                {selectedSession.is_blocked ? (
                  <Button
                    onClick={handleUnblock}
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2 px-3"
                  >
                    <Unlock size={15} />
                    <span className="hidden md:inline">Ativar IA</span>
                  </Button>
                ) : (
                  <Button
                    onClick={handleBlock}
                    variant="outline"
                    className="border-amber-200 text-amber-700 hover:bg-amber-50 gap-2 px-3"
                  >
                    <Lock size={15} />
                    <span className="hidden md:inline">
                      Assumir Atendimento
                    </span>
                  </Button>
                )}
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 space-y-4">
              {hasMore && (
                <div className="flex justify-center">
                  <Button
                    onClick={handleLoadMore}
                    variant="outline"
                    className="bg-white border-slate-300 text-slate-700"
                    disabled={loadingMessages}
                  >
                    <ChevronUp size={14} className="mr-2" />
                    {loadingMessages
                      ? "Carregando..."
                      : "Carregar mensagens antigas"}
                  </Button>
                </div>
              )}

              {loadingMessages && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="w-8 h-8 animate-spin text-slate-300" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Histórico vazio
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] md:max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        msg.role === "user"
                          ? "bg-slate-900 text-white rounded-tr-md"
                          : "bg-white text-slate-800 border border-slate-200 rounded-tl-md"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                      <div
                        className={`text-[10px] mt-2 ${
                          msg.role === "user"
                            ? "text-slate-300"
                            : "text-slate-400"
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
              <div className="mx-4 md:mx-6 mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 shrink-0">
                <ShieldAlert
                  className="text-amber-600 shrink-0 mt-0.5"
                  size={18}
                />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold">IA bloqueada</p>
                  <p className="opacity-80">
                    Sessão transferida para atendimento humano. As respostas
                    automáticas estão desativadas.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-slate-400 flex-col gap-4">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
              <MessageCircle size={30} className="text-slate-200" />
            </div>
            <p>Selecione um atendimento para visualizar</p>
          </div>
        )}
      </section>
    </div>
  );
}
