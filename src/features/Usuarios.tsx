import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../providers/AuthProvider";
import { UserProfile, Role } from "../types";
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
  Clock
} from "lucide-react";

export default function Usuarios() {
  const { profile } = useAuth();
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (user.email.toLowerCase() === "portadordelsello@gmail.com") {
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

  const handleChangeRol = async (user: UserProfile, nuevoRol: Role) => {
    if (user.email.toLowerCase() === "portadordelsello@gmail.com") {
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
      case "admin":
        return "Administrador";
      case "recepcion":
        return "Recepcionista";
      case "tecnico":
        return "Técnico";
      case "consulta":
        return "Consulta / Auditor";
      default:
        return "Desconocido";
    }
  };

  // Stats calculation
  const totalUsers = usuarios.length;
  const activeUsers = usuarios.filter((u) => u.activo).length;
  const pendingUsers = usuarios.filter((u) => !u.activo).length;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                  const isPrimaryAdmin = user.email.toLowerCase() === "portadordelsello@gmail.com";
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
                          disabled={isPrimaryAdmin || updatingId === user.uid}
                          onChange={(e) => handleChangeRol(user, e.target.value as Role)}
                          className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer disabled:opacity-50"
                        >
                          <option value="admin">Administrador</option>
                          <option value="recepcion">Recepcionista</option>
                          <option value="tecnico">Técnico de Taller</option>
                          <option value="consulta">Consulta / Auditor</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => handleToggleActivo(user)}
                          disabled={isPrimaryAdmin || isSelf || updatingId === user.uid}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-all disabled:opacity-40 ${
                            user.activo
                              ? "bg-red-50 dark:bg-red-950/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-950/30 hover:bg-red-100"
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
