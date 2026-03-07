import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BotMessageSquare,
  Grab,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

type PromptVisualStatus = "active" | "expired" | "scheduled" | "disabled";

function getPromptVisualStatus(
  prompt: PromptPriorityOverrideConfig,
): PromptVisualStatus {
  if (!prompt.is_enabled) return "disabled";

  if (prompt.mode === "temporary" && prompt.expires_at) {
    const expiresAt = new Date(prompt.expires_at);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return "expired";
    }
  }

  if (prompt.is_active_now) return "active";
  return "scheduled";
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

interface SortableItemProps {
  prompt: PromptPriorityOverrideConfig;
  availableFieldSet: Set<string>;
  onEdit: (prompt: PromptPriorityOverrideConfig) => void;
  onDelete: (id: number) => Promise<void>;
  deletingId: number | null;
}

function SortablePromptRow({
  prompt,
  availableFieldSet,
  onEdit,
  onDelete,
  deletingId,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prompt.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const parsedListPrompt = parsePromptSegments(
    prompt.prompt_text || "",
    availableFieldSet,
  );
  const visualStatus = getPromptVisualStatus(prompt);

  const statusStyles: Record<
    PromptVisualStatus,
    { card: string; dot: string; badge: string; label: string }
  > = {
    active: {
      card: "bg-emerald-50 border-emerald-200",
      dot: "bg-emerald-500",
      badge: "bg-emerald-100 text-emerald-700",
      label: "Ativo agora",
    },
    expired: {
      card: "bg-red-50 border-red-200",
      dot: "bg-red-500",
      badge: "bg-red-100 text-red-700",
      label: "Expirado",
    },
    scheduled: {
      card: "bg-amber-50 border-amber-200",
      dot: "bg-amber-500",
      badge: "bg-amber-100 text-amber-700",
      label: "Agendado",
    },
    disabled: {
      card: "bg-neutral-50 border-neutral-200",
      dot: "bg-neutral-400",
      badge: "bg-neutral-200 text-neutral-700",
      label: "Desativado",
    },
  };

  const activeStatusStyle = statusStyles[visualStatus];

  const placeholders = parsedListPrompt.segments.filter(
    (segment): segment is Extract<PromptSegment, { type: "placeholder" }> =>
      segment.type === "placeholder",
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-4 p-4 rounded-2xl border ${activeStatusStyle.card} ${
        isDragging ? "shadow-2xl border-emerald-500" : "hover:border-neutral-300 shadow-sm transition-all"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 p-1"
        title="Arrastar para reordenar"
      >
        <Grab size={20} />
      </button>

      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${activeStatusStyle.dot}`}
            />
            <h3 className="text-sm font-bold text-neutral-900 truncate">
              {prompt.prompt_text.split("\n")[0].substring(0, 100)}
              {prompt.prompt_text.length > 100 ? "..." : ""}
            </h3>
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${activeStatusStyle.badge}`}
            >
              {activeStatusStyle.label}
            </span>
            {prompt.mode === "permanent" ? (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Permanente
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Temporário
              </span>
            )}
            {prompt.trigger_keywords && (
              <span
                className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 truncate max-w-40"
                title={`Gatilhos: ${prompt.trigger_keywords}`}
              >
                Gatilhos: {prompt.trigger_keywords}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-neutral-500 hover:text-neutral-900"
              onClick={() => onEdit(prompt)}
            >
              <Pencil size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-neutral-500 hover:text-red-600"
              onClick={() => onDelete(prompt.id)}
              disabled={deletingId === prompt.id}
            >
              {deletingId === prompt.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </Button>
          </div>
        </div>

        <div className="text-xs text-neutral-600 line-clamp-2 italic bg-white/70 p-2 rounded-lg border border-white/80">
          "{prompt.prompt_text}"
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-neutral-500 font-medium">
          <div className="flex items-center gap-1">
            <span className="font-bold">Início:</span>{" "}
            {formatDate(prompt.starts_at)}
          </div>
          {prompt.mode === "temporary" && (
            <div className="flex items-center gap-1">
              <span className="font-bold">Expira:</span>{" "}
              {formatDate(prompt.expires_at)}
            </div>
          )}
          {placeholders.length > 0 && (
            <div className="flex items-center gap-1.5 border-l border-neutral-200 pl-4">
              <span className="font-bold">Variáveis:</span>
              <div className="flex gap-1">
                {placeholders.slice(0, 3).map((p, i) => (
                  <span
                    key={i}
                    className={`px-1.5 py-0.5 rounded-md ${
                      p.isValid
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-red-50 text-red-700 border border-red-100"
                    }`}
                  >
                    {p.field}
                  </span>
                ))}
                {placeholders.length > 3 && (
                  <span className="text-neutral-400">
                    +{placeholders.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [triggerKeywords, setTriggerKeywords] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
  const promptStatusSummary = useMemo(() => {
    return prompts.reduce(
      (acc, prompt) => {
        const status = getPromptVisualStatus(prompt);
        if (status === "active") acc.active += 1;
        if (status === "expired") acc.expired += 1;
        return acc;
      },
      { active: 0, expired: 0 },
    );
  }, [prompts]);

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
    setTriggerKeywords("");
  };

  const loadPrompts = useCallback(async () => {
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
  }, [api]);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const handleEdit = (prompt: PromptPriorityOverrideConfig) => {
    setEditingId(prompt.id);
    setPromptText(prompt.prompt_text || "");
    setIsEnabled(Boolean(prompt.is_enabled));
    setMode(prompt.mode || "temporary");
    setStartsAt(toDatetimeLocal(prompt.starts_at));
    setExpiresAt(toDatetimeLocal(prompt.expires_at));
    setTriggerKeywords(prompt.trigger_keywords || "");
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
        trigger_keywords: triggerKeywords.trim() || null,
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
    } catch (error: unknown) {
      let message = "Erro ao salvar prompt prioritário";
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.error || error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
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
    } catch (error: unknown) {
      let message = "Erro ao excluir prompt prioritário";
      if (axios.isAxiosError(error)) {
        message = error.response?.data?.error || error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPrompts((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Chamar API para persistir a nova ordem
        void api
          .reorderPromptPriorityOverrides(newItems.map((i) => i.id))
          .catch(() => {
            toast.error("Erro ao salvar nova ordem dos prompts");
            void loadPrompts(); // Recarregar se falhar
          });

        return newItems;
      });
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

          <div className="space-y-2">
            <label
              htmlFor="prompt-trigger-keywords"
              className="text-xs font-bold uppercase tracking-wider text-neutral-500"
            >
              Palavras-chave (gatilho)
            </label>
            <input
              id="prompt-trigger-keywords"
              name="prompt_trigger_keywords"
              type="text"
              placeholder="Ex: dia da mulher, natal"
              value={triggerKeywords}
              onChange={(e) => setTriggerKeywords(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-neutral-900">
            Lista de prompts prioritários (na ordem de aplicação)
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
              Ativos: {promptStatusSummary.active}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700">
              Expirados: {promptStatusSummary.expired}
            </span>
          </div>
        </div>

        {prompts.length === 0 && (
          <div className="text-sm text-neutral-500">
            Nenhum prompt prioritário cadastrado.
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-3">
            <SortableContext
              items={prompts.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {prompts.map((prompt) => (
                <SortablePromptRow
                  key={prompt.id}
                  prompt={prompt}
                  availableFieldSet={availableFieldSet}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>
      </div>
    </div>
  );
}
