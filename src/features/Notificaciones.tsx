import React, { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { NotificationsService, toDate } from "../services/db";
import { AppNotification } from "../types";
import { 
  Bell, 
  Check, 
  CheckSquare, 
  Clock, 
  ArrowRight, 
  Wrench, 
  Truck, 
  User, 
  Package, 
  AlertTriangle,
  Inbox
} from "lucide-react";

export default function Notificaciones() {
  const { user, profile } = useAuth();
  const { navigate } = useNavigation();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<"todas" | "no_leidas">("todas");

  useEffect(() => {
    if (!profile || !user) return;

    const unsubscribe = NotificationsService.listenToNotifications(
      profile.rol,
      user.uid,
      (updatedNotifications) => {
        setNotifications(updatedNotifications);
      }
    );

    return () => unsubscribe();
  }, [profile, user]);

  if (!user || !profile) return null;

  const unreadCount = notifications.filter(
    (notif) => !notif.readBy || !notif.readBy.includes(user.uid)
  ).length;

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "no_leidas") {
      return !notif.readBy || !notif.readBy.includes(user.uid);
    }
    return true;
  });

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
    }
  };

  const formatDateTime = (timestamp: any) => {
    const date = toDate(timestamp);
    if (!date) return "Fecha no registrada";
    
    const day = date.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
    const time = date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit"
    });

    return `${day.charAt(0).toUpperCase() + day.slice(1)} - ${time} hs`;
  };

  const getNotificationIcon = (title: string, role?: string) => {
    const t = title.toLowerCase();
    if (t.includes("retiro") || t.includes("entrega") || role === "logistica") {
      return <Truck className="w-5 h-5 text-amber-500" />;
    }
    if (t.includes("diagnóstico") || t.includes("taller") || t.includes("equipo") || role === "taller") {
      return <Wrench className="w-5 h-5 text-indigo-500" />;
    }
    if (t.includes("insumo") || t.includes("stock")) {
      return <Package className="w-5 h-5 text-purple-500" />;
    }
    return <Bell className="w-5 h-5 text-indigo-500" />;
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-slate-150 dark:border-gray-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Centro de Notificaciones
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {unreadCount} nuevas
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Historial de avisos y novedades del sistema organizados por fecha y hora.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setFilter("todas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === "todas"
                  ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("no_leidas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === "no_leidas"
                  ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              No Leídas ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl text-xs font-extrabold transition-all border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs cursor-pointer active:scale-95"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Marcar todo como leído</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500 shadow-xs">
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-500" />
            <p className="text-base font-bold text-slate-700 dark:text-gray-300">Sin avisos para mostrar</p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
              {filter === "no_leidas" ? "Has leído todas las notificaciones." : "No se registraron avisos aún."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isUnread = !notif.readBy || !notif.readBy.includes(user.uid);
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isUnread
                    ? "border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20"
                    : "border-slate-150 dark:border-gray-800"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-gray-800 shrink-0 mt-0.5 sm:mt-0">
                    {getNotificationIcon(notif.title, notif.targetRole)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-bold text-slate-900 dark:text-white ${isUnread ? "text-indigo-600 dark:text-indigo-400 font-extrabold" : ""}`}>
                        {notif.title}
                      </span>
                      {isUnread && (
                        <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                          Nueva
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-slate-400 dark:text-gray-500">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{formatDateTime(notif.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0">
                  {notif.serviceId && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs">
                      <span>Ver Ficha</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {isUnread && notif.id && (
                    <button
                      onClick={(e) => handleMarkAsRead(notif.id!, e)}
                      className="p-2 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 bg-slate-50 dark:bg-gray-800 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-gray-700"
                      title="Marcar como leída"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
