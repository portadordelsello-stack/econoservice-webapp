import React, { useState } from "react";
import Tracker from "./Tracker";
import Presupuestos from "./Presupuestos";
import { Truck, Calculator, ArrowLeft, ArrowRight, MapPin } from "lucide-react";

type SubViewType = "hub" | "tracker" | "presupuestos";

export default function Logistica({ initialSubView = "hub" }: { initialSubView?: SubViewType }) {
  const [subView, setSubView] = useState<SubViewType>(initialSubView);

  React.useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section (different for hub vs. subviews) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {subView !== "hub" && (
              <button
                onClick={() => setSubView("hub")}
                className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-slate-500 dark:text-gray-400 cursor-pointer mr-1"
                title="Volver"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
              <Truck className="w-8 h-8 text-indigo-500 shrink-0" />
              Logística
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {subView === "hub" && "Selecciona una herramienta para gestionar envíos, ruteo satelital o cotizaciones."}
            {subView === "tracker" && "Monitoreo en tiempo real de entregas y geolocalización satelital."}
            {subView === "presupuestos" && "Administración de estimaciones, presupuestos de repuestos y mano de obra."}
          </p>
        </div>
      </div>

      {subView === "hub" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {/* Card 1: Tracker */}
          <button
            onClick={() => setSubView("tracker")}
            className="group flex flex-col text-left p-6 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-full blur-2xl group-hover:bg-indigo-100/50 transition-colors"></div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white font-display">
                Tracker Logístico
              </h2>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-6 flex-1">
              Geolocalización satelital en tiempo real para clientes de Santo Tomé y Santa Fe. Administra emisor GPS y órdenes activas.
            </p>
            
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <span>Abrir Tracker</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 2: Presupuestos */}
          <button
            onClick={() => setSubView("presupuestos")}
            className="group flex flex-col text-left p-6 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/50 dark:bg-amber-950/10 rounded-full blur-2xl group-hover:bg-amber-100/50 transition-colors"></div>

            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                <Calculator className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white font-display">
                Presupuestos
              </h2>
            </div>

            <p className="text-sm text-slate-500 dark:text-gray-400 mb-6 flex-1">
              Gestión detallada de cotizaciones de repuestos, costos de mano de obra, observaciones e informes de aprobación de clientes.
            </p>

            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <span>Abrir Presupuestos</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      )}

      {subView === "tracker" && (
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <Tracker isEmbedded={true} />
        </div>
      )}

      {subView === "presupuestos" && (
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <Presupuestos isEmbedded={true} />
        </div>
      )}
    </div>
  );
}
