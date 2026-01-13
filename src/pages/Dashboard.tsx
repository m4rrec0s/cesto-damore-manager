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
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.getBusinessStatus(60);
      const statusData = res.data || res;
      setStats(statusData);
      setTopSelling(statusData.top_products || []);

      // Fetch existing AI summary on load
      try {
        const aiData = await api.getAISummary(false);
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

  const generateAI = async () => {
    try {
      setLoadingAI(true);
      const data = await api.getAISummary(true);
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
      isCurrency: true
    },
    {
      label: "Pedidos Aprovados",
      value: stats?.totals?.approved_orders || 0,
    },
    {
      label: "Ticket Médio",
      value: stats?.metrics?.averageTicket || 0,
      prefix: "R$ ",
      isCurrency: true
    },
    {
      label: "Conversão",
      value: stats?.metrics?.conversionRate || 0,
      suffix: "%"
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold text-neutral-950 ">Dashboard</h2>
      </div>

      <header className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {statsItems.map((item, idx) => (
          <div
            key={item.label}
            className={`p-6 flex flex-col justify-between min-h-36 rounded-[2rem] shadow-sm relative overflow-hidden ${idx === 0 ? "bg-linear-to-br from-neutral-900 to-neutral-600 text-white" : "bg-white"
              }`}
          >
            <h3 className={`text-sm font-bold uppercase tracking-wider ${idx === 0 ? "text-neutral-400" : "text-neutral-500"}`}>
              {item.label}
            </h3>
            <div className="mt-4">
              <p className={`text-3xl font-black ${idx === 0 ? "text-white" : "text-neutral-950"}`}>
                {item.isCurrency ? (
                  item.value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                ) : (
                  `${item.value}${item.suffix || ""}`
                )}
              </p>
            </div>
            {idx === 0 && (
              <>
                <div className="absolute -right-20 -top-20 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
              </>
            )}
          </div>
        ))}
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-8 rounded-[2rem] shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-neutral-900">
              Desempenho de Vendas (Diário)
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Últimos {stats?.period?.days || 30} dias</span>
            </div>
          </div>

          {(stats?.daily_data?.length > 0 && stats?.daily_data?.some((d: any) => d.total_sales > 0)) ? (
            <ChartContainer config={revenueConfig} className="h-80 w-full">
              <AreaChart
                data={stats?.daily_data?.map((d: any) => ({
                  date: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
                  revenue: d.total_sales
                })) || []}
                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#262626" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#262626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  dy={10}
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
                  stroke="#262626"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  dot={{ r: 4, fill: "#262626", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="h-80 w-full flex flex-col items-center justify-center bg-neutral-50 rounded-[1.5rem] border border-dashed border-neutral-200">
              <TrendingUp className="w-10 h-10 text-neutral-300 mb-3" />
              <p className="text-neutral-500 font-medium text-sm">Nenhum dado de faturamento encontrado para este período.</p>
              <p className="text-neutral-400 text-xs mt-1">As vendas aprovadas aparecerão aqui automaticamente.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white p-8 rounded-[2rem] shadow-sm border border-neutral-100 flex flex-col justify-between relative overflow-hidden group">
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-neutral-400" />
                Resumo da Semana (IA)
              </h3>
            </div>

            {aiSummary ? (
              <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto pr-2 scrollbar-hide">
                {aiSummary}
              </div>
            ) : (
              <div className="h-56 flex flex-col items-center justify-center text-center space-y-4">
                <p className="text-sm text-neutral-400">
                  Gere um resumo estratégico baseado nos dados reais da sua loja.
                </p>
                <button
                  onClick={generateAI}
                  disabled={loadingAI}
                  className="px-6 py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingAI ? <RotateCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Gerar Resumo
                </button>
              </div>
            )}
          </div>

          {aiSummary && (
            <button
              onClick={generateAI}
              disabled={loadingAI}
              className="mt-6 text-xs font-bold text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-2"
            >
              {loadingAI ? "Atualizando..." : "Recalcular com novos dados"}
            </button>
          )}

          <div className="absolute bottom-0 right-0 w-32 h-32 bg-neutral-50 rounded-full blur-3xl z-0 opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
      </section>

      <section className="space-y-6">
        <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
          <div className="p-8 border-b border-neutral-100 flex justify-between items-center">
            <h3 className="text-2xl font-bold text-neutral-950">
              Produtos Mais Vendidos
            </h3>
            <Button
              onClick={loadDashboardData}
              disabled={loading}
              className="p-2 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              <RotateCw
                size={20}
                className={loading ? "animate-spin" : ""}
              />
            </Button>
          </div>

          {topSelling.length === 0 ? (
            <div className="p-12 text-center text-neutral-400">
              <p>Nenhum dado de vendas disponível ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-neutral-100">
                  <TableHead className="pl-8">Produto</TableHead>
                  <TableHead>Vendas</TableHead>
                  <TableHead className="text-right pr-8">Faturamento (Est.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSelling.map((item) => (
                  <TableRow
                    key={item.product_id}
                    className="border-neutral-100 hover:bg-neutral-50/30 transition-colors"
                  >
                    <TableCell className="pl-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-neutral-100 overflow-hidden border border-neutral-200 shrink-0">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-300">
                              <ImageIcon size={20} />
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-neutral-900">{item.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-neutral-600">
                        {item.total_sold} unidades
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-8 font-black text-neutral-950">
                      {item.revenue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
