import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TecnicoSchema } from "../schemas";
import { TecnicosService } from "../services/db";
import { Tecnico } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { 
  Plus, 
  Search, 
  Edit2, 
  X, 
  Check, 
  Phone, 
  Trash2,
  Cpu,
  UserCheck,
  ShieldCheck
} from "lucide-react";

export default function Tecnicos() {
  const { profile } = useAuth();
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTecnico, setEditingTecnico] = useState<Tecnico | null>(null);
  const [loading, setLoading] = useState(true);

  const { 
    register, 
    handleSubmit, 
    reset, 
    formState: { errors, isSubmitting } 
  } = useForm({
    resolver: zodResolver(TecnicoSchema),
    defaultValues: {
      nombre: "",
      telefono: "",
      especialidad: "",
      activo: true
    }
  });

  const loadTecnicos = async () => {
    try {
      setLoading(true);
      const data = await TecnicosService.getAll();
      setTecnicos(data);
    } catch (err) {
      console.error("Error loading tecnicos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTecnicos();
  }, []);

  const handleOpenCreate = () => {
    setEditingTecnico(null);
    reset({
      nombre: "",
      telefono: "",
      especialidad: "",
      activo: true
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (tecnico: Tecnico) => {
    setEditingTecnico(tecnico);
    reset({
      nombre: tecnico.nombre,
      telefono: tecnico.telefono || "",
      especialidad: tecnico.especialidad || "",
      activo: tecnico.activo
    });
    setIsFormOpen(true);
  };

  const onSubmitForm = async (data: any) => {
    try {
      if (editingTecnico && editingTecnico.id) {
        await TecnicosService.update(editingTecnico.id, data);
      } else {
        await TecnicosService.create(data);
      }
      setIsFormOpen(false);
      reset();
      loadTecnicos();
    } catch (err) {
      console.error("Error saving tecnico:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar permanentemente este técnico?")) {
      try {
        await TecnicosService.delete(id);
        loadTecnicos();
      } catch (err) {
        console.error("Error deleting tecnico:", err);
      }
    }
  };

  const filteredTecnicos = tecnicos.filter(t => 
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.especialidad && t.especialidad.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isAdmin = profile?.rol === "superadmin";

  if (loading && tecnicos.length === 0) {
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
            Staff de la Empresa
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestión de especialistas y personal del taller de reparaciones.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Integrante
          </button>
        )}
      </div>

      {/* Warning if not admin */}
      {!isAdmin && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl text-indigo-700 dark:text-indigo-400 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Tiene acceso de solo lectura. Únicamente el Superadmin puede añadir o modificar personal de staff.</span>
        </div>
      )}

      {/* Filter panel */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar técnico por nombre o especialidad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        {/* Tecnicos Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTecnicos.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-12 text-center text-gray-400">
              No hay técnicos registrados.
            </div>
          ) : (
            filteredTecnicos.map((t) => (
              <div 
                key={t.id}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden"
              >
                {/* Active Indicator bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${t.activo ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-700"}`} />

                {/* Card Title & Specialty */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="font-bold text-lg text-gray-900 dark:text-white block">
                      {t.nombre}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                      <Cpu className="w-3.5 h-3.5" />
                      {t.especialidad || "General / Sin especialidad"}
                    </span>
                  </div>
                  
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    t.activo 
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100" 
                      : "bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200"
                  }`}>
                    {t.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>

                {/* Telephone */}
                {t.telefono && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{t.telefono}</span>
                  </p>
                )}

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-50 dark:border-gray-800/60">
                    <button
                      onClick={() => handleOpenEdit(t)}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-lg transition-colors cursor-pointer"
                      title="Editar técnico"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id || "")}
                      className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar técnico"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center sm:items-start sm:pt-[2vh] justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in sm:ml-[30vw]">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingTecnico ? "Editar Ficha de Técnico" : "Agregar Nuevo Técnico"}
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
              
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ing. Carlos Gómez"
                  {...register("nombre")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
                {errors.nombre && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.nombre.message as string}</p>
                )}
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Teléfono de Contacto
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Ej. +54 9 11 2345-6789"
                    {...register("telefono")}
                    className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Especialidad */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Especialidad Principal
                </label>
                <input
                  type="text"
                  placeholder="Ej. Refrigeración, Lavarropas de carga frontal"
                  {...register("especialidad")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
              </div>

              {/* Activo switch */}
              <div className="flex items-center h-10">
                <label className="relative flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("activo")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Técnico Activo (Disponible para Asignación)</span>
                </label>
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
                  {isSubmitting ? "Guardando..." : "Guardar Técnico"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
