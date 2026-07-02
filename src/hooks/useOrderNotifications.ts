import { useEffect, useSyncExternalStore } from "react";

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
  serverId?: string;
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

// ─── Shared store (singleton) ──────────────────────────────────────
const STORAGE_KEY = "order_notifications";
const MAX_NOTIFICATIONS = 50;

function loadNotifications(): OrderNotification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: OrderNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error("Erro ao salvar notificações:", error);
  }
}

const getToken = (): string | null => {
  return localStorage.getItem("token") || localStorage.getItem("appToken");
};

type Listener = () => void;

let notifications: OrderNotification[] = loadNotifications();
let permission: NotificationPermission = {
  status: (typeof Notification !== "undefined" ? Notification.permission : "default") as "granted" | "denied" | "default",
  requested: typeof Notification !== "undefined" && Notification.permission !== "default",
};
let enabled = false;
let eventSourceInstance: EventSource | null = null;
let sseRetries = 0;
let sseStarted = false;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function setNotifications(updater: OrderNotification[] | ((prev: OrderNotification[]) => OrderNotification[])) {
  notifications = typeof updater === "function" ? updater(notifications) : updater;
  saveNotifications(notifications);
  emit();
}

function setEnabled(v: boolean) {
  enabled = v;
  emit();
}

function setPermission(p: NotificationPermission) {
  permission = p;
  emit();
}

// ─── Actions ───────────────────────────────────────────────────────

function addNotificationAction(
  notification: Omit<OrderNotification, "id" | "timestamp" | "seen"> & { serverId?: string },
) {
  setNotifications((prev) => {
    const isDuplicate = prev.some(
      (n) =>
        (notification.serverId && n.serverId === notification.serverId) ||
        (notification.orderId && n.orderId === notification.orderId),
    );
    if (isDuplicate) return prev;

    const newNotification: OrderNotification = {
      ...notification,
      id: notification.serverId || `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      seen: false,
    };
    return [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
  });
}

function markAsSeenAction(notificationId: string) {
  setNotifications((prev) =>
    prev.map((n) => (n.id === notificationId ? { ...n, seen: true } : n)),
  );

  const token = getToken();
  if (token) {
    const notif = notifications.find((n) => n.id === notificationId);
    if (notif?.serverId) {
      fetch(`${API_URL}/admin/notifications/${notif.serverId}/seen`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }
}

function markAllAsSeenAction() {
  setNotifications((prev) => prev.map((n) => ({ ...n, seen: true })));

  const token = getToken();
  if (token) {
    fetch(`${API_URL}/admin/notifications/seen-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

function clearNotificationsAction() {
  setNotifications([]);

  const token = getToken();
  if (token) {
    fetch(`${API_URL}/admin/notifications`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

// ─── Sound ─────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;

function playOrderBell() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    // 3 toques: "pin pin pin"
    [0, 0.15, 0.3].forEach((offset) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now + offset);
      osc.frequency.exponentialRampToValueAtTime(800, now + offset + 0.1);
      gain.gain.setValueAtTime(0.3, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  } catch {}
}

function showNotificationAction(orderId: string, title: string, body: string, serverId?: string) {
  addNotificationAction({ orderId, title, message: body, serverId });
  playOrderBell();
  // OS notification handled by Web Push (sw-push.js) — no duplicar com new Notification()
}

async function registerPushSubscriptionAction() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.register("/sw-push.js");
    await navigator.serviceWorker.ready;

    const token = getToken();
    if (!token) return;

    let publicKey: string;
    try {
      const res = await fetch(`${API_URL}/push/vapid-key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      publicKey = data.publicKey;
    } catch {
      return;
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
  } catch {}
}

async function requestPermissionAction() {
  if (!("Notification" in window)) return false;
  try {
    const result = await Notification.requestPermission();
    setPermission({
      status: result as "granted" | "denied" | "default",
      requested: true,
    });
    if (result === "granted") {
      await registerPushSubscriptionAction();
    }
    return result === "granted";
  } catch {
    return false;
  }
}

function startPollingAction() {
  if (eventSourceInstance || sseStarted) return;

  const token = getToken();
  if (!token) return;

  sseStarted = true;

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    registerPushSubscriptionAction();
  }

  const url = `${API_URL}/admin/orders/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);
  eventSourceInstance = es;
  setEnabled(true);

  // Buscar notificações pendentes do servidor ao conectar
  fetch(`${API_URL}/admin/notifications?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => r.json())
    .then((data) => {
      const serverNotifs: ServerNotification[] = data.notifications || [];
      if (serverNotifs.length === 0) return;

      const pending: OrderNotification[] = serverNotifs.map((sn) => ({
        id: sn.id,
        serverId: sn.id,
        orderId: sn.order_id || "",
        title: sn.title,
        message: sn.message,
        timestamp: new Date(sn.created_at).getTime(),
        seen: sn.seen,
      }));

      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.serverId || n.id));
        const newNotifs = pending.filter(
          (n) => !existingIds.has(n.serverId || n.id),
        );
        if (newNotifs.length === 0) return prev;
        return [...newNotifs, ...prev]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, MAX_NOTIFICATIONS);
      });
    })
    .catch(() => {});

  es.onmessage = (event) => {
    sseRetries = 0;
    try {
      const data = JSON.parse(event.data);

      if (data.type === "order_paid") {
        const totalText = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(data.total);
        const deliveryText = data.deliveryDate
          ? new Date(data.deliveryDate).toLocaleDateString("pt-BR")
          : "Sem data";
        showNotificationAction(
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
    eventSourceInstance = null;
    sseStarted = false;
    setEnabled(false);
    sseRetries++;
    const delay = Math.min(5000 * Math.pow(2, sseRetries - 1), 60000);
    setTimeout(() => startPollingAction(), delay);
  };
}

function stopPollingAction() {
  if (eventSourceInstance) {
    eventSourceInstance.close();
    eventSourceInstance = null;
  }
  sseStarted = false;
  setEnabled(false);
}

// ─── React hook (shared via useSyncExternalStore) ─────────────────

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getNotifications() {
  return notifications;
}

function getPermission() {
  return permission;
}

function getEnabled() {
  return enabled;
}

function getUnseenCount() {
  return notifications.filter((n) => !n.seen).length;
}

export const useOrderNotifications = () => {
  const notifications = useSyncExternalStore(subscribe, getNotifications);
  const permission = useSyncExternalStore(subscribe, getPermission);
  const enabled = useSyncExternalStore(subscribe, getEnabled);
  const unseenCount = useSyncExternalStore(subscribe, getUnseenCount);

  // Start SSE on first mount
  useEffect(() => {
    startPollingAction();
    return () => {
      if (eventSourceInstance) {
        eventSourceInstance.close();
        eventSourceInstance = null;
        sseStarted = false;
      }
    };
  }, []);

  return {
    notifications,
    permission,
    enabled,
    unseenCount,
    requestPermission: requestPermissionAction,
    startPolling: startPollingAction,
    stopPolling: stopPollingAction,
    markAsSeen: markAsSeenAction,
    markAllAsSeen: markAllAsSeenAction,
    clearNotifications: clearNotificationsAction,
  };
};
