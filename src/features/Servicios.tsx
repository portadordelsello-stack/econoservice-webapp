import React, { useEffect, useState } from "react";
import { ServiciosService, ClientesService, TecnicosService, toDate } from "../services/db";
import { Servicio, Cliente, Tecnico, EstadoServicio } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { 
  Plus, 
  Search, 
  Filter, 
  Wrench, 
  User, 
  UserCheck, 
  Calendar,
  AlertTriangle,
  ChevronRight,
  ShieldCheck
} from "lucide-react";

export default function Servicios() {
  const { profile } = useAuth();
  const { navigate } = useNavigation();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("");
  const [filterCliente, setFilterCliente] = useState<string>("");
  const [filterTecnico, setFilterTecnico] = useState<string>("");

  // Quick helper mappings
  const [clientNames, setClientNames] = useState<Record<string, { name: string, problematic: boolean }>>({});
  const [tecnicNames, setTecnicNames] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [servList, cliList, tecList] = await Promise.all([
          ServiciosService.getAll(),
          ClientesService.getAll(),
          TecnicosService.getAll()
        ]);

        setServicios(servList);
        setClientes(cliList);
        setTecnicos(tecList);

        const cliMap: Record<string, { name: string, problematic: boolean }> = {};
        cliList.forEach(c => {
          cliMap[c.id || ""] = {
            name: c.nombreApellido,
            problematic: c.clienteProblematico
          };
        });
        setClientNames(cliMap);

        const tecMap: Record<string, string> = {};
        tecList.forEach(t => {
          tecMap[t.id || ""] = t.nombre;
        });
        setTecnicNames(tecMap);

      } catch (err) {
        console.error("Error loading services data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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
      case "ENTREGADO":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50";
      case "CANCELADO":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/50";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const handleCreate = () => {
    navigate("crear-servicio");
  };

  // Client-side filtering for 100% Spark Plan index safety & speed
  const filteredServicios = servicios.filter(s => {
    const cliInfo = clientNames[s.clienteId];
    const cliName = cliInfo?.name.toLowerCase() || "";
    const tecName = s.tecnicoId ? tecnicNames[s.tecnicoId]?.toLowerCase() || "" : "";
    
    // Text search filter
    const matchesSearch = 
      s.numeroServicio.toString().includes(searchTerm) ||
      s.aparato.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.marcaModelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliName.includes(searchTerm.toLowerCase()) ||
      (s.desperfectoUsuario && s.desperfectoUsuario.toLowerCase().includes(searchTerm.toLowerCase()));

    // Dropdown filters
    const matchesEstado = !filterEstado || s.estado === filterEstado;
    const matchesCliente = !filterCliente || s.clienteId === filterCliente;
    const matchesTecnico = !filterTecnico || s.tecnicoId === filterTecnico;

    return matchesSearch && matchesEstado && matchesCliente && matchesTecnico;
  });

  const canWrite = profile?.rol === "superadmin" || profile?.rol === "logistica";

  if (loading && servicios.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
            Órdenes de Servicio
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Gestión integral del flujo de reparaciones, estados e historial del taller.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Orden de Trabajo
          </button>
        )}
      </div>

      {/* Filter panel */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
        
        {/* Row 1: Search & Simple instructions */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por N° de orden, aparato, marca o propietario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-transparent dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros Rápidos Sincronizados</span>
          </div>
        </div>

        {/* Row 2: Select Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Status Select */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Filtrar por Estado
            </label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-750 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600"
            >
              <option value="">-- Todos los Estados --</option>
              <option value="RECIBIDO">RECIBIDO</option>
              <option value="DIAGNOSTICO">DIAGNOSTICO</option>
              <option value="PENDIENTE_APROBACION">PENDIENTE_APROBACION</option>
              <option value="EN_REPARACION">EN_REPARACION</option>
              <option value="LISTO_PARA_ENTREGA">LISTO_PARA_ENTREGA</option>
              <option value="ENTREGADO">ENTREGADO</option>
              <option value="CANCELADO">CANCELADO</option>
            </select>
          </div>

          {/* Client Select */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Filtrar por Cliente
            </label>
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-750 rounded-xl text-xs focus:outline-none"
            >
              <option value="">-- Todos los Clientes --</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombreApellido}</option>
              ))}
            </select>
          </div>

          {/* Tech Select */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Filtrar por Técnico Asignado
            </label>
            <select
              value={filterTecnico}
              onChange={(e) => setFilterTecnico(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-750 rounded-xl text-xs focus:outline-none"
            >
              <option value="">-- Todos los Técnicos --</option>
              {tecnicos.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase border-b border-gray-100 dark:border-gray-800">
                <th className="p-4 pl-6">N° Orden</th>
                <th className="p-4">Cliente Propietario</th>
                <th className="p-4">Aparato / Detalle</th>
                <th className="p-4">Fecha Ingreso</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Técnico</th>
                <th className="p-4 pr-6 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-sm">
              {filteredServicios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400 dark:text-gray-500">
                    No se encontraron órdenes de servicio que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredServicios.map((s) => {
                  const client = clientNames[s.clienteId];
                  return (
                    <tr 
                      key={s.id} 
                      onClick={() => navigate("detalle-servicio", s.id)}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 cursor-pointer transition-colors"
                    >
                      {/* Order Number */}
                      <td className="p-4 pl-6 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        #{s.numeroServicio}
                      </td>

                      {/* Propietario & warning */}
                      <td className="p-4">
                        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{client ? client.name : "Cargando..."}</span>
                          {client?.problematic && (
                            <span className="text-red-500 inline-flex" title="Cliente Conflictivo">
                              <AlertTriangle className="w-3.5 h-3.5 fill-red-100 dark:fill-red-950/20" />
                            </span>
                          )}
                        </div>
                        {s.esReclamoGarantia && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.2 rounded uppercase tracking-wider">
                            Reclamo Garantía
                          </span>
                        )}
                      </td>

                      {/* Apparatus and Brand Model */}
                      <td className="p-4">
                        <div className="font-medium text-gray-850 dark:text-gray-300 flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {s.aparato}
                        </div>
                        <span className="text-xs text-gray-400">{s.marcaModelo}</span>
                      </td>

                      {/* Entry Date */}
                      <td className="p-4 text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {toDate(s.fechaIngreso)?.toLocaleDateString() || "Sin fecha"}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusColor(s.estado)}`}>
                          {s.estado}
                        </span>
                      </td>

                      {/* Assigned technician */}
                      <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                          {s.tecnicoId ? tecnicNames[s.tecnicoId] || "Asignado" : <span className="italic text-gray-400 font-normal">Sin asignar</span>}
                        </span>
                      </td>

                      {/* Go to detailed view */}
                      <td className="p-4 pr-6 text-right">
                        <button className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors cursor-pointer">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
