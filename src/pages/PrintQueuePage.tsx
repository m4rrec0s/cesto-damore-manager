import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  Printer,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import useApi from "../services/api";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

/* ─── Types ────────────────────────────────────────────────────────────── */

interface PrintJob {
  id: string;
  orderId: string;
  customerName: string;
  status: string;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  ackedAt: string | null;
  printedAt: string | null;
}

/* ─── Constants ────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  PENDING: { label: "Na fila", variant: "outline", icon: <Clock size={14} /> },
  PENDING_REVIEW: { label: "Aguardando revisão", variant: "secondary", icon: <Clock size={14} /> },
  SENT: { label: "Enviado", variant: "outline", icon: <Printer size={14} /> },
  RECEIVED: { label: "Recebido", variant: "default", icon: <Check size={14} /> },
  PRINTING: { label: "Imprimindo", variant: "default", icon: <Printer size={14} /> },
  PRINTED: { label: "Impresso", variant: "default", icon: <CheckCheck size={14} /> },
  FAILED: { label: "Falhou", variant: "destructive", icon: <XCircle size={14} /> },
};

/* ─── Component ────────────────────────────────────────────────────────── */

export function PrintQueuePage() {
  const api = useApi();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      params.set("limit", "100");
      const res = await api.get(`/api/print/queue?${params}`);
      setJobs(res.data.jobs);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to fetch print queue:", err);
    } finally {
      setLoading(false);
    }
  }, [api, filter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleDispatch = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      await api.patch(`/api/print/queue/${jobId}/dispatch`);
      toast.success("Job enviado para impressão");
      fetchJobs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Falha ao enviar job");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      await api.patch(`/api/print/queue/${jobId}/reject`);
      toast.success("Job rejeitado");
      fetchJobs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Falha ao rejeitar job");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDispatchAll = async () => {
    setActionLoading("all");
    try {
      const res = await api.patch("/api/print/queue/dispatch-all");
      toast.success(`${res.data.dispatched} job(s) enviado(s)${res.data.failed > 0 ? `, ${res.data.failed} falhou` : ""}`);
      fetchJobs();
    } catch (err: any) {
      toast.error("Falha ao enviar todos");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectAll = async () => {
    setActionLoading("all");
    try {
      const res = await api.patch("/api/print/queue/reject-all");
      toast.success(`${res.data.rejected} job(s) rejeitado(s)`);
      fetchJobs();
    } catch (err: any) {
      toast.error("Falha ao rejeitar todos");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingReview = jobs.filter((j) => j.status === "PENDING_REVIEW");
  const formatDate = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-950 flex items-center gap-2">
            <Printer size={24} />
            Fila de Impressão
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {total} job(s) no histórico
            {pendingReview.length > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                • {pendingReview.length} aguardando revisão
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button
          variant={filter === "" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("")}
        >
          Todos
        </Button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <Button
            key={key}
            variant={filter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {config.label}
          </Button>
        ))}
      </div>

      {/* Bulk actions for PENDING_REVIEW */}
      {pendingReview.length > 0 && filter === "PENDING_REVIEW" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <span className="text-sm text-amber-800">
            {pendingReview.length} job(s) aguardando revisão
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleDispatchAll}
              disabled={actionLoading === "all"}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCheck size={14} className="mr-1" />
              Imprimir todos
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRejectAll}
              disabled={actionLoading === "all"}
            >
              <XCircle size={14} className="mr-1" />
              Rejeitar todos
            </Button>
          </div>
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div className="text-center py-12 text-neutral-500">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
          Carregando...
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <Printer size={48} className="mx-auto mb-4 text-neutral-300" />
          <p className="font-medium">Nenhum job na fila</p>
          <p className="text-sm">Jobs de impressão aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.PENDING;
            const isReview = job.status === "PENDING_REVIEW";
            const isLoading = actionLoading === job.id;

            return (
              <div
                key={job.id}
                className={`border rounded-xl p-4 flex items-center justify-between transition-colors ${
                  isReview ? "border-amber-200 bg-amber-50/50" : "border-neutral-200 bg-white"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-neutral-950 truncate">
                      {job.customerName || "Sem nome"}
                    </span>
                    <Badge variant={statusConfig.variant} className="flex items-center gap-1 text-xs">
                      {statusConfig.icon}
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1 flex gap-3">
                    <span>Pedido: {job.orderId.slice(0, 8)}</span>
                    <span>Criado: {formatDate(job.createdAt)}</span>
                    {job.printedAt && <span>Impresso: {formatDate(job.printedAt)}</span>}
                    {job.lastError && (
                      <span className="text-red-500 truncate max-w-[200px]">{job.lastError}</span>
                    )}
                  </div>
                </div>

                {isReview && (
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleDispatch(job.id)}
                      disabled={isLoading}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(job.id)}
                      disabled={isLoading}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
