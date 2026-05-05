import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  SendHorizontal,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StreamingMarkdown } from "@/components/markdown/StreamingMarkdown";
import { useAuth } from "@/contexts/useAuth";
import {
  useApi,
  type LabMessage,
  type LabMemorySnapshot,
  type LabSessionSummary,
  type LinkPreviewPayload,
} from "@/services/api";

type ChatRole = "user" | "assistant" | "tool";
type InternalAgentName = "Ana" | "Bianca" | "Lucas" | "Alice";

type LabTraceEvent =
  | { type: "state"; label: string; timestamp: string }
  | { type: "tool_call"; toolName: string; timestamp: string }
  | { type: "tool_result"; toolName: string; success: boolean; timestamp: string }
  | { type: "text_delta"; output: string; timestamp: string }
  | { type: "done"; output: string; timestamp: string }
  | { type: "warning"; message: string; timestamp: string }
  | { type: "error"; message: string; timestamp: string };

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  traceLine?: string | null;
  thought?: string | null;
  usedTools?: string[];
  linkPreviews?: LinkPreviewPayload[];
  agentName?: string | null;
}

function normalizeMessage(message: LabMessage): ChatMessage {
  const role = (message.role || "").toLowerCase();
  const normalizedRole: ChatRole =
    role === "user" ? "user" : role === "tool" ? "tool" : "assistant";

  return {
    id: message.id,
    role: normalizedRole,
    content: message.content || "",
    createdAt: message.created_at,
  };
}

function extractUrls(text: string) {
  return text.match(/https?:\/\/[^\s"'`)>]+/gi) || [];
}

function isImageUrl(url: string) {
  try {
    const parsed = new URL(url);
    return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function canRenderPreviewImage(preview: LinkPreviewPayload) {
  const host = (preview.host || "").toLowerCase();
  // Some hosts frequently block hotlink previews in browser (HTTP 403).
  if (
    host.includes("whatsapp.com") ||
    host.includes("whatsapp.net") ||
    host.includes("fbcdn.net")
  ) {
    return false;
  }
  return Boolean(preview.image);
}

function getAgentBubbleClasses(agentName?: string | null) {
  switch ((agentName || "").trim()) {
    case "Ana":
      return "bg-violet-50 border-violet-200 text-violet-950";
    case "Bianca":
      return "bg-sky-50 border-sky-200 text-sky-950";
    case "Lucas":
      return "bg-emerald-50 border-emerald-200 text-emerald-950";
    case "Alice":
      return "bg-amber-50 border-amber-200 text-amber-950";
    default:
      return "bg-white border-slate-200 text-slate-800";
  }
}

export function LlmTestSessionPage() {
  const api = useApi();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<LabSessionSummary[]>([]);
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [thinkingLine, setThinkingLine] = useState<string>("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [memorySnapshot, setMemorySnapshot] = useState<LabMemorySnapshot | null>(
    null,
  );
  const previewCacheRef = useRef<Record<string, LinkPreviewPayload | null>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const customerName = useMemo(
    () => user?.name?.trim() || "cliente",
    [user?.name],
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );

  const activeMessages = useMemo(
    () => (messagesBySession[activeSessionId] || []).filter((msg) => msg.role !== "tool"),
    [messagesBySession, activeSessionId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 40);
    return () => clearTimeout(timer);
  }, [activeMessages.length, thinkingLine]);

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      setLoadingSessions(true);
      try {
        const response = await api.getLabSessions();
        if (cancelled) return;

        let loaded = response.sessions || [];
        if (loaded.length === 0) {
          const created = await api.createLabSession();
          loaded = [
            {
              id: created.session.id,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              is_blocked: false,
              totalMessages: 0,
              lastMessage: null,
            },
          ];
        }

        setSessions(loaded);
        setActiveSessionId(loaded[0]?.id || "");
      } catch (error) {
        console.error("Erro ao carregar sessões LAB:", error);
        toast.error("Não foi possível carregar as sessões LAB");
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    };

    loadSessions();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!activeSessionId || messagesBySession[activeSessionId]) return;

    let cancelled = false;
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const response = await api.getLabSessionMessages(activeSessionId);
        if (cancelled) return;
        setMessagesBySession((prev) => ({
          ...prev,
          [activeSessionId]: (response.messages || []).map(normalizeMessage),
        }));
      } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
        toast.error("Não foi possível carregar histórico da sessão");
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };
    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, api, messagesBySession]);

  useEffect(() => {
    const collectTargets = async () => {
      const messages = messagesBySession[activeSessionId] || [];
      const pendingUrls = new Set<string>();

      messages.forEach((message) => {
        extractUrls(message.content).forEach((url) => {
          if (!previewCacheRef.current[url]) {
            pendingUrls.add(url);
          }
        });
      });

      if (pendingUrls.size === 0) return;

      await Promise.all(
        Array.from(pendingUrls).map(async (url) => {
          try {
            const preview = await api.getLabLinkPreview(url);
            previewCacheRef.current[url] = preview;
          } catch {
            previewCacheRef.current[url] = null;
          }
        }),
      );

        setMessagesBySession((prev) => {
          const sessionMessages = prev[activeSessionId] || [];
          const updated = sessionMessages.map((message) => {
          const uniqueUrls = Array.from(new Set(extractUrls(message.content)));
          const previews = uniqueUrls
            .map((url) => previewCacheRef.current[url])
            .filter((entry): entry is LinkPreviewPayload => Boolean(entry));
          return {
            ...message,
            linkPreviews: previews,
          };
        });
        return { ...prev, [activeSessionId]: updated };
      });
    };

    void collectTargets();
  }, [activeSessionId, messagesBySession, api]);

  useEffect(() => {
    if (!showMemoryPanel || !activeSessionId) return;
    let cancelled = false;

    const loadMemory = async () => {
      setLoadingMemory(true);
      try {
        const snapshot = await api.getLabSessionMemory(activeSessionId);
        if (cancelled) return;
        setMemorySnapshot(snapshot);
      } catch (error) {
        console.error("Erro ao carregar memória da sessão:", error);
        if (!cancelled) {
          toast.error("Não foi possível carregar a memória da sessão");
        }
      } finally {
        if (!cancelled) setLoadingMemory(false);
      }
    };

    void loadMemory();
    return () => {
      cancelled = true;
    };
  }, [showMemoryPanel, activeSessionId, api]);

  const patchAssistantMessage = (
    sessionId: string,
    assistantMessageId: string,
    patch: Partial<ChatMessage>,
  ) => {
    setMessagesBySession((prev) => {
      const sessionMessages = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: sessionMessages.map((message) =>
          message.id === assistantMessageId ? { ...message, ...patch } : message,
        ),
      };
    });
  };

  const addToolToAssistantMessage = (
    sessionId: string,
    assistantMessageId: string,
    toolName: string,
  ) => {
    setMessagesBySession((prev) => {
      const sessionMessages = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: sessionMessages.map((message) => {
          if (message.id !== assistantMessageId) return message;
          const currentTools = message.usedTools || [];
          if (currentTools.includes(toolName)) return message;
          return {
            ...message,
            usedTools: [...currentTools, toolName],
          };
        }),
      };
    });
  };

  const appendMessage = (sessionId: string, message: ChatMessage) => {
    setMessagesBySession((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), message],
    }));

    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              totalMessages: session.totalMessages + 1,
              lastMessage: {
                id: message.id,
                role: message.role,
                content: message.content,
                created_at: message.createdAt,
              },
            }
          : session,
      ),
    );
  };

  const createSession = async () => {
    try {
      const created = await api.createLabSession();
      const next: LabSessionSummary = {
        id: created.session.id,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_blocked: false,
        totalMessages: 0,
        lastMessage: null,
      };
      setSessions((prev) => [next, ...prev]);
      setActiveSessionId(next.id);
      toast.success("Nova sessão LAB criada");
    } catch (error) {
      console.error("Erro ao criar sessão:", error);
      toast.error("Não foi possível criar sessão");
    }
  };

  const deleteCurrentSession = async () => {
    if (!activeSession) return;

    const confirmed = window.confirm(
      "Deseja excluir esta sessão LAB e apagar as mensagens?",
    );
    if (!confirmed) return;

    try {
      await api.deleteLabSession(activeSession.id);
      setMessagesBySession((prev) => {
        const next = { ...prev };
        delete next[activeSession.id];
        return next;
      });

      setSessions((prev) => {
        const filtered = prev.filter((session) => session.id !== activeSession.id);
        setActiveSessionId(filtered[0]?.id || "");
        setMemorySnapshot(null);
        return filtered;
      });

      toast.success("Sessão removida");
    } catch (error) {
      console.error("Erro ao remover sessão:", error);
      toast.error("Não foi possível remover sessão");
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeSessionId || isSending) return;

    const text = input.trim();
    if (!text) return;

    setIsSending(true);
    setThinkingLine("Analisando contexto da conversa");
    setInput("");

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    appendMessage(activeSessionId, userMessage);

    const assistantMessageId = `${Date.now()}-assistant-stream`;
    const currentAgentName = memorySnapshot?.session?.phase?.agent || null;
    appendMessage(activeSessionId, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      traceLine: "Analisando contexto da conversa",
      agentName: currentAgentName,
    });

    try {
      const streamConfig = api.getLabStreamConfig();
      const response = await fetch(streamConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(streamConfig.apiKey ? { "x-api-key": streamConfig.apiKey } : {}),
          ...(streamConfig.token
            ? { Authorization: `Bearer ${streamConfig.token}` }
            : {}),
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: text,
          customerName,
          managerUser: user
            ? {
                id: user.id,
                name: user.name,
                phone: user.phone || null,
                email: user.email,
              }
            : null,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Falha no stream: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const eventData = JSON.parse(line) as LabTraceEvent;
          if (eventData.type === "state") {
            setThinkingLine(eventData.label);
            const isThought = eventData.label.toLowerCase().startsWith("pensamento:");
            patchAssistantMessage(activeSessionId, assistantMessageId, {
              traceLine: isThought ? "Planejando próxima ação" : eventData.label,
              ...(isThought ? { thought: eventData.label } : {}),
            });
          }

          if (eventData.type === "tool_call") {
            const toolText = `Usando tool: ${eventData.toolName}`;
            setThinkingLine(toolText);
            addToolToAssistantMessage(
              activeSessionId,
              assistantMessageId,
              eventData.toolName,
            );
            patchAssistantMessage(activeSessionId, assistantMessageId, {
              traceLine: toolText,
            });
          }

          if (eventData.type === "tool_result") {
            const resultText = eventData.success
              ? `Tool concluída: ${eventData.toolName}`
              : `Falha na tool: ${eventData.toolName}`;
            setThinkingLine(resultText);
            patchAssistantMessage(activeSessionId, assistantMessageId, {
              traceLine: resultText,
            });
          }

          if (eventData.type === "text_delta") {
            patchAssistantMessage(activeSessionId, assistantMessageId, {
              content: eventData.output,
              traceLine: "Escrevendo resposta final...",
            });
          }

          if (eventData.type === "warning") {
            setThinkingLine(eventData.message);
            patchAssistantMessage(activeSessionId, assistantMessageId, {
              traceLine: eventData.message,
            });
          }

          if (eventData.type === "error") {
            throw new Error(eventData.message);
          }

          if (eventData.type === "done") {
            patchAssistantMessage(activeSessionId, assistantMessageId, {
              content: eventData.output,
              traceLine: "",
            });
            setThinkingLine("");
            try {
              const snapshot = await api.getLabSessionMemory(activeSessionId);
              if (showMemoryPanel) setMemorySnapshot(snapshot);
              const refreshedAgent = snapshot?.session?.phase?.agent || null;
              if (refreshedAgent) {
                patchAssistantMessage(activeSessionId, assistantMessageId, {
                  agentName: refreshedAgent,
                });
              }
            } catch {
              // ignore refresh failure
            }
          }
        }
      }
    } catch (error) {
      console.error("Erro no chat LAB:", error);
      toast.error("Não foi possível completar o stream da IA");
      patchAssistantMessage(activeSessionId, assistantMessageId, {
        content: "Falha ao gerar resposta da IA no modo LAB.",
        traceLine: "",
      });
      setThinkingLine("");
    } finally {
      setIsSending(false);
    }
  };

  const showMobileChat = Boolean(activeSessionId);

  return (
    <div className="h-full min-h-0 w-full bg-slate-100 flex flex-col md:flex-row">
      <aside
        className={`md:flex md:w-80 md:min-w-80 border-r border-slate-200 bg-white flex-col min-h-0 ${
          showMobileChat ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Sessoes LAB</h2>
          <p className="text-xs text-slate-500 mt-1">
            Streaming, tools e markdown em tempo real
          </p>
          <Button onClick={createSession} className="mt-3 gap-2">
            <Plus size={14} />
            Nova sessão LAB
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {loadingSessions ? (
            <div className="text-xs text-slate-500 flex items-center gap-2 px-2">
              <Loader2 size={14} className="animate-spin" />
              Carregando sessões...
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  session.id === activeSessionId
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                    LAB
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {session.totalMessages} msg
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2 truncate">
                  {session.lastMessage?.content || "Sessão vazia"}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section
        className={`flex-1 min-h-0 flex-col bg-slate-50 ${
          showMobileChat ? "flex" : "hidden md:flex"
        }`}
      >
        <header className="border-b border-slate-200 p-3 md:p-5 bg-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              type="button"
              variant="ghost"
              className="md:hidden px-2"
              onClick={() => setActiveSessionId("")}
            >
              <ArrowLeft size={16} />
            </Button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-neutral-900 truncate">
                  Chat LAB da LLM
                </h1>
                <p className="text-xs text-neutral-500 truncate">
                  Cliente de teste: {customerName}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant={showMemoryPanel ? "default" : "outline"}
            onClick={() => {
              setShowMemoryPanel((prev) => !prev);
            }}
            className="gap-2 shrink-0"
            disabled={!activeSession}
          >
            <FileText size={14} />
            <span className="hidden sm:inline">Memória</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={deleteCurrentSession}
            className="border-red-200 text-red-600 hover:bg-red-50 gap-2 shrink-0"
            disabled={!activeSession}
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Excluir</span>
          </Button>
        </header>

        {showMemoryPanel ? (
          <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 md:px-6 md:py-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 max-h-72 overflow-auto">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileText size={16} />
                Snapshot de memória (read-only)
              </div>
              {loadingMemory ? (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Carregando memória...
                </div>
              ) : memorySnapshot ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-600 mb-2">
                      Status de atualização da sessão
                    </p>
                    <p className="text-[11px] text-slate-700">
                      Última atualização:{" "}
                      {memorySnapshot.session.updated_at
                        ? new Date(memorySnapshot.session.updated_at).toLocaleString()
                        : "n/a"}
                    </p>
                    {memorySnapshot.session.completeness ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          [
                            "nome",
                            memorySnapshot.session.completeness.has_name,
                          ] as const,
                          [
                            "cidade",
                            memorySnapshot.session.completeness.has_city,
                          ] as const,
                          [
                            "orçamento",
                            memorySnapshot.session.completeness.has_budget,
                          ] as const,
                          [
                            "ocasião",
                            memorySnapshot.session.completeness.has_occasion,
                          ] as const,
                          [
                            "público",
                            memorySnapshot.session.completeness.has_audience,
                          ] as const,
                        ].map(([label, ok]) => (
                          <span
                            key={label}
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              ok
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-amber-50 border-amber-200 text-amber-700"
                            }`}
                          >
                            {label}: {ok ? "ok" : "pendente"}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {memorySnapshot.session.phase ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-[11px] font-semibold text-slate-700">
                          Fase atual: {memorySnapshot.session.phase.current} (
                          {memorySnapshot.session.phase.agent})
                        </p>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Motivo:{" "}
                          {memorySnapshot.session.phase.transition_reason || "n/a"}
                        </p>
                        {memorySnapshot.session.phase.checklist ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {[
                              [
                                "discovery",
                                memorySnapshot.session.phase.checklist
                                  .discoveryQualified,
                              ] as const,
                              [
                                "produto",
                                memorySnapshot.session.phase.checklist.productSelected,
                              ] as const,
                              [
                                "customização",
                                memorySnapshot.session.phase.checklist
                                  .customizationDecided,
                              ] as const,
                              [
                                "checkout",
                                memorySnapshot.session.phase.checklist
                                  .checkoutDataCollected,
                              ] as const,
                            ].map(([label, ok]) => (
                              <span
                                key={label}
                                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                  ok
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-amber-50 border-amber-200 text-amber-700"
                                }`}
                              >
                                {label}: {ok ? "ok" : "pendente"}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-600 mb-2">
                      Sessão (compact)
                    </p>
                    <pre className="text-[11px] whitespace-pre-wrap text-slate-700">
                      {memorySnapshot.session.compact}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-600 mb-2">
                      Sessão (markdown)
                    </p>
                    <pre className="text-[11px] whitespace-pre-wrap text-slate-700 max-h-56 overflow-auto">
                      {memorySnapshot.session.markdown}
                    </pre>
                  </div>
                  {memorySnapshot.customer ? (
                    <>
                      <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                        <p className="text-xs font-semibold text-slate-600 mb-2">
                          Cliente (compact) — {memorySnapshot.customer.customer_phone}
                        </p>
                        <pre className="text-[11px] whitespace-pre-wrap text-slate-700">
                          {memorySnapshot.customer.compact}
                        </pre>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                        <p className="text-xs font-semibold text-slate-600 mb-2">
                          Cliente (markdown)
                        </p>
                        <pre className="text-[11px] whitespace-pre-wrap text-slate-700 max-h-56 overflow-auto">
                          {memorySnapshot.customer.markdown}
                        </pre>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                        <p className="text-xs font-semibold text-slate-600 mb-2">
                          Resumo persistido no banco
                        </p>
                        <pre className="text-[11px] whitespace-pre-wrap text-slate-700">
                          {memorySnapshot.customer.db_summary || "n/a"}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Nenhuma memória de cliente vinculada a esta sessão ainda.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Selecione uma sessão com dados para visualizar a memória.
                </p>
              )}
            </div>
          </div>
        ) : null}

        <main className="flex-1 min-h-0 overflow-y-auto px-3 py-4 md:px-6 md:py-5 space-y-4">
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Carregando mensagens...
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Envie a primeira mensagem para iniciar o teste.
            </div>
          ) : (
            activeMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] md:max-w-[82%] rounded-2xl p-4 shadow-sm ${
                    message.role === "user"
                      ? "bg-slate-900 text-white rounded-tr-md"
                      : message.role === "tool"
                        ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-md"
                        : `${getAgentBubbleClasses(message.agentName)} border rounded-tl-md`
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs mb-2 opacity-80">
                    {message.role === "user" ? <User size={14} /> : <Bot size={14} />}
                    <span>
                      {message.role === "user"
                        ? "Você"
                        : message.role === "tool"
                          ? "Tool"
                          : message.agentName
                            ? `IA • ${message.agentName}`
                            : "IA"}
                    </span>
                  </div>

                  {message.traceLine ? (
                    <p className="text-xs text-slate-500/80 italic animate-pulse mb-2">
                      {message.traceLine}
                    </p>
                  ) : null}

                  {message.thought ? (
                    <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-md px-2 py-1 mb-2">
                      {message.thought}
                    </p>
                  ) : null}

                  <StreamingMarkdown content={message.content} />

                  {message.role === "assistant" &&
                  message.usedTools &&
                  message.usedTools.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-medium text-slate-500">
                        Tools usadas nesta resposta
                      </p>
                      <p className="mt-1 text-xs text-slate-700">
                        {message.usedTools.join(", ")}
                      </p>
                    </div>
                  ) : null}

                  {message.linkPreviews && message.linkPreviews.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.linkPreviews.map((preview, index) => (
                        <a
                          key={`${message.id}-${preview.url}-${index}`}
                          href={preview.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden"
                        >
                          {canRenderPreviewImage(preview) ? (
                            <button
                              type="button"
                              className="w-full"
                              onClick={(event) => {
                                event.preventDefault();
                                if (isImageUrl(preview.image || "")) {
                                  setPreviewImageUrl(preview.image || null);
                                }
                              }}
                            >
                              <img
                                src={preview.image}
                                alt={preview.title}
                                className="h-36 w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </button>
                          ) : null}
                          <div className="p-3">
                            <div className="text-sm font-medium text-slate-900 line-clamp-1">
                              {preview.title}
                            </div>
                            {preview.description ? (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {preview.description}
                              </p>
                            ) : null}
                            <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                              <ExternalLink size={12} />
                              {preview.host}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isSending && thinkingLine ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 flex items-center gap-2 text-slate-500/80 text-sm italic animate-pulse">
                <Loader2 size={15} className="animate-spin" />
                {thinkingLine}
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </main>

        <form
          onSubmit={sendMessage}
          className="border-t border-slate-200 p-3 md:p-5 bg-white shrink-0"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(event as unknown as FormEvent);
                }
              }}
              placeholder="Digite sua mensagem para a IA..."
              rows={2}
              className="min-h-[52px] max-h-40 flex-1 resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <Button
              type="submit"
              disabled={isSending || !input.trim() || !activeSessionId}
              className="h-[52px] w-[52px] p-0 shrink-0"
            >
              {isSending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <SendHorizontal size={16} />
              )}
            </Button>
          </div>
        </form>
      </section>

      {previewImageUrl && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setPreviewImageUrl(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter") {
              setPreviewImageUrl(null);
            }
          }}
          className="fixed inset-0 z-80 bg-black/70 p-4 md:p-10 flex items-center justify-center"
        >
          <button
            type="button"
            onClick={() => setPreviewImageUrl(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/90 text-neutral-700 flex items-center justify-center"
          >
            <X size={18} />
          </button>
          <img
            src={previewImageUrl}
            alt="Imagem ampliada"
            className="max-h-full max-w-full rounded-xl shadow-2xl object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {!activeSessionId && !loadingSessions ? (
        <div className="hidden md:flex flex-1 items-center justify-center text-sm text-slate-500">
          Selecione ou crie uma sessão LAB para começar.
        </div>
      ) : null}
    </div>
  );
}
