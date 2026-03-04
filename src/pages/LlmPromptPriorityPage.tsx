import { useEffect, useMemo, useState } from "react";
import {
  BotMessageSquare,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import CodeMirror from "@uiw/react-codemirror";
import {
  EditorView,
  Decoration,
  MatchDecorator,
  ViewPlugin,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { Button } from "@/components/ui/button";
import { useApi } from "@/services/api";
import type {
  PromptInjectionMetadata,
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

type PromptSegment =
  | { type: "text"; value: string }
  | { type: "placeholder"; value: string; field: string; isValid: boolean };

function parsePromptSegments(
  text: string,
  availableFields: Set<string>,
): {
  segments: PromptSegment[];
  validCount: number;
  invalidCount: number;
} {
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const segments: PromptSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let validCount = 0;
  let invalidCount = 0;

  while ((match = regex.exec(text)) !== null) {
    const [raw, field] = match;
    const start = match.index;
    const end = start + raw.length;

    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    const isValid = availableFields.has(field);
    if (isValid) validCount += 1;
    else invalidCount += 1;

    segments.push({
      type: "placeholder",
      value: raw,
      field,
      isValid,
    });

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return { segments, validCount, invalidCount };
}

function createPlaceholderHighlightExtension(
  availableFields: Set<string>,
): Extension {
  const decorator = new MatchDecorator({
    regexp: /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    decoration: (match) => {
      const field = match[1];
      const isValid = availableFields.has(field);

      return Decoration.mark({
        class: isValid ? "cm-placeholder-valid" : "cm-placeholder-invalid",
        attributes: {
          title: isValid
            ? `Campo disponível: ${field}`
            : `Campo indisponível: ${field}`,
        },
      });
    },
  });

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }

      update(update: ViewUpdate) {
        this.decorations = decorator.updateDeco(update, this.decorations);
      }
    },
    {
      decorations: (value) => value.decorations,
    },
  );
}

const commandEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#0b0f10",
      color: "#e4e4e7",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      fontSize: "13px",
      borderRadius: "0.75rem",
      minHeight: "192px",
    },
    ".cm-scroller": {
      overflow: "auto",
      lineHeight: "1.5rem",
      scrollbarGutter: "stable",
    },
    ".cm-content": {
      caretColor: "#6ee7b7",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      padding: "0.75rem",
    },
    ".cm-line": {
      padding: "0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#6ee7b7",
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(59, 130, 246, 0.35) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(59, 130, 246, 0.45) !important",
    },
    ".cm-content ::selection": {
      backgroundColor: "rgba(59, 130, 246, 0.35)",
    },
    ".cm-line ::selection": {
      backgroundColor: "rgba(59, 130, 246, 0.35)",
    },
    ".cm-gutters": {
      backgroundColor: "#0b0f10",
      color: "#71717a",
      border: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-placeholder-valid": {
      backgroundColor: "rgba(6, 95, 70, 0.65)",
      color: "#d1fae5",
      borderRadius: "2px",
    },
    ".cm-placeholder-invalid": {
      backgroundColor: "rgba(185, 28, 28, 0.72)",
      color: "#fee2e2",
      borderRadius: "2px",
    },
  },
  { dark: true },
);

export function LlmPromptPriorityPage() {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [prompts, setPrompts] = useState<PromptPriorityOverrideConfig[]>([]);
  const [promptInjection, setPromptInjection] =
    useState<PromptInjectionMetadata | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [promptText, setPromptText] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [mode, setMode] = useState<PromptOverrideMode>("temporary");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const isTemporary = mode === "temporary";
  const isEditing = editingId !== null;
  const availableFieldSet = useMemo(
    () => new Set(promptInjection?.available_fields || []),
    [promptInjection],
  );
  const parsedPrompt = useMemo(
    () => parsePromptSegments(promptText, availableFieldSet),
    [promptText, availableFieldSet],
  );
  const promptEditorExtensions = useMemo(
    () => [
      EditorView.lineWrapping,
      commandEditorTheme,
      createPlaceholderHighlightExtension(availableFieldSet),
    ],
    [availableFieldSet],
  );

  const formStatus = useMemo(() => {
    if (!promptText.trim()) return "Preencha o texto do prompt";
    if (isTemporary && !expiresAt)
      return "Defina expiração para modo temporário";
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
      setPromptInjection(response.prompt_injection || null);
    } catch {
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
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-neutral-700">
            Injeção dinâmica de campos
          </h3>
          <p className="text-sm text-neutral-600">
            Use placeholders no prompt com a sintaxe{" "}
            <code>{promptInjection?.syntax || "{{field_name}}"}</code>.
          </p>
          <p className="text-xs text-neutral-500">
            {promptInjection?.dynamic_rule ||
              "Qualquer chave de primeiro nível enviada no body de /ai/orchestrate-prompt vira variável injetável."}
          </p>
          <div className="flex flex-wrap gap-2">
            {(promptInjection?.available_fields || []).map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => setPromptText((prev) => `${prev}{{${field}}}`)}
                className="text-xs font-semibold px-2 py-1 rounded-full border border-neutral-300 bg-white hover:bg-neutral-100"
                title={`Inserir {{${field}}}`}
              >
                {`{{${field}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">
            {isEditing
              ? "Editar prompt prioritário"
              : "Novo prompt prioritário"}
          </h2>
          <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-neutral-100 text-neutral-700">
            {formStatus}
          </span>
        </div>

        <label
          htmlFor="prompt-enabled"
          className="flex items-center gap-3 text-sm font-semibold text-neutral-800"
        >
          <input
            id="prompt-enabled"
            name="prompt_enabled"
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Ativo
        </label>

        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Texto do prompt
          </div>
          <div className="relative rounded-xl border border-emerald-900 bg-[#0b0f10]">
            <CodeMirror
              value={promptText}
              onChange={(value) => setPromptText(value)}
              placeholder="Digite a instrução prioritária..."
              extensions={promptEditorExtensions}
              theme="dark"
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                dropCursor: false,
                allowMultipleSelections: false,
                searchKeymap: false,
              }}
              className="rounded-xl"
              style={{ backgroundColor: "#0b0f10" }}
              minHeight="192px"
            />
            <div className="absolute right-2 top-2 z-20 flex items-center gap-2 text-[10px] font-semibold">
              <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-100">
                {parsedPrompt.validCount} válidos
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-800 text-red-100">
                {parsedPrompt.invalidCount} inválidos
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="prompt-mode"
              className="text-xs font-bold uppercase tracking-wider text-neutral-500"
            >
              Modo
            </label>
            <select
              id="prompt-mode"
              name="prompt_mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as PromptOverrideMode)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="temporary">Temporário</option>
              <option value="permanent">Permanente</option>
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="prompt-starts-at"
              className="text-xs font-bold uppercase tracking-wider text-neutral-500"
            >
              Início (opcional)
            </label>
            <input
              id="prompt-starts-at"
              name="prompt_starts_at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="prompt-expires-at"
              className="text-xs font-bold uppercase tracking-wider text-neutral-500"
            >
              Expiração {isTemporary ? "" : "(não usada)"}
            </label>
            <input
              id="prompt-expires-at"
              name="prompt_expires_at"
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
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isEditing ? (
              <Save size={18} />
            ) : (
              <Plus size={18} />
            )}
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
          {prompts.map((prompt, index) => {
            const parsedListPrompt = parsePromptSegments(
              prompt.prompt_text || "",
              availableFieldSet,
            );
            const placeholders = parsedListPrompt.segments.filter(
              (
                segment,
              ): segment is Extract<PromptSegment, { type: "placeholder" }> =>
                segment.type === "placeholder",
            );

            return (
              <div
                key={prompt.id}
                className="rounded-2xl border border-neutral-200 p-4 bg-neutral-50 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-neutral-900">
                    #{index + 1} • ID {prompt.id}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                        prompt.is_active_now
                          ? "bg-green-100 text-green-700"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {prompt.is_active_now ? "Ativo agora" : "Inativo agora"}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                        prompt.is_enabled
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {prompt.is_enabled ? "Habilitado" : "Desabilitado"}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                      {prompt.mode === "permanent"
                        ? "Permanente"
                        : "Temporário"}
                    </span>
                    {placeholders.length > 0 && (
                      <>
                        <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-green-100 text-green-700">
                          {parsedListPrompt.validCount} placeholders válidos
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-red-100 text-red-700">
                          {parsedListPrompt.invalidCount} placeholders inválidos
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-sm text-neutral-800 whitespace-pre-wrap">
                  {prompt.prompt_text}
                </p>

                {placeholders.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {placeholders.map((placeholder, placeholderIndex) => (
                      <span
                        key={`${prompt.id}-${placeholderIndex}-${placeholder.field}`}
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                          placeholder.isValid
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {placeholder.value}
                      </span>
                    ))}
                  </div>
                )}

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
            );
          })}
        </div>
      </div>
    </div>
  );
}
