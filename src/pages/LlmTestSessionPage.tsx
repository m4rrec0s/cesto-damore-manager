import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  Bot,
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
import { useAuth } from "@/contexts/useAuth";
import { useApi } from "@/services/api";

const WEBHOOK_URL =
  import.meta.env.VITE_LLM_TEST_WEBHOOK_URL ||
  "https://n8n.cestodamore.com.br/webhook/ana-ai-agent";
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY || "";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  images?: string[];
}

interface LabSession {
  id: string;
  rawKey: string;
  sessionKey: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

function generateRawKey() {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join(
    "",
  );
}

function createLabSession(userId: string): LabSession {
  const rawKey = generateRawKey();
  const now = new Date().toISOString();
  return {
    id: `lab-${rawKey}-${Date.now()}`,
    rawKey,
    sessionKey: `lab-${userId}-${rawKey}`,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s"'`)>]+/gi);
  return matches || [];
}

function isImageUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(path);
  } catch {
    return false;
  }
}

function collectImageUrls(value: unknown, output: Set<string>) {
  if (!value) return;

  if (typeof value === "string") {
    extractUrls(value).forEach((url) => {
      if (isImageUrl(url)) output.add(url);
    });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectImageUrls(entry, output));
    return;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((entry) => collectImageUrls(entry, output));
  }
}

function extractAssistantText(payload: unknown, fallbackText: string) {
  if (typeof payload === "string") return payload;

  if (Array.isArray(payload)) {
    const joined = payload
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof part === "object" && part && "text" in part
            ? String(part.text || "")
            : "",
      )
      .filter(Boolean)
      .join("\n");
    return joined || fallbackText;
  }

  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    const candidates = [
      data.output,
      data.message,
      data.response,
      data.reply,
      data.text,
      data.answer,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }

  return fallbackText;
}

function getStorageKey(userId: string) {
  return `llm_test_sessions_${userId}`;
}

export function LlmTestSessionPage() {
  const api = useApi();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userId = user?.id || "anonymous";
  const customerName = user?.name?.trim() || "cliente";
  const storageKey = useMemo(() => getStorageKey(userId), [userId]);

  useEffect(() => {
    let loaded: LabSession[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      loaded = raw ? (JSON.parse(raw) as LabSession[]) : [];
    } catch {
      loaded = [];
    }

    if (loaded.length === 0) {
      const first = createLabSession(userId);
      setSessions([first]);
      setActiveSessionId(first.id);
      return;
    }

    setSessions(loaded);
    setActiveSessionId(loaded[0].id);
  }, [storageKey, userId]);

  useEffect(() => {
    if (!sessions.length) return;
    localStorage.setItem(storageKey, JSON.stringify(sessions));
  }, [sessions, storageKey]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 40);

    return () => clearTimeout(timer);
  }, [activeSessionId, activeSession?.messages.length]);

  const createSession = () => {
    const next = createLabSession(userId);
    setSessions((prev) => [next, ...prev]);
    setActiveSessionId(next.id);
    toast.success("Nova sessão LAB criada");
  };

  const clearSessionOnServer = async (session: LabSession) => {
    try {
      await api.clearSessionHistory(`session-${session.sessionKey}`);
    } catch {
      // Melhor esforço: manter remoção local mesmo se API falhar.
    }
  };

  const deleteCurrentSession = async () => {
    if (!activeSession) return;
    const confirmed = window.confirm(
      "Deseja excluir esta sessão LAB e apagar as mensagens?",
    );
    if (!confirmed) return;

    await clearSessionOnServer(activeSession);

    setSessions((prev) => {
      const filtered = prev.filter(
        (session) => session.id !== activeSession.id,
      );
      if (filtered.length > 0) {
        setActiveSessionId(filtered[0].id);
        return filtered;
      }

      const replacement = createLabSession(userId);
      setActiveSessionId(replacement.id);
      return [replacement];
    });

    toast.success("Sessão removida");
  };

  const appendMessage = (sessionId: string, message: ChatMessage) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages: [...session.messages, message],
              updatedAt: new Date().toISOString(),
            }
          : session,
      ),
    );
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeSession || isSending) return;

    const text = input.trim();
    if (!text) return;

    const sessionId = activeSession.id;
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    appendMessage(sessionId, userMessage);
    setInput("");
    setIsSending(true);

    try {
      const payload = {
        pushName: customerName,
        sessionKey: activeSession.sessionKey,
        chatId: activeSession.sessionKey,
        message: text,
        sessionType: "lab",
        userId,
      };

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-api-key": AI_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook retornou ${response.status}`);
      }

      const responseText = await response.text();
      let parsed: unknown = responseText;

      try {
        parsed = responseText ? JSON.parse(responseText) : "";
      } catch {
        parsed = responseText;
      }

      const assistantText = extractAssistantText(
        parsed,
        "Resposta recebida sem conteúdo textual.",
      );

      const imageUrls = new Set<string>();
      collectImageUrls(parsed, imageUrls);
      collectImageUrls(assistantText, imageUrls);

      appendMessage(sessionId, {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: assistantText,
        createdAt: new Date().toISOString(),
        images: Array.from(imageUrls),
      });
    } catch (error) {
      console.error("Erro no webhook de teste LLM:", error);
      toast.error("Não foi possível obter resposta do webhook");
      appendMessage(sessionId, {
        id: `${Date.now()}-assistant-error`,
        role: "assistant",
        content: "Falha ao consultar o webhook. Verifique o fluxo no n8n.",
        createdAt: new Date().toISOString(),
      });
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
          <h2 className="text-lg font-semibold text-slate-900">
            Sessoes LAB
          </h2>
          <p className="text-xs text-slate-500 mt-1">Teste da IA</p>
          <Button onClick={createSession} className="mb-3 gap-2">
            <Plus size={14} />
            Nova sessão LAB
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {sessions.map((session) => (
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
                  {session.messages.length} msg
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2 truncate">
                {session.messages.at(-1)?.content || "Sessao vazia"}
              </p>
            </button>
          ))}
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
                  Sessão de Teste LLM
                </h1>
                <p className="text-xs text-neutral-500 truncate">
                  Cliente: {customerName}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={deleteCurrentSession}
            className="border-red-200 text-red-600 hover:bg-red-50 gap-2 shrink-0"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Excluir</span>
          </Button>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto px-3 py-4 md:px-6 md:py-5 space-y-4">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Envie a primeira mensagem para iniciar o teste.
            </div>
          ) : (
            activeSession.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] md:max-w-[82%] rounded-2xl p-4 shadow-sm ${
                    message.role === "user"
                      ? "bg-slate-900 text-white rounded-tr-md"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-md"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs mb-2 opacity-80">
                    {message.role === "user" ? <User size={14} /> : <Bot size={14} />}
                    <span>{message.role === "user" ? "Voce" : "IA"}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>

                  {message.images && message.images.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {message.images.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setPreviewImageUrl(url)}
                          className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                        >
                          <img
                            src={url}
                            alt="Pre-visualizacao enviada pela IA"
                            className="h-28 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                            <ImageIcon
                              size={18}
                              className="text-white opacity-0 group-hover:opacity-100"
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />

          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 flex items-center gap-2 text-slate-600 text-sm">
                <Loader2 size={16} className="animate-spin" />
                Aguardando resposta do n8n...
              </div>
            </div>
          )}
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
              disabled={isSending || !input.trim()}
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

    </div>
  );
}
