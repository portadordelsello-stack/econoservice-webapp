import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { NotificationsService, toDate } from "../services/db";
import { AppNotification } from "../types";
import { Bell, Check, Trash, CheckSquare, Clock, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NotificationsCenterProps {
  align?: "left" | "right";
}

export function NotificationsCenter({ align = "right" }: NotificationsCenterProps) {
  const { user, profile } = useAuth();
  const { navigate } = useNavigation();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile || !user) return;

    // Listen to notifications in real-time
    const unsubscribe = NotificationsService.listenToNotifications(
      profile.rol,
      user.uid,
      (updatedNotifications) => {
        setNotifications(updatedNotifications);
      }
    );

    return () => unsubscribe();
  }, [profile, user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user || !profile) return null;

  // An unread notification is one where the user's uid is not in readBy array
  const unreadNotifications = notifications.filter(
    (notif) => !notif.readBy || !notif.readBy.includes(user.uid)
  );
  
  const unreadCount = unreadNotifications.length;

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await NotificationsService.markAsRead(id, user.uid);
  };

  const handleMarkAllAsRead = async () => {
    await NotificationsService.markAllAsReadForUser(user.uid, notifications);
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (notif.id) {
      await NotificationsService.markAsRead(notif.id, user.uid);
    }
    if (notif.serviceId) {
      navigate("detalle-servicio", notif.serviceId);
      setIsOpen(false);
    }
  };

  const formatTime = (timestamp: any) => {
    const date = toDate(timestamp);
    if (!date) return "";
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-[#0f172a] animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Floating Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute bottom-14 ${align === "left" ? "left-0" : "right-0 md:right-auto md:left-0"} w-80 md:w-96 max-h-[480px] bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden text-sm`}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-white">Notificaciones</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-xs font-bold rounded-full">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Marcar todo leído
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-[350px]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No tienes notificaciones todavía</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const isUnread = !notif.readBy || !notif.readBy.includes(user.uid);
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-4 transition-all duration-150 cursor-pointer flex gap-3 ${
                        isUnread 
                          ? "bg-indigo-500/[0.02] hover:bg-indigo-500/[0.05]" 
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      {/* Active indicator */}
                      <div className="shrink-0 pt-1">
                        <div className={`w-2 h-2 rounded-full ${isUnread ? "bg-indigo-500" : "bg-transparent"}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`block font-semibold text-slate-800 dark:text-white truncate ${isUnread ? "font-bold" : ""}`}>
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap pt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed ${isUnread ? "text-slate-700 dark:text-slate-300" : ""}`}>
                          {notif.message}
                        </p>

                        {/* Extra Actions */}
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          {notif.serviceId && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-0.5">
                              Ver Ficha de Trabajo
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          )}
                          {isUnread && notif.id && (
                            <button
                              onClick={(e) => handleMarkAsRead(notif.id!, e)}
                              className="ml-auto p-1 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 rounded transition-colors"
                              title="Marcar como leída"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
