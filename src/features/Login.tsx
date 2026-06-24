import React, { useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { ShieldAlert, CheckCircle } from "lucide-react";

export default function Login() {
  const { signInWithGoogle, authError, setAuthError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setSuccess(null);
    setAuthError(null);
    try {
      await signInWithGoogle();
      setSuccess("¡Sesión iniciada con éxito! Redirigiendo...");
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 transition-colors duration-200 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl p-8">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white mb-3 shadow-md">
            <span className="text-2xl font-bold font-mono">ES</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            EconoService
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestión de Servicio Técnico de Electrodomésticos
          </p>
          <div className="inline-block bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium px-2.5 py-1 rounded-full mt-2">
            Migrado de MS Access • Google Auth Activo
          </div>
        </div>

        {/* Error/Success Banner */}
        {authError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Acceso Restringido</span>
              <p className="text-xs leading-relaxed">{authError}</p>
            </div>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750 dark:text-gray-150 border border-gray-200 dark:border-gray-700 font-semibold rounded-xl text-sm transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.77-2.6-2.6-4.53-6.16-4.53z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            {loading ? "Iniciando sesión..." : "Iniciar Sesión con Google"}
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Las cuentas no autorizadas deberán ser aprobadas por el administrador global antes de ingresar al sistema.
          </p>
        </div>

      </div>
    </div>
  );
}
