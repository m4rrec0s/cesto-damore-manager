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
  MessageCircle,
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
                className="p-4 cursor-pointer hover:bg-neutral-50/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0",
                        order.status === "PAID"
                          ? "bg-emerald-50 text-emerald-600"
                          : order.status === "PENDING"
                            ? "bg-amber-50 text-amber-600"
                            : order.status === "CANCELED"
                              ? "bg-red-50 text-red-600"
                              : "bg-neutral-50 text-neutral-600",
                      )}
                    >
                      {order.status === "DELIVERED" ? (
                        <CheckCircle2 size={20} />
                      ) : order.status === "CANCELED" ? (
                        <XCircle size={20} />
                      ) : (
                        <Package size={20} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tight">
                          #{shortId(order.id)}
                        </span>
                        <span className="text-neutral-200 text-xs">•</span>
                        <span className="text-[10px] font-medium text-neutral-500">
                          {formatDate(order.created_at)}
                        </span>
                      </div>

                      <h4 className="font-bold text-neutral-950 text-base mb-1 truncate">
                        {order.user?.name || "Cliente Convidado"}
                      </h4>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={clsx(
                            "inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border",
                            STATUS_COLORS[order.status],
                          )}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>

                        <div className="flex items-center gap-1">
                          <Package size={12} className="text-neutral-400" />
                          <span className="text-[10px] font-medium text-neutral-600">
                            {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'itens'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-0.5">
                        Total
                      </p>
                      <p className="text-xl font-black text-neutral-950">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                    <ChevronDown
                      size={20}
                      className={clsx(
                        "text-neutral-300 transition-transform duration-300",
                        expandedId === order.id && "rotate-180",
                      )}
                    />
                  </div>
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
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="space-y-5">
                        <div>
                          <h5 className="text-xs font-bold text-neutral-950 mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                            Detalhes do Cliente
                          </h5>
                          <div className="space-y-2 pl-3">
                            <div className="flex items-center gap-2 text-neutral-900/70 font-medium text-sm">
                              <MessageSquare
                                size={14}
                                className="text-neutral-400"
                              />
                              <span>{order.user?.email}</span>
                            </div>
                            {order.user?.phone && (
                              <div className="flex items-center gap-2 text-neutral-900/70 font-medium text-sm">
                                <Phone size={14} className="text-neutral-400" />
                                <a
                                  href={`https://wa.me/55${onlyDigits(
                                    order.user.phone,
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
                          <h5 className="text-xs font-bold text-neutral-950 mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                            Informações de Entrega
                          </h5>
                          <div className="space-y-2 pl-3">
                            <div className="flex items-start gap-2 text-neutral-900/70 font-medium text-sm">
                              <MapPin
                                size={14}
                                className="text-neutral-400 mt-0.5"
                              />
                              <span className="text-xs">
                                {order.delivery_address || "Retirada na Loja"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-neutral-900/70 font-medium text-sm">
                              <Calendar
                                size={14}
                                className="text-neutral-400"
                              />
                              <span className="text-xs">
                                {order.created_at
                                  ? formatDate(order.created_at)
                                  : "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-xs font-bold text-neutral-950 mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                            Ações Rápidas
                          </h5>
                          <div className="flex flex-wrap gap-2 pl-3">
                            {STATUS_FLOW.map((status) => (
                              <Button
                                key={status}
                                disabled={
                                  updatingId === order.id ||
                                  order.status === status
                                }
                                onClick={() =>
                                  handleUpdateStatus(order.id, status)
                                }
                                className={clsx(
                                  "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm",
                                  order.status === status
                                    ? "bg-neutral-100 text-neutral-600 cursor-default"
                                    : "bg-white border border-neutral-100 text-neutral-900 hover:bg-neutral-50",
                                )}
                              >
                                {updatingId === order.id &&
                                  order.status !== status
                                  ? "..."
                                  : STATUS_LABELS[status]}
                              </Button>
                            ))}
                            {order.status !== "CANCELED" && (
                              <Button
                                onClick={() =>
                                  handleUpdateStatus(order.id, "CANCELED")
                                }
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-neutral-100 text-neutral-400 hover:bg-neutral-50"
                              >
                                Cancelar
                              </Button>
                            )}
                            {order.status === "CANCELED" && (
                              <Button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm("Tem certeza que deseja excluir permanentemente este pedido?")) {
                                    try {
                                      await api.deleteOrder(order.id);
                                      toast.success("Pedido excluído com sucesso");
                                      fetchOrders();
                                    } catch (e) {
                                      toast.error("Erro ao excluir pedido");
                                    }
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                              >
                                Excluir
                              </Button>
                            )}
                          </div>

                          {order.user?.phone && (
                            <div className="mt-4 pl-3">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const phone = order.user?.phone;
                                  if (phone) {
                                    const formattedPhone = `55${onlyDigits(phone)}`;
                                    window.open(`/service?phone=${formattedPhone}`, '_blank');
                                  }
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100"
                              >
                                <MessageCircle size={14} />
                                Ver Chat do Cliente
                              </Button>
                            </div>
                          )}

                          {order.google_drive_folder_url && (
                            <div className="mt-4 pl-3">
                              <a
                                href={order.google_drive_folder_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" /><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" /><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 5.85-10.15c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 10.15z" fill="#ea4335" /><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" /><path d="m59.8 53h-27.5l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.5c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" /><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8h29.75z" fill="#ffba00" /></svg>
                                Arquivos no Drive
                              </a>
                              <p className="text-[9px] text-neutral-400 mt-0.5">Imagens e arquivos de personalização</p>
                            </div>
                          )}

                        </div>
                      </div>

                      <div className="lg:col-span-2">
                        <h5 className="text-xs font-bold text-neutral-950 mb-3 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                          Itens do Pedido
                        </h5>
                        <div className="space-y-3">
                          {order.items?.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="bg-neutral-50/50 rounded-xl p-4 border border-neutral-100/50"
                            >
                              <div className="flex gap-3 mb-3">
                                {item.product?.image_url && (
                                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border border-neutral-200 shrink-0">
                                    <img
                                      src={item.product.image_url}
                                      alt={item.product.name}
                                      className="w-full h-full object-contain p-1"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h6 className="font-bold text-neutral-950 text-sm mb-0.5">
                                        {item.product?.name || "Produto"}
                                      </h6>
                                      <p className="text-[10px] text-neutral-600 font-medium">
                                        Quantidade: {item.quantity} • Unitário: {formatCurrency(item.price)}
                                      </p>
                                    </div>
                                    <span className="text-sm font-black text-neutral-950 shrink-0">
                                      {formatCurrency(item.price * item.quantity)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {item.customizations &&
                                item.customizations.length > 0 && (
                                  <div className="space-y-2 mt-3 pt-3 border-t border-neutral-200">
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Personalizações</p>
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
