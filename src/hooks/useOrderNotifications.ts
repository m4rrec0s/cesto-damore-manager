import { useEffect, useRef, useState, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

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
  const [permission, setPermission] = useState<NotificationPermission>({
    status: "default",
    requested: false,
  });
  const [enabled, setEnabled] = useState(false);
  const [notifications, setNotifications] = useState<OrderNotification[]>(loadNotifications());
  const eventSourceRef = useRef<EventSource | null>(null);

  const unseenCount = notifications.filter(n => !n.seen).length;

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission({
      status: Notification.permission as "granted" | "denied" | "default",
      requested: Notification.permission !== "default",
    });
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) return false;
    try {
      const result = await Notification.requestPermission();
      setPermission({ status: result as "granted" | "denied" | "default", requested: true });
      if (result === "granted") {
        await registerPushSubscription();
      }
      return result === "granted";
    } catch {
      return false;
    }
  };

  const registerPushSubscription = async () => {
    try {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;

      const token = localStorage.getItem("token") || localStorage.getItem("appToken");
      if (!token) return;

      // Buscar VAPID public key do backend
      const res = await fetch(`${API_URL}/push/vapid-key`);
      const { publicKey } = await res.json();
      if (!publicKey) return;

      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      await fetch(`${API_URL}/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(subscription),
      });
    } catch (err) {
      console.error("Erro ao registrar Web Push:", err);
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
      const updated = prev.map(n => n.id === notificationId ? { ...n, seen: true } : n);
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
  ) => {
    addNotification({ orderId, title, message: body });

    if (permission.status === "granted") {
      try {
        const notification = new Notification(title, {
          body,
          icon: "/cart-icon.svg",
          tag: `order-${orderId}`,
        });
        notification.onclick = () => {
          window.focus();
          window.location.href = `/orders?orderId=${orderId}`;
          notification.close();
        };
      } catch {}
    }
  }, [permission.status, addNotification]);

  const startPolling = useCallback(() => {
    if (eventSourceRef.current) return;

    const token = localStorage.getItem("token") || localStorage.getItem("appToken");
    if (!token) return;

    // Registrar Web Push se permissão já concedida
    if (Notification.permission === "granted") {
      registerPushSubscription();
    }

    const url = `${API_URL}/admin/orders/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    setEnabled(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "order_paid") {
          const totalText = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.total);
          const deliveryText = data.deliveryDate
            ? new Date(data.deliveryDate).toLocaleDateString("pt-BR")
            : "Sem data";
          showNotification(
            data.orderId,
            `🛒 Novo Pedido - ${data.customerName}`,
            `Entrega: ${deliveryText} • ${data.itemsCount} item(s) • ${totalText}`,
          );
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setEnabled(false);
      // Reconectar após 5s
      setTimeout(() => startPolling(), 5000);
    };
  }, [showNotification]);

  const stopPolling = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setEnabled(false);
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
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
    markAsSeen,
    markAllAsSeen,
    clearNotifications,
  };
};
