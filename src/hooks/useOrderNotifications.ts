import { useEffect, useRef, useState } from "react";
import { useApi } from "../services/api";

interface NotificationPermission {
  status: "granted" | "denied" | "default";
  requested: boolean;
}

export const useOrderNotifications = () => {
  const api = useApi();
  const [permission, setPermission] = useState<NotificationPermission>({
    status: "default",
    requested: false,
  });
  const [enabled, setEnabled] = useState(false);
  const lastOrderIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const showNotification = (
    title: string,
    body: string,
    icon?: string,
  ) => {
    if (permission.status !== "granted") {
      console.warn("Permissão de notificação não concedida");
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: icon || "/logo192.png",
        badge: icon || "/logo192.png",
        tag: "order-notification",
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error("Erro ao mostrar notificação:", error);
    }
  };

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
            `🛒 Novo Pedido - ${firstName}`,
            `Entrega: ${deliveryDate}\n${itemsCount} ${itemsText} • ${totalText}`,
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
    requestPermission,
    startPolling,
    stopPolling,
    showNotification,
  };
};
