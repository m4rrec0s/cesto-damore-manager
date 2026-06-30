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
  serverId?: string; // ID da notificação no servidor (DB)
}

interface NotificationPermission {
  status: "granted" | "denied" | "default";
  requested: boolean;
}

interface ServerNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  order_id: string | null;
  metadata: Record<string, unknown> | null;
  seen: boolean;
  created_at: string;
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

const getToken = (): string | null => {
  return localStorage.getItem("token") || localStorage.getItem("appToken");
};

export const useOrderNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>({
    status: "default",
    requested: false,
  });
  const [enabled, setEnabled] = useState(false);
  const [notifications, setNotifications] =
    useState<OrderNotification[]>(loadNotifications());
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseRetriesRef = useRef(0);

  const unseenCount = notifications.filter((n) => !n.seen).length;

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission({
      status: Notification.permission as "granted" | "denied" | "default",
      requested: Notification.permission !== "default",
    });
  }, []);

  // Buscar notificações do servidor ao montar
  useEffect(() => {
    const fetchServerNotifications = async () => {
      const token = getToken();
      if (!token) return;

      try {
        const res = await fetch(`${API_URL}/admin/notifications?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverNotifs: ServerNotification[] = data.notifications || [];

        if (serverNotifs.length === 0) return;

        // Converter notificações do servidor para o formato local
        const localNotifs: OrderNotification[] = serverNotifs.map((sn) => ({
          id: sn.id,
          serverId: sn.id,
          orderId: sn.order_id || "",
          title: sn.title,
          message: sn.message,
          timestamp: new Date(sn.created_at).getTime(),
          seen: sn.seen,
        }));

        // Merge: priorizar notificações do servidor, manter locais sem serverId
        setNotifications((prev) => {
          const prevWithoutServer = prev.filter((n) => !n.serverId);
          const serverIds = new Set(localNotifs.map((n) => n.serverId));
          const prevLocalOnly = prevWithoutServer.filter(
            (n) => !serverIds.has(n.id),
          );

          const merged = [...localNotifs, ...prevLocalOnly]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, MAX_NOTIFICATIONS);

          saveNotifications(merged);
          return merged;
        });
      } catch {
        // Silenciar erros - fallback para localStorage
      }
    };

    fetchServerNotifications();
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) return false;
    try {
      const result = await Notification.requestPermission();
      setPermission({
        status: result as "granted" | "denied" | "default",
        requested: true,
      });
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
      const registration =
        await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;

      const token = getToken();
      if (!token) return;

      // Buscar VAPID public key do backend via API client (CORS OK)
      let publicKey: string;
      try {
        const res = await fetch(`${API_URL}/push/vapid-key`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        publicKey = data.publicKey;
      } catch {
        return; // Silenciar - VAPID não configurado ou CORS
      }
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(subscription),
      });
    } catch {
      // Silenciar erros de push - não é crítico
    }
  };

  const addNotification = useCallback(
    (
      notification: Omit<OrderNotification, "id" | "timestamp" | "seen"> & {
        serverId?: string;
      },
    ) => {
      // Verificar duplicata por serverId
      if (notification.serverId) {
        setNotifications((prev) => {
          if (prev.some((n) => n.serverId === notification.serverId))
            return prev;
          const newNotification: OrderNotification = {
            ...notification,
            id: notification.serverId!,
            timestamp: Date.now(),
            seen: false,
          };
          const updated = [newNotification, ...prev].slice(
            0,
            MAX_NOTIFICATIONS,
          );
          saveNotifications(updated);
          return updated;
        });
        return;
      }

      const newNotification: OrderNotification = {
        ...notification,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        seen: false,
      };
      setNotifications((prev) => {
        const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
        saveNotifications(updated);
        return updated;
      });
    },
    [],
  );

  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  const markAsSeen = useCallback(async (notificationId: string) => {
    // Atualizar localmente
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === notificationId ? { ...n, seen: true } : n,
      );
      saveNotifications(updated);
      return updated;
    });

    // Sincronizar com servidor
    const token = getToken();
    if (token) {
      try {
        const notif = notificationsRef.current.find(
          (n) => n.id === notificationId,
        );
        if (notif?.serverId) {
          await fetch(`${API_URL}/admin/notifications/${notif.serverId}/seen`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch {
        // Silenciar - sync é best-effort
      }
    }
  }, []);

  const markAllAsSeen = useCallback(async () => {
    // Atualizar localmente
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, seen: true }));
      saveNotifications(updated);
      return updated;
    });

    // Sincronizar com servidor
    const token = getToken();
    if (token) {
      try {
        await fetch(`${API_URL}/admin/notifications/seen-all`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Silenciar - sync é best-effort
      }
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  const showNotification = useCallback(
    (orderId: string, title: string, body: string, serverId?: string) => {
      addNotification({ orderId, title, message: body, serverId });

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
    },
    [permission.status, addNotification],
  );

  const startPolling = useCallback(() => {
    if (eventSourceRef.current) return;

    const token = getToken();
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
      sseRetriesRef.current = 0; // Reset retries on successful message
      try {
        const data = JSON.parse(event.data);

        if (
          data.type === "pending_notifications" &&
          Array.isArray(data.notifications)
        ) {
          // Receber notificações pendentes do servidor ao conectar
          const pending: OrderNotification[] = data.notifications.map(
            (sn: ServerNotification) => ({
              id: sn.id,
              serverId: sn.id,
              orderId: sn.order_id || "",
              title: sn.title,
              message: sn.message,
              timestamp: new Date(sn.created_at).getTime(),
              seen: false,
            }),
          );

          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.serverId || n.id));
            const newNotifs = pending.filter(
              (n) => !existingIds.has(n.serverId || n.id),
            );
            if (newNotifs.length === 0) return prev;

            const updated = [...newNotifs, ...prev]
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, MAX_NOTIFICATIONS);
            saveNotifications(updated);
            return updated;
          });
        } else if (data.type === "order_paid") {
          const totalText = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(data.total);
          const deliveryText = data.deliveryDate
            ? new Date(data.deliveryDate).toLocaleDateString("pt-BR")
            : "Sem data";
          showNotification(
            data.orderId,
            `🛒 Novo Pedido - ${data.customerName}`,
            `Entrega: ${deliveryText} • ${data.itemsCount} item(s) • ${totalText}`,
            data.notificationId,
          );
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setEnabled(false);
      // Reconectar com backoff, SEM limite máximo de tentativas
      sseRetriesRef.current++;
      const delay = Math.min(
        5000 * Math.pow(2, sseRetriesRef.current - 1),
        60000,
      );
      setTimeout(() => startPolling(), delay);
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
