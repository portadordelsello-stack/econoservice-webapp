import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EquipoSchema } from "../schemas";
import { EquiposService, ClientesService } from "../services/db";
import { Equipo, Cliente } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { 
  Plus, 
  Search, 
  Edit2, 
  Laptop, 
  X, 
  Check, 
  User, 
  Tag,
  MapPin,
  Trash,
  AlertTriangle
} from "lucide-react";

export default function Equipos() {
  const { profile } = useAuth();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [equipoToDelete, setEquipoToDelete] = useState<string | null>(null);
  
  const isSuperadmin = profile?.rol === "superadmin";

  const handleDeleteEquipo = (id: string) => {
    if (!id) return;
    setEquipoToDelete(id);
  };

  const confirmDeleteEquipo = async () => {
    if (!equipoToDelete) return;
    try {
      await EquiposService.delete(equipoToDelete);
      loadData();
      setEquipoToDelete(null);
    } catch (err) {
      console.error("Error deleting equipment:", err);
    }
  };
  
  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<Equipo | null>(null);
  const [loading, setLoading] = useState(true);

  // Client mapping for fast display
  const [clientMap, setClientMap] = useState<Record<string, Cliente>>({});

  // Client Search in modal states
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { 
    register, 
    handleSubmit, 
    reset, 
    setValue,
    watch,
    formState: { errors, isSubmitting } 
  } = useForm({
    resolver: zodResolver(EquipoSchema),
    defaultValues: {
      clienteId: "",
      tipo: "",
      marca: "",
      modelo: "",
      serie: "",
      observaciones: ""
    }
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [eqList, cliList] = await Promise.all([
        EquiposService.getAll(),
        ClientesService.getAll()
      ]);
      setEquipos(eqList);
      setClientes(cliList);

      const mapping: Record<string, Cliente> = {};
      cliList.forEach(c => {
        mapping[c.id || ""] = c;
      });
      setClientMap(mapping);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingEquipo(null);
    setClientSearchQuery("");
    setShowSuggestions(false);
    reset({
      clienteId: "",
      tipo: "",
      marca: "",
      modelo: "",
      serie: "",
      observaciones: ""
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (equipo: Equipo) => {
    setEditingEquipo(equipo);
    const client = clientMap[equipo.clienteId];
    setClientSearchQuery(client ? client.nombreApellido : "");
    setShowSuggestions(false);
    reset({
      clienteId: equipo.clienteId,
      tipo: equipo.tipo,
      marca: equipo.marca,
      modelo: equipo.modelo,
      serie: equipo.serie || "",
      observaciones: equipo.observaciones || ""
    });
    setIsFormOpen(true);
  };

  const onSubmitForm = async (data: any) => {
    try {
      if (editingEquipo && editingEquipo.id) {
        await EquiposService.update(editingEquipo.id, data);
      } else {
        await EquiposService.create(data);
      }
      setIsFormOpen(false);
      reset();
      loadData();
    } catch (err) {
      console.error("Error saving equipo:", err);
    }
  };

  const filteredEquipos = equipos.filter(eq => {
    const client = clientMap[eq.clienteId];
    const cliName = client?.nombreApellido?.toLowerCase() || "";
    const cliAddress = client ? [
      client.calle ? `${client.calle} ${client.numero || ""}` : "",
      client.barrio ? `B° ${client.barrio}` : "",
      client.localidad || ""
    ].filter(Boolean).join(", ").toLowerCase() : "";
    const term = searchTerm.toLowerCase();
    return (
      eq.tipo.toLowerCase().includes(term) ||
      eq.marca.toLowerCase().includes(term) ||
      eq.modelo.toLowerCase().includes(term) ||
      (eq.serie && eq.serie.toLowerCase().includes(term)) ||
      cliName.includes(term) ||
      cliAddress.includes(term)
    );
  });

  const matchedClientesForModal = clientSearchQuery.trim() === ""
    ? []
    : clientes.filter(c => {
        const name = (c.nombreApellido || "").toLowerCase();
        const address = `${c.calle || ""} ${c.numero || ""} ${c.barrio || ""} ${c.localidad || ""}`.toLowerCase();
        const term = clientSearchQuery.toLowerCase();
        return name.includes(term) || address.includes(term);
      }).slice(0, 5);

  const canWrite = profile?.rol === "superadmin" || profile?.rol === "logistica";

  if (loading && equipos.length === 0) {
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
            Equipos del Taller
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Catálogo e historial de aparatos y electrodomésticos vinculados a clientes.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar Equipo
          </button>
        )}
      </div>

      {/* Filter and List Section */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por tipo, marca, modelo, N° serie o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        {/* Equipos Grid Table - Desktop View */}
        <div className="hidden md:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase border-b border-gray-100 dark:border-gray-800">
                  <th className="p-4 pl-6">Equipo</th>
                  <th className="p-4">Marca y Modelo</th>
                  <th className="p-4">Dirección</th>
                  <th className="p-4">Cliente / Propietario</th>
                  <th className="p-4">Observaciones</th>
                  {canWrite && <th className="p-4 pr-6 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-sm">
                {filteredEquipos.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} className="p-8 text-center text-gray-400 dark:text-gray-500">
                      No se encontraron equipos registrados.
                    </td>
                  </tr>
                ) : (
                  filteredEquipos.map((eq) => (
                    <tr key={eq.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-4 pl-6 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 shrink-0">
                          <Laptop className="w-4 h-4" />
                        </div>
                        {eq.tipo}
                      </td>
                      <td className="p-4 font-medium text-gray-700 dark:text-gray-300">
                        {eq.marca} <span className="text-gray-400 font-normal">({eq.modelo})</span>
                      </td>
                      <td className="p-4 font-bold text-gray-900 dark:text-white max-w-[220px] truncate">
                        {(() => {
                          const c = clientMap[eq.clienteId];
                          if (!c) return <span className="italic text-gray-400 font-normal">Sin dirección</span>;
                          const address = [
                            c.calle ? `${c.calle} ${c.numero || ""}` : "",
                            c.barrio ? `B° ${c.barrio}` : "",
                            c.localidad || ""
                          ].filter(Boolean).join(", ");
                          return address ? (
                            <span className="flex items-center gap-1.5 truncate" title={address}>
                              <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{address}</span>
                            </span>
                          ) : (
                            <span className="italic text-gray-400 font-normal">Sin dirección</span>
                          );
                        })()}
                      </td>
                      <td className="p-4 text-gray-900 dark:text-white font-medium">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {clientMap[eq.clienteId]?.nombreApellido || <span className="text-red-500 italic">Cliente Huérfano</span>}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {eq.observaciones || <span className="italic text-gray-300 dark:text-gray-600">Ninguna</span>}
                      </td>
                      {canWrite && (
                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(eq)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            {isSuperadmin && (
                              <button
                                onClick={() => handleDeleteEquipo(eq.id || "")}
                                className="p-1.5 text-gray-450 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar Equipo"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Equipos List - Mobile Card View */}
        <div className="md:hidden space-y-4">
          {filteredEquipos.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
              No se encontraron equipos registrados.
            </div>
          ) : (
            filteredEquipos.map((eq) => {
              const c = clientMap[eq.clienteId];
              const address = c ? [
                c.calle ? `${c.calle} ${c.numero || ""}` : "",
                c.barrio ? `B° ${c.barrio}` : "",
                c.localidad || ""
              ].filter(Boolean).join(", ") : "";

              return (
                <div
                  key={eq.id}
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-3"
                >
                  {/* Header: Type and badge */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-950 dark:text-white flex items-center gap-2 text-sm">
                      <Laptop className="w-4 h-4 text-indigo-500 shrink-0" />
                      {eq.tipo}
                    </span>
                    {eq.serie && (
                      <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500">
                        {eq.serie}
                      </span>
                    )}
                  </div>

                  {/* Brand & Model */}
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="font-semibold text-gray-400">Marca/Modelo:</span> {eq.marca} ({eq.modelo})
                  </div>

                  {/* Owner & Address details */}
                  <div className="space-y-2 text-xs bg-gray-50 dark:bg-gray-850 p-3 rounded-xl border border-gray-100/30 dark:border-gray-800/20">
                    <div className="flex items-center gap-1.5 truncate text-gray-900 dark:text-white">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="font-medium truncate">
                        {c?.nombreApellido || <span className="text-red-500 italic">Cliente Huérfano</span>}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 text-gray-500 dark:text-gray-400 pl-5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span className="truncate">
                        {address || <span className="italic text-gray-400">Sin dirección registrada</span>}
                      </span>
                    </div>
                  </div>

                  {/* Observations */}
                  {eq.observaciones && (
                    <p className="text-xs text-gray-400 italic">
                      <span className="font-semibold not-italic">Notas:</span> {eq.observaciones}
                    </p>
                  )}

                  {/* Edit / Delete action */}
                  {canWrite && (
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenEdit(eq)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar Datos
                      </button>
                      {isSuperadmin && (
                        <button
                          onClick={() => handleDeleteEquipo(eq.id || "")}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-gray-100 dark:border-gray-800 rounded-xl transition-colors cursor-pointer"
                          title="Eliminar Equipo"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit/Create Dialog */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center sm:items-start sm:pt-[2vh] justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in sm:ml-[30vw]">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingEquipo ? "Editar Datos de Equipo" : "Registrar Nuevo Equipo"}
              </h2>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmitForm)} className="p-6 space-y-4">
              
               {/* Propietario Selector */}
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Cliente Propietario *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre o dirección..."
                    value={clientSearchQuery}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      // Small timeout to allow onClick on suggestion to trigger first
                      setTimeout(() => {
                        setShowSuggestions(false);
                      }, 200);
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClientSearchQuery(val);
                      setShowSuggestions(true);
                      if (val === "") {
                        setValue("clienteId", "");
                      }
                    }}
                    className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  {clientSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientSearchQuery("");
                        setValue("clienteId", "");
                        setShowSuggestions(false);
                      }}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Hidden input for React Hook Form binding */}
                <input type="hidden" {...register("clienteId")} />

                {/* Suggestions Dropdown */}
                {showSuggestions && clientSearchQuery.trim() !== "" && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-850 border border-gray-100 dark:border-gray-750 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800 animate-in fade-in duration-100">
                    {matchedClientesForModal.length === 0 ? (
                      <div className="p-3 text-xs text-gray-400 dark:text-gray-500 text-center">
                        No se encontraron clientes coincidentes
                      </div>
                    ) : (
                      matchedClientesForModal.map((c) => {
                        const hasAddress = c.calle || c.barrio || c.localidad;
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              setValue("clienteId", c.id || "");
                              setClientSearchQuery(c.nombreApellido);
                              setShowSuggestions(false);
                            }}
                            className="p-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer flex flex-col gap-1 transition-colors text-left"
                          >
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                              {c.nombreApellido}
                            </span>
                            {hasAddress && (
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="truncate">
                                  {[
                                    c.calle ? `${c.calle} ${c.numero || ""}` : "",
                                    c.barrio ? `B° ${c.barrio}` : "",
                                    c.localidad || ""
                                  ].filter(Boolean).join(", ")}
                                </span>
                              </div>
                            )}
                            {c.telefono && (
                              <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono pl-4">
                                Tel: {c.telefono}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Show indicator if a valid client is currently selected */}
                {watch("clienteId") && (
                  <p className="text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 mt-1 flex items-center gap-1 pl-1">
                    <Check className="w-3.5 h-3.5" />
                    Cliente seleccionado correctamente
                  </p>
                )}

                {errors.clienteId && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.clienteId.message as string}</p>
                )}
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Tipo de Equipo *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Lavarropas, Lavavajillas, Horno Eléctrico"
                  {...register("tipo")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                {errors.tipo && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.tipo.message as string}</p>
                )}
              </div>

              {/* Marca y Modelo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Marca *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Whirlpool"
                    {...register("marca")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  {errors.marca && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.marca.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. WQE-10"
                    {...register("modelo")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  {errors.modelo && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.modelo.message as string}</p>
                  )}
                </div>
              </div>

              {/* Serie */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Número de Serie
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="S/N"
                    {...register("serie")}
                    className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Observaciones Generales
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles estéticos iniciales, partes rotas, etc."
                  {...register("observaciones")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
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
                  {isSubmitting ? "Guardando..." : "Guardar Equipo"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {equipoToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ¿Eliminar equipo registrado?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará de forma permanente este equipo de la base de datos de forma irreversible.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setEquipoToDelete(null)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteEquipo}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all"
              >
                Sí, Eliminar Equipo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
