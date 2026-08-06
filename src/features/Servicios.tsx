import React, { useEffect, useState } from "react";
import { ClientesService, EquiposService, ServiciosService, NotificationsService } from "../services/db";
import { Cliente, Equipo, Servicio, EstadoServicio, getEstadoLabel } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { 
  Wrench, 
  Search, 
  MapPin, 
  Clock, 
  FileText, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  Cpu, 
  Layers, 
  Check, 
  Loader2, 
  RefreshCw,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Inbox,
  UserCheck,
  Handshake,
  XCircle,
  MessageSquare,
  Trash2,
  ChevronLeft
} from "lucide-react";

const getEstadoBadgeClass = (estado: string) => {
  switch (estado) {
    case "RECIBIDO":
      return "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30";
    case "EN_ESPERA":
      return "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30";
    case "ACEPTADO":
      return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/30 dark:border-emerald-900/30";
    case "LISTO_PARA_ENTREGA":
      return "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-100/30 dark:border-teal-900/30";
    case "ENTREGA_EN_PROGRESO":
      return "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-100/30 dark:border-sky-900/30";
    case "ENTREGADO":
      return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30";
    case "RECHAZADO":
    case "CANCELADO":
      return "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/30 dark:border-rose-900/30";
    default:
      return "bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700";
  }
};

const getEstadoLabelBadgeClass = (estado: string) => {
  switch (estado) {
    case "RECIBIDO":
      return "bg-amber-100/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400";
    case "EN_ESPERA":
      return "bg-indigo-100/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400";
    case "ACEPTADO":
      return "bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400";
    case "LISTO_PARA_ENTREGA":
      return "bg-teal-100/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400";
    case "ENTREGA_EN_PROGRESO":
      return "bg-sky-100/70 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400";
    case "ENTREGADO":
      return "bg-emerald-200 dark:bg-emerald-905 text-emerald-850 dark:text-emerald-200";
    case "RECHAZADO":
    case "CANCELADO":
      return "bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400";
    default:
      return "bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300";
  }
};

export default function Servicios() {
  const { profile, user } = useAuth();
  const { navigate } = useNavigation();

  const isAdmin = profile?.rol === "superadmin" || profile?.rol === "admin" || profile?.rol === "administracion";

  // Data states
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"recibidos" | "espera" | "aceptados" | "rechazados" | "terminados" | "todos">("recibidos");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // Form states for the currently expanded service
  const [formNotasInternas, setFormNotasInternas] = useState("");
  const [formServiciosRequeridos, setFormServiciosRequeridos] = useState("");
  const [formRepuestosComprar, setFormRepuestosComprar] = useState("");
  const [formServiciosConvenidos, setFormServiciosConvenidos] = useState("");

  const formatClienteId = (c: Cliente): string => {
    if (!c?.numeroCliente) return "S/D";
    return String(c.numeroCliente).padStart(6, "0");
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [srvList, clList, eqList] = await Promise.all([
        ServiciosService.getAll(),
        ClientesService.getAll(),
        EquiposService.getAll()
      ]);
      setServicios(srvList);
      setClientes(clList);
      setEquipos(eqList);
    } catch (error) {
      console.error("Error loading workshop data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Map utilities for quick lookups
  const clientMap = new Map<string, Cliente>();
  clientes.forEach(c => {
    if (c.id) clientMap.set(c.id, c);
  });

  const equipoMap = new Map<string, Equipo>();
  equipos.forEach(e => {
    if (e.id) equipoMap.set(e.id, e);
  });

  // Filter only services that entered workshop (ingresoTaller === true)
  const workshopServicios = servicios.filter(s => s.ingresoTaller === true);

  // Split into our Tab states
  const recibidosList = workshopServicios.filter(s => s.estado === "RECIBIDO");
  const esperaList = workshopServicios.filter(s => s.estado === "EN_ESPERA");
  const aceptadosList = workshopServicios.filter(s => s.estado === "ACEPTADO");
  const rechazadosList = workshopServicios.filter(s => s.estado === "RECHAZADO");
  const terminadosList = workshopServicios.filter(s => s.estado === "LISTO_PARA_ENTREGA");

  // Filter based on search and selected tab
  const getFilteredList = () => {
    let list = [];
    if (activeTab === "recibidos") {
      list = recibidosList;
    } else if (activeTab === "espera") {
      list = esperaList;
    } else if (activeTab === "aceptados") {
      list = aceptadosList;
    } else if (activeTab === "rechazados") {
      list = rechazadosList;
    } else if (activeTab === "terminados") {
      list = terminadosList;
    } else {
      list = workshopServicios;
    }

    if (!searchTerm.trim()) return list;

    const query = searchTerm.toLowerCase();
    return list.filter(srv => {
      const client = clientMap.get(srv.clienteId);
      const equipo = equipoMap.get(srv.equipoId);
      
      const clientName = client?.nombreApellido?.toLowerCase() || "";
      const clientIdStr = client ? formatClienteId(client) : "";
      const deviceBrand = equipo?.marca?.toLowerCase() || "";
      const deviceModel = equipo?.modelo?.toLowerCase() || "";
      const deviceType = srv.aparato?.toLowerCase() || "";
      const serviceNum = srv.numeroServicio?.toString() || "";

      return (
        clientName.includes(query) ||
        clientIdStr.includes(query) ||
        deviceBrand.includes(query) ||
        deviceModel.includes(query) ||
        deviceType.includes(query) ||
        serviceNum.includes(query)
      );
    });
  };

  const filteredList = getFilteredList();
  const totalPages = Math.max(1, Math.ceil(filteredList.length / itemsPerPage));
  const paginatedList = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Expand or collapse card, loading existing fields into state
  const handleToggleExpand = (srv: Servicio) => {
    if (expandedId === srv.id) {
      setExpandedId(null);
    } else {
      setExpandedId(srv.id || null);
      
      let notas = srv.notasInternas || "";
      let reqs = srv.serviciosRequeridos || "";
      
      // Fallback parsing from diagnostico if the separate fields are empty (e.g. for tecnico updates)
      if (!notas && !reqs && srv.diagnostico) {
        const diag = srv.diagnostico;
        const reqIndex = diag.indexOf("[Servicios Requeridos]\n");
        const notasIndex = diag.indexOf("[Notas Internas]\n");
        
        if (reqIndex !== -1) {
          const nextHeaderIndex = diag.indexOf("[", reqIndex + 23);
          reqs = diag.substring(reqIndex + 23, nextHeaderIndex !== -1 ? nextHeaderIndex : undefined).trim();
        }
        if (notasIndex !== -1) {
          const nextHeaderIndex = diag.indexOf("[", notasIndex + 17);
          notas = diag.substring(notasIndex + 17, nextHeaderIndex !== -1 ? nextHeaderIndex : undefined).trim();
        }
        
        // If it's a simple legacy format, just put it all in notas
        if (reqIndex === -1 && notasIndex === -1) {
          notas = diag.trim();
        }
      }
      
      setFormNotasInternas(notas);
      setFormServiciosRequeridos(reqs);
      setFormRepuestosComprar(srv.repuestosComprar || "");
      setFormServiciosConvenidos(srv.serviciosConvenidos || "");
    }
  };

  // Save technician fields or administrator fields with respective target states
  const handleSaveTechnicianForm = async (srv: Servicio, targetState: EstadoServicio = "EN_ESPERA", isFinished: boolean = false) => {
    if (!srv.id) return;
    setSubmittingId(srv.id);
    try {
      const userUid = profile?.uid || user?.uid || "tecnico";
      const userNombre = profile?.nombre || profile?.nombreApellido || user?.displayName || "Técnico";

      let updateData: Partial<Servicio>;
      const finalState = isFinished ? "LISTO_PARA_ENTREGA" : targetState;

      if (isAdmin) {
        // Admins can write all fields — Firestore rules allow this
        updateData = {
          diagnostico: formNotasInternas || formServiciosRequeridos,
          notasInternas: formNotasInternas,
          serviciosRequeridos: formServiciosRequeridos,
          repuestosComprar: formRepuestosComprar,
          serviciosConvenidos: formServiciosConvenidos,
          estado: finalState,
          terminado: isFinished
        };
        if (finalState === "ACEPTADO" || finalState === "LISTO_PARA_ENTREGA") {
          updateData.acepta = true;
          updateData.rechazaDevolver = false;
        } else if (finalState === "RECHAZADO") {
          updateData.acepta = false;
          updateData.rechazaDevolver = true;
        }

        await ServiciosService.update(
          srv.id,
          updateData,
          userUid,
          userNombre,
          `Taller: diagnóstico/presupuesto actualizado por Administrador. Estado: ${finalState}.`
        );
      } else {
        // Tecnico: Firestore live rules only allow these specific fields.
        // We pack all the workshop data into the 'diagnostico' field in a readable structured format.
        const parts: string[] = [];
        if (formServiciosRequeridos.trim()) {
          parts.push(`[Servicios Requeridos]\n${formServiciosRequeridos.trim()}`);
        }
        if (formNotasInternas.trim()) {
          parts.push(`[Notas Internas]\n${formNotasInternas.trim()}`);
        }
        updateData = {
          diagnostico: parts.join("\n\n"),
          repuestosComprar: formRepuestosComprar,
          estado: finalState
        };

        await ServiciosService.updateTecnico(
          srv.id,
          updateData,
          userUid,
          userNombre,
          `Taller: diagnóstico actualizado por Técnico. Estado: ${finalState}.`
        );
      }

      // Send automatic notifications based on state transitions
      const hasDiagContent = Boolean(formServiciosRequeridos.trim() || formNotasInternas.trim());
      if (profile?.rol === "tecnico" && (hasDiagContent || finalState === "EN_ESPERA" || finalState === "DIAGNOSTICO")) {
        await NotificationsService.create({
          targetRole: "admin",
          title: "Equipo Diagnosticado",
          message: `El técnico ${userNombre} completó/actualizó el diagnóstico del Servicio #${srv.numeroServicio} (${srv.aparato || "Equipo"} ${srv.marcaModelo || ""}).`,
          serviceId: srv.id
        });
      } else if (finalState === "EN_ESPERA") {
        // Taller -> Admin: Equipment diagnosed, ready for quote communication
        await NotificationsService.create({
          targetRole: "admin",
          title: "Equipo Diagnosticado",
          message: `El Taller completó el diagnóstico del Servicio #${srv.numeroServicio}. Comunicar presupuesto al cliente.`,
          serviceId: srv.id
        });
      } else if (finalState === "ACEPTADO" || finalState === "EN_REPARACION") {
        // Admin -> Taller: Repair confirmed, begin repair
        await NotificationsService.create({
          targetRole: "taller",
          title: "Reparación Confirmada",
          message: `El Administrador confirmó la reparación del Servicio #${srv.numeroServicio} (${srv.aparato || "Equipo"} ${srv.marcaModelo || ""}). Proceder con la reparación.`,
          serviceId: srv.id
        });
      } else if (finalState === "LISTO_PARA_ENTREGA" || isFinished) {
        // Taller -> Admin & Logistica: Repair finished
        await NotificationsService.create({
          targetRole: "admin",
          title: "Reparación Terminada",
          message: `El Taller / Técnico ${userNombre} dio por terminada la reparación del Servicio #${srv.numeroServicio} (${srv.aparato || "Equipo"} ${srv.marcaModelo || ""}).`,
          serviceId: srv.id
        });
        await NotificationsService.create({
          targetRole: "logistica",
          title: "Equipo Listo para Entrega",
          message: `El Servicio #${srv.numeroServicio} fue marcado como listo para entrega. Coordinar despacho.`,
          serviceId: srv.id
        });
      }

      // Toast success
      alert(`¡Orden de Servicio #${srv.numeroServicio} guardada con éxito en estado ${finalState}!`);
      
      // Close expansion and reload data
      setExpandedId(null);
      await loadAllData();
    } catch (error) {
      console.error("Error saving service technicians data:", error);
      alert("Error de conexión: No se guardaron los cambios del taller. Verifique su conexión o permisos.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header with quick Reload button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
            Módulo de Taller
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Administración del flujo de equipos recibidos de logística para diagnóstico y reparación.
          </p>
        </div>
        <button
          onClick={loadAllData}
          disabled={loading}
          className="inline-flex items-center gap-2 h-10 px-4 bg-white dark:bg-gray-850 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-850 text-xs font-bold rounded-xl transition-all shadow-3xs cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Sincronizar</span>
        </button>
      </div>


      {/* Tabs and Search Bar */}
      <div className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800/80 rounded-2xl p-4 shadow-3xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-50 dark:bg-gray-850 rounded-xl w-fit">
            <button
              onClick={() => {
                setActiveTab("recibidos");
                setExpandedId(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "recibidos"
                  ? "bg-white dark:bg-gray-900 text-amber-600 dark:text-amber-400 shadow-3xs"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
              }`}
            >
              Recibidos ({recibidosList.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("espera");
                setExpandedId(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "espera"
                  ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-3xs"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
              }`}
            >
              Diagnosticados ({esperaList.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("aceptados");
                setExpandedId(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "aceptados"
                  ? "bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-3xs"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
              }`}
            >
              Confirmados ({aceptadosList.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("rechazados");
                setExpandedId(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "rechazados"
                  ? "bg-white dark:bg-gray-900 text-rose-600 dark:text-rose-400 shadow-3xs"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
              }`}
            >
              Rechazados ({rechazadosList.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("terminados");
                setExpandedId(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "terminados"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-3xs"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
              }`}
            >
              Terminados ({terminadosList.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("todos");
                setExpandedId(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "todos"
                  ? "bg-white dark:bg-gray-900 text-slate-800 dark:text-white shadow-3xs"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
              }`}
            >
              Todos ({workshopServicios.length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID, Cliente, Equipo o Servicio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-850 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200/50 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800/80 rounded-2xl p-8 shadow-3xs">
          <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 font-bold uppercase tracking-wider">Cargando base de datos del taller...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[320px] bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800/80 rounded-2xl p-8 text-center shadow-3xs">
          <div className="p-4 bg-slate-50 dark:bg-gray-850 rounded-2xl mb-3 text-slate-400">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">Sin órdenes de taller</h3>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-1 max-w-md leading-relaxed">
            {searchTerm 
              ? "No se encontraron registros para los filtros ingresados." 
              : activeTab === "recibidos" 
                ? "No hay nuevos equipos recibidos de logística pendientes de diagnóstico." 
                : activeTab === "espera"
                  ? "Aún no se han guardado órdenes en estado 'Diagnosticados'."
                  : activeTab === "terminados"
                    ? "No hay órdenes de servicio en estado 'Terminados'."
                    : "No hay ningún equipo registrado en el taller."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedList.map((srv) => {
            const client = clientMap.get(srv.clienteId);
            const equipo = equipoMap.get(srv.equipoId);
            const isExpanded = expandedId === srv.id;

            // Format address
            const addressStr = client ? [
              client.calle ? `${client.calle} ${client.numero || ""}`.trim() : "",
              client.piso ? `Piso ${client.piso}` : "",
              client.depto ? `Depto ${client.depto}` : "",
              client.barrio ? `Barrio ${client.barrio}` : "",
              client.localidad || "Santo Tomé"
            ].filter(Boolean).join(", ") : "Sin Domicilio";

            return (
              <div
                key={srv.id}
                onClick={() => navigate("detalle-servicio", srv.id)}
                className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800/80 rounded-2xl shadow-3xs overflow-hidden transition-all duration-300 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/10 cursor-pointer"
              >
                {/* Header Banner */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none bg-gradient-to-r from-slate-50/50 to-white dark:from-gray-850/40 dark:to-gray-900 hover:from-slate-100 hover:to-white dark:hover:from-gray-800 dark:hover:to-gray-900 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Unique Highlight Icon */}
                    <div className={`p-2.5 rounded-xl text-xs font-bold shrink-0 ${getEstadoBadgeClass(srv.estado)}`}>
                      Orden #{srv.numeroServicio}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Address (Bold & Medium size) */}
                        <span className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-gray-250 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                          {addressStr}
                        </span>
                        
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${getEstadoLabelBadgeClass(srv.estado)}`}>
                          {getEstadoLabel(srv.estado)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right hand side action indicator */}
                  <div className="flex items-center gap-3 self-end md:self-auto">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm("¿Está seguro que desea eliminar esta orden de servicio del taller? Esta acción no se puede deshacer.")) {
                            try {
                              await ServiciosService.delete(srv.id);
                              await loadAllData();
                            } catch (err) {
                              console.error("Error deleting service:", err);
                              alert("Error al eliminar el servicio.");
                            }
                          }
                        }}
                        className="p-1.5 text-red-600 hover:text-red-700 bg-red-50/60 dark:bg-red-950/20 hover:bg-red-100/80 dark:hover:bg-red-950/40 rounded-lg transition-all cursor-pointer border border-red-100/40 dark:border-red-900/20 flex items-center justify-center hover:scale-105 active:scale-95 mr-1"
                        title="Eliminar de Taller"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredList.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-gray-850/40 p-4 border border-slate-150 dark:border-gray-850 rounded-2xl select-none">
          <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">
            Mostrando <span className="font-extrabold text-slate-700 dark:text-white">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredList.length)}</span> - <span className="font-extrabold text-slate-700 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredList.length)}</span> de <span className="font-extrabold text-slate-700 dark:text-white">{filteredList.length}</span> servicios
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-extrabold text-slate-700 dark:text-white">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
