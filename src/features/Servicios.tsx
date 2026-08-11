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
  AlertCircle, 
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
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  X,
  RotateCw,
  Eye
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
  const [presupuestoFilter, setPresupuestoFilter] = useState<"todos" | "presupuestado" | "no_presupuestado">("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
        ServiciosService.getActive(),
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
      if (presupuestoFilter === "presupuestado") {
        list = list.filter(s => s.presupuestado === true);
      } else if (presupuestoFilter === "no_presupuestado") {
        list = list.filter(s => s.presupuestado !== true);
      }
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
      
      const clientCalle = client?.calle?.toLowerCase() || "";
      const clientNumero = client?.numero?.toString()?.toLowerCase() || "";
      const clientFullAddress = `${clientCalle} ${clientNumero}`.trim();

      return (
        clientName.includes(query) ||
        clientIdStr.includes(query) ||
        deviceBrand.includes(query) ||
        deviceModel.includes(query) ||
        deviceType.includes(query) ||
        serviceNum.includes(query) ||
        clientCalle.includes(query) ||
        clientNumero.includes(query) ||
        clientFullAddress.includes(query)
      );
    });
  };

  const filteredList = getFilteredList().sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
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
            Taller
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
              En Espera ({esperaList.length})
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

          {/* Search Input & Budget Filter */}
          <div className="flex items-center gap-2.5 flex-1 w-full lg:max-w-lg">
            {activeTab === "espera" && (
              <select
                value={presupuestoFilter}
                onChange={(e) => setPresupuestoFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 dark:bg-gray-855 text-slate-900 dark:text-white text-xs font-bold rounded-xl border border-slate-200/50 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shrink-0"
              >
                <option value="todos">Ver: Todos</option>
                <option value="presupuestado">Ver: Presupuestados</option>
                <option value="no_presupuestado">Ver: No Presupuestados</option>
              </select>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por ID, Cliente, Equipo o Servicio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-855 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200/50 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
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
                  ? "Aún no se han guardado órdenes en estado 'En Espera'."
                  : activeTab === "terminados"
                    ? "No hay órdenes de servicio en estado 'Terminados'."
                    : "No hay ningún equipo registrado en el taller."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile screen orientation warning */}
          {isPortrait && (
            <div className="md:hidden flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-150 dark:border-indigo-900/30 rounded-xl text-indigo-700 dark:text-indigo-400 text-xs font-semibold animate-pulse">
              <RotateCw className="w-4 h-4 shrink-0 text-indigo-500 animate-spin" style={{ animationDuration: "4s" }} />
              <span>Para una mejor experiencia con la planilla de Taller, te recomendamos girar tu celular horizontalmente.</span>
            </div>
          )}

          {/* Excel Spreadsheet Table */}
          <div className="overflow-x-auto bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-800 shadow-sm scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[680px] bg-[#FFFFEB] dark:bg-gray-900">
              <thead>
                {/* Excel coordinate letters */}
                <tr className="bg-slate-100 dark:bg-gray-850 text-slate-400 dark:text-gray-500 font-mono text-[9px] uppercase tracking-wider select-none text-center divide-x divide-slate-200 dark:divide-gray-800 border-b border-slate-200 dark:border-gray-800">
                  <th className="py-1 px-2 font-bold w-12 bg-slate-100 dark:bg-gray-850"></th>
                  <th className="py-1 px-3 font-bold">A</th>
                  <th className="py-1 px-3 font-bold">B</th>
                  <th className="py-1 px-3 font-bold">C</th>
                  <th className="py-1 px-3 font-bold">D</th>
                  <th className="py-1 px-3 font-bold">E</th>
                </tr>
                {/* Excel visual columns */}
                <tr className="bg-slate-50 dark:bg-gray-855/50 text-[10px] font-extrabold text-slate-505 dark:text-gray-400 uppercase tracking-wider select-none divide-x divide-slate-200 dark:divide-gray-800 border-b border-slate-300 dark:border-gray-800">
                  <th className="py-2.5 px-2 text-center font-mono font-bold bg-slate-100 dark:bg-gray-855 text-slate-450 w-12">#</th>
                  <th className="py-2.5 px-3">Domicilio / Cliente</th>
                  <th className="py-2.5 px-3">Marca / Modelo</th>
                  <th className="py-2.5 px-3">Desperfecto / Falla</th>
                  <th className="py-2.5 px-3">Estado / Diagnóstico</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Fecha Retiro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-800">
                {paginatedList.map((srv, idx) => {
                  const client = clientMap.get(srv.clienteId);
                  const equipo = equipoMap.get(srv.equipoId);

                  const addressCalle = client?.calle 
                    ? `${client.calle} ${client.numero || ""}`.trim() 
                    : "Sin Domicilio";
                  const addressLoc = client?.localidad || "Santo Tomé";

                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;

                  const isSinDiag = srv.diagnosticoTipo === "SIN_DIAGNOSTICO" || 
                    (!srv.diagnosticoTipo && 
                     !srv.diagnostico?.includes("[PREVIO]") && 
                     !srv.diagnostico?.includes("[FINAL]") && 
                     !srv.serviciosRequeridos?.includes("[PREVIO]") && 
                     !srv.serviciosRequeridos?.includes("[FINAL]"));

                  const isPrevio = srv.diagnosticoTipo === "PREVIO" || 
                    srv.diagnostico?.includes("[PREVIO]") || 
                    srv.serviciosRequeridos?.includes("[PREVIO]");

                  const isFinal = srv.diagnosticoTipo === "FINAL" || 
                    srv.diagnostico?.includes("[FINAL]") || 
                    srv.serviciosRequeridos?.includes("[FINAL]");

                  return (
                    <tr
                      key={srv.id}
                      onClick={() => navigate("detalle-servicio", srv.id, { servicio: srv, cliente: client || null, equipo: equipo || null })}
                      className="group hover:bg-slate-100/50 dark:hover:bg-gray-850/20 transition-all cursor-pointer divide-x divide-slate-200 dark:divide-gray-800"
                    >
                      <td className="py-2.5 px-2 text-center font-mono font-bold bg-slate-50 dark:bg-gray-855/50 text-slate-400 select-none text-[10px]">
                        {rowNumber}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-800 dark:text-gray-200 font-semibold max-w-[175px] truncate">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-900 dark:text-white truncate">{addressCalle}</span>
                          <span className="text-[10px] text-slate-505 font-medium truncate">{client?.nombreApellido || "Cliente S/N"}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-750 dark:text-gray-300 font-semibold max-w-[120px] truncate">
                        {srv.marcaModelo || "No especificado"}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-gray-400 italic max-w-[250px] truncate font-medium" title={srv.serviciosRequeridos || srv.diagnostico || srv.desperfectoUsuario}>
                        {(srv.serviciosRequeridos || srv.diagnostico || srv.desperfectoUsuario || "Sin desperfecto reportado").replace(/^\[(PREVIO|FINAL|SIN_DIAGNOSTICO)\]\s*/, "")}
                      </td>
                      <td className="py-2.5 px-3 text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${getEstadoBadgeClass(srv.estado)}`}>
                              {getEstadoLabel(srv.estado)}
                            </span>
                            {isSinDiag && (
                              <span className="text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-250">
                                Sin Diag.
                              </span>
                            )}
                            {isPrevio && (
                              <span className="text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                                Previo
                              </span>
                            )}
                            {isFinal && (
                              <span className="text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-indigo-50 text-indigo-800 border border-indigo-200">
                                Final
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-gray-400 font-mono whitespace-nowrap">
                        {(() => {
                          const dateVal = srv.createdAt;
                          if (!dateVal) return <span className="text-slate-300 dark:text-gray-600">—</span>;
                          try {
                            const iso = typeof dateVal === "string" ? dateVal : new Date(dateVal).toISOString();
                            const [y, m, d] = iso.substring(0, 10).split("-");
                            return <span className="font-bold text-slate-700 dark:text-gray-300">{d}/{m}/{y}</span>;
                          } catch {
                            return <span className="text-slate-300 dark:text-gray-600">—</span>;
                          }
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredList.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-gray-850/40 p-4 border border-slate-150 dark:border-gray-850 rounded-2xl select-none">
          <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">
            Mostrando <span className="font-extrabold text-slate-700 dark:text-white">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredList.length)}</span> - <span className="font-extrabold text-slate-700 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredList.length)}</span> de <span className="font-extrabold text-slate-700 dark:text-white">{filteredList.length}</span> servicios
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Primera página"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-extrabold text-slate-700 dark:text-white px-2">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Última página"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
