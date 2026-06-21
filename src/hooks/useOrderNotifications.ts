import { useEffect, useRef, useState, useCallback } from "react";
import { useApi } from "../services/api";

interface OrderNotification {
  id: string;
  orderId: string;
  title: string;
  message: string;
  timestamp: number;
  seen: boolean;
}

interface NotificationPermission {
  status: "granted" | "denied" | "default";
  requested: boolean;
}

const STORAGE_KEY = "order_notifications";
const MAX_NOTIFICATIONS = 50;

const loadNotifications = (): OrderNotification[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveNotifications = (notifications: OrderNotification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error("Erro ao salvar notificações:", error);
  }
};

export const useOrderNotifications = () => {
  const api = useApi();
  const [permission, setPermission] = useState<NotificationPermission>({
    status: "default",
    requested: false,
  });
  const [enabled, setEnabled] = useState(false);
  const [notifications, setNotifications] = useState<OrderNotification[]>(loadNotifications());
  const lastOrderIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const unseenCount = notifications.filter(n => !n.seen).length;

  useEffect(() => {
    // Verificar se o navegador suporta notificações
    if (!("Notification" in window)) {
      console.warn("Este navegador não suporta notificações");
      return;
    }

    setPermission({
      status: Notification.permission as "granted" | "denied" | "default",
      requested: Notification.permission !== "default",
    });
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission({
        status: result as "granted" | "denied" | "default",
        requested: true,
      });
      return result === "granted";
    } catch (error) {
      console.error("Erro ao solicitar permissão de notificação:", error);
      return false;
    }
  };

  const addNotification = useCallback((notification: Omit<OrderNotification, "id" | "timestamp" | "seen">) => {
    const newNotification: OrderNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      seen: false,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveNotifications(updated);
      return updated;
    });

    return newNotification;
  }, []);

  const markAsSeen = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, seen: true } : n
      );
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAllAsSeen = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, seen: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  const showNotification = useCallback((
    orderId: string,
    title: string,
    body: string,
    icon?: string,
  ) => {
    // Adicionar ao histórico
    addNotification({
      orderId,
      title,
      message: body,
    });

    // Mostrar notificação nativa se permitido
    if (permission.status !== "granted") {
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: icon || "/cart-icon.svg",
        badge: icon || "/cart-icon.svg",
        tag: `order-${orderId}`,
        requireInteraction: false,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        // Navegar para a página de pedidos será tratado pelo componente
        window.location.href = `/orders?orderId=${orderId}`;
        notification.close();
      };
    } catch (error) {
      console.error("Erro ao mostrar notificação:", error);
    }
  }, [permission.status, addNotification]);

  const checkNewOrders = async () => {
    try {
      const response = await api.getOrders({
        status: "PAID",
        limit: 1,
        summary: true,
      });

      if (response.data.data && response.data.data.length > 0) {
        const latestOrder = response.data.data[0];
        
        // Se é a primeira vez ou se há um novo pedido
        if (lastOrderIdRef.current === null) {
          lastOrderIdRef.current = latestOrder.id;
          return;
        }

        if (latestOrder.id !== lastOrderIdRef.current) {
          lastOrderIdRef.current = latestOrder.id;

          // Buscar detalhes completos do pedido para notificação
          const orderDetails = await api.getOrder(latestOrder.id);
          
          const firstName = orderDetails.user?.name?.split(" ")[0] || "Cliente";
          const deliveryDate = orderDetails.delivery_date
            ? new Date(orderDetails.delivery_date).toLocaleDateString("pt-BR")
            : "Sem data";
          
          const itemsCount = orderDetails.items?.length || 0;
          const itemsText = itemsCount === 1 ? "item" : "itens";
          const total = orderDetails.grand_total || orderDetails.total || 0;
          const totalText = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(total);

          showNotification(
            latestOrder.id,
            `🛒 Novo Pedido - ${firstName}`,
            `Entrega: ${deliveryDate} • ${itemsCount} ${itemsText} • ${totalText}`,
            "/cart-icon.svg",
          );
        }
      }
    } catch (error) {
      console.error("Erro ao verificar novos pedidos:", error);
    }
  };

  const startPolling = () => {
    if (intervalRef.current) {
      return;
    }

    // Polling a cada 30 segundos
    intervalRef.current = setInterval(checkNewOrders, 30000);
    setEnabled(true);

    // Primeira verificação imediata
    checkNewOrders();
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setEnabled(false);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    permission,
    enabled,
    notifications,
    unseenCount,
    requestPermission,
    startPolling,
    stopPolling,
    showNotification,
    markAsSeen,
    markAllAsSeen,
    clearNotifications,
  };
};
