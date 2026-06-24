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
  Tag
} from "lucide-react";

export default function Equipos() {
  const { profile } = useAuth();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<Equipo | null>(null);
  const [loading, setLoading] = useState(true);

  // Client mapping for fast display
  const [clientNames, setClientNames] = useState<Record<string, string>>({});

  const { 
    register, 
    handleSubmit, 
    reset, 
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

      const mapping: Record<string, string> = {};
      cliList.forEach(c => {
        mapping[c.id || ""] = c.nombreApellido;
      });
      setClientNames(mapping);
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
    const cliName = clientNames[eq.clienteId]?.toLowerCase() || "";
    const term = searchTerm.toLowerCase();
    return (
      eq.tipo.toLowerCase().includes(term) ||
      eq.marca.toLowerCase().includes(term) ||
      eq.modelo.toLowerCase().includes(term) ||
      (eq.serie && eq.serie.toLowerCase().includes(term)) ||
      cliName.includes(term)
    );
  });

  const canWrite = profile?.rol === "admin" || profile?.rol === "recepcion";

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

        {/* Equipos Grid Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase border-b border-gray-100 dark:border-gray-800">
                  <th className="p-4 pl-6">Equipo</th>
                  <th className="p-4">Marca y Modelo</th>
                  <th className="p-4">N° Serie</th>
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
                      <td className="p-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {eq.serie || <span className="italic text-gray-400">S/N</span>}
                      </td>
                      <td className="p-4 text-gray-900 dark:text-white font-medium">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {clientNames[eq.clienteId] || <span className="text-red-500 italic">Cliente Huérfano</span>}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {eq.observaciones || <span className="italic text-gray-300 dark:text-gray-600">Ninguna</span>}
                      </td>
                      {canWrite && (
                        <td className="p-4 pr-6 text-right">
                          <button
                            onClick={() => handleOpenEdit(eq)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit/Create Dialog */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in">
            
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
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Cliente Propietario *
                </label>
                <select
                  {...register("clienteId")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">-- Seleccionar Cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombreApellido}</option>
                  ))}
                </select>
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

    </div>
  );
}
