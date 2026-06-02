import { useEffect, useState } from "react";
import { fetchAgentLogs, fetchAvailableEvents, fetchAgentLogStats, downloadAgentLogsCSV, type AgentLogEntry } from "../services/agentLogsService";
import { toast } from "sonner";
import './AgentLogsPage.css';

export function AgentLogsPage() {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [sessionFilter, setSessionFilter] = useState<string>("");
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const itemsPerPage = 50;

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [eventsData, statsData] = await Promise.all([
        fetchAvailableEvents(),
        fetchAgentLogStats(),
      ]);
      setEvents(eventsData);
      setStats(statsData);
    } catch (error) {
      toast.error("Erro ao carregar dados de eventos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAgentLogs({
        limit: itemsPerPage,
        offset: page * itemsPerPage,
        eventFilter: selectedEvent || undefined,
        sessionFilter: sessionFilter || undefined,
      });
      setLogs(data.entries);
    } catch (error) {
      toast.error("Erro ao carregar logs");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadLogs = () => {
    setPage(0);
    loadLogs();
  };

  const handleDownload = async () => {
    try {
      await downloadAgentLogsCSV();
      toast.success("Logs exportados com sucesso");
    } catch (error) {
      toast.error("Erro ao exportar logs");
      console.error(error);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      JSON.stringify(log).toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="agent-logs-page">
      <div className="page-header">
        <h1>📊 Agent Logs</h1>
        <p className="subtitle">Visualize e monitore eventos do agente IA</p>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total de Eventos</div>
            <div className="stat-value">{stats.totalEntries}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tipos de Evento</div>
            <div className="stat-value">{Object.keys(stats.eventsCount).length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Atualizado em</div>
            <div className="stat-value" style={{ fontSize: '0.9rem' }}>
              {new Date(stats.lastUpdate).toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
      )}

      <div className="filters-section">
        <div className="filter-group">
          <label>Tipo de Evento</label>
          <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}>
            <option value="">Todos os eventos</option>
            {events.map(event => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>ID da Sessão</label>
          <input 
            type="text" 
            placeholder="Filtrar por sessionId..." 
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Buscar</label>
          <input 
            type="text" 
            placeholder="Buscar em todo o log..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="btn-primary" onClick={handleLoadLogs} disabled={loading}>
          {loading ? "Carregando..." : "Aplicar Filtros"}
        </button>

        <button className="btn-secondary" onClick={handleDownload} disabled={loading}>
          📥 Exportar CSV
        </button>
      </div>

      <div className="logs-section">
        <h2>Eventos ({filteredLogs.length})</h2>
        
        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum evento encontrado com os filtros aplicados</p>
          </div>
        ) : (
          <div className="logs-list">
            {filteredLogs.map((log, index) => (
              <div key={index} className="log-entry">
                <div className="log-header">
                  <span className="log-event">{log.event}</span>
                  <span className="log-time">{new Date(log.ts).toLocaleString('pt-BR')}</span>
                </div>
                <div className="log-body">
                  <pre>{JSON.stringify(
                    Object.fromEntries(
                      Object.entries(log).filter(([k]) => k !== 'ts' && k !== 'event')
                    ),
                    null,
                    2
                  )}</pre>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pagination">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
            ← Anterior
          </button>
          <span>Página {page + 1}</span>
          <button onClick={() => setPage(page + 1)} disabled={filteredLogs.length < itemsPerPage}>
            Próxima →
          </button>
        </div>
      </div>
    </div>
  );
}
