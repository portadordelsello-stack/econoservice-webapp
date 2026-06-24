import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ServicioSchema } from "../schemas";
import { ServiciosService, ClientesService, EquiposService, TecnicosService } from "../services/db";
import { Cliente, Equipo, Tecnico } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { 
  ArrowLeft, 
  Check, 
  Wrench, 
  User, 
  Laptop, 
  PlusCircle, 
  AlertTriangle 
} from "lucide-react";

export default function CrearServicio() {
  const { profile } = useAuth();
  const { navigate } = useNavigation();

  // DB options
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected states for dynamic filtering
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [filteredEquipos, setFilteredEquipos] = useState<Equipo[]>([]);

  // Inline creators toggles
  const [showInlineCliente, setShowInlineCliente] = useState(false);
  const [inlineClienteName, setInlineClienteName] = useState("");
  const [inlineClientePhone, setInlineClientePhone] = useState("");

  const [showInlineEquipo, setShowInlineEquipo] = useState(false);
  const [inlineEquipoTipo, setInlineEquipoTipo] = useState("");
  const [inlineEquipoMarca, setInlineEquipoMarca] = useState("");
  const [inlineEquipoModelo, setInlineEquipoModelo] = useState("");

  const { 
    register, 
    handleSubmit, 
    setValue, 
    watch, 
    formState: { errors, isSubmitting } 
  } = useForm({
    resolver: zodResolver(ServicioSchema),
    defaultValues: {
      clienteId: "",
      equipoId: "",
      tecnicoId: "",
      aparato: "",
      marcaModelo: "",
      desperfectoUsuario: "",
      serviciosRequeridos: "",
      serviciosConvenidos: "",
      garantia: false,
      esReclamoGarantia: false,
      ingresoTaller: true,
      pasaStock: false,
      entregado: false,
      terminado: false,
      factura: false,
      contado: false,
    }
  });

  const selectedEquipoId = watch("equipoId");

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [cliList, eqList, tecList] = await Promise.all([
        ClientesService.getAll(),
        EquiposService.getAll(),
        TecnicosService.getAll()
      ]);
      setClientes(cliList);
      setEquipos(eqList);
      setTecnicos(tecList.filter(t => t.activo)); // Only load active technicians
    } catch (err) {
      console.error("Error loading create service data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter equipment when client selection changes
  useEffect(() => {
    if (selectedClienteId) {
      const filtered = equipos.filter(e => e.clienteId === selectedClienteId);
      setFilteredEquipos(filtered);
      setValue("clienteId", selectedClienteId);
      setValue("equipoId", ""); // Reset equipment selection
    } else {
      setFilteredEquipos([]);
    }
  }, [selectedClienteId, equipos, setValue]);

  // Auto-fill Apparato & Brand/Model when equipment selection changes
  useEffect(() => {
    if (selectedEquipoId) {
      const eq = equipos.find(e => e.id === selectedEquipoId);
      if (eq) {
        setValue("aparato", eq.tipo);
        setValue("marcaModelo", `${eq.marca} ${eq.modelo}`);
      }
    } else {
      setValue("aparato", "");
      setValue("marcaModelo", "");
    }
  }, [selectedEquipoId, equipos, setValue]);

  // Inline Creators Handlers
  const handleCreateInlineCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineClienteName.trim()) return;

    try {
      const newClientId = await ClientesService.create({
        nombreApellido: inlineClienteName,
        telCel: inlineClientePhone,
        clienteProblematico: false
      });
      
      // Re-load list and auto-select
      await loadAllData();
      setSelectedClienteId(newClientId);
      
      // Reset inputs
      setInlineClienteName("");
      setInlineClientePhone("");
      setShowInlineCliente(false);
    } catch (err) {
      console.error("Error creating inline cliente:", err);
    }
  };

  const handleCreateInlineEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId || !inlineEquipoTipo.trim() || !inlineEquipoMarca.trim() || !inlineEquipoModelo.trim()) return;

    try {
      const newEqId = await EquiposService.create({
        clienteId: selectedClienteId,
        tipo: inlineEquipoTipo,
        marca: inlineEquipoMarca,
        modelo: inlineEquipoModelo
      });

      // Re-load and auto-select
      await loadAllData();
      setTimeout(() => {
        setValue("equipoId", newEqId);
      }, 150);

      // Reset inputs
      setInlineEquipoTipo("");
      setInlineEquipoMarca("");
      setInlineEquipoModelo("");
      setShowInlineEquipo(false);
    } catch (err) {
      console.error("Error creating inline equipo:", err);
    }
  };

  const onSubmitForm = async (data: any) => {
    if (!profile) return;
    try {
      await ServiciosService.create(
        {
          ...data,
          createdBy: profile.uid,
          presupuesto: Number(data.presupuesto) || 0
        },
        profile.uid,
        profile.nombre
      );
      navigate("servicios");
    } catch (err) {
      console.error("Error creating service order:", err);
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
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("servicios")}
          className="p-2 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-500 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Nueva Orden de Ingreso
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Complete los datos para generar el ticket del electrodoméstico ingresado.
          </p>
        </div>
      </div>

      {/* Main Intake Layout */}
      <form onSubmit={handleSubmit(onSubmitForm)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Client and machine selectors */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Client Selection */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                1. Selección de Cliente
              </h2>
              <button
                type="button"
                onClick={() => setShowInlineCliente(!showInlineCliente)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Crear Cliente Nuevo
              </button>
            </div>

            {/* Inline Client Creator Panel */}
            {showInlineCliente && (
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3 animate-fade-in">
                <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Rápido: Registrar Cliente
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre y Apellido *"
                    value={inlineClienteName}
                    onChange={(e) => setInlineClienteName(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Teléfono Celular"
                    value={inlineClientePhone}
                    onChange={(e) => setInlineClientePhone(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowInlineCliente(false)}
                    className="px-2.5 py-1 text-gray-400 hover:underline"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateInlineCliente}
                    className="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                  >
                    Crear y Seleccionar
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Seleccione un Cliente Propietario *
              </label>
              <select
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
              >
                <option value="">-- Buscar / Seleccionar Cliente --</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombreApellido} {c.telCel ? `(${c.telCel})` : ""} {c.clienteProblematico ? "⚠️" : ""}
                  </option>
                ))}
              </select>
              {errors.clienteId && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.clienteId.message as string}</p>
              )}
            </div>
          </div>

          {/* Card 2: Equipment Selection */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Laptop className="w-5 h-5 text-indigo-600" />
                2. Selección de Equipo
              </h2>
              {selectedClienteId && (
                <button
                  type="button"
                  onClick={() => setShowInlineEquipo(!showInlineEquipo)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Crear Equipo Nuevo
                </button>
              )}
            </div>

            {/* Inline Equipment Creator Panel */}
            {showInlineEquipo && selectedClienteId && (
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3 animate-fade-in">
                <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Rápido: Registrar Equipo para este Cliente
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Tipo (Lavarropas, etc) *"
                    value={inlineEquipoTipo}
                    onChange={(e) => setInlineEquipoTipo(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Marca *"
                    value={inlineEquipoMarca}
                    onChange={(e) => setInlineEquipoMarca(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Modelo *"
                    value={inlineEquipoModelo}
                    onChange={(e) => setInlineEquipoModelo(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowInlineEquipo(false)}
                    className="px-2.5 py-1 text-gray-400 hover:underline"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateInlineEquipo}
                    className="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                  >
                    Crear y Seleccionar
                  </button>
                </div>
              </div>
            )}

            {!selectedClienteId ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 text-center text-xs text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                Seleccione un cliente primero para ver sus equipos o crear uno nuevo.
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Seleccione el Equipo del Cliente *
                </label>
                <select
                  {...register("equipoId")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                >
                  <option value="">-- Seleccionar Equipo --</option>
                  {filteredEquipos.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.tipo} • {eq.marca} ({eq.modelo})</option>
                  ))}
                </select>
                {errors.equipoId && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.equipoId.message as string}</p>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Service details */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-50 dark:border-gray-800 pb-3">
              <Wrench className="w-5 h-5 text-indigo-600" />
              3. Detalles del Servicio
            </h2>

            {/* Autofilled Fields but customizable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Aparato / Tipo de Equipo *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Lavarropas"
                  {...register("aparato")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
                {errors.aparato && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.aparato.message as string}</p>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Marca y Modelo *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Drean Excellent 6.0"
                  {...register("marcaModelo")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
                {errors.marcaModelo && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.marcaModelo.message as string}</p>
                )}
              </div>
            </div>

            {/* Desperfecto reportado por usuario */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Desperfecto Reportado por el Usuario *
              </label>
              <textarea
                rows={3}
                placeholder="Ej. No centrifuga, hace ruido excesivo al desagotar..."
                {...register("desperfectoUsuario")}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
              />
              {errors.desperfectoUsuario && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.desperfectoUsuario.message as string}</p>
              )}
            </div>

            {/* Servicios requeridos / convenidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Servicios Requeridos (Taller)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Revisar bomba de desagote, verificar carbones..."
                  {...register("serviciosRequeridos")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Servicios Convenidos con Cliente
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Cambio de bomba y rulemanes si el presupuesto es menor a $15000..."
                  {...register("serviciosConvenidos")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none text-xs"
                />
              </div>
            </div>

          </div>

        </div>

        {/* Right Side: Assignment & Logistics */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-md">
              Asignación y Diagnóstico
            </h3>

            {/* Tecnico select */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Técnico Inicial Asignado
              </label>
              <select
                {...register("tecnicoId")}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-xs focus:outline-none"
              >
                <option value="">-- Sin asignar / Espera taller --</option>
                {tecnicos.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre} ({t.especialidad || "General"})</option>
                ))}
              </select>
            </div>

            {/* Warranty & options */}
            <div className="space-y-3 pt-3 border-t border-gray-50 dark:border-gray-800/50">
              <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Parámetros Especiales
              </span>
              
              <div className="flex flex-col gap-2">
                <label className="relative flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("esReclamoGarantia")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">¿Reclamo de Garantía?</span>
                </label>

                <label className="relative flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("ingresoTaller")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Ingreso Físico a Taller</span>
                </label>
              </div>
            </div>

          </div>

          {/* Form Actions */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-md">
              Confirmar Ingreso
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Al guardar la orden de ingreso, el estado se establecerá por defecto en **RECIBIDO**, se creará la primera entrada en la bitácora de historial de auditoría y se generará un número de orden secuencial autoincremental de taller.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? "Generando Orden..." : "Guardar e Imprimir Orden"}
            </button>
          </div>

        </div>

      </form>

    </div>
  );
}
