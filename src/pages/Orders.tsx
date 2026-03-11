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
  Edit3,
  Image as ImageIcon,
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
import { parseCustomizationData } from "../utils/customization";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { Button } from "@/components/ui/button";

type OrderSummary = Order & {
  items_count?: number;
  items?: Order["items"];
};

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

const getCustomizationSummary = (customization: {
  customization_type?: string;
  value?: string | null;
}) => {
  const data = parseCustomizationData(customization.value);
  const type = customization.customization_type || data.customization_type;

  switch (type) {
    case "TEXT":
    case "TEXT_INPUT":
      return data.text ? `Texto: ${String(data.text)}` : "Texto não informado";
    case "MULTIPLE_CHOICE":
      return (
        data.selected_option_label ||
        data.selected_option ||
        "Opção não selecionada"
      );
    case "IMAGES": {
      const photos = Array.isArray(data.photos) ? data.photos : [];
      return photos.length > 0 ? `${photos.length} foto(s)` : "Sem fotos anexadas";
    }
    case "DYNAMIC_LAYOUT":
      return (
        data.selected_item_label ||
        (typeof data.selected_item === "string"
          ? data.selected_item
          : data.selected_item?.selected_item) ||
        "Design personalizado"
      );
    default:
      return "Personalização registrada";
  }
};

const getItemCount = (order: OrderSummary) => {
  if (typeof order.items_count === "number") return order.items_count;
  if (Array.isArray(order.items)) return order.items.length;
  return 0;
};

const resolveClientPhone = (order?: Order | null) => {
  if (!order) return "";
  return onlyDigits(order.user?.phone || order.recipient_phone || "");
};

export function Orders() {
  const api = useApi();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [orderDetails, setOrderDetails] = useState<Record<string, Order>>({});
  const [detailsLoadingMap, setDetailsLoadingMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === "all" ? { summary: true } : { status: filter, summary: true };
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

  const fetchOrderDetails = useCallback(
    async (orderId: string) => {
      if (orderDetails[orderId]) return;

      setDetailsLoadingMap((prev) => ({ ...prev, [orderId]: true }));
      try {
        const details = await api.getOrder(orderId);
        setOrderDetails((prev) => ({ ...prev, [orderId]: details }));
      } catch (e) {
        toast.error(extractErrorMessage(e, "Erro ao carregar detalhes do pedido"));
      } finally {
        setDetailsLoadingMap((prev) => ({ ...prev, [orderId]: false }));
      }
    },
    [api, orderDetails],
  );

  const handleToggleOrder = async (orderId: string) => {
    const isClosing = expandedId === orderId;
    setExpandedId(isClosing ? null : orderId);

    if (!isClosing) {
      await fetchOrderDetails(orderId);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await api.updateOrderStatus(orderId, status, { notifyCustomer: true });
      toast.success("Status atualizado com sucesso!");
      await fetchOrders();

      if (orderDetails[orderId]) {
        const details = await api.getOrder(orderId);
        setOrderDetails((prev) => ({ ...prev, [orderId]: details }));
      }
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
            Lista rápida com detalhes carregados apenas quando necessário.
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
            Buscando pedidos...
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
              Tente ajustar seus filtros ou aguarde novas vendas.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const details = orderDetails[order.id];
            const activeOrder: OrderSummary = details || order;
            const detailsLoading = detailsLoadingMap[order.id];
            const itemCount = getItemCount(activeOrder);

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                <div
                  onClick={() => void handleToggleOrder(order.id)}
                  className="p-4 cursor-pointer hover:bg-neutral-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={clsx(
                          "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0",
                          activeOrder.status === "PAID"
                            ? "bg-emerald-50 text-emerald-600"
                            : activeOrder.status === "PENDING"
                              ? "bg-amber-50 text-amber-600"
                              : activeOrder.status === "CANCELED"
                                ? "bg-red-50 text-red-600"
                                : "bg-neutral-50 text-neutral-600",
                        )}
                      >
                        {activeOrder.status === "DELIVERED" ? (
                          <CheckCircle2 size={20} />
                        ) : activeOrder.status === "CANCELED" ? (
                          <XCircle size={20} />
                        ) : (
                          <Package size={20} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tight">
                            #{shortId(activeOrder.id)}
                          </span>
                          <span className="text-neutral-200 text-xs">•</span>
                          <span className="text-[10px] font-medium text-neutral-500">
                            {formatDate(activeOrder.created_at)}
                          </span>
                        </div>

                        <h4 className="font-bold text-neutral-950 text-base mb-1 truncate">
                          {activeOrder.user?.name || "Cliente Convidado"}
                        </h4>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={clsx(
                              "inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border",
                              STATUS_COLORS[activeOrder.status],
                            )}
                          >
                            {STATUS_LABELS[activeOrder.status]}
                          </span>

                          <div className="flex items-center gap-1">
                            <Package size={12} className="text-neutral-400" />
                            <span className="text-[10px] font-medium text-neutral-600">
                              {itemCount} {itemCount === 1 ? "item" : "itens"}
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
                          {formatCurrency(activeOrder.grand_total || activeOrder.total)}
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
                      transition={{ duration: 0.25 }}
                      className="border-t border-neutral-50"
                    >
                      {detailsLoading && !details ? (
                        <div className="p-8 flex items-center justify-center gap-2 text-sm text-neutral-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Carregando detalhes do pedido...
                        </div>
                      ) : !details ? (
                        <div className="p-8 text-sm text-red-500">
                          Não foi possível carregar os detalhes desse pedido.
                        </div>
                      ) : (
                        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="space-y-5">
                            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3">
                              <h5 className="text-xs font-bold text-neutral-950 flex items-center gap-2">
                                <MessageSquare size={12} /> Dados do Cliente
                              </h5>
                              <div className="space-y-2 text-sm text-neutral-700">
                                <p className="font-semibold text-neutral-900">
                                  {details.user?.name || "Cliente convidado"}
                                </p>
                                {details.user?.email && <p>{details.user.email}</p>}
                                {details.user?.phone && (
                                  <a
                                    href={`https://wa.me/55${onlyDigits(details.user.phone)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                                  >
                                    <Phone size={14} /> {details.user.phone}
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3">
                              <h5 className="text-xs font-bold text-neutral-950 flex items-center gap-2">
                                <MapPin size={12} /> Entrega
                              </h5>
                              <p className="text-xs text-neutral-700 leading-relaxed">
                                {details.delivery_address || "Retirada na Loja"}
                              </p>
                              <p className="text-xs text-neutral-500 inline-flex items-center gap-1">
                                <Calendar size={12} />
                                {details.created_at ? formatDate(details.created_at) : "N/A"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3">
                              <h5 className="text-xs font-bold text-neutral-950">Ações</h5>
                              <div className="flex flex-wrap gap-2">
                                {STATUS_FLOW.map((status) => (
                                  <Button
                                    key={status}
                                    disabled={updatingId === details.id || details.status === status}
                                    onClick={() => handleUpdateStatus(details.id, status)}
                                    className={clsx(
                                      "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm",
                                      details.status === status
                                        ? "bg-neutral-100 text-neutral-600 cursor-default"
                                        : "bg-white border border-neutral-100 text-neutral-900 hover:bg-neutral-50",
                                    )}
                                  >
                                    {updatingId === details.id && details.status !== status
                                      ? "..."
                                      : STATUS_LABELS[status]}
                                  </Button>
                                ))}
                                {details.status !== "CANCELED" && (
                                  <Button
                                    onClick={() => handleUpdateStatus(details.id, "CANCELED")}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-neutral-100 text-neutral-400 hover:bg-neutral-50"
                                  >
                                    Cancelar
                                  </Button>
                                )}
                                {details.status === "CANCELED" && (
                                  <Button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm("Tem certeza que deseja excluir permanentemente este pedido?")) {
                                        try {
                                          await api.deleteOrder(details.id);
                                          toast.success("Pedido excluído com sucesso");
                                          setExpandedId((prev) => (prev === details.id ? null : prev));
                                          setOrderDetails((prev) => {
                                            const next = { ...prev };
                                            delete next[details.id];
                                            return next;
                                          });
                                          await fetchOrders();
                                        } catch (e) {
                                          toast.error(extractErrorMessage(e, "Erro ao excluir pedido"));
                                        }
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                                  >
                                    Excluir
                                  </Button>
                                )}
                              </div>

                              {resolveClientPhone(details) && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const phone = resolveClientPhone(details);
                                    window.open(`/service?phone=${encodeURIComponent(phone)}`, "_blank");
                                  }}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100"
                                >
                                  <MessageCircle size={14} />
                                  Abrir Sessão do Cliente
                                </Button>
                              )}

                              {details.google_drive_folder_url && (
                                <a
                                  href={details.google_drive_folder_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                                >
                                  Arquivos no Drive
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="lg:col-span-2 space-y-4">
                            <h5 className="text-xs font-bold text-neutral-950">Itens e Revisão de Customização</h5>
                            {details.items?.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="rounded-2xl border border-neutral-200 bg-white overflow-hidden"
                              >
                                <div className="p-4 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
                                  <div className="flex gap-3">
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
                                      <h6 className="font-bold text-neutral-950 text-sm">
                                        {item.product?.name || "Produto"}
                                      </h6>
                                      <p className="text-[11px] text-neutral-600 font-medium">
                                        Quantidade: {item.quantity} | Unitário: {formatCurrency(item.price)}
                                      </p>
                                    </div>
                                    <span className="text-sm font-black text-neutral-950 shrink-0">
                                      {formatCurrency(item.price * item.quantity)}
                                    </span>
                                  </div>
                                </div>

                                <div className="p-4 space-y-3">
                                  {!item.customizations || item.customizations.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-xs text-neutral-500">
                                      Sem personalizações neste item.
                                    </div>
                                  ) : (
                                    item.customizations.map((cust: any) => (
                                      <div key={cust.id} className="rounded-xl border border-neutral-100 bg-neutral-50/40 p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-xs font-semibold text-neutral-900 inline-flex items-center gap-1.5">
                                            <Edit3 size={12} />
                                            {cust.title || "Personalização"}
                                          </p>
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                            Revisada
                                          </span>
                                        </div>
                                        <p className="text-xs text-neutral-600 inline-flex items-center gap-1.5">
                                          <ImageIcon size={12} />
                                          {getCustomizationSummary(cust)}
                                        </p>
                                        <CustomizationDisplay customization={cust} />
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
