import React, { createContext, useContext, useState, useEffect } from "react";

export type ViewType =
  | "clientes"
  | "equipos"
  | "insumos"
  | "servicios"
  | "crear-servicio"
  | "detalle-servicio"
  | "presupuestos"
  | "usuarios"
  | "tracker"
  | "logistica";

interface NavigationContextType {
  currentView: ViewType;
  selectedId: string | null;
  navigate: (view: ViewType, id?: string | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    // Attempt hash recovery for better UX during dev reloads
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const [view, id] = hash.split("/");
      if (isValidView(view)) {
        return view as ViewType;
      }
    }
    return "servicios";
  });

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const [_, id] = hash.split("/");
      return id || null;
    }
    return null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        const [view, id] = hash.split("/");
        if (isValidView(view)) {
          setCurrentView(view as ViewType);
          setSelectedId(id || null);
        }
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = (view: ViewType, id: string | null = null) => {
    setCurrentView(view);
    setSelectedId(id);
    if (id) {
      window.location.hash = `${view}/${id}`;
    } else {
      window.location.hash = view;
    }
  };

  function isValidView(view: string): boolean {
    const validViews: ViewType[] = [
      "clientes",
      "equipos",
      "insumos",
      "servicios",
      "crear-servicio",
      "detalle-servicio",
      "presupuestos",
      "usuarios",
      "tracker",
      "logistica"
    ];
    return validViews.includes(view as ViewType);
  }

  return (
    <NavigationContext.Provider value={{ currentView, selectedId, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}
