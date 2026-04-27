import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApi, type KnowledgeDocumentSummary } from "@/services/api";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export function LlmKnowledgeDocsPage() {
  const api = useApi();
  const [documents, setDocuments] = useState<KnowledgeDocumentSummary[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  const hasDocuments = useMemo(() => documents.length > 0, [documents]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await api.getLabKnowledgeDocuments();
      setDocuments(response.documents || []);
    } catch (error) {
      console.error("Erro ao carregar documentos de conhecimento:", error);
      toast.error("Não foi possível carregar os PDFs da base");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.warning("Selecione um arquivo PDF");
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são permitidos");
      return;
    }

    setUploading(true);
    try {
      await api.uploadLabKnowledgeDocument(selectedFile);
      toast.success("PDF enviado e indexado com sucesso");
      setSelectedFile(null);
      await loadDocuments();
    } catch (error: any) {
      console.error("Erro ao enviar PDF:", error);
      toast.error(error?.response?.data?.error || "Falha ao enviar PDF");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: KnowledgeDocumentSummary) => {
    if (!window.confirm(`Remover o documento "${doc.title}"?`)) return;

    setBusyDocId(doc.id);
    try {
      await api.deleteLabKnowledgeDocument(doc.id);
      toast.success("Documento removido");
      await loadDocuments();
    } catch (error: any) {
      console.error("Erro ao remover documento:", error);
      toast.error(error?.response?.data?.error || "Falha ao remover documento");
    } finally {
      setBusyDocId(null);
    }
  };

  const handleReindex = async (doc: KnowledgeDocumentSummary) => {
    setBusyDocId(doc.id);
    try {
      await api.reindexLabKnowledgeDocument(doc.id);
      toast.success("Documento reindexado");
      await loadDocuments();
    } catch (error: any) {
      console.error("Erro ao reindexar documento:", error);
      toast.error(
        error?.response?.data?.error || "Falha ao reindexar documento",
      );
    } finally {
      setBusyDocId(null);
    }
  };

  return (
    <section className="p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-neutral-900">
            Base de Conhecimento (PDF)
          </h1>
          <p className="text-sm text-neutral-600">
            Faça upload de PDFs institucionais para a tool
            `query_company_knowledge` no MCP.
          </p>
        </div>
        <Button
          onClick={loadDocuments}
          variant="outline"
          disabled={loading || uploading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Atualizar
        </Button>
      </header>

      <Card className="p-4 md:p-5 space-y-3">
        <h2 className="font-medium text-neutral-900">Adicionar PDF</h2>
        <div className="flex flex-col md:flex-row items-stretch gap-2">
          <Input
            type="file"
            accept="application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setSelectedFile(file);
            }}
          />
          <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <UploadCloud className="w-4 h-4 mr-2" />
            )}
            Enviar PDF
          </Button>
        </div>
        {selectedFile ? (
          <p className="text-xs text-neutral-600">
            Selecionado:{" "}
            <span className="font-medium">{selectedFile.name}</span>
          </p>
        ) : null}
      </Card>

      <Card className="p-4 md:p-5">
        <h2 className="font-medium text-neutral-900 mb-3">
          Documentos indexados
        </h2>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-neutral-600">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Carregando documentos...
          </div>
        ) : !hasDocuments ? (
          <div className="py-10 text-center text-neutral-600">
            <FileText className="w-8 h-8 mx-auto mb-2" />
            Nenhum PDF indexado ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => {
              const isBusy = busyDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  className="border border-neutral-200 rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-neutral-900">{doc.title}</p>
                    <p className="text-xs text-neutral-600">
                      Arquivo: {doc.sourceFilename}
                    </p>
                    <p className="text-xs text-neutral-600">
                      Chunks: {doc.totalChunks} • Versão: {doc.version} •
                      Atualizado: {formatDateTime(doc.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReindex(doc)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-1" />
                      )}
                      Reindexar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleDelete(doc)}
                      disabled={isBusy}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
