import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClienteSchema } from "../schemas";
import { ClientesService, EquiposService, ServiciosService, toDate } from "../services/db";
import { Cliente, Equipo, Servicio, getEstadoLabel } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { 
  UserPlus, 
  Search, 
  Edit2, 
  AlertTriangle, 
  Eye, 
  MapPin, 
  Phone, 
  Wrench, 
  Laptop, 
  X, 
  Check,
  ChevronRight,
  ArrowLeft,
  Trash
} from "lucide-react";

export default function Clientes() {
  const { profile } = useAuth();
  const { navigate } = useNavigation();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteEquipos, setClienteEquipos] = useState<Equipo[]>([]);
  const [clienteServicios, setClienteServicios] = useState<Servicio[]>([]);
  
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);
  
  const isSuperadmin = profile?.rol === "superadmin";

  const handleDeleteCliente = (id: string) => {
    if (!id) return;
    setClienteToDelete(id);
  };

  const confirmDeleteCliente = async () => {
    if (!clienteToDelete) return;
    try {
      await ClientesService.delete(clienteToDelete);
      if (selectedCliente?.id === clienteToDelete) {
        setSelectedCliente(null);
      }
      loadClientes();
      setClienteToDelete(null);
    } catch (err) {
      console.error("Error deleting client:", err);
    }
  };
  
  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);

  // Zod & React Hook Form
  const { 
    register, 
    handleSubmit, 
    reset, 
    formState: { errors, isSubmitting } 
  } = useForm({
    resolver: zodResolver(ClienteSchema),
    defaultValues: {
      nombreApellido: "",
      telFijo: "",
      telCel: "",
      telCelBis: "",
      telCelOtro: "",
      localidad: "",
      barrio: "",
      zona: "",
      calle: "",
      numero: "",
      piso: "",
      depto: "",
      clienteProblematico: false,
      observaciones: ""
    }
  });

  const loadClientes = async () => {
    try {
      setLoading(true);
      const data = await ClientesService.getAll();
      setClientes(data);
    } catch (err) {
      console.error("Error loading clientes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, []);

  const handleSelectCliente = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    try {
      if (cliente.id) {
        const [equipos, servicios] = await Promise.all([
          EquiposService.getByCliente(cliente.id),
          ServiciosService.getAll() // Retrieve all and filter client-side to minimize index errors
        ]);
        setClienteEquipos(equipos);
        setClienteServicios(servicios.filter(s => s.clienteId === cliente.id));
      }
    } catch (err) {
      console.error("Error loading cliente details:", err);
    }
  };

  const handleOpenCreate = () => {
    setEditingCliente(null);
    reset({
      nombreApellido: "",
      telFijo: "",
      telCel: "",
      telCelBis: "",
      telCelOtro: "",
      localidad: "",
      barrio: "",
      zona: "",
      calle: "",
      numero: "",
      piso: "",
      depto: "",
      clienteProblematico: false,
      observaciones: ""
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    reset({
      nombreApellido: cliente.nombreApellido,
      telFijo: cliente.telFijo || "",
      telCel: cliente.telCel || "",
      telCelBis: cliente.telCelBis || "",
      telCelOtro: cliente.telCelOtro || "",
      localidad: cliente.localidad || "",
      barrio: cliente.barrio || "",
      zona: cliente.zona || "",
      calle: cliente.calle || "",
      numero: cliente.numero || "",
      piso: cliente.piso || "",
      depto: cliente.depto || "",
      clienteProblematico: cliente.clienteProblematico,
      observaciones: cliente.observaciones || ""
    });
    setIsFormOpen(true);
  };

  const onSubmitForm = async (data: any) => {
    try {
      if (editingCliente && editingCliente.id) {
        await ClientesService.update(editingCliente.id, data);
        if (selectedCliente?.id === editingCliente.id) {
          setSelectedCliente({ ...selectedCliente, ...data });
        }
      } else {
        await ClientesService.create(data);
      }
      setIsFormOpen(false);
      reset();
      loadClientes();
    } catch (err) {
      console.error("Error saving cliente:", err);
    }
  };

  // Filter clients locally
  const filteredClientes = clientes.filter(c => 
    c.nombreApellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.telCel && c.telCel.includes(searchTerm)) ||
    (c.localidad && c.localidad.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.calle && c.calle.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.numero && c.numero.includes(searchTerm))
  );

  const canWrite = profile?.rol === "superadmin" || profile?.rol === "logistica";

  if (loading && clientes.length === 0) {
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
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Directorio de Clientes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestión y hojas de servicio detalladas de clientes registrados.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Search and List */}
        <div className={`lg:col-span-1 space-y-4 ${selectedCliente ? "hidden lg:block" : "block"}`}>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente por dirección, nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50 dark:divide-gray-800/50 max-h-[600px] overflow-y-auto">
            {filteredClientes.length === 0 ? (
              <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                No se encontraron clientes.
              </div>
            ) : (
              filteredClientes.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelectCliente(c)}
                  className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                    selectedCliente?.id === c.id 
                      ? "bg-indigo-500/10 border-l-4 border-indigo-600" 
                      : "hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                  }`}
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-gray-900 dark:text-white truncate">
                        {[
                          c.calle ? `${c.calle} ${c.numero || ""}` : "",
                          c.barrio ? `B° ${c.barrio}` : "",
                          c.localidad || ""
                        ].filter(Boolean).join(", ") || "Domicilio no registrado"}
                      </span>
                      {c.clienteProblematico && (
                        <span className="inline-flex items-center text-red-600 dark:text-red-400 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 fill-red-100 dark:fill-red-950/40" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-normal truncate">
                      {c.nombreApellido}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {isSuperadmin && (
                      <button
                        onClick={() => handleDeleteCliente(c.id || "")}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar Cliente"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column: Cliente Details */}
        <div className={`lg:col-span-2 ${selectedCliente ? "block" : "hidden lg:block"}`}>
          {selectedCliente ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
              
              {/* Volver button for mobile */}
              <button
                onClick={() => setSelectedCliente(null)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-2 cursor-pointer bg-gray-50 dark:bg-gray-850 rounded-lg border border-gray-100 dark:border-gray-800"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al listado
              </button>

              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedCliente.nombreApellido}
                    </h2>
                    {selectedCliente.clienteProblematico && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Cliente Conflictivo
                      </span>
                    )}
                  </div>
                  
                  {/* Address Badge */}
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>
                      {[
                        selectedCliente.calle ? `${selectedCliente.calle} ${selectedCliente.numero || ""}` : "",
                        selectedCliente.barrio ? `B° ${selectedCliente.barrio}` : "",
                        selectedCliente.localidad || ""
                      ].filter(Boolean).join(", ") || "Domicilio no registrado"}
                    </span>
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {canWrite && (
                    <button
                      onClick={() => handleOpenEdit(selectedCliente)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar Perfil
                    </button>
                  )}
                  {isSuperadmin && (
                    <button
                      onClick={() => handleDeleteCliente(selectedCliente.id || "")}
                      className="p-1.5 border border-gray-100 dark:border-gray-800 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Eliminar Cliente"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Personal details & Address details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Contacto</h3>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <p className="flex items-center gap-2">
                      <span className="font-semibold w-24">Celular Principal:</span>
                      <span>{selectedCliente.telCel || <span className="italic text-gray-400">Ninguno</span>}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-semibold w-24">Fijo:</span>
                      <span>{selectedCliente.telFijo || <span className="italic text-gray-400">Ninguno</span>}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-semibold w-24">Celular Bis:</span>
                      <span>{selectedCliente.telCelBis || <span className="italic text-gray-400">Ninguno</span>}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-semibold w-24">Celular Otro:</span>
                      <span>{selectedCliente.telCelOtro || <span className="italic text-gray-400">Ninguno</span>}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Dirección</h3>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <p className="flex items-center gap-2">
                      <span className="font-semibold w-24">Zona/Localidad:</span>
                      <span>{selectedCliente.localidad} {selectedCliente.zona ? `(${selectedCliente.zona})` : ""}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-semibold w-24">Barrio:</span>
                      <span>{selectedCliente.barrio || <span className="italic text-gray-400">Ninguno</span>}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-semibold w-24">Calle y N°:</span>
                      <span>{selectedCliente.calle} {selectedCliente.numero}</span>
                    </p>
                    {(selectedCliente.piso || selectedCliente.depto) && (
                      <p className="flex items-center gap-2">
                        <span className="font-semibold w-24">Piso / Depto:</span>
                        <span>{selectedCliente.piso ? `Piso ${selectedCliente.piso}` : ""} {selectedCliente.depto ? `Depto ${selectedCliente.depto}` : ""}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {selectedCliente.observaciones && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/50 rounded-xl">
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notas Internas</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedCliente.observaciones}</p>
                </div>
              )}

              {/* Equipment lists */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-indigo-600" />
                  Equipos Registrados ({clienteEquipos.length})
                </h3>
                {clienteEquipos.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No hay equipos registrados de este cliente.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clienteEquipos.map((eq) => (
                      <div key={eq.id} className="p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm text-gray-900 dark:text-white">{eq.tipo}</span>
                          <p className="text-xs text-gray-400">{eq.marca} • {eq.modelo}</p>
                        </div>
                        {eq.serie && <span className="text-[10px] font-mono bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500">{eq.serie}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Service tickets opened */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-indigo-600" />
                  Historial de Servicios ({clienteServicios.length})
                </h3>
                {clienteServicios.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No hay registros de servicio anteriores.</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-50 dark:border-gray-800 rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 font-bold text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                          <th className="p-3">N° Orden</th>
                          <th className="p-3">Aparato</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {clienteServicios.map((s) => (
                          <tr 
                            key={s.id} 
                            onClick={() => navigate("detalle-servicio", s.id)}
                            className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                          >
                            <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">#{s.numeroServicio}</td>
                            <td className="p-3 font-medium text-gray-900 dark:text-white">{s.aparato}</td>
                            <td className="p-3">
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400">
                                {getEstadoLabel(s.estado)}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-gray-400">{toDate(s.fechaIngreso)?.toLocaleDateString() || "Sin fecha"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-12 text-center text-gray-400 dark:text-gray-500">
              <Eye className="w-12 h-12 mx-auto stroke-1 mb-4 opacity-50" />
              <p className="text-sm font-medium">Seleccione un cliente del listado lateral para visualizar su ficha completa.</p>
            </div>
          )}
        </div>

      </div>

      {/* Slide Modal for Create / Edit */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center sm:items-start sm:pt-[2vh] justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in sm:ml-[30vw]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingCliente ? "Editar Perfil de Cliente" : "Ingresar Nuevo Cliente"}
              </h2>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit(onSubmitForm)} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Name & Problematic flag */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    {...register("nombreApellido")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  {errors.nombreApellido && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.nombreApellido.message as string}</p>
                  )}
                </div>

                <div className="flex items-center h-10">
                  <label className="relative flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register("clienteProblematico")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">¿Cliente Conflictivo?</span>
                  </label>
                </div>
              </div>

              {/* Telephones */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Fijo
                  </label>
                  <input
                    type="text"
                    {...register("telFijo")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Celular
                  </label>
                  <input
                    type="text"
                    {...register("telCel")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Celular Bis
                  </label>
                  <input
                    type="text"
                    {...register("telCelBis")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Celular Otro
                  </label>
                  <input
                    type="text"
                    {...register("telCelOtro")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Location details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Localidad / Ciudad
                  </label>
                  <input
                    type="text"
                    {...register("localidad")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Barrio
                  </label>
                  <input
                    type="text"
                    {...register("barrio")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Zona / Sector
                  </label>
                  <input
                    type="text"
                    {...register("zona")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Address detail */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Calle
                  </label>
                  <input
                    type="text"
                    {...register("calle")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    {...register("numero")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Piso
                    </label>
                    <input
                      type="text"
                      {...register("piso")}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Depto
                    </label>
                    <input
                      type="text"
                      {...register("depto")}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Observaciones / Comentarios Internos
                </label>
                <textarea
                  rows={3}
                  {...register("observaciones")}
                  placeholder="Instrucciones para llegar, advertencias de cobros, etc."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSubmitting ? "Guardando..." : "Guardar Registro"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {clienteToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ¿Eliminar cliente?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará de forma permanente este cliente de la base de datos de forma irreversible.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setClienteToDelete(null)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteCliente}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all"
              >
                Sí, Eliminar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
