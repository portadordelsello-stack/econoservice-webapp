import React, { useEffect, useState } from "react";
import { ServiciosService, ClientesService, TecnicosService, toDate } from "../services/db";
import { Servicio, Cliente, Tecnico, EstadoServicio, getEstadoLabel } from "../types";
import { useNavigation } from "../providers/NavigationProvider";
import { 
  Wrench, 
  ClipboardList, 
  Cpu, 
  CheckCircle, 
  CircleDollarSign,
  ArrowRight,
  TrendingUp,
  Clock,
  UserCheck
} from "lucide-react";

export default function Dashboard() {
  const { navigate } = useNavigation();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [tecnicos, setTecnicos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [servList, cliList, tecList] = await Promise.all([
          ServiciosService.getAll(),
          ClientesService.getAll(),
          TecnicosService.getAll()
        ]);

        setServicios(servList);
        
        // Map clients and technicians for fast O(1) id-to-name resolution
        const cliMap: Record<string, string> = {};
        cliList.forEach(c => {
          cliMap[c.id || ""] = c.nombreApellido;
        });
        setClientes(cliMap);

        const tecMap: Record<string, string> = {};
        tecList.forEach(t => {
          tecMap[t.id || ""] = t.nombre;
        });
        setTecnicos(tecMap);

      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // Compute Metrics
  const openServices = servicios.filter(s => s.estado !== "ENTREGADO" && s.estado !== "CANCELADO").length;
  const diagnosticServices = servicios.filter(s => s.estado === "DIAGNOSTICO").length;
  const repairServices = servicios.filter(s => s.estado === "EN_REPARACION").length;
  const pendingBudgets = servicios.filter(s => s.estado === "PENDIENTE_APROBACION").length;
  
  // Delivered Today
  const deliveredToday = servicios.filter(s => {
    if (s.estado !== "ENTREGADO" || !s.updatedAt) return false;
    const date = toDate(s.updatedAt);
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }).length;

  const latestServicios = servicios.slice(0, 5);

  const getStatusColor = (status: EstadoServicio) => {
    switch (status) {
      case "RECIBIDO":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/50";
      case "DIAGNOSTICO":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900/50";
      case "PENDIENTE_APROBACION":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50";
      case "EN_REPARACION":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-900/50";
      case "LISTO_PARA_ENTREGA":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50";
      case "ENTREGA_EN_PROGRESO":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/50";
      case "ENTREGADO":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50";
      case "CANCELADO":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/50";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
          Panel de Control
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          Resumen operativo y estadísticas en tiempo real de EconoService.
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider">
              Servicios Abiertos
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-display">
              {openServices}
            </h3>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span>Activos en taller</span>
            </p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider">
              En Diagnóstico
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-display">
              {diagnosticServices}
            </h3>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-600" />
              <span>Esperando informe</span>
            </p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider">
              En Reparación
            </span>
            <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-500 dark:text-orange-400">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-orange-500 dark:text-orange-400 font-display">
              {repairServices}
            </h3>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-orange-500" />
              <span>Técnicos trabajando</span>
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider">
              Presupuestos Pendientes
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
              <CircleDollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-indigo-900 dark:text-indigo-200 font-display">
              {pendingBudgets}
            </h3>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1 flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-indigo-600" />
              <span>Esperando aprobación</span>
            </p>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider">
              Entregados Hoy
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 dark:text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-display">
              {deliveredToday}
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <span>¡Buen trabajo hoy!</span>
            </p>
          </div>
        </div>

      </div>

      {/* Main Content Area: Latest Orders & Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Latest Services Table */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white font-display">
              Últimos Servicios Ingresados
            </h2>
            <button 
              onClick={() => navigate("servicios")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
            >
              Ver todos los servicios
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 dark:border-gray-850 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-gray-800 text-slate-400 dark:text-gray-400 text-xs font-bold uppercase border-b border-slate-100 dark:border-gray-850">
                  <th className="p-4">N° Orden</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Aparato</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Técnico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-800 text-sm">
                {latestServicios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-gray-500">
                      No hay servicios registrados en la base de datos.
                    </td>
                  </tr>
                ) : (
                  latestServicios.map((s) => (
                    <tr 
                      key={s.id} 
                      onClick={() => navigate("detalle-servicio", s.id)}
                      className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        #{s.numeroServicio}
                      </td>
                      <td className="p-4 font-medium text-slate-800 dark:text-white">
                        {clientes[s.clienteId] || "Cargando..."}
                      </td>
                      <td className="p-4 text-slate-500 dark:text-gray-400">
                        {s.aparato} <span className="text-xs opacity-70">({s.marcaModelo})</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusColor(s.estado)}`}>
                          {getEstadoLabel(s.estado)}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-gray-400">
                        {s.tecnicoId ? tecnicos[s.tecnicoId] || "Asignado" : <span className="italic text-slate-400">Sin asignar</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Access Menu / Sidebar actions */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white font-display">
            Accesos Rápidos
          </h2>
          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => navigate("crear-servicio")}
              className="flex items-center justify-between p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm cursor-pointer group"
            >
              <span>Ingresar Nuevo Servicio</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate("clientes")}
              className="flex items-center justify-between p-3 border border-slate-150 dark:border-gray-850 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300 rounded-xl font-medium text-sm transition-all cursor-pointer"
            >
              <span>Registrar Nuevo Cliente</span>
              <ArrowRight className="w-4 h-4 opacity-50" />
            </button>

            <button
              onClick={() => navigate("agenda")}
              className="flex items-center justify-between p-3 border border-slate-150 dark:border-gray-850 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300 rounded-xl font-medium text-sm transition-all cursor-pointer"
            >
              <span>Ver Agenda de Entregas</span>
              <ArrowRight className="w-4 h-4 opacity-50" />
            </button>


          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-gray-800">
            <div className="p-3.5 bg-slate-50 dark:bg-gray-850/40 rounded-xl text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <span className="font-bold text-slate-700 dark:text-gray-300 block">EconoService Taller</span>
              <p>Este sistema está completamente sincronizado con Firestore y Storage. Permite operar el taller con control total de presupuestos y agendas.</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
