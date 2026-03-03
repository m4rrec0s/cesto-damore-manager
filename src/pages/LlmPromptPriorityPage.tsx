import { useEffect, useMemo, useState } from "react";
import { BotMessageSquare, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/services/api";
import type {
  PromptOverrideMode,
  PromptPriorityOverrideConfig,
} from "@/services/api";

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(datetimeLocal: string): string | null {
  if (!datetimeLocal) return null;
  const parsed = new Date(datetimeLocal);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export function LlmPromptPriorityPage() {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [prompts, setPrompts] = useState<PromptPriorityOverrideConfig[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [promptText, setPromptText] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [mode, setMode] = useState<PromptOverrideMode>("temporary");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const isTemporary = mode === "temporary";
  const isEditing = editingId !== null;

  const formStatus = useMemo(() => {
    if (!promptText.trim()) return "Preencha o texto do prompt";
    if (isTemporary && !expiresAt) return "Defina expiração para modo temporário";
    return isEditing ? "Pronto para atualizar" : "Pronto para criar";
  }, [promptText, isTemporary, expiresAt, isEditing]);

  const resetForm = () => {
    setEditingId(null);
    setPromptText("");
    setIsEnabled(true);
    setMode("temporary");
    setStartsAt("");
    setExpiresAt("");
  };

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const response = await api.listPromptPriorityOverrides();
      setPrompts(response.prompts || []);
    } catch (error) {
      toast.error("Erro ao carregar prompts prioritários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPrompts();
  }, []);

  const handleEdit = (prompt: PromptPriorityOverrideConfig) => {
    setEditingId(prompt.id);
    setPromptText(prompt.prompt_text || "");
    setIsEnabled(Boolean(prompt.is_enabled));
    setMode(prompt.mode || "temporary");
    setStartsAt(toDatetimeLocal(prompt.starts_at));
    setExpiresAt(toDatetimeLocal(prompt.expires_at));
  };

  const handleSave = async () => {
    if (!promptText.trim()) {
      toast.error("Preencha o texto do prompt");
      return;
    }

    if (isTemporary && !expiresAt) {
      toast.error("Informe a data de expiração");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        prompt_text: promptText.trim(),
        is_enabled: isEnabled,
        mode,
        starts_at: toIsoOrNull(startsAt),
        expires_at: isTemporary ? toIsoOrNull(expiresAt) : null,
      };

      if (editingId !== null) {
        await api.updatePromptPriorityOverride(editingId, payload);
        toast.success("Prompt prioritário atualizado");
      } else {
        await api.createPromptPriorityOverride(payload);
        toast.success("Prompt prioritário criado");
      }

      await loadPrompts();
      resetForm();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error || "Erro ao salvar prompt prioritário",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Deseja excluir este prompt prioritário?");
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await api.deletePromptPriorityOverride(id);
      toast.success("Prompt prioritário excluído");
      await loadPrompts();
      if (editingId === id) resetForm();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error || "Erro ao excluir prompt prioritário",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-3">
          <BotMessageSquare size={30} />
          Prompt Prioritário LLM
        </h1>
        <p className="text-neutral-500">
          Lista de prompts prioritários aplicada no topo do prompt final.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">
            {isEditing ? "Editar prompt prioritário" : "Novo prompt prioritário"}
          </h2>
          <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-neutral-100 text-neutral-700">
            {formStatus}
          </span>
        </div>

        <label className="flex items-center gap-3 text-sm font-semibold text-neutral-800">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Ativo
        </label>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Texto do prompt
          </label>
          <Textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Digite a instrução prioritária..."
            rows={8}
            className="bg-neutral-50 border-neutral-200"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Modo
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as PromptOverrideMode)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="temporary">Temporário</option>
              <option value="permanent">Permanente</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Início (opcional)
            </label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Expiração {isTemporary ? "" : "(não usada)"}
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={!isTemporary}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-neutral-900 text-white gap-2 px-5 py-2.5 rounded-xl font-bold"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : isEditing ? <Save size={18} /> : <Plus size={18} />}
            {isEditing ? "Atualizar" : "Criar"}
          </Button>

          <Button
            onClick={resetForm}
            type="button"
            variant="outline"
            className="gap-2"
          >
            <X size={16} />
            Limpar
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-neutral-900">
          Lista de prompts prioritários (mais antigos primeiro)
        </h2>

        {prompts.length === 0 && (
          <div className="text-sm text-neutral-500">
            Nenhum prompt prioritário cadastrado.
          </div>
        )}

        <div className="space-y-3">
          {prompts.map((prompt, index) => (
            <div
              key={prompt.id}
              className="rounded-2xl border border-neutral-200 p-4 bg-neutral-50 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-neutral-900">
                  #{index + 1} • ID {prompt.id}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${prompt.is_active_now ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>
                    {prompt.is_active_now ? "Ativo agora" : "Inativo agora"}
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${prompt.is_enabled ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    {prompt.is_enabled ? "Habilitado" : "Desabilitado"}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                    {prompt.mode === "permanent" ? "Permanente" : "Temporário"}
                  </span>
                </div>
              </div>

              <p className="text-sm text-neutral-800 whitespace-pre-wrap">
                {prompt.prompt_text}
              </p>

              <div className="text-xs text-neutral-500 grid grid-cols-1 md:grid-cols-4 gap-2">
                <div>Criado: {formatDate(prompt.created_at)}</div>
                <div>Atualizado: {formatDate(prompt.updated_at)}</div>
                <div>Início: {formatDate(prompt.starts_at)}</div>
                <div>Expira: {formatDate(prompt.expires_at)}</div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => handleEdit(prompt)}
                >
                  <Pencil size={14} />
                  Editar
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(prompt.id)}
                  disabled={deletingId === prompt.id}
                >
                  {deletingId === prompt.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
