import React, { useEffect, useState } from "react";
import { PresupuestosService, ServiciosService, toDate } from "../services/db";
import { Presupuesto, PresupuestoItem, Servicio } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { 
  Plus, 
  Trash, 
  Check, 
  FileSpreadsheet, 
  Calculator, 
  User, 
  X,
  FileText
} from "lucide-react";

export default function Presupuestos() {
  const { profile } = useAuth();
  const { navigate } = useNavigation();

  // Budgets lists
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);

  // Selector mappings
  const [servicesMap, setServicesMap] = useState<Record<string, Servicio>>({});

  // Form states for Create/Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Presupuesto | null>(null);
  
  const [selectedServicioId, setSelectedServicioId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [aprobado, setAprobado] = useState(false);

  // Line items states
  const [items, setItems] = useState<Omit<PresupuestoItem, "id">[]>([
    { descripcion: "Mano de obra", cantidad: 1, precio: 0, total: 0 }
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const servList = await ServiciosService.getAll();
      setServicios(servList);

      const sMap: Record<string, Servicio> = {};
      servList.forEach(s => {
        sMap[s.id || ""] = s;
      });
      setServicesMap(sMap);

      // We load all budgets
      // Since budgets is a standalone collection we read all or filter. Let's read all.
      const bList: Presupuesto[] = [];
      for (const s of servList) {
        if (s.id) {
          const buds = await PresupuestosService.getByServicio(s.id);
          bList.push(...buds);
        }
      }
      setPresupuestos(bList);
    } catch (err) {
      console.error("Error loading budgets data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItemLine = () => {
    setItems([...items, { descripcion: "", cantidad: 1, precio: 0, total: 0 }]);
  };

  const handleRemoveItemLine = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleUpdateItemLine = (index: number, key: keyof Omit<PresupuestoItem, "id">, value: any) => {
    const updated = items.map((item, idx) => {
      if (idx !== index) return item;
      const newItem = { ...item, [key]: value };
      
      // Auto-calculate line total
      if (key === "cantidad" || key === "precio") {
        newItem.total = Number(newItem.cantidad) * Number(newItem.precio);
      }
      return newItem;
    });
    setItems(updated);
  };

  // Sum line totals
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal; // Assuming no VAT adjustments for the Spark Plan, straightforward total

  const handleOpenCreate = () => {
    setEditingBudget(null);
    setSelectedServicioId("");
    setObservaciones("");
    setAprobado(false);
    setItems([{ descripcion: "Mano de obra diagnóstico", cantidad: 1, precio: 0, total: 0 }]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = async (budget: Presupuesto) => {
    setEditingBudget(budget);
    setSelectedServicioId(budget.servicioId);
    setObservaciones(budget.observaciones || "");
    setAprobado(budget.aprobado);

    try {
      if (budget.id) {
        const loadedItems = await PresupuestosService.getItems(budget.id);
        if (loadedItems.length > 0) {
          setItems(loadedItems.map(it => ({
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precio: it.precio,
            total: it.total
          })));
        } else {
          setItems([{ descripcion: "Mano de obra", cantidad: 1, precio: 0, total: 0 }]);
        }
      }
    } catch (err) {
      console.error("Error loading budget items:", err);
    }
    setIsFormOpen(true);
  };

  const handleSubmitBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServicioId) {
      alert("Seleccione un servicio de taller.");
      return;
    }

    try {
      const budgetData = {
        servicioId: selectedServicioId,
        aprobado,
        subtotal,
        total,
        observaciones
      };

      if (editingBudget && editingBudget.id) {
        await PresupuestosService.update(editingBudget.id, budgetData, items);
        
        // Also update main service amount
        await ServiciosService.update(
          selectedServicioId,
          { presupuesto: total, acepta: aprobado },
          profile?.uid || "user",
          profile?.nombre || "Usuario",
          `Presupuesto editado en la pestaña central de finanzas: $${total}`
        );

      } else {
        await PresupuestosService.create(budgetData, items);
        
        // Update main service budget amount
        await ServiciosService.update(
          selectedServicioId,
          { presupuesto: total },
          profile?.uid || "user",
          profile?.nombre || "Usuario",
          `Presupuesto inicial creado por un total de $${total}`
        );
      }

      setIsFormOpen(false);
      loadData();
      alert("¡Presupuesto guardado exitosamente!");
    } catch (err) {
      console.error("Error saving budget:", err);
    }
  };

  const canWrite = profile?.rol === "superadmin";

  if (loading && presupuestos.length === 0) {
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
            Estimaciones y Presupuestos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestión detallada de repuestos, mano de obra, e informes de aprobación.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Crear Presupuesto
          </button>
        )}
      </div>

      {/* Budgets List Grid */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase border-b border-gray-100 dark:border-gray-800">
                <th className="p-4 pl-6">N° Orden</th>
                <th className="p-4">Aparato</th>
                <th className="p-4">Monto Estimado</th>
                <th className="p-4">Fecha Cotización</th>
                <th className="p-4">Resolución Cliente</th>
                <th className="p-4">Comentarios</th>
                {canWrite && <th className="p-4 pr-6 text-right">Detalles</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-sm">
              {presupuestos.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 7 : 6} className="p-8 text-center text-gray-400">
                    No hay estimaciones presupuestadas aún en el sistema.
                  </td>
                </tr>
              ) : (
                presupuestos.map((p) => {
                  const serv = servicesMap[p.servicioId];
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-4 pl-6 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        #{serv ? serv.numeroServicio : "Cargando..."}
                      </td>
                      <td className="p-4 font-semibold text-gray-850 dark:text-white">
                        {serv ? serv.aparato : <span className="italic text-gray-300">Cargando...</span>}
                      </td>
                      <td className="p-4 font-extrabold text-gray-900 dark:text-white">
                        ${p.total.toLocaleString()}
                      </td>
                      <td className="p-4 text-xs text-gray-400">
                        {toDate(p.fechaCreacion)?.toLocaleDateString() || "Hoy"}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          p.aprobado 
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100" 
                            : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100"
                        }`}>
                          {p.aprobado ? "Aprobado" : "Pendiente"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-500 max-w-xs truncate">
                        {p.observaciones || <span className="italic text-gray-300">Ninguna</span>}
                      </td>
                      {canWrite && (
                        <td className="p-4 pr-6 text-right">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Editar Cotización
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center sm:items-start sm:pt-[2vh] justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in sm:ml-[30vw]">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Calculator className="w-5 h-5 text-indigo-600" />
                {editingBudget ? "Modificar Hoja de Presupuesto" : "Crear Nueva Hoja de Presupuesto"}
              </h2>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Budget compiler Form */}
            <form onSubmit={handleSubmitBudget} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Select Service */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Vincular a Orden de Servicio *
                  </label>
                  <select
                    disabled={!!editingBudget}
                    value={selectedServicioId}
                    onChange={(e) => setSelectedServicioId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                  >
                    <option value="">-- Seleccionar Orden --</option>
                    {servicios.map(s => (
                      <option key={s.id} value={s.id}>#{s.numeroSecuencia || s.numeroServicio} - {s.aparato} ({s.marcaModelo})</option>
                    ))}
                  </select>
                </div>

                {/* Direct approval toggle */}
                <div className="flex items-center sm:pt-5">
                  <label className="relative flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aprobado}
                      onChange={(e) => setAprobado(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">¿Aprobado por el cliente de palabra?</span>
                  </label>
                </div>

              </div>

              {/* Dynamic compiler of rows */}
              <div className="space-y-3 pt-3 border-t border-gray-50 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Conceptos e Ítems Detallados</span>
                  <button
                    type="button"
                    onClick={handleAddItemLine}
                    className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 px-2.5 py-1 rounded-lg text-gray-600 dark:text-gray-300 font-bold cursor-pointer"
                  >
                    + Agregar Ítem
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {items.map((line, idx) => (
                    <div key={idx} className="flex gap-2.5 items-center">
                      
                      {/* Description */}
                      <input
                        type="text"
                        placeholder="Descripción del repuesto o labor..."
                        required
                        value={line.descripcion}
                        onChange={(e) => handleUpdateItemLine(idx, "descripcion", e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-950 dark:text-white focus:outline-none"
                      />

                      {/* Quantity */}
                      <input
                        type="number"
                        placeholder="Cant"
                        min={1}
                        required
                        value={line.cantidad}
                        onChange={(e) => handleUpdateItemLine(idx, "cantidad", Number(e.target.value))}
                        className="w-14 px-2.5 py-1.5 text-xs text-center bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-950 dark:text-white focus:outline-none"
                      />

                      {/* Unit Price */}
                      <input
                        type="number"
                        placeholder="Precio $"
                        min={0}
                        required
                        value={line.precio}
                        onChange={(e) => handleUpdateItemLine(idx, "precio", Number(e.target.value))}
                        className="w-20 px-2.5 py-1.5 text-xs text-center bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-950 dark:text-white focus:outline-none"
                      />

                      {/* Item Line Sum */}
                      <span className="w-16 text-right text-xs font-bold text-gray-600 dark:text-gray-300">
                        ${line.total.toLocaleString()}
                      </span>

                      {/* Delete item line */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItemLine(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                      >
                        <Trash className="w-4 h-4" />
                      </button>

                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation */}
              <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-500 dark:text-gray-400">Total Neto Estimado:</span>
                <span className="text-xl font-extrabold text-indigo-600 font-mono">
                  ${total.toLocaleString()}
                </span>
              </div>

              {/* Observations */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Observaciones Internas o de Cobro
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre facilidades de pago o tiempo de validez de la oferta..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Compilar Presupuesto
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
