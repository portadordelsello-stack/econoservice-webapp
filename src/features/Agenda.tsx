import React, { useEffect, useState } from "react";
import { ServiciosService, ClientesService } from "../services/db";
import { Servicio, Cliente } from "../types";
import { useNavigation } from "../providers/NavigationProvider";
import { useAuth } from "../providers/AuthProvider";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  MapPin, 
  Wrench,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

export default function Agenda() {
  const { navigate } = useNavigation();
  const { user, profile } = useAuth();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Calendar dates states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState<Servicio[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedServiceToAdd, setSelectedServiceToAdd] = useState<string>("");
  const [horaDesde, setHoraDesde] = useState("");
  const [horaHasta, setHoraHasta] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [servList, cliList] = await Promise.all([
          ServiciosService.getAll(),
          ClientesService.getAll()
        ]);
        setServicios(servList);

        const cliMap: Record<string, string> = {};
        cliList.forEach(c => {
          cliMap[c.id || ""] = c.nombreApellido;
        });
        setClientes(cliMap);

        // Default: selected events are today's events
        const todayStr = new Date().toISOString().split("T")[0];
        setSelectedDateStr(todayStr);
        setSelectedDayEvents(filterEventsForDate(servList, todayStr));

      } catch (err) {
        console.error("Error loading agenda data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filterEventsForDate = (eventsList: Servicio[], dateStr: string): Servicio[] => {
    return eventsList.filter(s => {
      if (!s.citaEntrega && !s.citaDia) return false;
      const deliveryDate = s.citaEntrega ? s.citaEntrega.toDate ? s.citaEntrega.toDate() : new Date(s.citaEntrega) : null;
      const diagDate = s.citaDia ? s.citaDia.toDate ? s.citaDia.toDate() : new Date(s.citaDia) : null;

      const delStr = deliveryDate ? deliveryDate.toISOString().split("T")[0] : "";
      const diaStr = diagDate ? diagDate.toISOString().split("T")[0] : "";

      return delStr === dateStr || diaStr === dateStr;
    });
  };

  const handleDayClick = (dayNum: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const formattedDay = String(dayNum).padStart(2, "0");
    const clickedDateStr = `${year}-${month}-${formattedDay}`;

    setSelectedDateStr(clickedDateStr);
    setSelectedDayEvents(filterEventsForDate(servicios, clickedDateStr));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Monthly logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create calendar cells array
  const cells: (number | null)[] = [];
  // Adjust so Monday is first day of the week, or keep Sunday default
  // Let's keep Standard layout where Sunday is first
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push(i);
  }

  const getEventsCountForDay = (dayNum: number) => {
    const yStr = year;
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(dayNum).padStart(2, "0");
    const queryStr = `${yStr}-${mStr}-${dStr}`;
    return filterEventsForDate(servicios, queryStr).length;
  };

  const handleAddDelivery = async () => {
    if (!selectedServiceToAdd || !user || !profile) return;
    try {
      setSubmitting(true);
      const targetDate = new Date(`${selectedDateStr}T12:00:00`);
      
      await ServiciosService.update(
        selectedServiceToAdd, 
        {
          citaEntrega: targetDate,
          horaEntregaDesde: horaDesde,
          horaEntregaHasta: horaHasta
        },
        user.uid,
        profile.nombre || "Usuario",
        "Se agendó la fecha y hora de entrega"
      );
      
      // Refresh
      const [servList, cliList] = await Promise.all([
        ServiciosService.getAll(),
        ClientesService.getAll()
      ]);
      setServicios(servList);
      setSelectedDayEvents(filterEventsForDate(servList, selectedDateStr));
      
      setShowAddModal(false);
      setSelectedServiceToAdd("");
      setHoraDesde("");
      setHoraHasta("");
    } catch (err) {
      console.error("Error agendando entrega:", err);
      alert("Error al agendar la entrega");
    } finally {
      setSubmitting(false);
    }
  };

  const readyToDeliverServices = servicios.filter(s => s.estado === "LISTO_PARA_ENTREGA" && !s.citaEntrega);

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
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Agenda de Entregas y Retiros
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Calendario interactivo coordinado según citas programadas en taller.
        </p>
      </div>

      {/* Grid: Left is Monthly Grid, Right is Scheduled Day Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Grid */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
          
          {/* Month Navigator Header */}
          <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 pb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              {monthNames[month]} {year}
            </h2>
            <div className="flex items-center gap-1">
              <button 
                onClick={prevMonth}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={nextMonth}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Weekday Titles */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Dom</span>
            <span>Lun</span>
            <span>Mar</span>
            <span>Mié</span>
            <span>Jue</span>
            <span>Vie</span>
            <span>Sáb</span>
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((cell, idx) => {
              if (cell === null) {
                return <div key={idx} className="aspect-square bg-gray-50/20 dark:bg-gray-850/10 rounded-lg sm:rounded-xl" />;
              }

              const count = getEventsCountForDay(cell);
              const formattedCellDay = String(cell).padStart(2, "0");
              const formattedCellMonth = String(month + 1).padStart(2, "0");
              const isSelected = selectedDateStr === `${year}-${formattedCellMonth}-${formattedCellDay}`;

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(cell)}
                  className={`aspect-square p-1 sm:p-2 rounded-lg sm:rounded-xl flex flex-col justify-between items-center transition-all cursor-pointer relative border ${
                    isSelected 
                      ? "bg-indigo-600 border-indigo-600 text-white font-extrabold shadow-md"
                      : "bg-gray-50/50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-[10px] sm:text-xs font-semibold">{cell}</span>
                  {count > 0 && (
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${isSelected ? "bg-white" : "bg-indigo-600"}`} />
                  )}
                </button>
              );
            })}
          </div>

        </div>

        {/* Day details */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 pb-3">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                Citas del Día
              </h3>
              <span className="text-xs text-gray-400 font-medium">
                {selectedDateStr && new Date(selectedDateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            {selectedDateStr && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-colors"
              >
                + Entrega
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
            {selectedDayEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 italic">
                No hay retiros o entregas agendadas para esta fecha.
              </div>
            ) : (
              selectedDayEvents.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate("detalle-servicio", s.id)}
                  className="p-3.5 bg-gray-50 dark:bg-gray-850/50 hover:bg-gray-100 border border-gray-100 dark:border-gray-800 rounded-xl space-y-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">#{s.numeroServicio}</span>
                    <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/10">
                      {s.citaEntrega ? "Entrega" : "Diagnóstico / Retiro"}
                    </span>
                  </div>

                  <span className="block font-bold text-sm text-gray-900 dark:text-white truncate">
                    {clientes[s.clienteId] || "Cargando..."}
                  </span>

                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5 text-gray-400" />
                    <span>{s.aparato} ({s.marcaModelo})</span>
                  </p>

                  <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Rango: {s.horaEntregaDesde || "S/H"} a {s.horaEntregaHasta || "S/H"} hs.
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Add Delivery Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl border border-gray-100 dark:border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Agendar Entrega
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[60vh]">
              {readyToDeliverServices.length === 0 ? (
                <div className="text-center p-6 text-gray-500 text-sm italic">
                  No hay equipos listos para entregar en el taller.
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">
                      Seleccionar Equipo
                    </label>
                    <select
                      value={selectedServiceToAdd}
                      onChange={(e) => setSelectedServiceToAdd(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="">-- Elija un servicio listo --</option>
                      {readyToDeliverServices.map(s => (
                        <option key={s.id} value={s.id}>
                          #{s.numeroServicio} - {clientes[s.clienteId] || "Cliente"} ({s.aparato})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedServiceToAdd && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase">
                          Hora Desde
                        </label>
                        <input
                          type="time"
                          value={horaDesde}
                          onChange={(e) => setHoraDesde(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase">
                          Hora Hasta
                        </label>
                        <input
                          type="time"
                          value={horaHasta}
                          onChange={(e) => setHoraHasta(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddDelivery}
                disabled={!selectedServiceToAdd || submitting}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors"
              >
                {submitting ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
