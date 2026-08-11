import React, { useState, useEffect } from "react";
import Tracker from "./Tracker";
import { ClientesService, ServiciosService, NotificationsService, toDate } from "../services/db";
import { Cliente, Servicio } from "../types";
import { useNavigation } from "../providers/NavigationProvider";
import { useAuth } from "../providers/AuthProvider";
import { 
  Truck, 
  MapPin, 
  Calendar, 
  ArrowLeft, 
  Phone, 
  Clock, 
  Map as MapIcon, 
  ExternalLink, 
  AlertTriangle,
  Search,
  RefreshCw,
  ChevronRight,
  ClipboardList,
  Compass,
  MessageSquare,
  Info,
  Check,
  Save,
  Eye,
  X,
  Trash2,
  Wrench,
  Laptop,
  CalendarClock
} from "lucide-react";

type LogisticaView = "hub" | "tracker" | "retiros" | "agenda-general" | "entregas" | "detalle-entrega";

// Helper for WhatsApp URLs
const getWhatsAppUrl = (phone?: string) => {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (clean.length === 10 && !clean.startsWith("54")) {
    clean = "54" + clean;
  }
  return `https://wa.me/${clean}`;
};

// Helper to format Spanish Date nicely
const formatSpanishDate = (dateStr: string) => {
  try {
    const [year, month, day] = dateStr.split("-");
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.toLocaleDateString("es-AR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
};

// Helper to format Time cleanly
const formatTimeStr = (dateTimeStr: string) => {
  try {
    const parts = dateTimeStr.split("T");
    if (parts.length > 1) {
      return parts[1] + " hs";
    }
    return "Todo el día";
  } catch (e) {
    return "Hora acordada";
  }
};

export default function Logistica() {
  const { navigate } = useNavigation();
  const { profile, user } = useAuth();
  const [view, setView] = useState<LogisticaView>("hub");
  
  // Logistics retiros data states
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Delivery states
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [deliveryCita, setDeliveryCita] = useState("");
  const [deliveryHoraDesde, setDeliveryHoraDesde] = useState("");
  const [deliveryHoraHasta, setDeliveryHoraHasta] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [activeEntregaTab, setActiveEntregaTab] = useState<"pendientes" | "entregados">("pendientes");
  const [deliveredSearchTerm, setDeliveredSearchTerm] = useState("");
  const [selectedGroupForModal, setSelectedGroupForModal] = useState<GroupedWithdrawal | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<Servicio | null>(null);

  const handleToggleRetirado = async (srvId: string, currentVal: boolean) => {
    try {
      const userUid = profile?.uid || user?.uid || "logistica";
      const userNombre = profile?.nombre || profile?.nombreApellido || user?.displayName || "Logística";
      
      const newVal = !currentVal;
      await ServiciosService.update(
        srvId,
        { ingresoTaller: newVal },
        userUid,
        userNombre,
        `Retiro pactado: marcado como ${newVal ? "RETIRADO" : "PENDIENTE"}`
      );

      if (newVal) {
        const targetSrv = servicios.find(s => s.id === srvId);
        await NotificationsService.create({
          targetRole: "taller",
          title: "Nuevo Equipo Ingresado",
          message: `Logística retiró e ingresó el equipo ${targetSrv?.aparato || ""} #${targetSrv?.numeroServicio || ""} para diagnóstico.`,
          serviceId: srvId
        });
        // WhatsApp Notification
        fetch("/api/whatsapp/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "pickup", serviceId: srvId })
        }).catch(err => console.error("Error sending WhatsApp pickup notify:", err));
      }
      
      await loadData();
    } catch (error) {
      console.error("Error updating retirado status:", error);
    }
  };

  const handleToggleRetiradoGroup = async (group: any) => {
    try {
      const userUid = profile?.uid || user?.uid || "logistica";
      const userNombre = profile?.nombre || profile?.nombreApellido || user?.displayName || "Logística";
      
      const newVal = !group.isRetirado;
      
      for (const srv of group.services) {
        await ServiciosService.update(
          srv.id!,
          { ingresoTaller: newVal },
          userUid,
          userNombre,
          `Retiro pactado: marcado como ${newVal ? "RETIRADO" : "PENDIENTE"}`
        );

        if (newVal) {
          await NotificationsService.create({
            targetRole: "taller",
            title: "Nuevo Equipo Ingresado",
            message: `Logística retiró e ingresó el equipo ${srv.aparato || ""} #${srv.numeroServicio || ""} para diagnóstico.`,
            serviceId: srv.id!
          });
          // WhatsApp Notification
          fetch("/api/whatsapp/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "pickup", serviceId: srv.id })
          }).catch(err => console.error("Error sending WhatsApp group pickup notify:", err));
        }
      }
      
      await loadData();
    } catch (error) {
      console.error("Error updating retirado status for group:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [allClientes, allServicios] = await Promise.all([
        ClientesService.getAll(),
        ServiciosService.getAll()
      ]);
      setClientes(allClientes);
      setServicios(allServicios);
    } catch (e) {
      console.error("Error loading logistics data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateServiceState = async (srvId: string, newState: EstadoServicio) => {
    try {
      setLoading(true);
      const updateData: Partial<Servicio> = {
        estado: newState
      };
      
      if (newState === "ENTREGADO") {
        updateData.entregado = true;
      } else {
        updateData.entregado = false;
        // Send back to workshop/logistics: mark as in workshop (or ready to dispatch) and clear delivery timestamp
        updateData.ingresoTaller = true;
        updateData.citaEntrega = null;
      }

      const userUid = profile?.uid || user?.uid || "logistica";
      const userNombre = profile?.nombre || profile?.nombreApellido || user?.displayName || "Logística";

      await ServiciosService.update(srvId, updateData, userUid, userNombre, `Estado cambiado a ${newState} desde Historial de Entregados.`);
      await loadData();
    } catch (err) {
      console.error("Error updating service status:", err);
      alert("Error al actualizar el estado del servicio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === "retiros" || view === "agenda-general" || view === "entregas" || view === "detalle-entrega") {
      loadData();
    }
  }, [view]);

  // Client ID formatting function
  const formatClienteId = (c: Cliente): string => {
    if (c.numeroCliente) {
      return String(c.numeroCliente).padStart(6, "0");
    }
    if (c.id) {
      let hash = 0;
      for (let i = 0; i < c.id.length; i++) {
        hash = c.id.charCodeAt(i) + ((hash << 5) - hash);
      }
      const num = Math.abs(hash) % 1000000;
      return String(num).padStart(6, "0");
    }
    return "000000";
  };

  // Helper to extract withdrawal info
  const parseInfoLogistica = (info?: string, fallbackDate?: string | Date) => {
    let fechaRetiroStr = "";
    let notasRetiro = "";
    if (info) {
      const parts = info.split(" | ");
      parts.forEach(part => {
        if (part.startsWith("Retiro acordado: ")) {
          fechaRetiroStr = part.replace("Retiro acordado: ", "");
        } else if (part.startsWith("Notas retiro: ")) {
          notasRetiro = part.replace("Notas retiro: ", "");
        }
      });
    }

    // Fallback: search for YYYY-MM-DD pattern anywhere in infoLogistica if fechaRetiroStr is still empty
    if (!fechaRetiroStr && info) {
      const dateMatch = info.match(/\b\d{4}-\d{2}-\d{2}\b/);
      if (dateMatch) {
        fechaRetiroStr = dateMatch[0];
      }
    }

    // Final fallback: use creation / entry date formatted as YYYY-MM-DD
    if (!fechaRetiroStr && fallbackDate) {
      try {
        const d = new Date(fallbackDate);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          fechaRetiroStr = `${year}-${month}-${day}`;
        }
      } catch (e) {
        console.error("Error formatting fallback date:", e);
      }
    }

    if (!fechaRetiroStr) return null;
    return { fechaRetiroStr, notasRetiro };
  };

  // Local helper for Argentine local date formatting (YYYY-MM-DD)
  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();

  // Map clients for quick access
  const clientMap = new Map<string, Cliente>();
  clientes.forEach(c => {
    if (c.id) clientMap.set(c.id, c);
  });

  // Extract all services that have scheduled withdrawals and are not yet in the workshop
  const servicesWithWithdrawals = servicios
    .map(s => {
      const parsed = parseInfoLogistica(s.infoLogistica, s.fechaIngreso || s.createdAt);
      return parsed ? { ...s, withdrawal: parsed } : null;
    })
    .filter((s): s is (Servicio & { withdrawal: { fechaRetiroStr: string; notasRetiro: string } }) => 
      s !== null && s.ingresoTaller === false && s.entregado !== true && s.estado !== "ENTREGADO"
    );

  // Divide into today's withdrawals and other days' (Agenda)
  const todayWithdrawals = servicesWithWithdrawals.filter(s => {
    const datePart = s.withdrawal.fechaRetiroStr.split("T")[0];
    return datePart <= todayStr;
  });

  const otherWithdrawals = servicesWithWithdrawals.filter(s => {
    const datePart = s.withdrawal.fechaRetiroStr.split("T")[0];
    return datePart > todayStr;
  });

  // Filter other withdrawals by selectedDate and searchQuery
  const filteredOtherWithdrawals = otherWithdrawals.filter(s => {
    const client = clientMap.get(s.clienteId);
    if (!client) return false;

    // Search query match
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = client.nombreApellido.toLowerCase().includes(query);
    const idMatch = formatClienteId(client).includes(query);
    const phoneMatch = [client.telCel, client.telFijo, client.telCelBis, client.telCelOtro]
      .some(p => p && p.includes(query));
    const addressMatch = [client.calle, client.numero, client.barrio, client.localidad]
      .some(a => a && a.toLowerCase().includes(query));
    const matchesQuery = !query || nameMatch || idMatch || phoneMatch || addressMatch;

    // Date filter match
    const datePart = s.withdrawal.fechaRetiroStr.split("T")[0];
    const matchesDate = !selectedDate || datePart === selectedDate;

    return matchesQuery && matchesDate;
  });

  // Sort function for withdrawal times
  const sortByTime = (
    a: Servicio & { withdrawal: { fechaRetiroStr: string } },
    b: Servicio & { withdrawal: { fechaRetiroStr: string } }
  ) => {
    return a.withdrawal.fechaRetiroStr.localeCompare(b.withdrawal.fechaRetiroStr);
  };

  todayWithdrawals.sort(sortByTime);
  filteredOtherWithdrawals.sort(sortByTime);

  // Grouping helper type
  interface GroupedWithdrawal {
    id: string;
    clienteId: string;
    isRetirado: boolean;
    withdrawal: {
      fechaRetiroStr: string;
      notasRetiro: string;
    };
    services: (Servicio & { withdrawal: { fechaRetiroStr: string; notasRetiro: string } })[];
  }

  const groupWithdrawals = (list: typeof servicesWithWithdrawals) => {
    const groupsMap = new Map<string, typeof servicesWithWithdrawals>();
    list.forEach(item => {
      // Group by client ID and exact date/time string of withdrawal
      const key = `${item.clienteId}_${item.withdrawal.fechaRetiroStr.split("T")[0]}_${formatTimeStr(item.withdrawal.fechaRetiroStr)}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(item);
    });

    const grouped: GroupedWithdrawal[] = [];
    groupsMap.forEach((items, key) => {
      const first = items[0];
      const allRetirado = items.every(s => s.ingresoTaller === true);
      const combinedNotes = items
        .map(s => s.withdrawal.notasRetiro)
        .filter(Boolean)
        .filter((value, index, self) => self.indexOf(value) === index)
        .join(" | ");

      grouped.push({
        id: key,
        clienteId: first.clienteId,
        isRetirado: allRetirado,
        withdrawal: {
          fechaRetiroStr: first.withdrawal.fechaRetiroStr,
          notasRetiro: combinedNotes
        },
        services: items
      });
    });

    return grouped;
  };

  const sortGroupedByTime = (
    a: GroupedWithdrawal,
    b: GroupedWithdrawal
  ) => {
    return a.withdrawal.fechaRetiroStr.localeCompare(b.withdrawal.fechaRetiroStr);
  };

  const sortGroupedByRetiradoAndTime = (
    a: GroupedWithdrawal,
    b: GroupedWithdrawal
  ) => {
    if (a.isRetirado !== b.isRetirado) {
      return a.isRetirado ? 1 : -1;
    }
    return a.withdrawal.fechaRetiroStr.localeCompare(b.withdrawal.fechaRetiroStr);
  };

  const groupedTodayWithdrawals = groupWithdrawals(todayWithdrawals).filter(g => !g.isRetirado);
  const groupedOtherWithdrawals = groupWithdrawals(filteredOtherWithdrawals);

  groupedTodayWithdrawals.sort(sortGroupedByRetiradoAndTime);
  groupedOtherWithdrawals.sort(sortGroupedByTime);

  // Extract all services that are ready for delivery or in progress
  const readyDeliveries = servicios.filter(s => 
    (s.estado === "LISTO_PARA_ENTREGA" || s.estado === "ENTREGA_EN_PROGRESO" || s.terminado === true) &&
    s.entregado !== true
  );

  // Extract all services that have been successfully delivered
  const baseDelivered = servicios.filter(s => 
    s.entregado === true || s.estado === "ENTREGADO"
  );

  const deliveredDeliveries = baseDelivered.filter(s => {
    if (!deliveredSearchTerm.trim()) return true;
    const query = deliveredSearchTerm.toLowerCase().trim();
    
    // Match order number
    if (String(s.numeroServicio).includes(query)) return true;

    // Match client info
    const client = clientMap.get(s.clienteId);
    if (client) {
      const nameMatch = client.nombreApellido?.toLowerCase().includes(query);
      const calleMatch = client.calle?.toLowerCase().includes(query);
      const numeroMatch = client.numero?.toLowerCase().includes(query);
      const localidadMatch = client.localidad?.toLowerCase().includes(query);
      return nameMatch || calleMatch || numeroMatch || localidadMatch;
    }
    return false;
  });

  const handleSaveDeliveryInfo = async (srvId: string) => {
    try {
      const userUid = profile?.uid || user?.uid || "logistica";
      const userNombre = profile?.nombre || profile?.nombreApellido || user?.displayName || "Logística";

      let resolvedDate: Date | null = null;
      if (deliveryCita) {
        const [year, month, day] = deliveryCita.split("-").map(Number);
        resolvedDate = new Date(year, month - 1, day, 12, 0, 0);
      }

      await ServiciosService.update(
        srvId,
        {
          citaEntrega: resolvedDate,
          horaEntregaDesde: deliveryHoraDesde,
          horaEntregaHasta: deliveryHoraHasta,
          infoLogistica: deliveryInfo
        },
        userUid,
        userNombre,
        "Logística: datos de planificación de entrega actualizados"
      );
      setEditingDeliveryId(null);
      await loadData();
    } catch (e) {
      console.error("Error saving delivery info:", e);
      alert("Error al intentar guardar los datos de envío.");
    }
  };



  const isAdmin = profile?.rol === "superadmin" || profile?.rol === "admin" || profile?.rol === "administracion";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HUB / MENU LAUNCHER VIEW */}
      {view === "hub" && (
        <>
          {/* Header section */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
              <Truck className="w-8 h-8 text-indigo-500 shrink-0" />
              Logística
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
              Selecciona una de las herramientas de ruteo, geolocalización o entrega/retiro de equipos.
            </p>
          </div>

          {/* Cards Container */}
          <div className={`grid grid-cols-1 ${(isAdmin || profile?.rol === "logistica") ? "md:grid-cols-3" : "md:grid-cols-2"} gap-6 max-w-5xl pt-2`}>
            {(isAdmin || profile?.rol === "logistica") && (
              /* CARD: ENTREGAS */
              <button
                onClick={() => setView("entregas")}
                className="group flex flex-col text-left p-6 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer relative overflow-hidden"
                id="btn-logistica-entregas"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-full blur-2xl group-hover:bg-emerald-100/50 transition-colors"></div>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white font-display">
                    ENTREGAS
                  </h2>
                </div>
                
                <p className="text-sm text-slate-500 dark:text-gray-400 mb-6 flex-1">
                  Planificación, programación de horarios, inicio de despacho y entrega de equipos reparados en taller.
                </p>
                
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span>Gestionar Entregas</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            )}

            {/* CARD 1: TRACKER */}
            <button
              onClick={() => setView("tracker")}
              className="group flex flex-col text-left p-6 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden"
              id="btn-logistica-tracker"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-full blur-2xl group-hover:bg-indigo-100/50 transition-colors"></div>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                  <Compass className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white font-display">
                  TRACKER
                </h2>
              </div>
              
              <p className="text-sm text-slate-500 dark:text-gray-400 mb-6 flex-1">
                Monitoreo en tiempo real de entregas, ruteo satelital y geolocalización de conductores para clientes de Santo Tomé y Santa Fe.
              </p>
              
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <span>Abrir Tracker</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* CARD 2: RETIROS */}
            <button
              onClick={() => setView("retiros")}
              className="group flex flex-col text-left p-6 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-500 dark:hover:border-amber-500 transition-all cursor-pointer relative overflow-hidden"
              id="btn-logistica-retiros"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/50 dark:bg-amber-950/10 rounded-full blur-2xl group-hover:bg-amber-100/50 transition-colors"></div>

              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white font-display">
                  RETIROS
                </h2>
              </div>

              <p className="text-sm text-slate-500 dark:text-gray-400 mb-6 flex-1">
                Visualización centralizada de los retiros pactados para hoy (destacados) y agenda interactiva de retiros programados para otros días.
              </p>

              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <span>Gestionar Retiros</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </>
      )}

      {/* TRACKER VIEW */}
      {view === "tracker" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setView("hub")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white font-extrabold rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer text-xs active:scale-95 group"
              id="btn-back-tracker"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Volver al Menú de Logística</span>
            </button>
            <span className="text-xs font-mono text-slate-400">TRACKER SATELITAL ACTIVO</span>
          </div>
          
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <Tracker isEmbedded={true} />
          </div>
        </div>
      )}
       {/* RETIROS VIEW */}
      {view === "retiros" && (
        <div className="space-y-6 animate-fade-in">
          {/* Title & Action bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-150 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer active:scale-95 group"
                title="Volver"
                id="btn-back-retiros"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                <span>Volver</span>
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-amber-500" />
                  Retiros del Día
                </h1>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Equipos a retirar pactados para hoy.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => setView("agenda-general")}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 transition-all cursor-pointer w-full sm:w-auto"
                id="btn-go-agenda-general"
              >
                <ClipboardList className="w-4 h-4" />
                <span>Agenda General</span>
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span>Sincronizar</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-500 dark:text-gray-400">Cargando cronograma de retiros...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-amber-100 dark:border-amber-950/40 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                    Retiros Pactados para Hoy (Cantidad: {groupedTodayWithdrawals.length})
                  </h2>
                </div>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 rounded-xl capitalize">
                  {formatSpanishDate(todayStr)}
                </span>
              </div>

              {groupedTodayWithdrawals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-amber-50/20 dark:bg-amber-950/5 border border-dashed border-amber-200/50 dark:border-amber-900/20 rounded-2xl text-center space-y-4 max-w-2xl mx-auto">
                  <Info className="w-12 h-12 text-amber-500/70" />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-base">
                      No hay retiros agendados para hoy
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto">
                      Todos los retiros para el día de hoy están al día o no se registraron visitas hoy. Haz clic en el botón superior <strong>"Agenda General"</strong> para planificar y buscar retiros de otros días.
                    </p>
                  </div>
                  <button
                    onClick={() => setView("agenda-general")}
                    className="inline-flex items-center gap-2 h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    <ClipboardList className="w-4.5 h-4.5" />
                    <span>Abrir Agenda General</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groupedTodayWithdrawals.map(group => {
                    const client = clientMap.get(group.clienteId);
                    if (!client) return null;

                    const isRetirado = group.isRetirado;
                    const isOverdue = !isRetirado && group.withdrawal.fechaRetiroStr.split("T")[0] < todayStr;

                    const addressStr = [
                      client.calle ? `${client.calle} ${client.numero || ""}`.trim() : "",
                      client.torre ? `Torre ${client.torre}` : "",
                      client.piso ? `Piso ${client.piso}` : "",
                      client.depto ? `Depto ${client.depto}` : "",
                      client.barrio ? `Barrio ${client.barrio}` : "",
                      client.localidad ? `${client.localidad}` : "",
                      client.zona ? `(Zona: ${client.zona})` : ""
                    ].filter(Boolean).join(", ");

                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${client.calle || ""} ${client.numero || ""}, ${client.barrio || ""}, ${client.localidad || "Santo Tome"}, Santa Fe, Argentina`
                    )}`;

                    return (
                      <div 
                        key={group.id}
                        className={`border-2 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden transition-all duration-300 ${
                          isRetirado
                            ? "bg-gradient-to-br from-emerald-50/40 via-white to-white dark:from-emerald-950/10 dark:via-gray-900 dark:to-gray-900 border-emerald-200/80 dark:border-emerald-900/40"
                            : isOverdue
                              ? "animate-neon-pulse border-red-500/80 bg-red-500/[0.03] dark:bg-red-950/[0.05]"
                              : "bg-gradient-to-br from-amber-50/40 via-white to-white dark:from-amber-950/10 dark:via-gray-900 dark:to-gray-900 border-amber-200/80 dark:border-amber-900/40"
                        }`}
                      >
                        {/* Left highlight band */}
                        <div className={`absolute top-0 left-0 bottom-0 w-1.5 transition-colors duration-300 ${
                          isRetirado 
                            ? "bg-emerald-500" 
                            : isOverdue
                              ? "bg-red-600 animate-pulse"
                              : "bg-amber-500"
                        }`}></div>

                        {/* Top bar with time and status */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 pl-2">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold transition-colors duration-300 ${
                            isRetirado
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400"
                              : isOverdue
                                ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400 border border-red-200/50"
                                : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400"
                          }`}>
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>{formatTimeStr(group.withdrawal.fechaRetiroStr)}</span>
                            {isRetirado && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/40">
                                En Taller
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider bg-red-600 text-white border border-red-500 animate-pulse">
                                Retiro Atrasado ({formatSpanishDate(group.withdrawal.fechaRetiroStr.split("T")[0])})
                              </span>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`¿Está seguro que desea eliminar las ${group.services.length} órdenes/retiros de este cliente? Esta acción no se puede deshacer.`)) {
                                    try {
                                      for (const srv of group.services) {
                                        await ServiciosService.delete(srv.id!);
                                      }
                                      await loadData();
                                    } catch (err) {
                                      console.error("Error deleting services:", err);
                                      alert("Error al eliminar los servicios.");
                                    }
                                  }
                                }}
                                className="p-1 text-red-600 hover:text-red-700 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                                title="Eliminar Retiros del Cliente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Client & Device info */}
                        <div className="pl-2 space-y-3">
                          {client.clienteProblematico && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold border border-red-100 dark:border-red-900/30">
                                ⚠️ Conflictivo
                              </span>
                            </div>
                          )}

                          {/* Address details */}
                          {addressStr ? (
                            <div className="bg-slate-50 dark:bg-gray-855 p-3.5 rounded-xl border border-slate-150 dark:border-gray-800 flex items-center justify-between gap-3 shadow-xs">
                              <div className="space-y-1 flex-1">
                                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Dirección de Retiro</span>
                                <span className="text-base text-slate-900 dark:text-white font-extrabold leading-relaxed block">
                                  {addressStr}
                                </span>
                              </div>
                              <a 
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-12 h-12 flex items-center justify-center bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl transition-all shadow-sm shrink-0 active:scale-95"
                                title="Ver ruteo en Google Maps"
                              >
                                <MapIcon className="w-5.5 h-5.5" />
                              </a>
                            </div>
                          ) : (
                            <p className="text-xs text-red-500 italic">No se registró dirección para este cliente.</p>
                          )}

                          {/* Equipments button instead of full list */}
                          <div className="bg-slate-50 dark:bg-gray-855 p-3.5 rounded-xl border border-slate-150 dark:border-gray-800 flex items-center justify-between gap-3 shadow-xs">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Equipos / Aparatos</span>
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                {group.services.length} {group.services.length === 1 ? "equipo registrado" : "equipos registrados"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedGroupForModal(group)}
                              className="inline-flex items-center gap-1.5 h-10 px-4 bg-indigo-50 hover:bg-indigo-150 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl border border-indigo-200/50 dark:border-indigo-800/40 transition-all active:scale-95 cursor-pointer shrink-0"
                            >
                              <Wrench className="w-4 h-4" />
                              <span>Ver Equipos</span>
                            </button>
                          </div>

                          {/* Special instructions / Notes retiro */}
                          {group.withdrawal.notasRetiro && (
                            <div className="p-3 bg-amber-500/10 border border-amber-300/30 text-amber-850 dark:text-amber-300 text-xs rounded-xl flex items-start gap-2.5">
                              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                              <div>
                                <span className="font-extrabold uppercase text-[9px] tracking-wider text-amber-600 dark:text-amber-400 block">Info Logistica</span>
                                <p className="mt-0.5 font-medium leading-relaxed">{group.withdrawal.notasRetiro}</p>
                              </div>
                            </div>
                          )}

                          {/* Contact actions */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-slate-100 dark:border-gray-800">
                            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                              {client.telCel && (
                                <a 
                                  href={`tel:${client.telCel}`}
                                  className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl transition-all border border-blue-100 dark:border-blue-900/30 active:scale-95 cursor-pointer"
                                >
                                  <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                  <span>Llamar Cel</span>
                                </a>
                              )}
                              {client.telCel && (
                                <a 
                                  href={getWhatsAppUrl(client.telCel)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm shadow-emerald-500/10 cursor-pointer"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  <span>WhatsApp</span>
                                </a>
                              )}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
                              {client.telFijo && (
                                <a 
                                  href={`tel:${client.telFijo}`}
                                  className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
                                >
                                  <Phone className="w-4 h-4 text-slate-500" />
                                  <span>Fijo: {client.telFijo}</span>
                                </a>
                              )}
                              
                              {!isRetirado && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRetiradoGroup(group)}
                                  className="inline-flex items-center justify-center gap-1.5 h-11 px-4.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-orange-500/15 active:scale-95 cursor-pointer w-full sm:w-auto uppercase"
                                >
                                  <span>RETIRADO</span>
                                </button>
                              )}

                              {!isRetirado && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!window.confirm(`¿Confirmar "Reparado en Domicilio"?\n\nEl equipo fue reparado en el lugar y NO ingresa al taller. Pasará a ENTREGADOS.`)) return;
                                    try {
                                      const userUid = profile?.uid || user?.uid || "logistica";
                                      const userNombre = profile?.nombre || profile?.nombreApellido || user?.displayName || "Logística";
                                      for (const srv of group.services) {
                                        await ServiciosService.update(
                                          srv.id!,
                                          {
                                            entregado: true,
                                            terminado: true,
                                            estado: "ENTREGADO" as any,
                                            ingresoTaller: false
                                          },
                                          userUid,
                                          userNombre,
                                          "Reparado en domicilio: equipo reparado in-situ sin ingresar al taller"
                                        );
                                        await NotificationsService.create({
                                          targetRole: "taller",
                                          title: "Reparado en Domicilio",
                                          message: `El equipo ${srv.aparato || ""} #${srv.numeroServicio || ""} fue reparado en domicilio sin ingresar al taller.`,
                                          serviceId: srv.id!
                                        });
                                      }
                                      await loadData();
                                    } catch (err) {
                                      console.error("Error marcando reparado en domicilio:", err);
                                      alert("Error al actualizar el estado. Intente nuevamente.");
                                    }
                                  }}
                                  className="inline-flex items-center justify-center gap-1.5 h-11 px-4.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-teal-600/15 active:scale-95 cursor-pointer w-full sm:w-auto uppercase"
                                >
                                  <span>🔧 Reparado en Domicilio</span>
                                </button>
                              )}

                              <button
                                onClick={() => navigate("clientes", client.id)}
                                className="inline-flex items-center justify-center gap-1.5 h-11 px-4.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer w-full sm:w-auto"
                              >
                                <span>Ver Orden de Servicio</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
         {/* AGENDA GENERAL VIEW */}
      {view === "agenda-general" && (
        <div className="space-y-6 animate-fade-in">
          {/* Title & Back bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-150 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView("retiros")}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer active:scale-95 group"
                title="Volver"
                id="btn-back-agenda-general"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                <span>Volver</span>
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
                  <ClipboardList className="w-6 h-6 text-indigo-500" />
                  Agenda General de Retiros
                </h1>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Planificación y búsqueda interactiva de retiros programados.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => setView("retiros")}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer w-full sm:w-auto active:scale-95 group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                <span>Volver a Hoy</span>
              </button>
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span>Sincronizar</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-500 dark:text-gray-400">Cargando agenda de retiros...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Filters (col-span-4) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-5 rounded-2xl shadow-xs space-y-4">
                  <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">Filtros de Agenda</h3>
                  
                  {/* Search input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Búsqueda de Cliente</label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Buscar por nombre, ID, calle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-11 pl-10 pr-3.5 bg-slate-50 dark:bg-gray-855 border border-slate-200 dark:border-gray-800 rounded-xl text-base md:text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Date Picker */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Filtrar por fecha específica</label>
                    <div className="flex gap-2">
                      <input 
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="flex-1 h-11 px-3 bg-slate-50 dark:bg-gray-855 border border-slate-200 dark:border-gray-800 rounded-xl text-base md:text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white font-medium font-sans"
                      />
                      {selectedDate && (
                        <button
                          onClick={() => setSelectedDate("")}
                          className="h-11 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-gray-800 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Filters */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-gray-800">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">Atajos rápidos</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          setSelectedDate(getLocalDateString(tomorrow));
                        }}
                        className="h-9 px-3.5 bg-slate-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-xs font-semibold text-slate-700 dark:text-gray-300 transition-colors cursor-pointer flex items-center justify-center"
                      >
                        Mañana
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDate("");
                          setSearchQuery("");
                        }}
                        className="h-9 px-3.5 bg-slate-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-xs font-semibold text-slate-700 dark:text-gray-300 transition-colors cursor-pointer flex items-center justify-center"
                      >
                        Ver todos
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* Right Column: Agenda List (col-span-8) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-4 sm:p-5 rounded-2xl shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 pb-2">
                    <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">
                      Resultados de la Agenda ({groupedOtherWithdrawals.length})
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {groupedOtherWithdrawals.length === 0 ? (
                      <div className="text-center py-16 bg-slate-50/50 dark:bg-gray-950/20 border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl">
                        <p className="text-sm font-semibold text-slate-500 dark:text-gray-400">No se encontraron retiros agendados para los filtros seleccionados.</p>
                        <p className="text-xs text-slate-400 mt-1">Intenta cambiar la fecha o borrar la búsqueda de clientes.</p>
                        {(searchQuery || selectedDate) && (
                          <button
                            onClick={() => {
                              setSearchQuery("");
                              setSelectedDate("");
                            }}
                            className="mt-4 h-10 px-4 inline-flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 dark:text-indigo-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            Restablecer Filtros
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groupedOtherWithdrawals.map(group => {
                          const client = clientMap.get(group.clienteId);
                          if (!client) return null;

                          const datePart = group.withdrawal.fechaRetiroStr.split("T")[0];

                          return (
                            <div 
                              key={group.id}
                              className="bg-slate-50/50 dark:bg-gray-855 border border-slate-150 dark:border-gray-800/80 rounded-xl p-4 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-900 transition-all flex flex-col gap-3 relative"
                            >
                              {/* Top date and time line */}
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-indigo-750 dark:text-indigo-400 uppercase bg-indigo-100/70 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                                  {formatSpanishDate(datePart)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-gray-300">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{formatTimeStr(group.withdrawal.fechaRetiroStr)}</span>
                                  </div>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (window.confirm(`¿Está seguro que desea eliminar las ${group.services.length} órdenes/retiros de este cliente? Esta acción no se puede deshacer.`)) {
                                          try {
                                            for (const srv of group.services) {
                                              await ServiciosService.delete(srv.id!);
                                            }
                                            await loadData();
                                          } catch (err) {
                                            console.error("Error deleting services:", err);
                                            alert("Error al eliminar los servicios.");
                                          }
                                        }
                                      }}
                                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                      title="Eliminar Retiros del Cliente"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Client name, ID, and address */}
                              <div className="space-y-1">
                                <p className="text-xs text-slate-700 dark:text-gray-350 font-medium leading-relaxed">
                                  {client.calle ? `${client.calle} ${client.numero || ""}` : "S/D"}, {client.localidad || "Santo Tomé"}
                                </p>
                              </div>

                              {/* Equipments list */}
                              <div className="space-y-1.5 py-1">
                                {group.services.map((srv, idx) => (
                                  <div key={srv.id} className="text-[11px] text-slate-600 dark:text-gray-350 bg-slate-100/50 dark:bg-gray-800/40 px-2 py-1 rounded border border-slate-100 dark:border-gray-800/80">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {srv.aparato} ({srv.marcaModelo})
                                    </span>
                                    <span className="text-slate-400 mx-1.5">|</span>
                                    <span className="text-slate-500 dark:text-gray-455 italic">
                                      {srv.desperfectoUsuario}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Notes summary badge */}
                              {group.withdrawal.notasRetiro && (
                                <div className="bg-white dark:bg-gray-900 px-3 py-2 rounded-xl border border-slate-150 dark:border-gray-800 text-[11px] text-slate-600 dark:text-gray-300 italic leading-relaxed shadow-3xs">
                                  <span className="font-bold not-italic text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Nota:</span>
                                  "{group.withdrawal.notasRetiro}"
                                </div>
                              )}

                              {/* Quick access footer */}
                              <div className="flex items-center justify-between border-t border-slate-150/60 dark:border-gray-800 pt-2.5 mt-auto">
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {group.services.length === 1 
                                    ? `Orden #${group.services[0].numeroServicio}`
                                    : `${group.services.length} Órdenes`
                                  }
                                </span>
                                <button
                                  onClick={() => navigate("clientes", client.id)}
                                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-3xs active:scale-95"
                                >
                                  <span>Ver Orden de Servicio</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>
          )}
        </div>
      )}
      {/* ENTREGAS VIEW */}
      {view === "entregas" && (
        <div className="space-y-6 animate-fade-in">
          {/* Title & Action bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-150 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer active:scale-95 group"
                title="Volver"
                id="btn-back-entregas"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                <span>Volver</span>
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
                  <Truck className="w-6 h-6 text-emerald-500" />
                  {activeEntregaTab === "pendientes" ? "Entregas Pendientes" : "Historial de Entregas"}
                </h1>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {activeEntregaTab === "pendientes"
                    ? "Equipos reparados en taller listos para ser entregados."
                    : "Historial de equipos que ya fueron entregados al cliente."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {activeEntregaTab === "pendientes" && isAdmin && (
                <button
                onClick={() => {
                  const selectedSrvs = readyDeliveries.filter(s => selectedReceipts.includes(s.id));
                  const today = new Date();
                  const dayName = today.toLocaleDateString("es-AR", { weekday: "long" });
                  const dayNum = today.getDate();
                  const monthName = today.toLocaleDateString("es-AR", { month: "long" });
                  const year = today.getFullYear();
                  const fechaStr = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dayNum} de ${monthName} de ${year}`;

                  const receiptsHtml = selectedSrvs.map(srv => {
                    const client = clientMap.get(srv.clienteId);
                    if (!client) return "";
                    const calle = client.calle || "";
                    const numero = client.numero || "";
                    const piso = client.piso || "";
                    const depto = client.depto || "";
                    const torre = client.torre || "";
                    const localidad = client.localidad || "Santa Fe";
                    const horaDesde = srv.horaEntregaDesde || "";
                    const horaHasta = srv.horaEntregaHasta || "";
                    const aparato = srv.aparato || "";
                    const marcaModelo = srv.marcaModelo || "";
                    // Parse infoLogistica and only keep the actual notes, stripping metadata fields
                    const rawInfo = srv.infoLogistica || "";
                    const infoBox = rawInfo
                      .split(" | ")
                      .filter(part =>
                        !part.startsWith("Retiro acordado:") &&
                        !part.startsWith("Config:") &&
                        !part.startsWith("Notas retiro:")
                      )
                      .concat(
                        rawInfo.split(" | ")
                          .filter(part => part.startsWith("Notas retiro:"))
                          .map(part => part.replace("Notas retiro: ", "").trim())
                      )
                      .filter(Boolean)
                      .join("\n") || srv.notasInternas || "";

                    return `
                      <div class="receipt-item">
                        <div class="receipt-title">Recepcion Conforme</div>
                        <div class="receipt-main">
                          <div class="receipt-body">
                            <div class="receipt-top-row">
                              <span class="receipt-label">${localidad},</span>
                              <span class="receipt-label">&nbsp;&nbsp;${fechaStr}</span>
                              <span class="hora-group">
                                <span class="receipt-label">entre las</span>
                                <span class="dashed-field">${horaDesde}</span>
                                <span class="receipt-label">y las</span>
                                <span class="dashed-field">${horaHasta}</span>
                              </span>
                              <span class="hora-group">
                                ${torre ? `<span class="receipt-label">Torre</span><span class="dashed-field-sm">${torre}</span>` : ""}
                                <span class="receipt-label">Piso</span>
                                <span class="dashed-field-sm">${piso}</span>
                                <span class="receipt-label">Dpto.</span>
                                <span class="dashed-field-sm">${depto}</span>
                              </span>
                            </div>
                            <div class="receipt-addr-row">
                              <span class="receipt-label">En el día de la fecha, recibí en mi domicilio de</span>
                              <span class="addr-bold">&nbsp;${calle}&nbsp;${numero}</span>
                            </div>
                            <div class="receipt-aparato-row">
                              <span class="receipt-label">${aparato}</span>
                              <span class="receipt-label">&nbsp;&nbsp;${marcaModelo}</span>
                            </div>
                            <div class="receipt-firma-row">
                              <span class="receipt-label">DNI</span>
                              <span class="firma-line"></span>
                              <span class="receipt-label">FIRMA</span>
                              <span class="firma-line"></span>
                            </div>
                          </div>
                          <div class="receipt-box">${infoBox}</div>
                        </div>
                      </div>
                    `;
                  }).join("");

                  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Recibos de Entrega</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
    .receipt-item { border-bottom: 4px dashed #000; padding: 10px 16px 14px; page-break-inside: avoid; }
    .receipt-item:last-child { border-bottom: none; }
    .receipt-title { text-align: center; font-size: 15px; font-weight: bold; text-decoration: underline; margin-bottom: 8px; letter-spacing: 0.5px; }
    .receipt-main { display: flex; gap: 10px; align-items: flex-start; }
    .receipt-body { flex: 1; }
    .receipt-top-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 4px; }
    .hora-group { display: inline-flex; align-items: center; gap: 3px; }
    .receipt-label { white-space: nowrap; }
    .dashed-field { display: inline-block; border-bottom: 1px dashed #555; min-width: 38px; height: 13px; vertical-align: bottom; }
    .dashed-field-sm { display: inline-block; border-bottom: 1px dashed #555; min-width: 25px; height: 13px; vertical-align: bottom; }
    .receipt-addr-row { display: flex; flex-wrap: wrap; align-items: baseline; margin: 4px 0; }
    .addr-bold { font-weight: bold; }
    .receipt-aparato-row { display: flex; gap: 6px; align-items: baseline; margin: 4px 0; }
    .receipt-firma-row { display: flex; gap: 18px; align-items: flex-end; margin-top: 8px; }
    .firma-line { flex: 1; border-bottom: 1px dashed #555; height: 13px; }
    .receipt-box { border: 1px solid #555; min-height: 48px; padding: 4px 6px; font-size: 10px; line-height: 1.4; min-width: 110px; max-width: 130px; word-break: break-word; align-self: flex-start; }
    @media print {
      body { margin: 0; }
      .receipt-item { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${receiptsHtml}
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;

                  const popup = window.open("", "_blank", "width=800,height=900");
                  if (popup) {
                    popup.document.write(html);
                    popup.document.close();
                  } else {
                    alert("El navegador bloqueó la ventana emergente. Por favor, permitir ventanas emergentes para este sitio.");
                  }
                }}
                disabled={selectedReceipts.length === 0}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 dark:disabled:bg-gray-800 disabled:text-slate-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/10 disabled:shadow-none active:scale-95 w-full sm:w-auto"
              >
                <ClipboardList className="w-4 h-4" />
                <span>Generar Recibos {selectedReceipts.length > 0 ? `(${selectedReceipts.length})` : ""}</span>
              </button>
              )}
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span>Sincronizar</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 sm:gap-2 border-b border-slate-100 dark:border-gray-800/60 pb-px overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveEntregaTab("pendientes")}
              className={`pb-3 text-xs sm:text-sm font-extrabold border-b-2 px-4 sm:px-6 transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeEntregaTab === "pendientes"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 text-indigo-600 border-b-2"
                  : "border-transparent text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"
              }`}
            >
              Pendientes ({readyDeliveries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveEntregaTab("entregados")}
              className={`pb-3 text-xs sm:text-sm font-extrabold border-b-2 px-4 sm:px-6 transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeEntregaTab === "entregados"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 text-indigo-600 border-b-2"
                  : "border-transparent text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"
              }`}
            >
              Entregados ({deliveredDeliveries.length})
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-500 dark:text-gray-400">Cargando entregas...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {activeEntregaTab === "entregados" && (
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Buscar por dirección, número de orden o cliente..."
                    value={deliveredSearchTerm}
                    onChange={(e) => setDeliveredSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 bg-white dark:bg-gray-900 text-slate-850 dark:text-gray-150 border border-slate-200 dark:border-gray-800 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
                  />
                  {deliveredSearchTerm && (
                    <button
                      onClick={() => setDeliveredSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-indigo-650 hover:text-indigo-750 dark:text-indigo-400 bg-slate-50 dark:bg-gray-800 px-2 py-1 rounded-md transition-all cursor-pointer"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              )}
              {activeEntregaTab === "pendientes" ? (
                readyDeliveries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-emerald-50/20 dark:bg-emerald-950/5 border border-dashed border-emerald-200/50 dark:border-emerald-900/20 rounded-2xl text-center space-y-4 max-w-2xl mx-auto w-full">
                    <Info className="w-12 h-12 text-emerald-500/70" />
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-base">
                        No hay entregas pendientes
                      </p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto">
                        Todos los equipos reparados han sido entregados a los clientes. Cuando un técnico marque un trabajo como terminado en el taller, aparecerá en esta sección.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card Layout for iPhone / Mobile screens */}
                    <div className="block lg:hidden space-y-4">
                      {readyDeliveries.map(srv => {
                        const client = clientMap.get(srv.clienteId);
                        if (!client) return null;

                        const isDespachado = srv.estado === "ENTREGA_EN_PROGRESO";
                        const clientAddress = [
                          client.calle ? `${client.calle} ${client.numero || ""}`.trim() : "",
                          client.torre ? `Torre ${client.torre}` : "",
                          client.piso ? `Piso ${client.piso}` : "",
                          client.depto ? `Depto ${client.depto}` : "",
                          client.localidad ? `${client.localidad}` : ""
                        ].filter(Boolean).join(", ");

                        const isChecked = isAdmin && selectedReceipts.includes(srv.id);
                        const maxReached = selectedReceipts.length >= 30 && !isChecked;

                        return (
                          <div
                            key={srv.id}
                            onClick={() => {
                              if (!isAdmin) return;
                              if (isChecked) {
                                setSelectedReceipts(prev => prev.filter(id => id !== srv.id));
                              } else {
                                if (!maxReached) {
                                  setSelectedReceipts(prev => [...prev, srv.id]);
                                }
                              }
                            }}
                            className={`p-4 rounded-2xl border-2 transition-all relative overflow-hidden space-y-3 ${
                              isChecked
                                ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500/80 dark:border-indigo-500 cursor-pointer"
                                : "bg-white dark:bg-gray-900 border-slate-150 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                {isAdmin && (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={maxReached}
                                    onChange={() => {}} // Handled by outer div onClick
                                    className="w-4.5 h-4.5 text-indigo-600 border-slate-300 dark:border-gray-700 rounded focus:ring-indigo-500 cursor-pointer"
                                  />
                                )}
                                <span className="text-xs font-mono font-bold text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                  Orden #{srv.numeroServicio}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                                isDespachado
                                  ? "bg-indigo-100/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/40"
                                  : "bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/40"
                              }`}>
                                {isDespachado ? "En Camino" : "Listo"}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-sm font-bold text-slate-900 dark:text-white block">
                                {client.nombreApellido}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-gray-400 block leading-relaxed">
                                {clientAddress || "Sin dirección cargada"}
                              </span>
                            </div>

                            <div className="bg-slate-50 dark:bg-gray-850 p-2.5 rounded-xl text-xs text-slate-700 dark:text-gray-300 font-medium">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-0.5">Equipo</span>
                              {srv.aparato} {srv.marcaModelo ? `(${srv.marcaModelo})` : ""}
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm("¿Está seguro que desea eliminar este servicio/entrega? Esta acción no se puede deshacer.")) {
                                      try {
                                        await ServiciosService.delete(srv.id!);
                                        await loadData();
                                      } catch (err) {
                                        console.error("Error deleting service:", err);
                                        alert("Error al eliminar el servicio.");
                                      }
                                    }
                                  }}
                                  className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-3xs"
                                  title="Eliminar de Taller"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDelivery(srv);
                                  setView("detalle-entrega");
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer border border-indigo-200/60 dark:border-indigo-900/40"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>VER DETALLE</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden lg:block overflow-x-auto bg-white dark:bg-gray-900 rounded-2xl border border-slate-150 dark:border-gray-800 shadow-xs">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="border-b border-slate-150 dark:border-gray-850 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider bg-slate-50/50 dark:bg-gray-850/20">
                            {isAdmin && (
                              <th className="py-3.5 pl-4 pr-2 font-extrabold w-10">
                                <span className="sr-only">Seleccionar</span>
                              </th>
                            )}
                            <th className="py-3.5 px-4 font-extrabold">Orden</th>
                            <th className="py-3.5 px-4 font-extrabold">Cliente / Dirección</th>
                            <th className="py-3.5 px-4 font-extrabold">Equipo</th>
                            <th className="py-3.5 px-4 font-extrabold">Estado</th>
                            <th className="py-3.5 px-4 font-extrabold text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-gray-800/80">
                          {readyDeliveries.map(srv => {
                            const client = clientMap.get(srv.clienteId);
                            if (!client) return null;

                            const clientAddress = [
                              client.calle ? `${client.calle} ${client.numero || ""}`.trim() : "",
                              client.torre ? `Torre ${client.torre}` : "",
                              client.piso ? `Piso ${client.piso}` : "",
                              client.depto ? `Depto ${client.depto}` : "",
                              client.localidad ? `${client.localidad}` : ""
                            ].filter(Boolean).join(", ");

                            const isChecked = selectedReceipts.includes(srv.id);
                            const maxReached = selectedReceipts.length >= 30 && !isChecked;
                            const isDespachado = srv.estado === "ENTREGA_EN_PROGRESO";

                            return (
                              <tr
                                key={srv.id}
                                className={`transition-colors ${
                                  isAdmin ? "cursor-pointer" : ""
                                } ${
                                  isChecked
                                    ? "bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30"
                                    : "hover:bg-slate-50/40 dark:hover:bg-gray-850/10"
                                }`}
                                onClick={() => {
                                  if (!isAdmin) return;
                                  if (isChecked) {
                                    setSelectedReceipts(prev => prev.filter(id => id !== srv.id));
                                  } else if (!maxReached) {
                                    setSelectedReceipts(prev => [...prev, srv.id]);
                                  }
                                }}
                              >
                                {isAdmin && (
                                  <td className="py-3.5 pl-4 pr-2 w-10" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={maxReached}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedReceipts(prev => prev.filter(id => id !== srv.id));
                                        } else if (!maxReached) {
                                          setSelectedReceipts(prev => [...prev, srv.id]);
                                        }
                                      }}
                                      className="w-4/5 h-4 rounded border-slate-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={maxReached ? "Máximo 30 clientes" : ""}
                                    />
                                  </td>
                                )}
                                <td className="py-3.5 px-4 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                  #{srv.numeroServicio}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-900 dark:text-white">
                                  {clientAddress && (
                                    <div className="text-[15px] text-slate-800 dark:text-gray-200 font-bold flex items-center gap-1.5">
                                      <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                                      <span className="truncate max-w-[300px]" title={clientAddress}>{clientAddress}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-gray-300 font-medium">
                                  {srv.aparato} {srv.marcaModelo ? `- ${srv.marcaModelo}` : ""}
                                </td>
                                <td className="py-3.5 px-4 text-xs">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                                    isDespachado
                                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30"
                                      : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100/30 dark:border-emerald-900/30"
                                  }`}>
                                    {isDespachado ? "Despachado" : "Listo"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    {isAdmin && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (window.confirm("¿Está seguro que desea eliminar este servicio/entrega? Esta acción no se puede deshacer.")) {
                                            try {
                                              await ServiciosService.delete(srv.id!);
                                              await loadData();
                                            } catch (err) {
                                              console.error("Error deleting service:", err);
                                              alert("Error al eliminar el servicio.");
                                            }
                                          }
                                        }}
                                        className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-3xs"
                                        title="Eliminar de Taller"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setSelectedDelivery(srv);
                                        setView("detalle-entrega");
                                      }}
                                      className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-3xs"
                                      title="Ver detalles y planificar"
                                    >
                                      <Eye className="w-4.5 h-4.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Warning when 30 selected */}
                    {selectedReceipts.length === 30 && (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Límite alcanzado: máximo 30 recibos por vez. Desmarca alguno para elegir otro.</span>
                      </div>
                    )}
                  </>
                )
              ) : (
                deliveredDeliveries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50/20 dark:bg-gray-900/5 border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl text-center space-y-4 max-w-2xl mx-auto w-full">
                    <Info className="w-12 h-12 text-slate-400" />
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-base">
                        No hay entregas registradas
                      </p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto">
                        Aquí aparecerán los equipos una vez que el repartidor confirme la entrega en el Tracker.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card Layout for iPhone / Mobile screens */}
                    <div className="block lg:hidden space-y-4">
                      {deliveredDeliveries.map(srv => {
                        const client = clientMap.get(srv.clienteId);
                        if (!client) return null;

                        const clientAddress = [
                          client.calle ? `${client.calle} ${client.numero || ""}`.trim() : "",
                          client.torre ? `Torre ${client.torre}` : "",
                          client.piso ? `Piso ${client.piso}` : "",
                          client.depto ? `Depto ${client.depto}` : "",
                          client.localidad ? `${client.localidad}` : ""
                        ].filter(Boolean).join(", ");

                        let fechaEntregaFormatted = "Entregado";
                        if (srv.citaEntrega) {
                          try {
                            const dateVal = new Date(srv.citaEntrega);
                            fechaEntregaFormatted = dateVal.toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            }) + " hs";
                          } catch (e) {
                            fechaEntregaFormatted = String(srv.citaEntrega);
                          }
                        }

                        return (
                          <div
                            key={srv.id}
                            className="p-4 bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 rounded-2xl shadow-xs space-y-3 relative overflow-hidden"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-xs font-mono font-bold text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                Orden #{srv.numeroServicio}
                              </span>
                              {isAdmin ? (
                                <select
                                  value={srv.estado}
                                  onChange={(e) => handleUpdateServiceState(srv.id!, e.target.value as EstadoServicio)}
                                  className="px-2 py-0.5 bg-white dark:bg-gray-850 text-slate-850 dark:text-gray-250 border border-slate-200 dark:border-gray-800 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  <option value="ENTREGADO">Entregado</option>
                                  <option value="RECIBIDO">Recibido (Taller)</option>
                                  <option value="EN_ESPERA">Espera (Taller)</option>
                                  <option value="ACEPTADO">Confirmado (Taller)</option>
                                  <option value="LISTO_PARA_ENTREGA">Listo para Entrega</option>
                                </select>
                              ) : (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/40">
                                  Entregado
                                </span>
                              )}
                            </div>

                            <div className="space-y-1">
                              <span className="text-sm font-bold text-slate-900 dark:text-white block">
                                {client.nombreApellido}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-gray-400 block leading-relaxed">
                                {clientAddress || "Sin dirección cargada"}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div className="bg-slate-50 dark:bg-gray-855 p-2.5 rounded-xl text-xs text-slate-700 dark:text-gray-300 font-medium">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-0.5">Equipo</span>
                                {srv.aparato} {srv.marcaModelo ? `(${srv.marcaModelo})` : ""}
                              </div>
                              <div className="bg-slate-50 dark:bg-gray-855 p-2.5 rounded-xl text-xs text-slate-700 dark:text-gray-300 font-medium">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-0.5">Fecha Entrega</span>
                                {fechaEntregaFormatted}
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm("¿Está seguro que desea eliminar este servicio entregado? Esta acción no se puede deshacer.")) {
                                      try {
                                        await ServiciosService.delete(srv.id!);
                                        await loadData();
                                      } catch (err) {
                                        console.error("Error deleting service:", err);
                                        alert("Error al eliminar el servicio.");
                                      }
                                    }
                                  }}
                                  className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-3xs"
                                  title="Eliminar de Historial"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDelivery(srv);
                                  setView("detalle-entrega");
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-650 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer border border-indigo-200/60 dark:border-indigo-900/40"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>VER DETALLE</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden lg:block overflow-x-auto bg-white dark:bg-gray-900 rounded-2xl border border-slate-150 dark:border-gray-800 shadow-xs">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-150 dark:border-gray-850 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider bg-slate-50/50 dark:bg-gray-850/20">
                          <th className="py-3.5 px-4 font-extrabold">Orden</th>
                          <th className="py-3.5 px-4 font-extrabold">Cliente / Dirección</th>
                          <th className="py-3.5 px-4 font-extrabold">Equipo</th>
                          <th className="py-3.5 px-4 font-extrabold">Fecha Entrega</th>
                          <th className="py-3.5 px-4 font-extrabold text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-800/80">
                        {deliveredDeliveries.map(srv => {
                          const client = clientMap.get(srv.clienteId);
                          if (!client) return null;

                          const clientAddress = [
                            client.calle ? `${client.calle} ${client.numero || ""}`.trim() : "",
                            client.piso ? `Piso ${client.piso}` : "",
                            client.depto ? `Depto ${client.depto}` : "",
                            client.localidad ? `${client.localidad}` : ""
                          ].filter(Boolean).join(", ");

                          let fechaEntregaFormatted = "Entregado";
                          if (srv.citaEntrega) {
                            try {
                              const dateVal = new Date(srv.citaEntrega);
                              fechaEntregaFormatted = dateVal.toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              });
                            } catch (e) {
                              fechaEntregaFormatted = String(srv.citaEntrega);
                            }
                          }

                          return (
                            <tr
                              key={srv.id}
                              className="hover:bg-slate-50/40 dark:hover:bg-gray-850/10 transition-colors"
                            >
                              <td className="py-3.5 px-4 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                #{srv.numeroServicio}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-900 dark:text-white">
                                {clientAddress && (
                                  <div className="text-[15px] text-slate-800 dark:text-gray-200 font-bold flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <span className="truncate max-w-[300px]" title={clientAddress}>{clientAddress}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-gray-300 font-medium">
                                {srv.aparato} {srv.marcaModelo ? `- ${srv.marcaModelo}` : ""}
                              </td>
                              <td className="py-3.5 px-4 text-xs">
                                <div className="flex flex-col gap-1">
                                  {isAdmin ? (
                                    <select
                                      value={srv.estado}
                                      onChange={(e) => handleUpdateServiceState(srv.id!, e.target.value as EstadoServicio)}
                                      className="px-2 py-0.5 bg-white dark:bg-gray-855 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-800 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 w-fit cursor-pointer"
                                    >
                                      <option value="ENTREGADO">Entregado</option>
                                      <option value="RECIBIDO">Recibido (Taller)</option>
                                      <option value="EN_ESPERA">Espera (Taller)</option>
                                      <option value="ACEPTADO">Confirmado (Taller)</option>
                                      <option value="LISTO_PARA_ENTREGA">Listo para Entrega</option>
                                    </select>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/30 dark:border-emerald-900/30 w-fit">
                                      Entregado
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5 font-semibold">
                                    {fechaEntregaFormatted}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (window.confirm("¿Está seguro que desea eliminar este servicio entregado? Esta acción no se puede deshacer.")) {
                                          try {
                                            await ServiciosService.delete(srv.id!);
                                            await loadData();
                                          } catch (err) {
                                            console.error("Error deleting service:", err);
                                            alert("Error al eliminar el servicio.");
                                          }
                                        }
                                      }}
                                      className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-3xs"
                                      title="Eliminar de Historial"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setSelectedDelivery(srv);
                                      setView("detalle-entrega");
                                    }}
                                    className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-3xs"
                                    title="Ver detalles"
                                  >
                                    <Eye className="w-4.5 h-4.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )
              )}
            </div>
          )}
      </div>
    )}

      {/* DETALLE DE ENTREGA PAGE VIEW */}
      {view === "detalle-entrega" && selectedDelivery && (() => {
        const srv = servicios.find(s => s.id === selectedDelivery.id);
        if (!srv) {
          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-3xl max-w-lg mx-auto shadow-sm">
              <Info className="w-12 h-12 text-slate-450" />
              <div className="text-center">
                <p className="font-bold text-slate-800 dark:text-slate-200 text-base">La entrega ya no está pendiente</p>
                <p className="text-xs text-slate-500 mt-1">El servicio fue finalizado o removido de entregas pendientes.</p>
              </div>
              <button
                onClick={() => setView("entregas")}
                className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Volver a Entregas
              </button>
            </div>
          );
        }

        const client = clientMap.get(srv.clienteId);
        if (!client) return null;

        const isEntregado = srv.estado === "ENTREGADO" || srv.entregado === true;
        const isDespachado = srv.estado === "ENTREGA_EN_PROGRESO";
        const isEditing = editingDeliveryId === srv.id;

        const addressStr = [
          client.calle ? `${client.calle} ${client.numero || ""}`.trim() : "",
          client.torre ? `Torre ${client.torre}` : "",
          client.piso ? `Piso ${client.piso}` : "",
          client.depto ? `Depto ${client.depto}` : "",
          client.barrio ? `Barrio ${client.barrio}` : "",
          client.localidad ? `${client.localidad}` : "",
          client.zona ? `(Zona: ${client.zona})` : ""
        ].filter(Boolean).join(", ");

        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${client.calle || ""} ${client.numero || ""}, ${client.barrio || ""}, ${client.localidad || "Santo Tome"}, Santa Fe, Argentina`
        )}`;

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Header / Title bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-150 dark:border-gray-800 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setView("entregas");
                    setEditingDeliveryId(null);
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer active:scale-95 group"
                  title="Volver a Entregas"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  <span>Volver</span>
                </button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
                    <Truck className="w-6 h-6 text-indigo-505 text-indigo-600" />
                    Detalle de Envío #{srv.numeroServicio}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Planificación y control logístico del despacho de equipos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border ${
                  isEntregado
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                    : isDespachado 
                    ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-850 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900" 
                    : "bg-amber-50 dark:bg-amber-950 text-amber-850 dark:text-amber-450 border border-amber-200 dark:border-amber-900"
                }`}>
                  {isEntregado ? "Entregado" : isDespachado ? "Entrega en Progreso" : "Listo para entregar"}
                </span>
              </div>
            </div>

            {/* Centered Content */}
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Customer Details */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-150 dark:border-gray-800 p-5 sm:p-6 shadow-xs space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-450 border-b border-slate-100 dark:border-gray-800 pb-3">
                  Datos del Cliente
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Celular</span>
                    {client.telCel ? (
                      <span className="text-sm font-semibold text-slate-700 dark:text-gray-200 flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                        {client.telCel}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-gray-500 italic">No registrado</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Dirección Completa</span>
                  <div className="bg-slate-50/50 dark:bg-gray-855/30 bg-slate-50 dark:bg-gray-850 p-3.5 rounded-xl border border-slate-150 dark:border-gray-805 border-slate-205 dark:border-gray-800 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-gray-200 leading-relaxed">
                      {addressStr || "Sin dirección cargada"}
                    </span>
                  </div>
                </div>

                {/* Contact & Map Links */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100 dark:border-gray-800">
                  {client.telCel && (
                    <a
                      href={getWhatsAppUrl(client.telCel)}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 px-4 flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all border border-emerald-150 dark:border-emerald-900/30 text-xs font-bold"
                      title="Enviar WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                  
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-4 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-gray-855 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-300 rounded-xl transition-all border border-slate-200 dark:border-gray-800 text-xs font-bold"
                    title="Ver Mapa"
                  >
                    <MapIcon className="w-4 h-4" />
                    <span>Ver Mapa</span>
                  </a>
                </div>
              </div>

              {/* Device Details */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-150 dark:border-gray-800 p-5 sm:p-6 shadow-xs space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-450 border-b border-slate-100 dark:border-gray-805 border-slate-205 dark:border-gray-800 pb-3">
                  Datos del Equipo
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Aparato / Tipo</span>
                    <span className="text-sm font-extrabold text-slate-800 dark:text-white">{srv.aparato}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Marca / Modelo</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-gray-255">{srv.marcaModelo || "S/D"}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Planning Section */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-150 dark:border-gray-800 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-805 border-slate-205 dark:border-gray-800 pb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-450 flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4 text-indigo-500" />
                    Planificación de Entrega
                  </h3>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDeliveryId(srv.id || null);
                        if (srv.citaEntrega) {
                          try {
                            const dt = srv.citaEntrega instanceof Date ? srv.citaEntrega : (srv.citaEntrega as any).toDate();
                            const yyyy = dt.getFullYear();
                            const mm = String(dt.getMonth() + 1).padStart(2, '0');
                            const dd = String(dt.getDate()).padStart(2, '0');
                            setDeliveryCita(`${yyyy}-${mm}-${dd}`);
                          } catch { setDeliveryCita(""); }
                        } else { setDeliveryCita(""); }
                        setDeliveryHoraDesde(srv.horaEntregaDesde || "");
                        setDeliveryHoraHasta(srv.horaEntregaHasta || "");
                        setDeliveryInfo(srv.infoLogistica || "");
                      }}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer border border-indigo-200/60 dark:border-indigo-900/40"
                    >
                      Planificar / Editar
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <div className="space-y-3.5 text-xs text-slate-700 dark:text-gray-300 font-medium">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Fecha Acordada</span>
                        {srv.citaEntrega ? (
                          <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            {(() => {
                              try {
                                const dt = srv.citaEntrega instanceof Date ? srv.citaEntrega : (srv.citaEntrega as any).toDate();
                                return dt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                              } catch { return "Fecha no válida"; }
                            })()}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-gray-500 italic">No programada</span>
                        )}
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Horario Acordado</span>
                        {srv.horaEntregaDesde || srv.horaEntregaHasta ? (
                          <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            de {srv.horaEntregaDesde || "--:--"} hasta {srv.horaEntregaHasta || "--:--"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-gray-500 italic">No programado</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Información / Notas Logísticas</span>
                      <p className="p-3 bg-slate-50 dark:bg-gray-850 rounded-xl text-slate-700 dark:text-gray-300 font-medium italic border border-slate-100 dark:border-gray-800 leading-relaxed">
                        {srv.infoLogistica || "Sin observaciones logísticas."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-scale-up">
                    {/* Date Selector */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        Fecha de Entrega
                      </label>
                      <input
                        type="date"
                        value={deliveryCita}
                        onChange={(e) => setDeliveryCita(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-850 text-slate-900 dark:text-white border border-slate-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    {/* Numeric HH:MM Input Range */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                        Rango Horario de Entrega
                      </label>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="shrink-0 font-medium text-xs">de</span>
                        {/* DESDE */}
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0" max="23" placeholder="HH"
                            value={deliveryHoraDesde ? deliveryHoraDesde.split(":")[0] : ""}
                            onChange={(e) => {
                              const hh = e.target.value.replace(/\D/g, "").slice(0, 2);
                              const mm = deliveryHoraDesde ? (deliveryHoraDesde.split(":")[1] || "00") : "00";
                              setDeliveryHoraDesde(hh ? `${hh.padStart(2, "0")}:${mm}` : "");
                            }}
                            className="w-14 px-2 py-2 bg-slate-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-slate-200 dark:border-gray-800 rounded-xl text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                          <span className="font-bold text-gray-400">:</span>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0" max="59" placeholder="MM"
                            value={deliveryHoraDesde ? deliveryHoraDesde.split(":")[1] : ""}
                            onChange={(e) => {
                              const mm = e.target.value.replace(/\D/g, "").slice(0, 2);
                              const hh = deliveryHoraDesde ? (deliveryHoraDesde.split(":")[0] || "00") : "00";
                              setDeliveryHoraDesde(mm ? `${hh}:${mm.padStart(2, "0")}` : hh ? `${hh}:` : "");
                            }}
                            className="w-14 px-2 py-2 bg-slate-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-slate-200 dark:border-gray-800 rounded-xl text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                        </div>
                        <span className="shrink-0 font-medium text-xs">hasta</span>
                        {/* HASTA */}
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0" max="23" placeholder="HH"
                            value={deliveryHoraHasta ? deliveryHoraHasta.split(":")[0] : ""}
                            onChange={(e) => {
                              const hh = e.target.value.replace(/\D/g, "").slice(0, 2);
                              const mm = deliveryHoraHasta ? (deliveryHoraHasta.split(":")[1] || "00") : "00";
                              setDeliveryHoraHasta(hh ? `${hh.padStart(2, "0")}:${mm}` : "");
                            }}
                            className="w-14 px-2 py-2 bg-slate-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-slate-200 dark:border-gray-800 rounded-xl text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                          <span className="font-bold text-gray-400">:</span>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0" max="59" placeholder="MM"
                            value={deliveryHoraHasta ? deliveryHoraHasta.split(":")[1] : ""}
                            onChange={(e) => {
                              const mm = e.target.value.replace(/\D/g, "").slice(0, 2);
                              const hh = deliveryHoraHasta ? (deliveryHoraHasta.split(":")[0] || "00") : "00";
                              setDeliveryHoraHasta(mm ? `${hh}:${mm.padStart(2, "0")}` : hh ? `${hh}:` : "");
                            }}
                            className="w-14 px-2 py-2 bg-slate-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-slate-200 dark:border-gray-800 rounded-xl text-xs text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Logistics Notes Textarea */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                        Observaciones / Notas Logísticas
                      </label>
                      <textarea
                        value={deliveryInfo}
                        onChange={(e) => setDeliveryInfo(e.target.value)}
                        placeholder="Ej. Entregar por la mañana, tocar timbre de planta alta."
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-850 text-slate-905 dark:text-white text-xs font-medium rounded-xl border border-slate-205 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleSaveDeliveryInfo(srv.id!)}
                        className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        Guardar Planificación
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDeliveryId(null)}
                        className="h-10 px-4 text-xs font-bold text-slate-505 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Details Section */}
              {(srv.metodoPago || srv.montoEfectivo || srv.montoTransferencia) && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-150 dark:border-gray-800 p-5 sm:p-6 shadow-xs space-y-4 animate-scale-up">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-450 border-b border-slate-100 dark:border-gray-800 pb-3 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-emerald-500" />
                    Detalle de Pago Cobrado
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Método de Pago</span>
                      <span className="text-sm font-extrabold text-slate-800 dark:text-white uppercase">
                        {srv.metodoPago || "No especificado"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Monto Efectivo</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {srv.montoEfectivo ? `$${srv.montoEfectivo.toLocaleString("es-AR")}` : "$0"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Monto Transferencia</span>
                      <span className="text-sm font-bold text-indigo-650 dark:text-indigo-400">
                        {srv.montoTransferencia ? `$${srv.montoTransferencia.toLocaleString("es-AR")}` : "$0"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* MODAL: EQUIPOS PARA RETIRAR */}
      {selectedGroupForModal && (() => {
        const client = clientMap.get(selectedGroupForModal.clienteId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
              {/* Header */}
              <div className="p-5 border-b border-slate-150 dark:border-gray-800 flex items-center justify-between bg-slate-50/50 dark:bg-gray-950/20">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-indigo-500" />
                    <span>Equipos a Retirar ({selectedGroupForModal.services.length})</span>
                  </h3>

                </div>
                <button
                  type="button"
                  onClick={() => setSelectedGroupForModal(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {selectedGroupForModal.services.map((srv, idx) => (
                  <div 
                    key={srv.id} 
                    className="p-4 bg-slate-50/80 dark:bg-gray-855/40 rounded-xl border border-slate-150 dark:border-gray-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded uppercase tracking-wider">
                        Equipo #{idx + 1}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        Orden #{srv.numeroServicio}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-semibold text-slate-400 mr-1 block uppercase text-[9px] tracking-wider mb-0.5">
                          Aparato / Tipo
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {srv.aparato}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400 mr-1 block uppercase text-[9px] tracking-wider mb-0.5">
                          Marca / Modelo
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {srv.marcaModelo || "S/D"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/50 dark:border-gray-800 text-xs">
                      <span className="font-semibold text-slate-400 mr-1 block uppercase text-[9px] tracking-wider mb-0.5">
                        Falla / Desperfecto
                      </span>
                      <span className="text-slate-700 dark:text-gray-300 font-medium">
                        {srv.desperfectoUsuario}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 dark:bg-gray-950/20 border-t border-slate-150 dark:border-gray-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedGroupForModal(null)}
                  className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RETIROS VIEW */}
    </div>
  );
}
