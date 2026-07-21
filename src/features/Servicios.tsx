import React from "react";

export default function Servicios() {
  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
          Taller
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          La sección de taller ha sido reiniciada y se encuentra lista para el desarrollo de nuevas funciones.
        </p>
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-slate-200 dark:border-gray-800 rounded-3xl p-8 text-center bg-white dark:bg-gray-900 shadow-3xs">
        <div className="p-4 bg-slate-50 dark:bg-gray-850 rounded-2xl mb-4">
          <div className="w-10 h-10 border-2 border-slate-400 dark:border-gray-500 rounded-lg" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Sección Vacía</h3>
        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-sm">
          Todo el contenido previo ha sido eliminado de forma exitosa. El taller está en blanco y listo para las nuevas características.
        </p>
      </div>
    </div>
  );
}
