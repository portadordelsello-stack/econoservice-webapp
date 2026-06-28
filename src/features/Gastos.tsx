import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GastoSchema } from "../schemas";
import { GastosService, toDate } from "../services/db";
import { Gasto } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  TrendingDown, 
  Calendar,
  AlertTriangle,
  FolderOpen
} from "lucide-react";

export default function Gastos() {
  const { profile } = useAuth();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<Gasto | null>(null);
  const [loading, setLoading] = useState(true);
  const [gastoToDelete, setGastoToDelete] = useState<string | null>(null);

  const { 
    register, 
    handleSubmit, 
    reset, 
    formState: { errors, isSubmitting } 
  } = useForm({
    resolver: zodResolver(GastoSchema),
    defaultValues: {
      concepto: "",
      categoria: "Repuestos",
      monto: 0,
      observaciones: ""
    }
  });

  const loadGastos = async () => {
    try {
      setLoading(true);
      const data = await GastosService.getAll();
      setGastos(data);
    } catch (err) {
      console.error("Error loading gastos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGastos();
  }, []);

  const handleOpenCreate = () => {
    setEditingGasto(null);
    reset({
      concepto: "",
      categoria: "Repuestos",
      monto: 0,
      observaciones: ""
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (gasto: Gasto) => {
    setEditingGasto(gasto);
    reset({
      concepto: gasto.concepto,
      categoria: gasto.categoria,
      monto: gasto.monto,
      observaciones: gasto.observaciones || ""
    });
    setIsFormOpen(true);
  };

  const onSubmitForm = async (data: any) => {
    try {
      if (editingGasto && editingGasto.id) {
        await GastosService.update(editingGasto.id, {
          ...data,
          monto: Number(data.monto)
        });
      } else {
        await GastosService.create({
          ...data,
          monto: Number(data.monto)
        });
      }
      setIsFormOpen(false);
      reset();
      loadGastos();
    } catch (err) {
      console.error("Error saving gasto:", err);
    }
  };

  const handleDelete = (id: string) => {
    if (!id) return;
    setGastoToDelete(id);
  };

  const confirmDeleteGasto = async () => {
    if (!gastoToDelete) return;
    try {
      await GastosService.delete(gastoToDelete);
      loadGastos();
      setGastoToDelete(null);
    } catch (err) {
      console.error("Error deleting gasto:", err);
    }
  };

  const filteredGastos = gastos.filter(g => 
    g.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Compute Total Sum of Expenses
  const totalExpensesSum = filteredGastos.reduce((sum, g) => sum + g.monto, 0);

  const isAdmin = profile?.rol === "superadmin";

  if (loading && gastos.length === 0) {
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
            Egresos y Gastos de Taller
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Registro contable de repuestos comprados, alquileres y servicios del taller.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Gasto
          </button>
        )}
      </div>

      {/* Warning if not admin */}
      {!isAdmin && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl text-indigo-700 dark:text-indigo-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Tiene acceso de solo lectura. Únicamente los administradores pueden añadir, editar o eliminar registros financieros.</span>
        </div>
      )}

      {/* Grid: Stats & Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total stats card */}
        <div className="md:col-span-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
              Total de Egresos
            </span>
            <h3 className="text-3xl font-extrabold text-red-500 font-mono mt-1">
              ${totalExpensesSum.toLocaleString()}
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Suma de registros visualizados en tabla.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-500 shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        {/* Search filter input */}
        <div className="md:col-span-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl shadow-sm flex items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar egreso por concepto o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-transparent dark:border-gray-700 rounded-xl text-sm focus:outline-none"
            />
          </div>
        </div>

      </div>

      {/* Expenses Table list - Desktop View */}
      <div className="hidden md:block bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase border-b border-gray-100 dark:border-gray-800">
                <th className="p-4 pl-6">Fecha</th>
                <th className="p-4">Concepto</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Monto</th>
                <th className="p-4">Observaciones</th>
                {isAdmin && <th className="p-4 pr-6 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-sm">
              {filteredGastos.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-gray-400">
                    No se registran gastos anotados para el criterio de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredGastos.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="p-4 pl-6 text-gray-500 dark:text-gray-400 text-xs font-medium">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {toDate(g.fecha)?.toLocaleDateString() || "Hoy"}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">
                      {g.concepto}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700/50">
                        <FolderOpen className="w-3 h-3 text-gray-400" />
                        {g.categoria}
                      </span>
                    </td>
                    <td className="p-4 font-extrabold text-red-500 font-mono">
                      -${g.monto.toLocaleString()}
                    </td>
                    <td className="p-4 text-xs text-gray-400 max-w-xs truncate">
                      {g.observaciones || <span className="italic text-gray-350 dark:text-gray-600">Sin detalles</span>}
                    </td>
                    {isAdmin && (
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(g)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-lg transition-colors cursor-pointer"
                            title="Editar egreso"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(g.id || "")}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar egreso"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Expenses - Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredGastos.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
            No se registran gastos anotados para el criterio de búsqueda.
          </div>
        ) : (
          filteredGastos.map((g) => (
            <div
              key={g.id}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-3"
            >
              {/* Card Header: Concept & Category badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    {g.concepto}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700/50 mt-1">
                    <FolderOpen className="w-2.5 h-2.5 text-gray-400" />
                    {g.categoria}
                  </span>
                </div>
                <span className="font-extrabold text-red-500 font-mono text-sm whitespace-nowrap shrink-0">
                  -${g.monto.toLocaleString()}
                </span>
              </div>

              {/* Card Body: Observations if present */}
              {g.observaciones && (
                <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-100/30 dark:border-gray-800/20 whitespace-pre-wrap">
                  {g.observaciones}
                </p>
              )}

              {/* Card Footer: Date & actions */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-800/50 text-xs">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {toDate(g.fecha)?.toLocaleDateString() || "Hoy"}
                </span>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(g)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-lg transition-colors cursor-pointer"
                      title="Editar egreso"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id || "")}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar egreso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center sm:items-start sm:pt-[2vh] justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in sm:ml-[30vw]">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingGasto ? "Editar Registro de Gasto" : "Registrar Nuevo Egreso"}
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
              
              {/* Concepto */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Concepto del Egreso *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Compra de Rulemanes Drean x5"
                  {...register("concepto")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                {errors.concepto && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.concepto.message as string}</p>
                )}
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Categoría del Gasto *
                </label>
                <select
                  {...register("categoria")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                >
                  <option value="Repuestos">Repuestos y Refacciones</option>
                  <option value="Herramientas">Herramientas e Insumos</option>
                  <option value="Alquiler">Alquiler y Expensas</option>
                  <option value="Impuestos">Impuestos y Tasas</option>
                  <option value="Servicios">Servicios (Luz, Internet, Agua)</option>
                  <option value="Otros">Gastos Varios / Otros</option>
                </select>
                {errors.categoria && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.categoria.message as string}</p>
                )}
              </div>

              {/* Monto */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Monto Egresado ($) *
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  {...register("monto")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-750 rounded-xl text-sm focus:outline-none"
                />
                {errors.monto && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.monto.message as string}</p>
                )}
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Observaciones Adicionales
                </label>
                <textarea
                  rows={2}
                  placeholder="Información extra sobre el pago o proveedor..."
                  {...register("observaciones")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none text-xs"
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
                  {isSubmitting ? "Registrando..." : "Guardar Egreso"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {gastoToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ¿Eliminar registro de gasto?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará de forma permanente este registro de egreso de la base de datos de forma irreversible.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setGastoToDelete(null)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteGasto}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all"
              >
                Sí, Eliminar Gasto
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
