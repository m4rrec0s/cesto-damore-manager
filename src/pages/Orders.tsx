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
  User,
  ZapIcon,
  ArrowUpRight,
  Trash,
  Download,
  Handbag,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

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
  PENDING: "bg-amber-100 text-amber-600 border-amber-200",
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
      return photos.length > 0
        ? `${photos.length} foto(s)`
        : "Sem fotos anexadas";
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

const formatPhone = (raw?: string | null) => {
  const digits = onlyDigits(raw || "");
  if (digits.length < 10) return raw || "";

  const d = digits.length > 11 ? digits.slice(-11) : digits;

  if (d.length === 11) {
    const ddd = d.slice(0, 2);
    const first = d.slice(2, 3);
    const middle = d.slice(3, 7);
    const last = d.slice(7, 11);
    return `(${ddd}) ${first} ${middle}-${last}`;
  }

  const ddd = d.slice(0, 2);
  const first = d.slice(2, 6);
  const last = d.slice(6, 10);
  return `(${ddd}) ${first}-${last}`;
};

export function Orders() {
  const api = useApi();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [orderDetails, setOrderDetails] = useState<Record<string, Order>>({});
  const [detailsLoadingMap, setDetailsLoadingMap] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    orderId: string;
    newStatus: OrderStatus;
    currentStatus: OrderStatus;
  } | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        filter === "all"
          ? { summary: true }
          : { status: filter, summary: true };
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
        toast.error(
          extractErrorMessage(e, "Erro ao carregar detalhes do pedido"),
        );
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
          <h2 className="text-3xl font-bold text-neutral-950">Meus Pedidos</h2>
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
                    <div className="flex gap-6 flex-1 min-w-0">
                      <div
                        className={clsx(
                          "h-fit p-4 rounded-xl",
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
                          <CheckCircle2 size={25} />
                        ) : activeOrder.status === "CANCELED" ? (
                          <XCircle size={25} />
                        ) : (
                          <Package size={25} />
                        )}
                      </div>

                      <div className="flex flex-col gap-2 min-w-0">
                        <div className="flex items-start gap-2 mb-0.5">
                          <span className="text-xs font-bold text-neutral-400 tracking-tight">
                            Pedido #{shortId(activeOrder.id.toUpperCase())}
                          </span>
                          {activeOrder.delivery_date && (
                            <>
                              <span className="text-neutral-400 text-xs">
                                •
                              </span>
                              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                                {activeOrder.status === "DELIVERED" ||
                                activeOrder.status === "SHIPPED"
                                  ? "OK"
                                  : `Entrega: ${formatDate(activeOrder.delivery_date)}`}
                              </span>
                            </>
                          )}
                        </div>

                        <h4 className="font-semibold text-neutral-950 text-xl mb-1 truncate flex items-center gap-5">
                          {activeOrder.user?.name || "Cliente Convidado"}
                          <span
                            className={clsx(
                              "inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border",
                              STATUS_COLORS[activeOrder.status],
                            )}
                          >
                            {STATUS_LABELS[activeOrder.status]}
                          </span>
                        </h4>

                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-3">
                            <span className="text-xs flex gap-1 items-center font-medium text-neutral-500">
                              <Calendar
                                size={12}
                                className="text-neutral-400"
                              />
                              {formatDate(activeOrder.created_at)}
                            </span>
                            <span className="text-neutral-400 text-xs">•</span>
                            <span className="text-xs font-medium text-neutral-600 flex items-center gap-1">
                              <Package size={12} className="text-neutral-400" />
                              {itemCount} {itemCount === 1 ? "item" : "itens"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-0.5">
                          Total do pedido
                        </p>
                        <p className="text-2xl font-semibold text-neutral-950">
                          {formatCurrency(
                            activeOrder.grand_total || activeOrder.total,
                          )}
                        </p>
                      </div>
                      <div className="p-1 rounded-sm border">
                        <ChevronDown
                          size={16}
                          className={clsx(
                            "text-neutral-500 transition-transform duration-300",
                            expandedId === order.id && "rotate-180",
                          )}
                        />
                      </div>
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
                      <Separator
                        orientation="horizontal"
                        className="w-full mx-6"
                      />
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
                              <h5 className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                                <User size={16} /> Cliente
                              </h5>
                              <div className="flex items-center gap-4">
                                <Avatar>
                                  <AvatarImage
                                    src={details.user?.image_url ?? ""}
                                  />
                                  <AvatarFallback className="bg-blue-200">
                                    {details.user?.name
                                      ?.split(" ")
                                      .slice(0, 2)
                                      .map((n) => n[0])
                                      .join("")
                                      .toUpperCase() || "CL"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="text-neutral-700 text-sm">
                                  <p className="font-medium text-neutral-900">
                                    {details.user?.name || "Cliente convidado"}
                                  </p>
                                  {details.user?.email && (
                                    <p className="font-light">
                                      {details.user.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {details.user?.phone && (
                                <a
                                  href={`https://wa.me/55${onlyDigits(details.user.phone)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center text-blue-600 hover:underline"
                                >
                                  <Phone size={14} />{" "}
                                  <span className="ml-2">
                                    {formatPhone(details.user.phone)}
                                  </span>
                                  <ArrowUpRight size={12} />
                                </a>
                              )}
                            </div>

                            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3">
                              <h5 className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                                <MapPin size={16} /> Entrega
                              </h5>
                              <p className="text-xs text-neutral-700 leading-relaxed">
                                {details.delivery_address ? (
                                  <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(details.delivery_address)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Ver Endereço"
                                    className="hover:underline"
                                  >
                                    {details.delivery_address}
                                  </a>
                                ) : (
                                  <span>Retirada na Loja</span>
                                )}
                              </p>
                              <p className="text-xs text-neutral-500 inline-flex items-center gap-1">
                                <Calendar size={12} />
                                {details.created_at
                                  ? formatDate(details.created_at)
                                  : "N/A"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3">
                              <h5 className="text-sm inline-flex items-center gap-2 font-bold text-neutral-950">
                                <ZapIcon size={16} />
                                Ações
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                <div className="flex justify-between items-center gap-4 w-full">
                                  <h6 className="text-nowrap text-sm flex items-center gap-2 font-medium">
                                    Status atual{" "}
                                    <span
                                      className={clsx(
                                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                        STATUS_COLORS[activeOrder.status],
                                      )}
                                    >
                                      {STATUS_LABELS[activeOrder.status] ===
                                      "Pago" ? (
                                        <CheckCircle2
                                          size={12}
                                          className="text-emerald-600"
                                        />
                                      ) : null}
                                      {STATUS_LABELS[activeOrder.status]}
                                    </span>
                                  </h6>

                                  <Select
                                    value={details.status}
                                    onValueChange={(newStatus) => {
                                      if (newStatus !== details.status) {
                                        setPendingStatusChange({
                                          orderId: details.id,
                                          newStatus: newStatus as OrderStatus,
                                          currentStatus: details.status,
                                        });
                                      }
                                    }}
                                    disabled={updatingId === details.id}
                                  >
                                    <SelectTrigger className="">
                                      <SelectValue
                                        placeholder="Alterar Status"
                                        className="text-xs"
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        {STATUS_FLOW.map((status) => (
                                          <SelectItem
                                            key={status}
                                            value={status}
                                            disabled={details.status === status}
                                          >
                                            {STATUS_LABELS[status]}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* {STATUS_FLOW.map((status) => (
                                  <Button
                                    key={status}
                                    disabled={
                                      updatingId === details.id ||
                                      details.status === status
                                    }
                                    onClick={() =>
                                      handleUpdateStatus(details.id, status)
                                    }
                                    className={clsx(
                                      "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm",
                                      details.status === status
                                        ? "bg-neutral-100 text-neutral-600 cursor-default"
                                        : "bg-white border border-neutral-100 text-neutral-900 hover:bg-neutral-50",
                                    )}
                                  >
                                    {updatingId === details.id &&
                                    details.status !== status
                                      ? "..."
                                      : STATUS_LABELS[status]}
                                  </Button>
                                ))} */}
                                {details.status !== "CANCELED" && (
                                  <Button
                                    onClick={() =>
                                      handleUpdateStatus(details.id, "CANCELED")
                                    }
                                    className="w-full text-red-500 bg-red-50 hover:bg-red-500 border border-red-200 hover:text-white"
                                  >
                                    <XCircle size={14} />
                                    Cancelar pedido
                                  </Button>
                                )}
                                {details.status === "CANCELED" && (
                                  <Button
                                    variant={"destructive"}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (
                                        confirm(
                                          "Tem certeza que deseja excluir permanentemente este pedido?",
                                        )
                                      ) {
                                        try {
                                          await api.deleteOrder(details.id);
                                          toast.success(
                                            "Pedido excluído com sucesso",
                                          );
                                          setExpandedId((prev) =>
                                            prev === details.id ? null : prev,
                                          );
                                          setOrderDetails((prev) => {
                                            const next = { ...prev };
                                            delete next[details.id];
                                            return next;
                                          });
                                          await fetchOrders();
                                        } catch (e) {
                                          toast.error(
                                            extractErrorMessage(
                                              e,
                                              "Erro ao excluir pedido",
                                            ),
                                          );
                                        }
                                      }
                                    }}
                                    className="w-full bg-red-300"
                                  >
                                    <Trash size={14} />
                                    Excluir
                                  </Button>
                                )}
                              </div>

                              {resolveClientPhone(details) && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const phone = resolveClientPhone(details);
                                    window.open(
                                      `/service?phone=${encodeURIComponent(phone)}`,
                                      "_blank",
                                    );
                                  }}
                                  className="w-full text-blue-500 bg-blue-50 border border-blue-200 hover:bg-blue-600 hover:text-white"
                                >
                                  <MessageCircle size={14} />
                                  Abrir Sessão do Cliente
                                </Button>
                              )}

                              {details.google_drive_folder_url && (
                                <Button
                                  variant={"outline"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(
                                      details.google_drive_folder_url!,
                                      "_blank",
                                    );
                                  }}
                                  className="w-full"
                                >
                                  <Download size={14} />
                                  Arquivos no Drive
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="lg:col-span-2 space-y-4 border border-neutral-200 rounded-2xl p-4">
                            <h5 className="text-sm font-bold text-neutral-950 flex items-center gap-2">
                              <Handbag size={16} className="inline-block" />
                              <span>Itens do Pedido</span>
                            </h5>
                            <Separator className="my-0 w-full" />
                            {details.items?.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="rounded-2xl overflow-hidden"
                              >
                                <div className="p-4 border-b border-neutral-100 bg-linear-to-r from-neutral-50 to-white">
                                  <div className="flex gap-3">
                                    {item.product?.image_url && (
                                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border border-neutral-200 shrink-0">
                                        <img
                                          src={item.product.image_url}
                                          alt={item.product.name}
                                          className="w-full h-full object-cover p-1"
                                        />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <h6 className="font-semibold text-neutral-950 text-lg">
                                        {item.product?.name || "Produto"}
                                      </h6>
                                      <p className="text-[11px] text-neutral-600">
                                        Quantidade: {item.quantity} | Unitário:{" "}
                                        {formatCurrency(item.price)}
                                      </p>
                                    </div>
                                    <span className="text-lg font-semibold text-neutral-950 shrink-0">
                                      {formatCurrency(
                                        item.price * item.quantity,
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <div className="p-4 space-y-3 border border-neutral-100">
                                  <div className="flex items-center justify-between gap-2">
                                    <h5 className="text-sm font-semibold text-neutral-950 flex items-center gap-2">
                                      <Edit3 size={12} />
                                      <span>Personalizações</span>
                                    </h5>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                      ✓ Revisada
                                    </span>
                                  </div>
                                  {!item.customizations ||
                                  item.customizations.length === 0 ? (
                                    <div className="rounded-xl p-4 text-xs text-neutral-500">
                                      Sem personalizações neste item.
                                    </div>
                                  ) : (
                                    item.customizations.map((cust: any, custIdx: number) => (
                                      <div
                                        key={cust.id || `cust-${custIdx}`}
                                        className="rounded-xl py-3 border-t"
                                      >
                                        <CustomizationDisplay
                                          customization={cust}
                                        />
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

      <AlertDialog
        open={!!pendingStatusChange}
        onOpenChange={(open) => {
          if (!open) setPendingStatusChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de status</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusChange && (
                <span className="font-medium text-foreground">
                  {STATUS_LABELS[pendingStatusChange.currentStatus]} →{" "}
                  {STATUS_LABELS[pendingStatusChange.newStatus]}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingStatusChange) {
                  handleUpdateStatus(
                    pendingStatusChange.orderId,
                    pendingStatusChange.newStatus,
                  );
                  setPendingStatusChange(null);
                }
              }}
            >
              Prosseguir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
