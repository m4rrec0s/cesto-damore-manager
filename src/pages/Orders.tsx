import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ChevronDown,
  Phone,
  MapPin,
  Calendar,
  Package,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  Filter,
} from "lucide-react";
import { useApi } from "../services/api";
import type { Order, OrderStatus } from "../types";
import { CustomizationDisplay } from "../components/CustomizationDisplay";
import {
  formatCurrency,
  formatDate,
  shortId,
  onlyDigits,
  extractErrorMessage,
} from "../utils/format";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  PAID: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SHIPPED: "bg-blue-100 text-blue-700 border-blue-200",
  DELIVERED: "bg-neutral-100 text-neutral-700 border-neutral-200",
  CANCELED: "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_FLOW: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED"];

export function Orders() {
  const api = useApi();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === "all" ? {} : { status: filter };
      const response = await api.getOrders(params);
      setOrders(response.data.data || []);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao carregar pedidos"));
    } finally {
      setLoading(false);
    }
  }, [filter, api]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await api.updateOrderStatus(orderId, status, { notifyCustomer: true });
      toast.success("Status atualizado com sucesso!");
      fetchOrders();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao atualizar status"));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-neutral-950">
            Gerenciamento de Pedidos
          </h2>
          <p className="text-neutral-600/70 font-medium">
            Acompanhe e atualize o status dos pedidos em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchOrders}
            className="p-3 bg-white border border-neutral-100 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-colors shadow-sm"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </Button>
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              size={18}
            />
            <select
              title="filtrar pedidos"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-neutral-100 rounded-xl text-neutral-900 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500/20 appearance-none"
            >
              <option value="all">Todos os Pedidos</option>
              <option value="PENDING">Pendentes</option>
              <option value="PAID">Pagos</option>
              <option value="SHIPPED">Enviados</option>
              <option value="DELIVERED">Entregues</option>
              <option value="CANCELED">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={48} className="animate-spin text-neutral-500" />
          <p className="text-neutral-900/60 font-medium italic">
            Buscando pedidos incríveis...
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-100 p-20 text-center flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-400">
            <Package size={40} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-neutral-950">
              Nenhum pedido encontrado
            </h3>
            <p className="text-neutral-600/60 font-medium">
              Tente ajustar seus filtros ou aguarde novas vendas!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
            >
              <div
                onClick={() =>
                  setExpandedId(expandedId === order.id ? null : order.id)
                }
                className="p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={clsx(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                      order.status === "PAID"
                        ? "bg-emerald-50 text-emerald-600"
                        : order.status === "PENDING"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-neutral-50 text-neutral-600"
                    )}
                  >
                    {order.status === "DELIVERED" ? (
                      <CheckCircle2 size={24} />
                    ) : order.status === "CANCELED" ? (
                      <XCircle size={24} />
                    ) : (
                      <Package size={24} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-tighter">
                        #{shortId(order.id)}
                      </span>
                      <span className="text-neutral-200">•</span>
                      <span className="text-xs font-medium text-neutral-600">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                    <h4 className="font-bold text-neutral-950 text-lg">
                      {order.user?.name || "Cliente Convidado"}
                    </h4>
                    <span
                      className={clsx(
                        "inline-block px-3 py-1 mt-1 rounded-full text-[10px] font-bold border",
                        STATUS_COLORS[order.status]
                      )}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 md:gap-10">
                  <div className="text-right">
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                      Total
                    </p>
                    <p className="text-xl font-black text-neutral-950">
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                  <ChevronDown
                    size={24}
                    className={clsx(
                      "text-neutral-300 transition-transform duration-300 hidden md:block",
                      expandedId === order.id && "rotate-180"
                    )}
                  />
                </div>
              </div>

              <AnimatePresence>
                {expandedId === order.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-neutral-50"
                  >
                    <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                      <div className="space-y-8">
                        <div>
                          <h5 className="text-sm font-bold text-neutral-950 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                            Detalhes do Cliente
                          </h5>
                          <div className="space-y-3 pl-3.5">
                            <div className="flex items-center gap-3 text-neutral-900/70 font-medium">
                              <MessageSquare
                                size={16}
                                className="text-neutral-400"
                              />
                              <span>{order.user?.email}</span>
                            </div>
                            {order.user?.phone && (
                              <div className="flex items-center gap-3 text-neutral-900/70 font-medium">
                                <Phone size={16} className="text-neutral-400" />
                                <a
                                  href={`https://wa.me/55${onlyDigits(
                                    order.user.phone
                                  )}`}
                                  target="_blank"
                                  className="hover:text-neutral-600 transition-colors underline decoration-neutral-200 underline-offset-4"
                                >
                                  {order.user.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-bold text-neutral-950 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                            Informações de Entrega
                          </h5>
                          <div className="space-y-3 pl-3.5">
                            <div className="flex items-start gap-3 text-neutral-900/70 font-medium">
                              <MapPin
                                size={16}
                                className="text-neutral-400 mt-1"
                              />
                              <span>
                                {order.delivery_address || "Retirada na Loja"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-neutral-900/70 font-medium">
                              <Calendar
                                size={16}
                                className="text-neutral-400"
                              />
                              <span>
                                {order.created_at
                                  ? formatDate(order.created_at)
                                  : "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-bold text-neutral-950 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                            Ações Rápidas
                          </h5>
                          <div className="flex flex-wrap gap-3 pl-3.5">
                            {STATUS_FLOW.map((status) => (
                              <button
                                key={status}
                                disabled={
                                  updatingId === order.id ||
                                  order.status === status
                                }
                                onClick={() =>
                                  handleUpdateStatus(order.id, status)
                                }
                                className={clsx(
                                  "px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm",
                                  order.status === status
                                    ? "bg-neutral-100 text-neutral-600 cursor-default"
                                    : "bg-white border border-neutral-100 text-neutral-900 hover:bg-neutral-50"
                                )}
                              >
                                {updatingId === order.id &&
                                  order.status !== status
                                  ? "..."
                                  : STATUS_LABELS[status]}
                              </button>
                            ))}
                            {order.status !== "CANCELED" && (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(order.id, "CANCELED")
                                }
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-neutral-100 text-neutral-400 hover:bg-neutral-50"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-bold text-neutral-950 mb-4 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                          Itens e Customizações
                        </h5>
                        <div className="space-y-6">
                          {order.items?.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="bg-neutral-50/50 rounded-2xl p-5 border border-neutral-100/50"
                            >
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h6 className="font-bold text-neutral-950">
                                    {item.product?.name || "Produto"}
                                  </h6>
                                  <p className="text-xs text-neutral-600 font-medium">
                                    Qtd: {item.quantity} •{" "}
                                    {formatCurrency(item.price)}
                                  </p>
                                </div>
                                <span className="text-sm font-black text-neutral-950">
                                  {formatCurrency(item.price * item.quantity)}
                                </span>
                              </div>

                              {item.customizations &&
                                item.customizations.length > 0 && (
                                  <div className="space-y-3 mt-4">
                                    {item.customizations.map((cust: any) => (
                                      <CustomizationDisplay
                                        key={cust.id}
                                        customization={cust}
                                      />
                                    ))}
                                  </div>
                                )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
