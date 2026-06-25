import React from "react";
import { ThemeProvider, useTheme } from "./providers/ThemeProvider";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { NavigationProvider, useNavigation } from "./providers/NavigationProvider";

// Import all Feature Screens
import Login from "./features/Login";
import Dashboard from "./features/Dashboard";
import Clientes from "./features/Clientes";
import Equipos from "./features/Equipos";
import Servicios from "./features/Servicios";
import CrearServicio from "./features/CrearServicio";
import DetalleServicio from "./features/DetalleServicio";
import Presupuestos from "./features/Presupuestos";
import Agenda from "./features/Agenda";
import Gastos from "./features/Gastos";
import Usuarios from "./features/Usuarios";
import Tracker from "./features/Tracker";
import TrackingCliente from "./features/TrackingCliente";

import { 
  Wrench, 
  User, 
  Laptop, 
  Users2, 
  TrendingDown, 
  Calendar, 
  Activity, 
  LogOut, 
  Moon, 
  Sun, 
  Menu, 
  X,
  FileSpreadsheet,
  ShieldCheck,
  FolderLock,
  Truck,
  Settings
} from "lucide-react";

function MainLayout() {
  const { user, profile, signOut: logout } = useAuth();
  const { currentView, navigate } = useNavigation();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Sidebar link details
  const navigationLinks = [
    { view: "dashboard", label: "Dashboard", icon: Activity, roles: ["superadmin", "administracion", "admin"] },
    { view: "servicios", label: "Taller", icon: Wrench, roles: ["superadmin", "administracion", "tecnico", "logistica", "admin", "recepcion", "consulta"] },
    { view: "clientes", label: "Clientes", icon: User, roles: ["superadmin", "administracion", "logistica", "admin", "recepcion", "consulta"] },
    { view: "equipos", label: "Equipos", icon: Laptop, roles: ["superadmin", "administracion", "logistica", "admin", "recepcion", "consulta"] },
    { view: "presupuestos", label: "Presupuestos", icon: FileSpreadsheet, roles: ["superadmin", "administracion", "admin", "recepcion", "consulta"] },
    { view: "agenda", label: "Agenda", icon: Calendar, roles: ["superadmin", "administracion", "logistica", "admin", "recepcion", "consulta"] },
    { view: "tracker", label: "Tracker", icon: Truck, roles: ["superadmin", "administracion", "logistica", "tecnico", "admin", "recepcion", "consulta"] },
    { view: "gastos", label: "Gastos", icon: TrendingDown, roles: ["superadmin", "administracion", "admin"] },
    { view: "usuarios", label: "Ajustes", icon: Settings, roles: ["superadmin", "administracion", "admin"] }
  ];

  // Automatic authorized view redirection
  React.useEffect(() => {
    if (!user) return;
    if (profile) {
      const allowedLinks = navigationLinks.filter(link => link.roles.includes(profile.rol));
      if (allowedLinks.length > 0) {
        const isAllowed = navigationLinks.find(link => link.view === currentView)?.roles.includes(profile.rol);
        const isSubViewAllowed = (currentView === "crear-servicio" || currentView === "detalle-servicio") && 
                                 navigationLinks.find(link => link.view === "servicios")?.roles.includes(profile.rol);
        if (!isAllowed && !isSubViewAllowed) {
          navigate(allowedLinks[0].view as any);
        }
      }
    }
  }, [profile, currentView, user]);

  // If public tracking route is requested via URL hash, completely bypass the login screen for clients!
  const isPublicTracking = window.location.hash.startsWith("#tracking/");
  if (isPublicTracking) {
    const parts = window.location.hash.split("/");
    const id = parts[1] || "";
    return <TrackingCliente servicioId={id} />;
  }

  // If not logged in, force Login screen
  if (!user) {
    return <Login />;
  }

  const handleNavLinkClick = (view: string) => {
    navigate(view as any);
    setMobileMenuOpen(false);
  };

  const getRoleLabel = (rol?: string) => {
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
        return "Secretaría / Recepción";
      default:
        return rol || "Usuario";
    }
  };

  const getRoleColor = (rol?: string) => {
    switch (rol) {
      case "superadmin":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "administracion":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "tecnico":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "logistica":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "admin":
        return "bg-slate-700/50 text-slate-300 border-slate-600/30";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-gray-150 flex flex-col md:flex-row font-sans">
      
      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between p-4 bg-[#0f172a] text-white border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6 text-indigo-400" />
          <span className="font-extrabold text-lg tracking-tight text-white">
            EconoService
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* SIDEBAR FOR DESKTOP & MOBILE WRAPPER */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#0f172a] text-slate-300 border-r border-slate-800 flex flex-col justify-between transition-transform duration-300 md:translate-x-0 md:static md:h-screen shrink-0
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Brand details */}
        <div className="p-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white block">
                EconoService
              </span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">
                Agente de Gestión
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="mt-8 space-y-1.5">
            {navigationLinks.map((link) => {
              // Check user role permission
              if (link.roles && !link.roles.includes(profile?.rol || "")) {
                return null;
              }
              const Icon = link.icon;
              const isActive = currentView === link.view || (link.view === "servicios" && (currentView === "crear-servicio" || currentView === "detalle-servicio"));
              return (
                <button
                  key={link.view}
                  onClick={() => handleNavLinkClick(link.view)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  {link.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User context footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0b0f19] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold shrink-0">
              {profile?.nombre?.[0]?.toUpperCase() || user.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-white truncate">
                {profile?.nombre || "Usuario"}
              </span>
              <span className="block text-[10px] text-slate-500 truncate">
                {user.email}
              </span>
              <span className={`inline-block mt-1 text-[9px] font-bold border px-1.5 py-0.2 rounded uppercase tracking-wider ${getRoleColor(profile?.rol)}`}>
                {getRoleLabel(profile?.rol)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={toggleTheme}
              className="hidden md:flex p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Alternar Tema"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={logout}
              className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-red-600 hover:text-white text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-transparent hover:border-transparent transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* OVERLAY FOR MOBILE SIDEPANEL */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* MAIN VIEWPORT */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
        {currentView === "dashboard" && <Dashboard />}
        {currentView === "servicios" && <Servicios />}
        {currentView === "crear-servicio" && <CrearServicio />}
        {currentView === "detalle-servicio" && <DetalleServicio />}
        {currentView === "clientes" && <Clientes />}
        {currentView === "equipos" && <Equipos />}
        {currentView === "presupuestos" && <Presupuestos />}
        {currentView === "agenda" && <Agenda />}
        {currentView === "gastos" && <Gastos />}
        {currentView === "usuarios" && <Usuarios />}
        {currentView === "tracker" && <Tracker />}
      </main>

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationProvider>
          <MainLayout />
        </NavigationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
