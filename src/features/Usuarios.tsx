import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../providers/AuthProvider";
import { UserProfile, Role } from "../types";
import { DriveService } from "../services/drive";
import { GeminiConfigService } from "../services/geminiConfig";
import { BrandingService, DEFAULT_BRANDING } from "../services/branding";
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
  Lock,
  Sparkles,
  Palette,
  UploadCloud
} from "lucide-react";

export default function Usuarios() {
  const { profile } = useAuth();
  const [activeSubView, setActiveSubView] = useState<"menu" | "usuarios" | "drive" | "gemini" | "apariencia">("menu");
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const isSuperadmin = profile?.rol === "superadmin";
  const canManageConfig = profile?.rol === "superadmin" || profile?.rol === "admin" || profile?.rol === "administracion";

  // Branding Config states
  const [brandLogo, setBrandLogo] = useState("");
  const [brandTitulo, setBrandTitulo] = useState("");
  const [brandSubtitulo, setBrandSubtitulo] = useState("");
  const [brandBadge, setBrandBadge] = useState("");
  const [savingApariencia, setSavingApariencia] = useState(false);
  const [aparienciaSuccessMsg, setAparienciaSuccessMsg] = useState<string | null>(null);
  const [aparienciaErrorMsg, setAparienciaErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fetchBrandingConfig = async () => {
    try {
      const config = await BrandingService.getConfig();
      setBrandLogo(config.logo || "");
      setBrandTitulo(config.titulo || "");
      setBrandSubtitulo(config.subtitulo || "");
      setBrandBadge(config.badge || "");
    } catch (err) {
      console.error("Error fetching branding config in settings:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 500 * 1024) {
      setAparienciaErrorMsg("El logotipo es demasiado grande. Por favor, suba una imagen de menos de 500 KB.");
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setBrandLogo(reader.result as string);
      setAparienciaErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        setAparienciaErrorMsg("El logotipo es demasiado grande. Por favor, suba una imagen de menos de 500 KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBrandLogo(reader.result as string);
        setAparienciaErrorMsg(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperadmin) {
      setAparienciaErrorMsg("No tienes permisos suficientes para modificar la apariencia.");
      return;
    }
    setSavingApariencia(true);
    setAparienciaSuccessMsg(null);
    setAparienciaErrorMsg(null);
    try {
      await BrandingService.setConfig({
        logo: brandLogo,
        titulo: brandTitulo,
        subtitulo: brandSubtitulo,
        badge: brandBadge,
      });
      setAparienciaSuccessMsg("La apariencia y marca del sistema se han actualizado con éxito.");
    } catch (err: any) {
      console.error("Error saving branding config:", err);
      setAparienciaErrorMsg("No se pudo guardar la configuración de apariencia.");
    } finally {
      setSavingApariencia(false);
    }
  };

  // Gemini Config states
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [savingGeminiConfig, setSavingGeminiConfig] = useState(false);
  const [geminiSuccessMsg, setGeminiSuccessMsg] = useState<string | null>(null);
  const [geminiErrorMsg, setGeminiErrorMsg] = useState<string | null>(null);

  // Drive Config states
  const [folderId, setFolderId] = useState("");
  const [savingDriveConfig, setSavingDriveConfig] = useState(false);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);
  const [driveErrorMsg, setDriveErrorMsg] = useState<string | null>(null);

  const fetchGeminiConfig = async () => {
    try {
      const config = await GeminiConfigService.getConfig();
      setGeminiApiKey(config.apiKey);
      setGeminiModel(config.model || "gemini-2.5-flash");
    } catch (err) {
      console.error("Error fetching Gemini config:", err);
    }
  };

  const fetchDriveConfig = async () => {
    try {
      const id = await DriveService.getFolderId();
      setFolderId(id);
    } catch (err) {
      console.error("Error fetching drive config:", err);
    }
  };

  useEffect(() => {
    fetchBrandingConfig();
    if (canManageConfig) {
      fetchDriveConfig();
      fetchGeminiConfig();
    }
  }, [canManageConfig]);

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

  const handleSaveGeminiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeminiConfig(true);
    setGeminiSuccessMsg(null);
    setGeminiErrorMsg(null);
    try {
      await GeminiConfigService.setConfig({
        apiKey: geminiApiKey,
        model: geminiModel,
      });
      setGeminiSuccessMsg("Configuración de Gemini actualizada con éxito.");
    } catch (err: any) {
      console.error("Error saving Gemini config:", err);
      setGeminiErrorMsg("No se pudo guardar la configuración de Gemini.");
    } finally {
      setSavingGeminiConfig(false);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
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

          {/* Card: Configuración de Gemini */}
          <div 
            onClick={() => setActiveSubView("gemini")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Configuración de Gemini
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Configura el modelo de Inteligencia Artificial para el asistente de repuestos y gestiona tu clave API personalizada.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Configurar IA</span>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-300`}>
                {geminiModel}
              </span>
            </div>
          </div>

          {/* Card: Apariencia y Marca */}
          <div 
            onClick={() => setActiveSubView("apariencia")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Palette className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Apariencia y Marca
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Personaliza dinámicamente el logotipo, título principal, subtítulo y badge en la pantalla de inicio de sesión del sistema.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Personalizar pantalla</span>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-300`}>
                Configurado
              </span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (activeSubView === "apariencia") {
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
              <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-gray-800">
                <Palette className="w-5 h-5 text-indigo-600" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Personalización de Apariencia y Marca
                  </h2>
                  <p className="text-xs text-gray-450 dark:text-gray-500">
                    Establezca la identidad visual de la pantalla de inicio de sesión de la plataforma.
                  </p>
                </div>
              </div>

              {aparienciaSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{aparienciaSuccessMsg}</span>
                </div>
              )}

              {aparienciaErrorMsg && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{aparienciaErrorMsg}</span>
                </div>
              )}

              {!isSuperadmin && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/40 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
                  <Lock className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Acceso de Solo Lectura</span>
                    <p className="mt-0.5">La modificación de marca y apariencia está restringida exclusivamente para usuarios con rol de <strong>Superadministrador</strong>.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveBranding} className="space-y-6">
                
                {/* Título Principal */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Título Principal
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isSuperadmin || savingApariencia}
                    placeholder="Escriba el nombre del sistema (ej. EconoService)"
                    value={brandTitulo}
                    onChange={(e) => setBrandTitulo(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
                  />
                </div>

                {/* Subtítulo */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Subtítulo descriptivo
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isSuperadmin || savingApariencia}
                    placeholder="Breve descripción bajo el título"
                    value={brandSubtitulo}
                    onChange={(e) => setBrandSubtitulo(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
                  />
                </div>

                {/* Badge text */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Texto de Distintivo / Badge
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperadmin || savingApariencia}
                    placeholder="Ej. Migrado de MS Access • Google Auth Activo"
                    value={brandBadge}
                    onChange={(e) => setBrandBadge(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
                  />
                </div>

                {/* Logotipo upload or URL */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      Logotipo de la Marca
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Subir Archivo Drag-and-Drop */}
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all min-h-[140px] relative ${
                          !isSuperadmin 
                            ? "bg-gray-50/50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-800 opacity-60" 
                            : dragActive 
                              ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20" 
                              : "border-gray-200 dark:border-gray-800 hover:border-indigo-400 bg-gray-50/50 dark:bg-gray-850/50"
                        }`}
                      >
                        <UploadCloud className="w-7 h-7 text-gray-400 mb-2" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Arrastre y suelte una imagen aquí
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                          PNG, JPG o SVG (Max 500 KB)
                        </span>
                        
                        {isSuperadmin && (
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        )}
                      </div>

                      {/* URL Externa */}
                      <div className="p-4 bg-gray-50/50 dark:bg-gray-850/50 border border-gray-200 dark:border-gray-800 rounded-xl flex flex-col justify-between min-h-[140px]">
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">
                            URL de Imagen Externa
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            Si prefiere hospedar su logotipo externamente, pegue el enlace directo.
                          </span>
                        </div>
                        <input
                          type="text"
                          disabled={!isSuperadmin || savingApariencia}
                          placeholder="https://ejemplo.com/logo.png"
                          value={brandLogo && brandLogo.startsWith("data:") ? "" : brandLogo}
                          onChange={(e) => setBrandLogo(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {brandLogo && (
                      <div className="mt-4 flex items-center justify-between p-3 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100/40 dark:border-indigo-950/40 rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1 bg-white dark:bg-gray-900 rounded-md border border-gray-100 dark:border-gray-800">
                            <img src={brandLogo} alt="Mini logo" className="w-8 h-8 object-contain" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">Logotipo Personalizado Cargado</span>
                            <span className="text-[10px] text-gray-400 font-mono block truncate max-w-[250px]">
                              {brandLogo.startsWith("data:") ? "Imagen en Base64" : brandLogo}
                            </span>
                          </div>
                        </div>
                        {isSuperadmin && (
                          <button
                            type="button"
                            onClick={() => setBrandLogo("")}
                            className="px-2.5 py-1.5 bg-red-50 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-transparent shrink-0"
                          >
                            Eliminar Logo
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                {isSuperadmin && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="submit"
                      disabled={savingApariencia}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      {savingApariencia ? "Guardando..." : "Guardar Apariencia y Marca"}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Real-time Preview Column */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 sticky top-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white pb-3 border-b border-gray-100 dark:border-gray-800 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                Vista Previa en Tiempo Real
              </h3>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-xl flex items-center justify-center min-h-[300px]">
                {/* Simulated Login Card */}
                <div className="w-full max-w-xs bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-md text-center">
                  
                  {/* Brand Header */}
                  <div className="mb-6">
                    {brandLogo ? (
                      <div className="inline-flex items-center justify-center mb-3">
                        <img 
                          src={brandLogo} 
                          alt="Logo Preview" 
                          className="max-h-16 max-w-[140px] object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white mb-3 shadow-sm">
                        <span className="text-xl font-bold font-mono">
                          {brandTitulo ? brandTitulo.substring(0, 2).toUpperCase() : "ES"}
                        </span>
                      </div>
                    )}
                    <h4 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white truncate">
                      {brandTitulo || "EconoService"}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                      {brandSubtitulo || "Gestión de Servicio Técnico"}
                    </p>
                    {brandBadge && (
                      <div className="inline-block bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium px-2 py-0.5 rounded-full mt-2">
                        {brandBadge}
                      </div>
                    )}
                  </div>

                  {/* Simulated login button */}
                  <div className="py-2.5 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.77-2.6-2.6-4.53-6.16-4.53z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    Iniciar Sesión con Google
                  </div>

                </div>
              </div>
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

        {canManageConfig ? (
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
                La configuración de almacenamiento de Google Drive solo está disponible para usuarios con rol de <strong>Administrador o Superadministrador</strong>.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSubView === "gemini") {
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

        {canManageConfig ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-gray-800">
              <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Configuración de Gemini (Inteligencia Artificial)
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Configure el modelo de procesamiento de lenguaje natural y administre la clave de API para el asistente de repuestos e insumos.
                </p>
              </div>
            </div>

            {geminiSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{geminiSuccessMsg}</span>
              </div>
            )}

            {geminiErrorMsg && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{geminiErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveGeminiConfig} className="space-y-6">
              
              {/* Dropdown for Model Select */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Modelo de Gemini (Capa Gratuita / Recomendados)
                </label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Más rápido, ultra liviano)</option>
                  <option value="gemini-3-flash">Gemini 3 Flash (Alta velocidad de respuesta)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Excelente relación velocidad/calidad)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Ideal para respuestas de desarrollo)</option>
                  <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (Bajo consumo de cuota)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Clásico estable)</option>
                  <option value="gemini-1.5-flash-lite">Gemini 1.5 Flash-Lite (Baja latencia)</option>
                </select>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Seleccione el modelo preferido. Gemini 2.5/3.1 Flash se recomiendan para una respuesta sumamente ágil sobre listas de stock grandes.
                </p>
              </div>

              {/* API Key Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Clave de API personalizada (API Key)
                </label>
                <input
                  type="password"
                  placeholder="Pegue aquí su API Key de Google AI Studio (ej. AIzaSy...)"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Deje vacío para utilizar la clave de API por defecto de la plataforma. Si introduce una clave personalizada, se guardará de forma segura en la base de datos y se utilizará para todas las consultas del asistente.
                </p>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingGeminiConfig}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {savingGeminiConfig ? "Guardando..." : "Guardar Configuración"}
                </button>
              </div>

              <div className="p-4 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/40 dark:border-indigo-950/40 rounded-xl text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed space-y-1.5">
                <span className="font-bold text-gray-800 dark:text-gray-200 block">¿Cómo obtener una API Key gratuita de Gemini?</span>
                <p>
                  Puede obtener una clave de API completamente gratuita ingresando con su cuenta de Google a <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="font-bold underline text-indigo-700 dark:text-indigo-300">Google AI Studio</a> y haciendo clic en <strong>"Get API Key"</strong>. La capa gratuita le permite realizar hasta 15 consultas por minuto de forma gratuita.
                </p>
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
                La configuración de Gemini solo está disponible para usuarios con rol de <strong>Administrador o Superadministrador</strong>.
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
