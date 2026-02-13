import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Sparkles,
  Image as ImageIcon,
  BotMessageSquare,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "../services/api";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Pie,
  PieChart,
  CartesianGrid,
  Tooltip,
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
import type { ChartConfig } from "../components/ui/chart";

const revenueConfig = {
  revenue: {
    label: "Receita",
    color: "var(--neutral-800)",
  },
} satisfies ChartConfig;

export function Dashboard() {
  const api = useApi();
  const [stats, setStats] = useState<any>(null);
  const [topSelling, setTopSelling] = useState<any[]>([]);
  const [trendSummary, setTrendSummary] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statusRes, trendRes] = await Promise.all([
        api.getBusinessStatus(60),
        api.getTrendSummary(),
      ]);
      const statusData = statusRes.data || statusRes;
      setStats(statusData);
      setTopSelling(statusData.top_products || []);
      setTrendSummary(trendRes);

      // Fetch existing AI summary on load
      try {
        const aiData = await api.getAiSummary(false);
        if (aiData && aiData.summary) {
          setAiSummary(aiData.summary);
        }
      } catch (aiErr) {
        console.error("Error fetching AI summary on load", aiErr);
      }
    } catch (e) {
      console.error("Error fetching dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  /* ... imports ... */
  const generateAI = async () => {
    try {
      setLoadingAI(true);
      const data = await api.getAiSummary(true);
      if (data && data.summary) {
        setAiSummary(data.summary);
        toast.success("Resumo estratégico atualizado!");
      }
    } catch (e) {
      toast.error("Erro ao gerar resumo de IA");
    } finally {
      setLoadingAI(false);
    }
  };

  const statsItems = [
    {
      label: "Faturamento (30d)",
      value: stats?.totals?.total_sales || 0,
      prefix: "R$ ",
      isCurrency: true,
      description: "Vendas aprovadas",
    },
    {
      label: "Pedidos Aprovados",
      value: stats?.totals?.approved_orders || 0,
      description: "Total no período",
    },
    {
      label: "Ticket Médio",
      value: stats?.metrics?.averageTicket || 0,
      prefix: "R$ ",
      isCurrency: true,
      description: "Média por pedido",
    },
    {
      label: "Conversão",
      value: stats?.metrics?.conversionRate || 0,
      suffix: "%",
      description: "Pedidos / Total",
    },
  ];

  const monitoringItems = [
    {
      label: "Sessões Ativas",
      value: stats?.metrics?.activeSessions || 0,
      icon: BotMessageSquare,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Follow-ups Abertos",
      value: stats?.metrics?.openFollowUps || 0,
      icon: RefreshCw,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      label: "Clientes Totais",
      value: stats?.metrics?.totalClients || 0,
      icon: UserIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
  ];

  // Simple Markdown renderer (bold and headers)
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      // Headers
      if (line.startsWith("### "))
        return (
          <h4
            key={i}
            className="text-base font-bold mt-4 mb-2 text-neutral-800"
          >
            {line.replace("### ", "")}
          </h4>
        );
      if (line.startsWith("## "))
        return (
          <h3
            key={i}
            className="text-lg font-bold mt-5 mb-2 text-neutral-900 border-b pb-1"
          >
            {line.replace("## ", "")}
          </h3>
        );
      if (line.startsWith("# "))
        return (
          <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-neutral-950">
            {line.replace("# ", "")}
          </h2>
        );

      // List items
      if (line.trim().startsWith("- "))
        return (
          <p
            key={i}
            className="text-sm text-neutral-600 mb-1 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-neutral-400 font-medium"
          >
            {processBold(line.replace("- ", ""))}
          </p>
        );

      // Paragraphs
      if (line.trim() === "") return <div key={i} className="h-2"></div>;

      return (
        <p key={i} className="text-sm text-neutral-600 mb-1">
          {processBold(line)}
        </p>
      );
    });
  };

  const processBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="text-neutral-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const trendProductsSold = trendSummary?.top_products_sold || [];
  const trendProductsViewed = trendSummary?.top_products_viewed || [];
  const trendLayoutsViewed = trendSummary?.top_layouts_viewed || [];
  const trendRegions = trendSummary?.top_regions || [];

  const regionColors = [
    "#111827",
    "#1f2937",
    "#374151",
    "#4b5563",
    "#6b7280",
    "#9ca3af",
  ];

  return (
    <div className="space-y-8 p-6 max-w-400 mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-semibold text-neutral-950 mb-1">
          Visão Geral
        </h2>
        <p className="text-neutral-500">
          Acompanhe as métricas e insights da sua loja.
        </p>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsItems.map((item, idx) => (
            <div
              key={item.label}
              className={`p-5 flex-1 flex flex-col justify-between rounded-3xl shadow-sm border border-neutral-100 ${
                idx === 0
                  ? "bg-neutral-900 text-white border-neutral-800"
                  : "bg-white"
              }`}
            >
              <div>
                <h3
                  className={`text-xs font-bold uppercase tracking-wider mb-1 ${idx === 0 ? "text-neutral-400" : "text-neutral-500"}`}
                >
                  {item.label}
                </h3>
                {item.description && (
                  <span
                    className={`text-[10px] ${idx === 0 ? "text-neutral-500" : "text-neutral-400"}`}
                  >
                    {item.description}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p
                  className={`text-2xl font-black ${idx === 0 ? "text-white" : "text-neutral-950"}`}
                >
                  {item.isCurrency
                    ? item.value.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : `${item.value}${item.suffix || ""}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {monitoringItems.map((item) => (
            <div
              key={item.label}
              className="bg-white p-4 rounded-3xl shadow-sm border border-neutral-100 flex items-center gap-4"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}
              >
                <item.icon size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
                  {item.label}
                </p>
                <p className="text-xl font-bold text-neutral-900">
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100 space-y-6">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Desempenho Financeiro
            </h3>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest bg-neutral-50 px-3 py-1 rounded-full border border-neutral-100">
              Últimos {stats?.period?.days || 30} dias
            </span>
          </div>

          {stats?.daily_data?.length > 0 &&
          stats?.daily_data?.some((d: any) => d.total_sales > 0) ? (
            <ChartContainer config={revenueConfig} className="h-72 w-full">
              <AreaChart
                data={
                  stats?.daily_data?.map((d: any) => ({
                    date: new Date(d.date).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    }),
                    revenue: d.total_sales,
                  })) || []
                }
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#171717" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  dy={10}
                  minTickGap={30}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#171717"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="h-72 w-full flex flex-col items-center justify-center bg-neutral-50 rounded-[1.5rem] border border-dashed border-neutral-200">
              <TrendingUp className="w-10 h-10 text-neutral-300 mb-3" />
              <p className="text-neutral-500 font-medium text-sm">
                Sem dados para exibir
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100 flex max-sm:flex-col gap-3 relative overflow-hidden group min-h-100">
          <div className="space-y-4 relative z-10 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                Insights da IA
              </h3>
              <Button
                onClick={generateAI}
                disabled={loadingAI}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:text-neutral-900 rounded-full"
                title="Recalcular"
              >
                <RotateCw
                  className={`w-4 h-4 ${loadingAI ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            {aiSummary ? (
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {renderMarkdown(aiSummary)}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2">
                  <Sparkles className="w-8 h-8" />
                </div>
                <p className="text-sm text-neutral-500 max-w-50">
                  Nenhum insight gerado ainda. Clique abaixo para analisar sua
                  loja.
                </p>
                <Button
                  onClick={generateAI}
                  disabled={loadingAI}
                  className="bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800"
                >
                  Gerar Análise
                </Button>
              </div>
            )}
          </div>
          <div className="sm:w-[30vw] sm:pl-2 max-sm:pt-2 max-sm:border-t sm:border-l border-neutral-200 overflow-hidden">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 px-2">
              Mais Vendidos
            </h3>

            {topSelling.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-sm">
                Nenhum produto vendido
              </div>
            ) : (
              <div className="space-y-4">
                {topSelling.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-xl transition-colors"
                  >
                    <span className="text-xs font-bold text-neutral-400 w-4">
                      {idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden border border-neutral-200 shrink-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300">
                          <ImageIcon size={14} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-neutral-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {item.total_sold} vendas
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl z-0 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl z-0 pointer-events-none" />
        </div>

        {/* Top Products Card */}
      </div>

      <div className="flex flex-col gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Tendencias (30d)
              </h3>
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest bg-neutral-50 px-3 py-1 rounded-full border border-neutral-100">
                Atualizado diariamente
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-neutral-700">
                  Produtos mais vendidos
                </h4>
                <div className="rounded-2xl border border-neutral-100">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trendProductsSold.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="text-center text-neutral-400"
                          >
                            Sem dados de vendas
                          </TableCell>
                        </TableRow>
                      ) : (
                        trendProductsSold.slice(0, 6).map((item: any) => (
                          <TableRow key={item.product_id}>
                            <TableCell className="font-medium text-neutral-900">
                              {item.name}
                            </TableCell>
                            <TableCell className="text-right text-neutral-700">
                              {item.total_sold}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-neutral-700">
                  Produtos mais vistos
                </h4>
                <div className="rounded-2xl border border-neutral-100">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Visitas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trendProductsViewed.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="text-center text-neutral-400"
                          >
                            Sem dados de visitas
                          </TableCell>
                        </TableRow>
                      ) : (
                        trendProductsViewed.slice(0, 6).map((item: any) => (
                          <TableRow key={item.product_id}>
                            <TableCell className="font-medium text-neutral-900">
                              {item.name}
                            </TableCell>
                            <TableCell className="text-right text-neutral-700">
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
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-amber-500" />
              Layouts mais acessados
            </h3>
            <div className="rounded-2xl border border-neutral-100">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Layout</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trendLayoutsViewed.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-neutral-400"
                      >
                        Sem dados de layouts
                      </TableCell>
                    </TableRow>
                  ) : (
                    trendLayoutsViewed.slice(0, 6).map((item: any) => (
                      <TableRow key={item.layout_id}>
                        <TableCell className="font-medium text-neutral-900">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-right text-neutral-700">
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

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-indigo-500" />
              Regioes com mais acessos
            </h3>
            {trendRegions.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-sm">
                Sem dados de acesso
              </div>
            ) : (
              <ChartContainer config={revenueConfig} className="h-72 w-full">
                <PieChart>
                  <Pie
                    data={trendRegions.map((region: any) => ({
                      name: region.region,
                      value: region.total_access,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {trendRegions.map((_: any, idx: number) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={regionColors[idx % regionColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [value, name]}
                  />
                </PieChart>
              </ChartContainer>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">
              Localizacoes mais ativas
            </h3>
            <div className="rounded-2xl border border-neutral-100">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Localizacao</TableHead>
                    <TableHead className="text-right">Acessos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(trendSummary?.top_ips || []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-neutral-400"
                      >
                        Sem dados de IP
                      </TableCell>
                    </TableRow>
                  ) : (
                    trendSummary.top_ips.slice(0, 6).map((item: any) => (
                      <TableRow key={item.ip}>
                        <TableCell className="font-medium text-neutral-900">
                          {item.location ||
                            item.ip ||
                            "Localizacao indisponivel"}
                        </TableCell>
                        <TableCell className="text-right text-neutral-700">
                          {item.total_access}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
