import { Bell, Check, Trash2, X } from "lucide-react";
import { useOrderNotifications } from "../hooks/useOrderNotifications";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function NotificationCenter() {
  const {
    notifications,
    unseenCount,
    markAsSeen,
    markAllAsSeen,
    clearNotifications,
  } = useOrderNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (orderId: string, notificationId: string) => {
    markAsSeen(notificationId);
    setIsOpen(false);
    navigate(`/orders?orderId=${orderId}`);
  };

  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return "agora";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
    return `${Math.floor(seconds / 86400)}d atrás`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-neutral-100 transition-colors"
      >
        <Bell size={20} className="text-neutral-600" />
        {unseenCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-neutral-200 z-50 max-h-[600px] flex flex-col"
            >
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="font-bold text-neutral-950 flex items-center gap-2">
                  <Bell size={18} />
                  Notificações
                  {unseenCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                      {unseenCount} nova{unseenCount > 1 ? "s" : ""}
                    </span>
                  )}
                </h3>
                <div className="flex gap-1">
                  {unseenCount > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAllAsSeen();
                      }}
                      className="text-xs"
                    >
                      <Check size={14} />
                      Marcar todas
                    </Button>
                  )}
                  {notifications.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearNotifications();
                      }}
                      className="text-xs text-red-600"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsOpen(false)}
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500">
                    <Bell size={48} className="mx-auto mb-4 text-neutral-300" />
                    <p className="font-medium">Nenhuma notificação</p>
                    <p className="text-sm">Você será notificado de novos pedidos aqui</p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() =>
                          handleNotificationClick(
                            notification.orderId,
                            notification.id,
                          )
                        }
                        className={`w-full p-4 text-left hover:bg-neutral-50 transition-colors ${
                          !notification.seen ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!notification.seen && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-neutral-950 text-sm">
                              {notification.title}
                            </p>
                            <p className="text-xs text-neutral-600 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-[10px] text-neutral-400 mt-2">
                              {formatRelativeTime(notification.timestamp)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
