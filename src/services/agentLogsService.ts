/**
 * Service para leitura e parsing de logs do agente (agent.log)
 */

export interface AgentLogEntry {
  ts: string;
  event: string;
  [key: string]: unknown;
}

export interface AgentLogsResponse {
  entries: AgentLogEntry[];
  total: number;
  truncated: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.cestodamore.com.br';

/**
 * Busca logs do agente com filtro opcional
 */
export async function fetchAgentLogs(
  options: {
    limit?: number;
    offset?: number;
    eventFilter?: string;
    sessionFilter?: string;
  } = {},
): Promise<AgentLogsResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());
  if (options.eventFilter) params.append('event', options.eventFilter);
  if (options.sessionFilter) params.append('sessionId', options.sessionFilter);

  const response = await fetch(
    `${API_BASE}/agent-logs?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('appToken') || localStorage.getItem('token') || ''}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch agent logs: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Download logs como CSV
 */
export async function downloadAgentLogsCSV(): Promise<void> {
  const response = await fetch(
    `${API_BASE}/agent-logs/export?format=csv`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('appToken') || localStorage.getItem('token') || ''}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to download logs');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-logs-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Obtém lista de eventos únicos nos logs
 */
export async function fetchAvailableEvents(): Promise<string[]> {
  const response = await fetch(
    `${API_BASE}/agent-logs/events`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('appToken') || localStorage.getItem('token') || ''}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to fetch available events');
  }

  const data = await response.json();
  return data.events || [];
}

/**
 * Obtém estatísticas dos logs (últimas 24h, últimas conversões, etc)
 */
export async function fetchAgentLogStats(): Promise<{
  totalEntries: number;
  eventsCount: Record<string, number>;
  lastUpdate: string;
}> {
  const response = await fetch(
    `${API_BASE}/agent-logs/stats`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('appToken') || localStorage.getItem('token') || ''}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to fetch agent log stats');
  }

  return response.json();
}
