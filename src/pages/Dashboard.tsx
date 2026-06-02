import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RotateCw,
  Sparkles,
  Image as ImageIcon,
  BotMessageSquare,
  RefreshCw,
  User as UserIcon,
  FlaskConical,
  SlidersHorizontal,
  ArrowRight,
  Printer,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle2,
  Activity,
  Package,
  ShoppingCart,
  BarChart3,
  MapPin,
  Clock,
  ChevronRight,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "../services/api";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Pie,
  PieChart,
  Bar,
  BarChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import type { ChartConfig } from "../components/ui/chart";
import { cn } from "../lib/utils";
import { useAuth } from "@/contexts/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentLogStats {
  totalEntries: number;
  eventsCount: Record<string, number>;
  lastUpdate: string;
}

// ─── Chart configs ────────────────────────────────────────────────────────────

const revenueConfig = {
  revenue: { label: "Receita", color: "var(--neutral-800)" },
} satisfies ChartConfig;

const ordersConfig = {
  orders: { label: "Pedidos", color: "#6366f1" },
} satisfies ChartConfig;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  accent = false,
  trend,
}: {
  label: string;
  value: string;
  description?: string;
  icon?: React.ElementType;
  accent?: boolean;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 flex flex-col gap-3 transition-all",
        accent
          ? "bg-neutral-900 border-neutral-800 text-white"
          : "bg-white border-neutral-100 hover:border-neutral-200 hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            accent ? "text-neutral-400" : "text-neutral-500",
          )}
        >
          {label}
        </span>
        {Icon && (
          <div
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center",
              accent
                ? "bg-white/10 text-white"
                : "bg-neutral-50 text-neutral-400",
            )}
          >
            <Icon size={16} />
          </div>
        )}
      </div>
      <div>
        <p
          className={cn(
            "text-2xl font-black tracking-tight",
            accent ? "text-white" : "text-neutral-950",
          )}
        >
          {value}
        </p>
        {description && (
          <p
            className={cn(
              "text-xs mt-1",
              accent ? "text-neutral-500" : "text-neutral-400",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {trend && (
        <div className="flex items-center gap-1">
          {trend === "up" ? (
            <TrendingUp size={12} className="text-emerald-400" />
          ) : trend === "down" ? (
            <TrendingDown size={12} className="text-red-400" />
          ) : null}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  badge,
  iconColor = "text-neutral-400",
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
        <Icon size={18} className={iconColor} />
        {title}
      </h3>
      {badge && (
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-neutral-50 px-3 py-1 rounded-full border border-neutral-100">
          {badge}
        </span>
      )}
    </div>
  );
}

function PrintAgentWidget({
  agentConnected,
  agentStats,
  loadingAgent,
  onRefresh,
}: {
  agentConnected: boolean | null;
  agentStats: AgentLogStats | null;
  loadingAgent: boolean;
  onRefresh: () => void;
}) {
  const printEvents = agentStats?.eventsCount?.["print_job_started"] ?? 0;
  const printDone = agentStats?.eventsCount?.["print_job_completed"] ?? 0;
  const printErrors = agentStats?.eventsCount?.["print_job_failed"] ?? 0;
  const lastUpdate = agentStats?.lastUpdate
    ? new Date(agentStats.lastUpdate).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-5 hover:border-neutral-200 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              agentConnected === true
                ? "bg-emerald-50 text-emerald-500"
                : agentConnected === false
                  ? "bg-red-50 text-red-500"
                  : "bg-neutral-50 text-neutral-400",
            )}
          >
            <Printer size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900">
              Agente de Impressão
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {agentConnected === null ? (
                <span className="text-xs text-neutral-400">Verificando...</span>
              ) : agentConnected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-600 font-medium">
                    Online
                  </span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-xs text-red-600 font-medium">
                    Offline
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={loadingAgent}
          className="h-7 w-7 rounded-lg text-neutral-400 hover:text-neutral-700"
        >
          <RotateCw size={14} className={loadingAgent ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-neutral-50">
        <div className="text-center">
          <p className="text-lg font-black text-neutral-900">{printEvents}</p>
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide mt-0.5">
            Iniciados
          </p>
        </div>
        <div className="text-center border-x border-neutral-50">
          <p className="text-lg font-black text-emerald-600">{printDone}</p>
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide mt-0.5">
            Concluídos
          </p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-red-500">{printErrors}</p>
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide mt-0.5">
            Erros
          </p>
        </div>
      </div>

      {lastUpdate && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-neutral-50">
          <Clock size={11} className="text-neutral-300" />
          <span className="text-[11px] text-neutral-400">
            Atualizado às {lastUpdate}
          </span>
        </div>
      )}
    </div>
  );
}

function renderMarkdown(text: string) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### "))
      return (
        <h4 key={i} className="text-sm font-bold mt-4 mb-1.5 text-neutral-800">
          {line.replace("### ", "")}
        </h4>
      );
    if (line.startsWith("## "))
      return (
        <h3
          key={i}
          className="text-base font-bold mt-4 mb-2 text-neutral-900 border-b border-neutral-100 pb-1"
        >
          {line.replace("## ", "")}
        </h3>
      );
    if (line.startsWith("# "))
      return (
        <h2 key={i} className="text-lg font-bold mt-5 mb-2 text-neutral-950">
          {line.replace("# ", "")}
        </h2>
      );
    if (line.trim().startsWith("- "))
      return (
        <p
          key={i}
          className="text-sm text-neutral-600 mb-1 pl-4 relative before:content-['·'] before:absolute before:left-1 before:text-neutral-300"
        >
          {processBold(line.replace("- ", ""))}
        </p>
      );
    if (line.trim() === "") return <div key={i} className="h-1.5" />;
    return (
      <p key={i} className="text-sm text-neutral-600 mb-1 leading-relaxed">
        {processBold(line)}
      </p>
    );
  });
}

function processBold(text: string) {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-neutral-800 font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard() {
  const api = useApi();
  const { user } = useAuth();

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [topSelling, setTopSelling] = useState<any[]>([]);
  const [trendSummary, setTrendSummary] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // Agent states
  const [agentConnected, setAgentConnected] = useState<boolean | null>(null);
  const [agentStats, setAgentStats] = useState<AgentLogStats | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);

  // UI states
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<"vendas" | "visitas">("vendas");

  const fetchAgentStatus = useCallback(async () => {
    setLoadingAgent(true);
    try {
      const [statusRes, statsRes] = await Promise.allSettled([
        api.getAgentStatus(),
        fetch(
          `${import.meta.env.VITE_API_URL || "https://api.cestodamore.com.br"}/agent-logs/stats`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("appToken") || localStorage.getItem("token") || ""}`,
            },
          },
        ).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (statusRes.status === "fulfilled")
        setAgentConnected(statusRes.value.connected);
      if (statsRes.status === "fulfilled" && statsRes.value)
        setAgentStats(statsRes.value);
    } catch {
      setAgentConnected(false);
    } finally {
      setLoadingAgent(false);
    }
  }, [api]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, trendRes] = await Promise.all([
        api.getBusinessStatus(30),
        api.getTrendSummary(),
      ]);
      const statusData = statusRes.data || statusRes;
      setStats(statusData);
      setTopSelling(statusData.top_products || []);
      setTrendSummary(trendRes);

      try {
        const aiData = await api.getAiSummary(false);
        if (aiData?.summary) setAiSummary(aiData.summary);
      } catch {
        console.warn("Failed to load AI summary on dashboard init");
      }
    } catch (e) {
      console.error("Dashboard load error", e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadDashboardData();
    fetchAgentStatus();
  }, [loadDashboardData, fetchAgentStatus]);

  const generateAI = async () => {
    try {
      setLoadingAI(true);
      const data = await api.getAiSummary(true);
      if (data?.summary) {
        setAiSummary(data.summary);
        toast.success("Resumo estratégico atualizado!");
      }
    } catch {
      toast.error("Erro ao gerar resumo de IA");
    } finally {
      setLoadingAI(false);
    }
  };

  // ─── Derived data ──────────────────────────────────────────────────────────

  const totalSales = stats?.totals?.total_sales || 0;
  const approvedOrders = stats?.totals?.approved_orders || 0;
  const avgTicket = stats?.metrics?.averageTicket || 0;
  const conversionRate = stats?.metrics?.conversionRate || 0;
  const activeSessions = stats?.metrics?.activeSessions || 0;
  const openFollowUps = stats?.metrics?.openFollowUps || 0;
  const totalClients = stats?.metrics?.totalClients || 0;

  const trendProductsSold = trendSummary?.top_products_sold || [];
  const trendProductsViewed = trendSummary?.top_products_viewed || [];
  const trendRegions = trendSummary?.top_regions || [];
  const trendIPs = trendSummary?.top_ips || [];

  const dailyData =
    stats?.daily_data?.map((d: any) => ({
      date: new Date(d.date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      }),
      revenue: d.total_sales,
      orders: d.approved_orders || 0,
    })) || [];

  const hasRevenue = dailyData.some((d: any) => d.revenue > 0);

  const regionColors = [
    "#111827",
    "#374151",
    "#4b5563",
    "#6b7280",
    "#9ca3af",
    "#d1d5db",
  ];

  const deprecatedConfigs = [
    {
      title: "Atendimento (Legado)",
      description: "Sessões históricas e fluxos do agente anterior.",
      href: "/service",
      icon: BotMessageSquare,
    },
    {
      title: "LLM Lab",
      description: "Chat profissional com streaming e ferramentas avançadas.",
      href: "/ai/llm-test",
      icon: FlaskConical,
    },
    {
      title: "Prompt Prioritário",
      description: "Gerenciamento de prompts da orquestração anterior.",
      href: "/ai/llm-prompt-priority",
      icon: SlidersHorizontal,
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-800 rounded-full animate-spin" />
          <p className="text-sm text-neutral-400">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50/50">
      <div className="mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-2">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              Olá, {user?.name || "usuário"}!
            </Badge>
            <h1 className="text-3xl font-black text-neutral-950 tracking-tight">
              Visão Geral
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Últimos {stats?.period?.days || 30} dias ·{" "}
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            className="rounded-xl text-neutral-600 border-neutral-200 hover:border-neutral-300 gap-1.5 mt-1"
          >
            <RotateCw size={14} />
            Atualizar
          </Button>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            accent
            label="Faturamento (30d)"
            value={totalSales.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            description="Vendas aprovadas"
            icon={TrendingUp}
          />
          <StatCard
            label="Pedidos aprovados"
            value={approvedOrders.toLocaleString("pt-BR")}
            description="No período"
            icon={ShoppingCart}
          />
          <StatCard
            label="Ticket médio"
            value={avgTicket.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            description="Média por pedido"
            icon={BarChart3}
          />
          <StatCard
            label="Conversão"
            value={`${conversionRate}%`}
            description="Pedidos / Total"
            icon={Activity}
          />
        </div>

        {/* ── Status Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Active Sessions */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <BotMessageSquare size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Sessões ativas
              </p>
              <p className="text-xl font-black text-neutral-900">
                {activeSessions}
              </p>
            </div>
          </div>

          {/* Follow-ups */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <RefreshCw size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Follow-ups abertos
              </p>
              <p className="text-xl font-black text-neutral-900">
                {openFollowUps}
              </p>
            </div>
          </div>

          {/* Total Clients */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
              <UserIcon size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Clientes totais
              </p>
              <p className="text-xl font-black text-neutral-900">
                {totalClients}
              </p>
            </div>
          </div>

          {/* Print Agent */}
          <PrintAgentWidget
            agentConnected={agentConnected}
            agentStats={agentStats}
            loadingAgent={loadingAgent}
            onRefresh={fetchAgentStatus}
          />
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Chart – 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-100 p-6">
            <SectionHeader
              icon={TrendingUp}
              title="Desempenho Financeiro"
              badge={`${stats?.period?.days || 30} dias`}
              iconColor="text-emerald-500"
            />

            {/* Chart type toggle */}
            <div className="flex gap-1 mb-4 bg-neutral-50 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab("vendas")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  activeTab === "vendas"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600",
                )}
              >
                Receita
              </button>
              <button
                onClick={() => setActiveTab("visitas")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  activeTab === "visitas"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600",
                )}
              >
                Pedidos
              </button>
            </div>

            {hasRevenue ? (
              <ChartContainer config={revenueConfig} className="h-56 w-full">
                <AreaChart
                  data={dailyData}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={
                          activeTab === "vendas" ? "#111827" : "#6366f1"
                        }
                        stopOpacity={0.12}
                      />
                      <stop
                        offset="95%"
                        stopColor={
                          activeTab === "vendas" ? "#111827" : "#6366f1"
                        }
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f5f5f5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    dy={8}
                    minTickGap={28}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    tickFormatter={(v) =>
                      activeTab === "vendas"
                        ? `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                        : String(v)
                    }
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey={activeTab === "vendas" ? "revenue" : "orders"}
                    stroke={activeTab === "vendas" ? "#111827" : "#6366f1"}
                    strokeWidth={2}
                    fill="url(#grad1)"
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-56 flex flex-col items-center justify-center bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                <TrendingUp size={32} className="text-neutral-200 mb-2" />
                <p className="text-sm text-neutral-400">Sem dados no período</p>
              </div>
            )}
          </div>

          {/* Top Regions Pie – 1 col */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-6">
            <SectionHeader
              icon={MapPin}
              title="Regiões"
              iconColor="text-indigo-500"
            />

            {trendRegions.length > 0 ? (
              <>
                <ChartContainer config={revenueConfig} className="h-40 w-full">
                  <PieChart>
                    <Pie
                      data={trendRegions.map((r: any) => ({
                        name: r.region,
                        value: r.total_access,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {trendRegions.map((_: any, i: number) => (
                        <Cell
                          key={i}
                          fill={regionColors[i % regionColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [v, n]} />
                  </PieChart>
                </ChartContainer>

                <div className="space-y-2 mt-2">
                  {trendRegions.slice(0, 4).map((r: any, i: number) => (
                    <div
                      key={r.region}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background: regionColors[i % regionColors.length],
                        }}
                      />
                      <span className="text-neutral-600 truncate flex-1">
                        {r.region}
                      </span>
                      <span className="font-semibold text-neutral-800">
                        {r.total_access}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-56 flex items-center justify-center text-neutral-400 text-sm">
                Sem dados de região
              </div>
            )}
          </div>
        </div>

        {/* ── AI Insights + Top Selling ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* AI Insights – 3 cols */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-neutral-100 p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-500" />
                Insights da IA
              </h3>
              <Button
                onClick={generateAI}
                disabled={loadingAI}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 rounded-xl"
              >
                <RotateCw
                  size={13}
                  className={loadingAI ? "animate-spin" : ""}
                />
                {loadingAI ? "Analisando..." : "Atualizar"}
              </Button>
            </div>

            {aiSummary ? (
              <div className="overflow-y-auto max-h-80 pr-1 custom-scrollbar">
                {renderMarkdown(aiSummary)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400">
                  <Sparkles size={26} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-700">
                    Nenhuma análise gerada
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Clique para analisar sua loja com IA
                  </p>
                </div>
                <Button
                  onClick={generateAI}
                  disabled={loadingAI}
                  className="bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl text-sm gap-2"
                >
                  <Zap size={14} />
                  Gerar Análise
                </Button>
              </div>
            )}

            <div className="absolute -top-10 -right-10 w-36 h-36 bg-indigo-500/5 rounded-full pointer-events-none" />
          </div>

          {/* Top Selling – 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-100 p-6">
            <SectionHeader
              icon={Package}
              title="Mais vendidos"
              iconColor="text-emerald-500"
            />

            {topSelling.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-neutral-400 text-sm">
                Nenhum produto vendido
              </div>
            ) : (
              <div className="space-y-3">
                {topSelling.slice(0, 6).map((item, idx) => (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-3 group"
                  >
                    <span className="text-xs font-bold text-neutral-300 w-4 shrink-0 text-right">
                      {idx + 1}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-neutral-50 border border-neutral-100 overflow-hidden shrink-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300">
                          <ImageIcon size={13} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {item.total_sold} vendas
                      </p>
                    </div>
                    {idx === 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                        #1
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Trends Tables ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Most sold */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-6">
            <SectionHeader
              icon={TrendingUp}
              title="Produtos mais vendidos"
              badge="30d"
              iconColor="text-emerald-500"
            />
            <div className="rounded-xl border border-neutral-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50 border-b border-neutral-100">
                    <TableHead className="text-xs font-semibold text-neutral-500">
                      Produto
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-neutral-500">
                      Vendas
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trendProductsSold.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-neutral-400 text-sm py-6"
                      >
                        Sem dados
                      </TableCell>
                    </TableRow>
                  ) : (
                    trendProductsSold.slice(0, 6).map((item: any) => (
                      <TableRow
                        key={item.product_id}
                        className="hover:bg-neutral-50/50 transition-colors"
                      >
                        <TableCell className="font-medium text-neutral-800 text-sm">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-right text-neutral-600 text-sm font-semibold">
                          {item.total_sold}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Most viewed */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-6">
            <SectionHeader
              icon={Activity}
              title="Produtos mais vistos"
              badge="30d"
              iconColor="text-blue-500"
            />
            <div className="rounded-xl border border-neutral-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50 border-b border-neutral-100">
                    <TableHead className="text-xs font-semibold text-neutral-500">
                      Produto
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-neutral-500">
                      Visitas
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trendProductsViewed.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-neutral-400 text-sm py-6"
                      >
                        Sem dados
                      </TableCell>
                    </TableRow>
                  ) : (
                    trendProductsViewed.slice(0, 6).map((item: any) => (
                      <TableRow
                        key={item.product_id}
                        className="hover:bg-neutral-50/50 transition-colors"
                      >
                        <TableCell className="font-medium text-neutral-800 text-sm">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-right text-neutral-600 text-sm font-semibold">
                          {item.total_views}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* ── Bottom Row: Locations + Legacy Tools ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Active Locations – 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-100 p-6">
            <SectionHeader
              icon={MapPin}
              title="Localizações ativas"
              iconColor="text-indigo-500"
            />
            <div className="rounded-xl border border-neutral-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50 border-b border-neutral-100">
                    <TableHead className="text-xs font-semibold text-neutral-500">
                      Local
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-neutral-500">
                      Acessos
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trendIPs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-neutral-400 text-sm py-6"
                      >
                        Sem dados
                      </TableCell>
                    </TableRow>
                  ) : (
                    trendIPs.slice(0, 6).map((item: any) => (
                      <TableRow
                        key={item.ip}
                        className="hover:bg-neutral-50/50 transition-colors"
                      >
                        <TableCell className="font-medium text-neutral-800 text-sm">
                          {item.location || item.ip || "Indisponível"}
                        </TableCell>
                        <TableCell className="text-right text-neutral-600 text-sm font-semibold">
                          {item.total_access}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Legacy Tools – 3 cols */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-neutral-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Ferramentas legadas
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Mantidas para compatibilidade histórica
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                Legado
              </span>
            </div>

            <div className="space-y-2">
              {deprecatedConfigs.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50 transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
                    <item.icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-800">
                      {item.title}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight
                    size={15}
                    className="text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0"
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
