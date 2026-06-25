import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../providers/AuthProvider";
import { UserProfile, Role } from "../types";
import { DriveService } from "../services/drive";
import { 
  Users, 
  ShieldCheck, 
  UserX, 
  UserCheck, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  User,
  Shield,
  Clock,
  FolderOpen,
  Save,
  HardDrive,
  Trash2,
  Settings,
  ArrowLeft,
  ChevronRight,
  Lock
} from "lucide-react";

export default function Usuarios() {
  const { profile } = useAuth();
  const [activeSubView, setActiveSubView] = useState<"menu" | "usuarios" | "drive">("menu");
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const isSuperadmin = profile?.rol === "superadmin";

  // Drive Config states
  const [folderId, setFolderId] = useState("");
  const [savingDriveConfig, setSavingDriveConfig] = useState(false);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);
  const [driveErrorMsg, setDriveErrorMsg] = useState<string | null>(null);

  const fetchDriveConfig = async () => {
    try {
      const id = await DriveService.getFolderId();
      setFolderId(id);
    } catch (err) {
      console.error("Error fetching drive config:", err);
    }
  };

  useEffect(() => {
    if (isSuperadmin) {
      fetchDriveConfig();
    }
  }, [isSuperadmin]);

  const handleSaveDriveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDriveConfig(true);
    setDriveSuccessMsg(null);
    setDriveErrorMsg(null);
    try {
      await DriveService.setFolderId(folderId.trim());
      setDriveSuccessMsg("ID de carpeta de Google Drive actualizado con éxito.");
    } catch (err: any) {
      console.error("Error saving drive config:", err);
      setDriveErrorMsg("No se pudo guardar la configuración de Google Drive.");
    } finally {
      setSavingDriveConfig(false);
    }
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as any);
      });
      setUsuarios(list);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setErrorMessage("No se pudieron cargar los usuarios del sistema.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleToggleActivo = async (user: UserProfile) => {
    if (user.email.toLowerCase() === "juanpacheco@playcode.com.ar") {
      setErrorMessage("No se puede desactivar al administrador global primario.");
      return;
    }
    if (user.uid === profile?.uid) {
      setErrorMessage("No puedes desactivar tu propio usuario activo.");
      return;
    }

    setUpdatingId(user.uid);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const userRef = doc(db, "users", user.uid);
      const nuevoEstado = !user.activo;
      await updateDoc(userRef, { activo: nuevoEstado });
      
      setUsuarios((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, activo: nuevoEstado } : u))
      );
      setSuccessMessage(`Usuario ${user.nombre} ${nuevoEstado ? "activado" : "desactivado"} con éxito.`);
    } catch (err: any) {
      console.error("Error updating user status:", err);
      setErrorMessage("Error al cambiar el estado del usuario.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.email.toLowerCase() === "juanpacheco@playcode.com.ar") {
      setErrorMessage("No se puede eliminar al administrador global primario.");
      return;
    }
    if (user.uid === profile?.uid) {
      setErrorMessage("No puedes eliminar tu propia cuenta.");
      return;
    }

    setUpdatingId(user.uid);
    setErrorMessage(null);
    setSuccessMessage(null);
    setUserToDelete(null);

    try {
      const userRef = doc(db, "users", user.uid);
      await deleteDoc(userRef);
      
      setUsuarios((prev) => prev.filter((u) => u.uid !== user.uid));
      setSuccessMessage(`Usuario ${user.nombre} eliminado con éxito.`);
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setErrorMessage("Error al eliminar el usuario del sistema.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleChangeRol = async (user: UserProfile, nuevoRol: Role) => {
    if (user.email.toLowerCase() === "juanpacheco@playcode.com.ar") {
      setErrorMessage("No se puede cambiar el rol del administrador global primario.");
      return;
    }

    setUpdatingId(user.uid);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { rol: nuevoRol });
      
      setUsuarios((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, rol: nuevoRol } : u))
      );
      setSuccessMessage(`Rol de ${user.nombre} actualizado a ${getRoleLabel(nuevoRol)}.`);
    } catch (err: any) {
      console.error("Error updating user role:", err);
      setErrorMessage("Error al cambiar el rol del usuario.");
    } finally {
      setUpdatingId(null);
    }
  };

  const getRoleLabel = (rol: Role) => {
    switch (rol) {
      case "superadmin":
        return "Superadmin";
      case "administracion":
        return "Administración";
      case "tecnico":
        return "Técnico";
      case "logistica":
        return "Logística";
      case "admin":
        return "Administrador (Legacy)";
      case "recepcion":
        return "Recepcionista (Legacy)";
      case "consulta":
        return "Consulta / Auditor (Legacy)";
      default:
        return rol || "Desconocido";
    }
  };

  // Stats calculation
  const totalUsers = usuarios.length;
  const activeUsers = usuarios.filter((u) => u.activo).length;
  const pendingUsers = usuarios.filter((u) => !u.activo).length;

  if (activeSubView === "menu") {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-7 h-7 text-indigo-600" />
            Ajustes del Sistema
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestión de configuraciones del sistema, administración de cuentas de usuario y servicios conectados.
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card: Usuarios del Sistema */}
          <div 
            onClick={() => setActiveSubView("usuarios")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Usuarios del Sistema
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Administra las cuentas de Google Auth, activa accesos, asigna los roles correspondientes (superadmin, logística, técnico, etc.) o elimina cuentas.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Gestionar usuarios</span>
              <span className="bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 rounded-md text-[10px] font-mono text-indigo-700 dark:text-indigo-300">
                {totalUsers} Cuentas
              </span>
            </div>
          </div>

          {/* Card: Configuración de Google Drive */}
          <div 
            onClick={() => setActiveSubView("drive")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Configuración de Google Drive
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Configura el ID de la carpeta de Google Drive donde se almacenarán automáticamente las fotos tomadas por el personal de logística al realizar las entregas.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Configurar almacenamiento</span>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                folderId ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
              }`}>
                {folderId ? "Configurado" : "Pendiente"}
              </span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (activeSubView === "drive") {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div>
          <button 
            onClick={() => setActiveSubView("menu")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer transition-colors mb-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3.5 py-2 rounded-xl shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Ajustes
          </button>
        </div>

        {isSuperadmin ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
              <HardDrive className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Configuración de Google Drive
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Especifique la carpeta de Google Drive donde se almacenarán las fotos tomadas por el personal de logística.
                </p>
              </div>
            </div>

            {driveSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{driveSuccessMsg}</span>
              </div>
            )}

            {driveErrorMsg && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{driveErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveDriveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  ID de la Carpeta de Google Drive
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej. 1A2b3C4d5E6f7G8h9I0j..."
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <button
                    type="submit"
                    disabled={savingDriveConfig}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {savingDriveConfig ? "Guardando..." : "Guardar ID"}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-900 rounded-xl text-xs text-slate-500 leading-relaxed space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">¿Cómo encontrar el ID de una carpeta de Google Drive?</span>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Abra la carpeta que desea usar en su Google Drive en el navegador web.</li>
                  <li>Mire la barra de direcciones URL del navegador.</li>
                  <li>La URL tendrá este formato: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-700 dark:text-gray-300 text-[11px]">https://drive.google.com/drive/folders/&lt;ID_DE_CARPETA&gt;</code></li>
                  <li>Copie todo el texto que viene después de <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-700 dark:text-gray-300 text-[11px]">/folders/</code> y péguelo en el campo de arriba.</li>
                </ol>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Acceso Restringido</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                La configuración de almacenamiento de Google Drive solo está disponible para usuarios con rol de <strong>Superadministrador</strong>.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Back button and Header */}
      <div>
        <button 
          onClick={() => setActiveSubView("menu")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer transition-colors mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3.5 py-2 rounded-xl shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Ajustes
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-indigo-600" />
              Usuarios del Sistema
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Administra las cuentas de Google Auth, activa accesos y asigna los roles correspondientes.
            </p>
          </div>
          <div>
            <button
              onClick={fetchUsuarios}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Card */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Total Usuarios</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">{totalUsers}</span>
          </div>
        </div>

        {/* Active Card */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Activos</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono text-emerald-500">{activeUsers}</span>
          </div>
        </div>

        {/* Pending Card */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Pendientes de Activación</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono text-amber-500">{pendingUsers}</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
          <Check className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Access Restriction Warning */}
      {!isSuperadmin && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/25 border border-indigo-150 dark:border-indigo-900/40 rounded-xl text-indigo-700 dark:text-indigo-400 text-sm flex items-center gap-2">
          <Shield className="w-5 h-5 shrink-0" />
          <span>Tiene acceso de solo lectura. Únicamente el Superadmin puede activar cuentas o cambiar roles del sistema.</span>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {loading && usuarios.length === 0 ? (
          <div className="flex items-center justify-center min-h-[250px]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No se encontraron usuarios registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800/80 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Usuario</th>
                  <th className="p-4">Contacto</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Rol en Sistema</th>
                  <th className="p-4 pr-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                {usuarios.map((user) => {
                  const isPrimaryAdmin = user.email.toLowerCase() === "juanpacheco@playcode.com.ar";
                  const isSelf = user.uid === profile?.uid;
                  
                  return (
                    <tr key={user.uid} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      {/* Name / Avatar */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold uppercase ${
                            user.activo 
                              ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" 
                              : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                          }`}>
                            {user.nombre?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="font-bold text-gray-850 dark:text-white block flex items-center gap-1.5">
                              {user.nombre}
                              {isPrimaryAdmin && (
                                <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-indigo-600 text-white rounded-md uppercase tracking-wider">
                                  Global Creator
                                </span>
                              )}
                              {isSelf && (
                                <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-emerald-500 text-white rounded-md uppercase tracking-wider">
                                  Tú
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">ID: {user.uid.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact / Email */}
                      <td className="p-4 text-gray-600 dark:text-gray-300">
                        <span className="font-medium font-mono text-xs block">{user.email}</span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          user.activo
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                            : "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-amber-100 dark:border-amber-900/30"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.activo ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {user.activo ? "Activo" : "Pendiente"}
                        </span>
                      </td>

                      {/* Role selection */}
                      <td className="p-4">
                        <select
                          value={user.rol}
                          disabled={!isSuperadmin || isPrimaryAdmin || updatingId === user.uid}
                          onChange={(e) => handleChangeRol(user, e.target.value as Role)}
                          className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer disabled:opacity-50"
                        >
                          <option value="superadmin">Superadmin</option>
                          <option value="administracion">Administración</option>
                          <option value="tecnico">Técnico</option>
                          <option value="logistica">Logística</option>
                          <option value="admin">Administrador (Legacy)</option>
                          <option value="recepcion">Recepcionista (Legacy)</option>
                          <option value="consulta">Consulta / Auditor (Legacy)</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => handleToggleActivo(user)}
                            disabled={!isSuperadmin || isPrimaryAdmin || isSelf || updatingId === user.uid}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-all disabled:opacity-40 ${
                              user.activo
                                ? "bg-amber-50 dark:bg-amber-950/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-950/30 hover:bg-amber-100"
                                : "bg-emerald-50 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-950/30 hover:bg-emerald-100"
                            }`}
                          >
                            {user.activo ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                Desactivar
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Activar Cuenta
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setUserToDelete(user)}
                            disabled={!isSuperadmin || isPrimaryAdmin || isSelf || updatingId === user.uid}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-red-100 dark:border-red-950/30 bg-red-50 dark:bg-red-950/10 text-red-600 dark:text-red-400 hover:bg-red-100 disabled:opacity-40 cursor-pointer transition-all"
                            title="Eliminar Cuenta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ¿Eliminar cuenta de usuario?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará el perfil de <strong className="text-gray-900 dark:text-white">{userToDelete.nombre}</strong> ({userToDelete.email}) de la base de datos de forma permanente. El usuario ya no tendrá acceso ni roles asignados en el sistema.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(userToDelete)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all"
              >
                Sí, Eliminar Cuenta
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
