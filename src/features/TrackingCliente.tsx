import React, { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  Truck, 
  MapPin, 
  Clock, 
  Phone, 
  Wrench, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Navigation
} from "lucide-react";
import { BrandingService } from "../services/branding";

// Dynamic hook to load Leaflet CDN assets (React 19 safe and extremely robust)
function useLeaflet() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if ((window as any).L) {
      setLoaded(true);
      return;
    }

    // Load css
    const linkId = "leaflet-css";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load js
    const scriptId = "leaflet-js";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
    }

    const handleScriptLoad = () => setLoaded(true);
    script.addEventListener("load", handleScriptLoad);

    return () => {
      if (script) {
        script.removeEventListener("load", handleScriptLoad);
      }
    };
  }, []);

  return loaded;
}

// Nominatim Geocoder - converts physical address into {lat, lng} for Santo Tome & Santa Fe
async function geocodeAddress(calle: string, numero: string, localidad: string): Promise<{lat: number, lng: number} | null> {
  try {
    const cleanCalle = calle || "";
    const cleanNumero = numero || "";
    const cleanLocalidad = localidad || "Santo Tome";
    
    // Construct address string for higher resolution search in Santa Fe province
    const addressStr = `${cleanCalle} ${cleanNumero}, ${cleanLocalidad}, Santa Fe, Argentina`;
    const query = encodeURIComponent(addressStr);
    
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "EconoService-Client-Tracker"
      }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (e) {
    console.error("Geocoding failed for address:", e);
  }
  return null;
}

interface TrackingClienteProps {
  servicioId: string;
}

export default function TrackingCliente({ servicioId }: TrackingClienteProps) {
  const leafletLoaded = useLeaflet();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<any>(() => BrandingService.getLocalConfig());

  useEffect(() => {
    let active = true;
    BrandingService.updateDocumentTitle(branding.titulo + " - Seguimiento");
    BrandingService.getConfig()
      .then((config) => {
        if (active) {
          setBranding(config);
          BrandingService.updateDocumentTitle(config.titulo + " - Seguimiento");
        }
      })
      .catch((err) => {
        console.error("Error loading branding in tracking page:", err);
      });
    return () => {
      active = false;
    };
  }, []);
  
  // Service, Client, and Tracker positions
  const [servicio, setServicio] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [driverTracking, setDriverTracking] = useState<any>(null);
  
  // Geocoded home coordinates
  const [clientHomeCoords, setClientHomeCoords] = useState<{lat: number, lng: number} | null>(null);
  const [geocodingDone, setGeocodingDone] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);

  // Map references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const clientMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);

  // Load basic service details initially
  useEffect(() => {
    if (!servicioId) {
      setError("No se especificó un código de servicio válido.");
      setLoading(false);
      return;
    }

    const loadServiceData = async () => {
      try {
        const servRef = doc(db, "servicios", servicioId);
        const servSnap = await getDoc(servRef);
        
        if (!servSnap.exists()) {
          setError("El servicio solicitado no existe o el enlace es incorrecto.");
          setLoading(false);
          return;
        }

        const sData = { id: servSnap.id, ...servSnap.data() } as any;
        setServicio(sData);

        // Fetch client data to get physical address and phone number
        if (sData.clienteId) {
          const cliSnap = await getDoc(doc(db, "clientes", sData.clienteId));
          if (cliSnap.exists()) {
            const cData = { id: cliSnap.id, ...cliSnap.data() } as any;
            setCliente(cData);
            
            // Geocode the physical address immediately
            const { calle, numero, localidad } = cData;
            if (calle) {
              const coords = await geocodeAddress(calle, numero || "", localidad || "Santo Tome");
              if (coords) {
                setClientHomeCoords(coords);
              }
            }
          }
        }
        setGeocodingDone(true);
      } catch (e) {
        console.error("Error loading customer service tracking:", e);
        setError("Error de conexión al cargar los detalles del servicio.");
      } finally {
        setLoading(false);
      }
    };

    loadServiceData();
  }, [servicioId]);

  // Subscribe to real-time Driver GPS updates
  useEffect(() => {
    if (!servicioId) return;

    const trackRef = doc(db, "tracking_envios", servicioId);
    
    // Listen in real-time to GPS coordinates written by the logistics driver's phone
    const unsubscribe = onSnapshot(trackRef, (docSnap) => {
      if (docSnap.exists()) {
        setDriverTracking(docSnap.data());
      } else {
        setDriverTracking(null);
      }
    }, (err) => {
      console.error("Real-time GPS subscription error:", err);
    });

    return () => unsubscribe();
  }, [servicioId]);

  // Map Initialization
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Center standard on Santo Tome and Santa Fe region
    const defaultCenter = [-31.6420, -60.7200];

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true
      }).setView(defaultCenter, 13);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapInstance(map);
    }
  }, [leafletLoaded, loading]);

  // Update Markers on Map
  useEffect(() => {
    if (!leafletLoaded || !mapInstance) return;
    const L = (window as any).L;
    if (!L) return;

    const truckIcon = L.divIcon({
      className: "custom-truck-marker-client",
      html: `
        <div class="flex items-center justify-center w-10 h-10 bg-amber-500 text-white rounded-full border-2 border-white shadow-lg animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M19 18h2a1 1 0 0 0 1-1v-5.14a1 1 0 0 0-.29-.71l-2.61-2.61a1 1 0 0 0-.71-.29H14v10"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const homeIcon = L.divIcon({
      className: "custom-home-marker-client",
      html: `
        <div class="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-full border-2 border-white shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    // Clear previous markers
    if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }
    if (clientMarkerRef.current) {
      clientMarkerRef.current.remove();
      clientMarkerRef.current = null;
    }
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const bounds: any[] = [];

    // Plot Client Home Marker
    if (clientHomeCoords) {
      clientMarkerRef.current = L.marker([clientHomeCoords.lat, clientHomeCoords.lng], { icon: homeIcon })
        .addTo(mapInstance)
        .bindPopup(`<strong>Tu Domicilio</strong><br/>${cliente?.calle || ""} ${cliente?.numero || ""}, ${cliente?.localidad || ""}`);
      bounds.push([clientHomeCoords.lat, clientHomeCoords.lng]);
    }

    // Plot Mobile Driver Marker
    if (driverTracking?.activo && driverTracking?.lat && driverTracking?.lng) {
      driverMarkerRef.current = L.marker([driverTracking.lat, driverTracking.lng], { icon: truckIcon })
        .addTo(mapInstance)
        .bindPopup("<strong>Móvil de EconoService</strong><br/>En camino para entregar tu equipo.");
      bounds.push([driverTracking.lat, driverTracking.lng]);
    }

    // Fit map bounds neatly if markers are available
    if (bounds.length > 0) {
      mapInstance.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } else if (clientHomeCoords) {
      mapInstance.setView([clientHomeCoords.lat, clientHomeCoords.lng], 14);
    } else {
      mapInstance.setView([-31.6420, -60.7200], 13);
    }

  }, [clientHomeCoords, driverTracking, leafletLoaded, geocodingDone, mapInstance]);

  // Handle Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="p-8 bg-white dark:bg-gray-900 rounded-3xl shadow-xl flex flex-col items-center max-w-sm w-full border border-gray-100 dark:border-gray-800">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cargando datos de entrega...</p>
          <p className="text-xs text-gray-400 mt-1">Buscando servicio en Santo Tomé / Santa Fe</p>
        </div>
      </div>
    );
  }

  // Handle Error Screen
  if (error || !servicio) {
    return (
      <div className="min-h-screen w-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="p-8 bg-white dark:bg-gray-900 rounded-3xl shadow-xl flex flex-col items-center max-w-md w-full border border-gray-100 dark:border-gray-800 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Seguimiento no disponible</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {error || "No se pudo recuperar los datos de este servicio técnico."}
          </p>
          <p className="text-xs text-gray-400">
            Si creés que se trata de un error, por favor contactate con el taller de soporte técnico de EconoService.
          </p>
        </div>
      </div>
    );
  }

  // Translate State to readable terms
  const getReadableState = (status: string) => {
    switch (status) {
      case "RECIBIDO":
        return { label: "Ingresado al Taller", color: "text-blue-500", desc: "El equipo está registrado en nuestro sistema." };
      case "DIAGNOSTICO":
        return { label: "En Diagnóstico", color: "text-purple-500", desc: "El técnico está revisando el aparato para hallar el desperfecto." };
      case "PENDIENTE_APROBACION":
        return { label: "Presupuesto Listo", color: "text-indigo-600", desc: "Hallamos el problema. Esperamos tu aprobación del presupuesto para reparar." };
      case "EN_REPARACION":
        return { label: "En Reparación", color: "text-orange-500", desc: "Tu equipo se encuentra en proceso de arreglo." };
      case "LISTO_PARA_ENTREGA":
        return { label: "Listo para entrega", color: "text-indigo-500", desc: "La reparación finalizó con éxito. Aguardando envío/retiro." };
      case "ENTREGA_EN_PROGRESO":
        return { label: "¡En camino a tu casa!", color: "text-amber-500", desc: "El móvil de reparto ya cargó tu equipo y está conduciendo a tu domicilio." };
      case "ENTREGADO":
        return { label: "Entregado", color: "text-emerald-500", desc: "¡Entrega completada! Tu equipo ya está de vuelta con vos." };
      case "CANCELADO":
        return { label: "Cancelado", color: "text-rose-500", desc: "Servicio devuelto o cancelado." };
      default:
        return { label: status, color: "text-gray-500", desc: "Estado de servicio." };
    }
  };

  const statusInfo = getReadableState(servicio.estado);
  const isEnCamino = servicio.estado === "ENTREGA_EN_PROGRESO" && driverTracking?.activo;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 pb-12">
      
      {/* HEADER BAR */}
      <header className="sticky top-0 z-50 bg-[#0f172a] text-white py-4 px-6 shadow-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {branding.logo ? (
              <img 
                src={branding.logo} 
                alt="Logo" 
                className="h-8 max-w-[120px] object-contain rounded-md" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shrink-0">
                <Truck className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
            )}
            <span className="font-extrabold text-lg tracking-tight truncate">{branding.titulo}</span>
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/50 shrink-0">
            Seguimiento de Equipo
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT PANEL - SERVICE DETAILS */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Service Main Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Orden de Trabajo</span>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">#{servicio.numeroServicio}</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                servicio.estado === "ENTREGA_EN_PROGRESO" 
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
              }`}>
                {statusInfo.label}
              </span>
            </div>

            <div className="border-t border-gray-50 dark:border-gray-800/50 pt-4 space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Aparato / Modelo</span>
                <p className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">
                  {servicio.aparato} {servicio.marcaModelo}
                </p>
              </div>

              {servicio.diagnostico && (
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Trabajo Realizado</span>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed italic bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                    "{servicio.diagnostico}"
                  </p>
                </div>
              )}

              {cliente && (
                <div className="grid grid-cols-1 gap-3 pt-2 bg-gray-50/50 dark:bg-gray-850/50 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="text-gray-400 font-medium block">Domicilio de Entrega</span>
                      <span className="font-semibold text-gray-800 dark:text-white">
                        {cliente.calle} {cliente.numero || ""}, {cliente.localidad || "Santo Tome"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Logistics Tracking Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Navigation className="w-4 h-4 text-indigo-500 animate-pulse" />
              Información de Envío
            </h3>

            {isEnCamino ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block animate-ping"></span>
                    Móvil en Ruta de Reparto
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    Tu equipo ya está en la camioneta de reparto. El chofer <strong className="text-gray-900 dark:text-white">{driverTracking.operadorNombre || "de logística"}</strong> se dirige a tu domicilio. Podés seguir su ubicación exacta en el mapa de la derecha.
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs py-1 border-b border-gray-50 dark:border-gray-800 pb-2">
                  <span className="text-gray-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Última señal GPS</span>
                  <span className="font-bold text-gray-800 dark:text-white">
                    {driverTracking.actualizadoEn ? new Date(driverTracking.actualizadoEn).toLocaleTimeString() : "Ahora"}
                  </span>
                </div>
              </div>
            ) : servicio.estado === "ENTREGADO" ? (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-xs flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-600 dark:text-emerald-400">¡Entrega Completada!</h4>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    El equipo fue entregado en mano en el domicilio acordado. ¡Muchas gracias por confiar en EconoService!
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-bold">
                  <Clock className="w-4 h-4" />
                  Próximamente en camino
                </div>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  El equipo ya está reparado. En cuanto el móvil de logística comience el recorrido hacia tu domicilio, el GPS se activará automáticamente y se mostrará en este mapa.
                </p>
              </div>
            )}

            {/* Quick Contact Box */}
            <div className="pt-2">
              <a
                href="tel:03424751525" // Standard mock phone or actual econoservice phone
                className="w-full py-2.5 px-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border border-transparent hover:border-transparent"
              >
                <Phone className="w-4 h-4" />
                Contactar a EconoService
              </a>
            </div>
          </div>

        </div>

        {/* RIGHT PANEL - LIVE MAP */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm rounded-3xl p-4 flex flex-col h-[350px] md:h-[500px] lg:h-[600px] relative">
          <div className="flex items-center justify-between mb-3 border-b border-gray-50 dark:border-gray-800 pb-2.5">
            <span className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-indigo-500" />
              Recorrido en Tiempo Real
            </span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-600 rounded-full inline-block animate-pulse"></span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Tu Casa</span>
              <span className="w-2 h-2 bg-amber-500 rounded-full inline-block animate-ping"></span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Chofer</span>
            </div>
          </div>

          <div className="flex-1 rounded-2xl overflow-hidden relative border border-gray-100 dark:border-gray-850">
            {/* Loading / Waiting for leaflet */}
            {!leafletLoaded && (
              <div className="absolute inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Cargando mapa interactivo...</p>
              </div>
            )}

            {/* Actual map hook container */}
            <div 
              ref={mapContainerRef} 
              id="leaflet-map-client" 
              className="w-full h-full bg-slate-50 dark:bg-slate-950" 
              style={{ minHeight: "100%" }}
            />
          </div>

          {/* Quick status bar inside map footer */}
          <div className="mt-3.5 flex items-center gap-1.5 bg-gray-50 dark:bg-gray-850 p-3 rounded-xl text-[11px] text-gray-500 dark:text-gray-400">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isEnCamino 
                ? "El mapa se actualiza solo en tiempo real. No es necesario recargar la página." 
                : "El GPS se activará en cuanto el vehículo de reparto salga hacia tu casa."}
            </span>
          </div>
        </div>

      </main>
    </div>
  );
}
