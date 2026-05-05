import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  FileText,
  Search,
  Filter,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Tag,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApi } from "@/services/api";
import type {
  KBKnowledgeDocument,
  KBVersion,
  KBAnalytics,
} from "@/services/api";

type KBDocumentCategory = "faq" | "pattern" | "objection" | "upsell" | "troubleshooting" | "general";
type SalesPhase = "DISCOVERY" | "CURATION" | "CUSTOMIZATION" | "CHECKOUT";
type KBApprovalStatus = "draft" | "approved" | "archived";

export function ObsidianKnowledgePage() {
  const api = useApi();
  const [documents, setDocuments] = useState<KBKnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingDocument, setEditingDocument] = useState<KBKnowledgeDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<{
    category?: KBDocumentCategory;
    phase?: SalesPhase;
    approvalStatus?: KBApprovalStatus;
  }>({});
  const [analytics, setAnalytics] = useState<KBAnalytics | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<KBVersion[]>([]);
  const [selectedDocForVersions, setSelectedDocForVersions] = useState<string>("");

  const categories: KBDocumentCategory[] = [
    "faq",
    "pattern",
    "objection",
    "upsell",
    "troubleshooting",
    "general",
  ];

  const phases: SalesPhase[] = [
    "DISCOVERY",
    "CURATION",
    "CUSTOMIZATION",
    "CHECKOUT",
  ];

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.category) params.category = filters.category;
      if (filters.phase) params.phase = filters.phase;
      if (filters.approvalStatus) params.approvalStatus = filters.approvalStatus;
      if (searchQuery) params.search = searchQuery;

      const result = await api.getKBDocuments(params);
      setDocuments(result.documents || result);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
      toast.error("Não foi possível carregar os documentos");
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const data = await api.getKBAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error("Erro ao carregar analytics:", error);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadAnalytics();
  }, [filters, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este documento?")) return;

    try {
      await api.deleteKBDocument(id);
      toast.success("Documento excluído com sucesso");
      loadDocuments();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Não foi possível excluir o documento");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.approveKBDocument(id);
      toast.success("Documento aprovado com sucesso");
      loadDocuments();
    } catch (error) {
      console.error("Erro ao aprovar:", error);
      toast.error("Não foi possível aprovar o documento");
    }
  };

  const handleEdit = (doc: KBKnowledgeDocument) => {
    setEditingDocument(doc);
    setShowEditor(true);
  };

  const handleCreateNew = () => {
    setEditingDocument(null);
    setShowEditor(true);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingDocument(null);
    loadDocuments();
  };

  const handleShowVersions = async (docId: string) => {
    try {
      const result = await api.getKBDocumentVersions(docId);
      setVersions(result.versions || result);
      setSelectedDocForVersions(docId);
      setShowVersions(true);
    } catch (error) {
      console.error("Erro ao carregar versões:", error);
      toast.error("Não foi possível carregar versões");
    }
  };

  const getStatusBadge = (status: KBApprovalStatus) => {
    const config: Record<KBApprovalStatus, { color: string; icon: any; label: string }> = {
      draft: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Rascunho" },
      approved: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Aprovado" },
      archived: { color: "bg-gray-100 text-gray-800", icon: AlertCircle, label: "Arquivado" },
    };
    const { color, icon: Icon, label } = config[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        <Icon size={12} />
        {label}
      </span>
    );
  };

  const filteredDocuments = useMemo(() => {
    let result = [...documents];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.content.toLowerCase().includes(query)
      );
    }
    return result;
  }, [documents, searchQuery]);

  return (
    <div className="h-full min-h-0 w-full bg-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-violet-600" />
              Knowledge Base (Obsidian-style)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gerencie documentos Markdown para a IA aprender de forma conectada
            </p>
          </div>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus size={16} />
            Novo Documento
          </Button>
        </div>

        {/* Analytics */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
              <p className="text-xs text-violet-600 font-medium">Total de Docs</p>
              <p className="text-2xl font-bold text-violet-900">{analytics.total}</p>
            </div>
            {Object.entries(analytics.byStatus || {}).map(([status, count]) => (
              <div key={status} className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-600 font-medium capitalize">{status}</p>
                <p className="text-2xl font-bold text-slate-900">{count}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar documentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <select
            value={filters.category || ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                category: (e.target.value || undefined) as KBDocumentCategory | undefined,
              }))
            }
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Todas Categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={filters.phase || ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                phase: (e.target.value || undefined) as SalesPhase | undefined,
              }))
            }
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Todas Fases</option>
            {phases.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>

          <select
            value={filters.approvalStatus || ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                approvalStatus: (e.target.value || undefined) as KBApprovalStatus | undefined,
              }))
            }
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Todos Status</option>
            <option value="draft">Rascunho</option>
            <option value="approved">Aprovado</option>
            <option value="archived">Arquivado</option>
          </select>
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="text-center text-slate-500 py-8">Carregando documentos...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            Nenhum documento encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-slate-900 flex-1 pr-2">
                    {doc.title}
                  </h3>
                  {getStatusBadge(doc.approval_status)}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                    <Tag size={12} />
                    {doc.category}
                  </span>
                  {doc.phases?.map((phase) => (
                    <span
                      key={phase}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-violet-50 rounded text-xs text-violet-700"
                    >
                      <Layers size={12} />
                      {phase}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-slate-600 mb-3 line-clamp-3">
                  {doc.content.substring(0, 150)}...
                </p>

                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                  <span>v{doc.version}</span>
                  <span>•</span>
                  <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(doc)}
                    className="flex-1 gap-1"
                  >
                    <Edit size={14} />
                    Editar
                  </Button>
                  {doc.approval_status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(doc.id)}
                      className="flex-1 gap-1"
                    >
                      <CheckCircle size={14} />
                      Aprovar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleShowVersions(doc.id)}
                    className="gap-1"
                  >
                    Histórico
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(doc.id)}
                    className="text-red-600 hover:bg-red-50 gap-1"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <DocumentEditor
          document={editingDocument}
          onClose={handleEditorClose}
          onSave={loadDocuments}
        />
      )}

      {/* Versions Modal */}
      {showVersions && (
        <VersionsModal
          versions={versions}
          documentId={selectedDocForVersions}
          onClose={() => setShowVersions(false)}
          onRevert={loadDocuments}
        />
      )}
    </div>
  );
}

// ===== Document Editor Component =====
interface DocumentEditorProps {
  document: KBKnowledgeDocument | null;
  onClose: () => void;
  onSave: () => void;
}

function DocumentEditor({ document, onClose, onSave }: DocumentEditorProps) {
  const api = useApi();
  const [title, setTitle] = useState(document?.title || "");
  const [content, setContent] = useState(document?.content || "");
  const [category, setCategory] = useState<KBDocumentCategory>(
    (document?.category as KBDocumentCategory) || "general"
  );
  const [phases, setPhases] = useState<SalesPhase[]>(
    (document?.phases as SalesPhase[]) || []
  );
  const [tags, setTags] = useState<string[]>(document?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const categories: KBDocumentCategory[] = [
    "faq",
    "pattern",
    "objection",
    "upsell",
    "troubleshooting",
    "general",
  ];

  const allPhases: SalesPhase[] = [
    "DISCOVERY",
    "CURATION",
    "CUSTOMIZATION",
    "CHECKOUT",
  ];

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      if (document) {
        await api.updateKBDocument(document.id, {
          title,
          content,
          category,
          phases,
          tags,
        });
        toast.success("Documento atualizado com sucesso");
      } else {
        await api.createKBDocument({
          title,
          content,
          category,
          phases,
          tags,
        });
        toast.success("Documento criado com sucesso");
      }
      onSave();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Não foi possível salvar o documento");
    } finally {
      setSaving(false);
    }
  };

  const togglePhase = (phase: SalesPhase) => {
    if (phases.includes(phase)) {
      setPhases(phases.filter((p) => p !== phase));
    } else {
      setPhases([...phases, phase]);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {document ? "Editar Documento" : "Novo Documento"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Título do documento"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as KBDocumentCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fases Aplicáveis
              </label>
              <div className="flex flex-wrap gap-2">
                {allPhases.map((phase) => (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => togglePhase(phase)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      phases.includes(phase)
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {phase}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Adicionar tag"
              />
              <Button onClick={addTag} size="sm">
                Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-violet-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Conteúdo (Markdown)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
              placeholder="Conteúdo em Markdown..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== Versions Modal =====
interface VersionsModalProps {
  versions: KBVersion[];
  documentId: string;
  onClose: () => void;
  onRevert: () => void;
}

function VersionsModal({
  versions,
  documentId,
  onClose,
  onRevert,
}: VersionsModalProps) {
  const api = useApi();
  const [reverting, setReverting] = useState(false);

  const handleRevert = async (version: number) => {
    if (!window.confirm(`Deseja reverter para a versão ${version}?`)) return;

    setReverting(true);
    try {
      await api.revertKBDocument(documentId, version);
      toast.success(`Revertido para versão ${version}`);
      onRevert();
      onClose();
    } catch (error) {
      console.error("Erro ao reverter:", error);
      toast.error("Não foi possível reverter");
    } finally {
      setReverting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            Histórico de Versões
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {versions.length === 0 ? (
            <p className="text-center text-slate-500 py-4">
              Nenhuma versão encontrada
            </p>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border border-slate-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-900">
                      Versão {version.version}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevert(version.version)}
                      disabled={reverting}
                    >
                      Reverter para esta versão
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    Alterado por: {version.changed_by} em{" "}
                    {new Date(version.created_at).toLocaleString()}
                  </p>
                  {version.change_reason && (
                    <p className="text-sm text-slate-600">
                      {version.change_reason}
                    </p>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-violet-600">
                      Ver conteúdo
                    </summary>
                    <pre className="mt-2 p-2 bg-slate-50 rounded text-xs overflow-auto max-h-40">
                      {version.content}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
