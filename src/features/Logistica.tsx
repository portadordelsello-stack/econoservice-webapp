import React, { useState, useEffect } from "react";
import Tracker from "./Tracker";
import { ClientesService, ServiciosService } from "../services/db";
import { Cliente, Servicio } from "../types";
import { useNavigation } from "../providers/NavigationProvider";
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
  Info
} from "lucide-react";

type LogisticaView = "hub" | "tracker" | "retiros" | "agenda-general";

export default function Logistica() {
  const { navigate } = useNavigation();
  const [view, setView] = useState<LogisticaView>("hub");
  
  // Logistics retiros data states
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");

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

  useEffect(() => {
    if (view === "retiros" || view === "agenda-general") {
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
  const parseInfoLogistica = (info?: string) => {
    if (!info) return null;
    let fechaRetiroStr = "";
    let notasRetiro = "";
    const parts = info.split(" | ");
    parts.forEach(part => {
      if (part.startsWith("Retiro acordado: ")) {
        fechaRetiroStr = part.replace("Retiro acordado: ", "");
      } else if (part.startsWith("Notas retiro: ")) {
        notasRetiro = part.replace("Notas retiro: ", "");
      }
    });
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

  // Extract all services that have scheduled withdrawals
  const servicesWithWithdrawals = servicios
    .map(s => {
      const parsed = parseInfoLogistica(s.infoLogistica);
      return parsed ? { ...s, withdrawal: parsed } : null;
    })
    .filter((s): s is (Servicio & { withdrawal: { fechaRetiroStr: string; notasRetiro: string } }) => s !== null);

  // Divide into today's withdrawals and other days' (Agenda)
  const todayWithdrawals = servicesWithWithdrawals.filter(s => {
    const datePart = s.withdrawal.fechaRetiroStr.split("T")[0];
    return datePart === todayStr;
  });

  const otherWithdrawals = servicesWithWithdrawals.filter(s => {
    const datePart = s.withdrawal.fechaRetiroStr.split("T")[0];
    return datePart !== todayStr;
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
              Selecciona una de las herramientas de ruteo, geolocalización o retiro de equipos.
            </p>
          </div>

          {/* Cards Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl pt-2">
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
                  TRACKER SATELITAL
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
                  RETIROS DE CLIENTES
                </h2>
              </div>

              <p className="text-sm text-slate-500 dark:text-gray-400 mb-6 flex-1">
                Visualización centralizada de los retiros pactados para hoy (destacados) y agenda interactiva de retiros programados para otros días.
              </p>

              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <span>Ver Retiros y Agenda</span>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 font-bold rounded-xl transition-all cursor-pointer text-xs"
              id="btn-back-tracker"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al Menú de Logística
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
        <div className="space-y-8 animate-fade-in">
          {/* Title & Action bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView("hub")}
                className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 border border-slate-150 dark:border-gray-800 rounded-xl text-slate-600 dark:text-gray-400 transition-colors cursor-pointer"
                title="Volver"
                id="btn-back-retiros"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
                  <Calendar className="w-7 h-7 text-amber-500" />
                  Retiros del Día
                </h1>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Visualización y control de equipos a retirar pactados para la jornada de hoy.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setView("agenda-general")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                id="btn-go-agenda-general"
              >
                <ClipboardList className="w-4.5 h-4.5" />
                Agenda General de Retiros
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer w-fit"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Sincronizar Datos
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
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                    Retiros Pactados para Hoy
                  </h2>
                </div>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 rounded-xl capitalize">
                  {formatSpanishDate(todayStr)}
                </span>
              </div>

              {todayWithdrawals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-amber-50/20 dark:bg-amber-950/5 border border-dashed border-amber-200/50 dark:border-amber-900/20 rounded-2xl text-center space-y-4 max-w-2xl mx-auto">
                  <Info className="w-12 h-12 text-amber-500/70" />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-base">
                      No hay retiros agendados para hoy
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto">
                      Todos los retiros para el día de hoy están al día o no se registraron visitas hoy. Haz clic en el botón superior <strong>"Agenda General de Retiros"</strong> para planificar y buscar retiros de otros días.
                    </p>
                  </div>
                  <button
                    onClick={() => setView("agenda-general")}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Abrir Agenda General
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {todayWithdrawals.map(srv => {
                    const client = clientMap.get(srv.clienteId);
                    if (!client) return null;

                    const addressStr = [
                      client.calle ? `${client.calle} ${client.numero || ""}`.trim() : "",
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
                        key={srv.id}
                        className="bg-gradient-to-br from-amber-50/40 via-white to-white dark:from-amber-950/10 dark:via-gray-900 dark:to-gray-900 border-2 border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden"
                      >
                        {/* Left highlight band */}
                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-amber-500"></div>

                        {/* Top bar with time and status */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pl-2">
                          <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 px-3 py-1.5 rounded-xl font-mono text-sm font-bold">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>{formatTimeStr(srv.withdrawal.fechaRetiroStr)}</span>
                          </div>
                          <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300">
                            Orden #{srv.numeroServicio}
                          </span>
                        </div>

                        {/* Client & Device info */}
                        <div className="pl-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                              ID: {formatClienteId(client)}
                            </span>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base font-display">
                              {client.nombreApellido}
                            </h3>
                            {client.clienteProblematico && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold border border-red-100 dark:border-red-900/30">
                                ⚠️ Conflictivo
                              </span>
                            )}
                          </div>

                          {/* Address details */}
                          {addressStr ? (
                            <div className="bg-slate-50 dark:bg-gray-855 p-3 rounded-xl border border-slate-150 dark:border-gray-800 flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Dirección de Retiro</span>
                                <span className="text-sm text-slate-700 dark:text-gray-300 font-medium">
                                  {addressStr}
                                </span>
                              </div>
                              <a 
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors shrink-0"
                                title="Ver ruteo en Google Maps"
                              >
                                <MapIcon className="w-4.5 h-4.5" />
                              </a>
                            </div>
                          ) : (
                            <p className="text-xs text-red-500 italic">No se registró dirección para este cliente.</p>
                          )}

                          {/* Equipment info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-500 dark:text-gray-400">
                            <div>
                              <span className="font-semibold text-slate-400 mr-1 block">Equipo / Aparato:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{srv.aparato} ({srv.marcaModelo})</span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-400 mr-1 block">Falla / Desperfecto:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{srv.desperfectoUsuario}</span>
                            </div>
                          </div>

                          {/* Special instructions / Notes retiro */}
                          {srv.withdrawal.notasRetiro && (
                            <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-300/30 text-amber-800 dark:text-amber-300 text-xs rounded-xl flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                              <div>
                                <span className="font-bold">Indicaciones especiales:</span>
                                <p className="mt-0.5">{srv.withdrawal.notasRetiro}</p>
                              </div>
                            </div>
                          )}

                          {/* Contact actions */}
                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            {client.telCel && (
                              <a 
                                href={`tel:${client.telCel}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Llamar celular
                              </a>
                            )}
                            {client.telCel && (
                              <a 
                                href={getWhatsAppUrl(client.telCel)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                WhatsApp
                              </a>
                            )}
                            {client.telFijo && (
                              <a 
                                href={`tel:${client.telFijo}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Tel. Fijo: {client.telFijo}
                              </a>
                            )}
                            
                            <button
                              onClick={() => navigate("detalle-servicio", srv.id)}
                              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                            >
                              <span>Ver Ficha de Servicio</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
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
        <div className="space-y-8 animate-fade-in">
          {/* Title & Back bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView("retiros")}
                className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 border border-slate-150 dark:border-gray-800 rounded-xl text-slate-600 dark:text-gray-400 transition-colors cursor-pointer"
                title="Volver"
                id="btn-back-agenda-general"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
                  <ClipboardList className="w-7 h-7 text-indigo-500" />
                  Agenda General de Retiros
                </h1>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Planificación, búsqueda interactiva y filtros por fecha de retiros programados para otros días.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setView("retiros")}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver a Hoy
              </button>
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Sincronizar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-500 dark:text-gray-400">Cargando agenda de retiros...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Filters (col-span-4) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Filtros de Agenda</h3>
                  
                  {/* Search input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Búsqueda de Cliente</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Buscar por nombre, ID, calle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-gray-855 border border-slate-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
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
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-gray-855 border border-slate-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white font-medium"
                      />
                      {selectedDate && (
                        <button
                          onClick={() => setSelectedDate("")}
                          className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-gray-800 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Filters */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-gray-800">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">Atajos rápidos</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          setSelectedDate(getLocalDateString(tomorrow));
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-xs font-medium text-slate-600 dark:text-gray-300 transition-colors cursor-pointer"
                      >
                        Mañana
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDate("");
                          setSearchQuery("");
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-xs font-medium text-slate-600 dark:text-gray-300 transition-colors cursor-pointer"
                      >
                        Ver todos
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* Right Column: Agenda List (col-span-8) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                      Resultados de la Agenda ({filteredOtherWithdrawals.length})
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {filteredOtherWithdrawals.length === 0 ? (
                      <div className="text-center py-16 bg-slate-50/50 dark:bg-gray-950/20 border border-dashed border-slate-200 dark:border-gray-800 rounded-2xl">
                        <p className="text-sm font-semibold text-slate-500 dark:text-gray-400">No se encontraron retiros agendados para los filtros seleccionados.</p>
                        <p className="text-xs text-slate-400 mt-1">Intenta cambiar la fecha o borrar la búsqueda de clientes.</p>
                        {(searchQuery || selectedDate) && (
                          <button
                            onClick={() => {
                              setSearchQuery("");
                              setSelectedDate("");
                            }}
                            className="mt-4 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 dark:text-indigo-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            Restablecer Filtros
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredOtherWithdrawals.map(srv => {
                          const client = clientMap.get(srv.clienteId);
                          if (!client) return null;

                          const datePart = srv.withdrawal.fechaRetiroStr.split("T")[0];

                          return (
                            <div 
                              key={srv.id}
                              className="bg-slate-50/50 dark:bg-gray-855 border border-slate-150 dark:border-gray-800/80 rounded-xl p-4 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-900 transition-all flex flex-col gap-3 relative"
                            >
                              {/* Top date and time line */}
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50/70 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                                  {formatSpanishDate(datePart)}
                                </span>
                                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-gray-400">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{formatTimeStr(srv.withdrawal.fechaRetiroStr)}</span>
                                </div>
                              </div>

                              {/* Client name, ID, and address */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                    ID: {formatClienteId(client)}
                                  </span>
                                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                                    {client.nombreApellido}
                                  </h4>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium line-clamp-1">
                                  {client.calle ? `${client.calle} ${client.numero || ""}` : "S/D"}, {client.localidad || "Santo Tomé"}
                                </p>
                              </div>

                              {/* Notes summary badge */}
                              {srv.withdrawal.notasRetiro && (
                                <div className="bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-gray-800 text-[11px] text-slate-500 dark:text-gray-400 italic">
                                  <span className="font-bold not-italic text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Nota:</span>
                                  "{srv.withdrawal.notasRetiro}"
                                </div>
                              )}

                              {/* Quick access footer */}
                              <div className="flex items-center justify-between border-t border-slate-150/60 dark:border-gray-800 pt-2.5 mt-auto">
                                <span className="text-[10px] text-slate-400 font-semibold">Orden #{srv.numeroServicio}</span>
                                <button
                                  onClick={() => navigate("detalle-servicio", srv.id)}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                >
                                  <span>Ir a Ficha</span>
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
    </div>
  );
}
