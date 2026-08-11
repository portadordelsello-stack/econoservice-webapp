import React, { useEffect, useState, useRef } from "react";
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  getDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  ServiciosService, 
  ClientesService, 
  EquiposService 
} from "../services/db";
import { GeminiConfigService } from "../services/geminiConfig";
import { Servicio, Cliente, EstadoServicio, getEstadoLabel } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { 
  Truck, 
  MapPin, 
  Compass, 
  Play, 
  Square, 
  Copy, 
  Check, 
  MessageSquare, 
  ExternalLink, 
  RefreshCw, 
  User, 
  AlertCircle,
  Clock,
  Navigation,
  Sparkles,
  ListOrdered,
  Calendar,
  Maximize,
  Minimize,
  CalendarClock,
  X as XIcon
} from "lucide-react";

// Hook to dynamically load Leaflet CDN assets (React 19 safe and extremely robust)
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
        "User-Agent": "EconoService-Tracker-App"
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

const CARD_BORDER_COLORS = [
  "border-l-4 border-l-indigo-500 dark:border-l-indigo-400",
  "border-l-4 border-l-emerald-500 dark:border-l-emerald-400",
  "border-l-4 border-l-amber-500 dark:border-l-amber-400",
  "border-l-4 border-l-rose-500 dark:border-l-rose-400",
  "border-l-4 border-l-violet-500 dark:border-l-violet-400",
  "border-l-4 border-l-cyan-500 dark:border-l-cyan-400",
  "border-l-4 border-l-teal-500 dark:border-l-teal-400",
  "border-l-4 border-l-pink-500 dark:border-l-pink-400"
];

export default function Tracker({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { profile } = useAuth();
  const leafletLoaded = useLeaflet();
  
  const [activeServices, setActiveServices] = useState<Servicio[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, Cliente>>({});
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Servicio | null>(null);
  const [clientData, setClientData] = useState<Cliente | null>(null);
  
  // Geolocation state
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [trackingEnvios, setTrackingEnvios] = useState<Record<string, any>>({});
  
  // Route optimization states
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeRecommendation, setRouteRecommendation] = useState<{
    explicacion: string;
    recomendaciones: Array<{
      numeroServicio: number | string;
      direccion: string;
      cliente: string;
      orden: number;
      comentario: string;
    }>;
  } | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Delivery scheduling modal state
  const [scheduleModalService, setScheduleModalService] = useState<Servicio | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleHoraDesde, setScheduleHoraDesde] = useState("");
  const [scheduleHoraHasta, setScheduleHoraHasta] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Payment modal state
  const [paymentModalService, setPaymentModalService] = useState<Servicio | null>(null);
  const [payEfectivo, setPayEfectivo] = useState(false);
  const [payTransferencia, setPayTransferencia] = useState(false);
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoTransferencia, setMontoTransferencia] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  useEffect(() => {
    if (paymentModalService) {
      setPayEfectivo(false);
      setPayTransferencia(false);
      setMontoEfectivo("");
      setMontoTransferencia("");
    }
  }, [paymentModalService]);

  const openScheduleModal = (serv: Servicio, e: React.MouseEvent) => {
    e.stopPropagation();
    // Pre-fill with existing values if any
    if (serv.citaEntrega) {
      try {
        const dt = serv.citaEntrega instanceof Date ? serv.citaEntrega : (serv.citaEntrega as any).toDate();
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        setScheduleDate(`${yyyy}-${mm}-${dd}`);
      } catch { setScheduleDate(""); }
    } else {
      setScheduleDate("");
    }
    setScheduleHoraDesde(serv.horaEntregaDesde || "");
    setScheduleHoraHasta(serv.horaEntregaHasta || "");
    setScheduleModalService(serv);
  };

  const saveSchedule = async () => {
    if (!scheduleModalService?.id) return;
    setScheduleSaving(true);
    try {
      const updateData: Record<string, any> = {
        horaEntregaDesde: scheduleHoraDesde,
        horaEntregaHasta: scheduleHoraHasta
      };
      let resolvedDate: Date | null = null;
      if (scheduleDate) {
        const [year, month, day] = scheduleDate.split("-").map(Number);
        resolvedDate = new Date(year, month - 1, day, 12, 0, 0);
        updateData.citaEntrega = resolvedDate;
      }
      await ServiciosService.update(
        scheduleModalService.id,
        updateData,
        profile?.uid || "logistica",
        profile?.nombre || "Logística",
        `Fecha de entrega acordada: ${scheduleDate} de ${scheduleHoraDesde} hasta ${scheduleHoraHasta}`
      );
      // Refresh card data
      setActiveServices(prev => prev.map(s =>
        s.id === scheduleModalService.id
          ? { ...s, citaEntrega: resolvedDate ? resolvedDate as any : s.citaEntrega, horaEntregaDesde: scheduleHoraDesde, horaEntregaHasta: scheduleHoraHasta }
          : s
      ));
      setScheduleModalService(null);
    } catch (err) {
      alert("Error al guardar la fecha de entrega.");
    } finally {
      setScheduleSaving(false);
    }
  };

  const isSuperadmin = profile?.rol === "superadmin";

  const mapSectionRef = useRef<HTMLDivElement>(null);

  // Toggle true Fullscreen with prefix support for Safari / iOS
  const toggleFullscreen = async () => {
    const element = mapSectionRef.current;
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (element) {
        try {
          if (element.requestFullscreen) {
            await element.requestFullscreen();
          } else if ((element as any).webkitRequestFullscreen) {
            await (element as any).webkitRequestFullscreen();
          } else if ((element as any).webkitEnterFullscreen) {
            await (element as any).webkitEnterFullscreen();
          } else if ((element as any).mozRequestFullScreen) {
            await (element as any).mozRequestFullScreen();
          } else if ((element as any).msRequestFullscreen) {
            await (element as any).msRequestFullscreen();
          }
        } catch (err) {
          console.warn("Native fullscreen requested but blocked or unsupported. Falling back to CSS fullscreen overlay.", err);
        }
      }
    } else {
      setIsFullscreen(false);
      try {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      } catch (err) {
        console.warn("Error exiting native fullscreen", err);
      }
    }
  };

  // Sync state with native fullscreenchange events (e.g. if exited using escape, swipe, or native buttons)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isCurrentlyNative = !!(
        doc.fullscreenElement || 
        doc.webkitFullscreenElement || 
        doc.mozFullScreenElement || 
        doc.msFullscreenElement
      );
      if (isCurrentlyNative !== isFullscreen) {
        setIsFullscreen(isCurrentlyNative);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, [isFullscreen]);

  // Escape key fallback to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        const doc = document as any;
        if (doc.fullscreenElement || doc.webkitFullscreenElement) {
          if (doc.exitFullscreen) doc.exitFullscreen();
          else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        } else {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 150);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "tracking_envios"), (snapshot) => {
      const tracks: Record<string, any> = {};
      snapshot.forEach((doc) => {
        tracks[doc.id] = { id: doc.id, ...doc.data() };
      });
      setTrackingEnvios(tracks);
    });
    return () => unsubscribe();
  }, []);
  
  // Maps variables
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const clientMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  // Derived GPS coordinates to display on the map
  const activeTrack = selectedService ? trackingEnvios[selectedService.id] : null;
  const isCurrentlyTrackedInFirestore = activeTrack?.activo === true;
  const effectiveGpsCoords = isTrackingActive && gpsCoords 
    ? gpsCoords 
    : (isCurrentlyTrackedInFirestore ? { lat: activeTrack.lat, lng: activeTrack.lng } : null);
  
  // Load services with status LISTO_PARA_ENTREGA or ENTREGA_EN_PROGRESO
  const loadServices = async () => {
    setLoading(true);
    try {
      const [all, allClients] = await Promise.all([
        ServiciosService.getAll(),
        ClientesService.getAll()
      ]);
      const list = all.filter(s => {
        const isTargetState = s.estado === "LISTO_PARA_ENTREGA" || s.estado === "ENTREGA_EN_PROGRESO" || s.estado === "RECHAZADO";
        if (!isTargetState) return false;

        if (s.citaEntrega) {
          try {
            const dt = s.citaEntrega instanceof Date ? s.citaEntrega : (typeof s.citaEntrega.toDate === "function" ? s.citaEntrega.toDate() : new Date(s.citaEntrega));
            const today = new Date();
            const isSameDay = dt.getDate() === today.getDate() &&
                              dt.getMonth() === today.getMonth() &&
                              dt.getFullYear() === today.getFullYear();
            return isSameDay;
          } catch {
            return true;
          }
        }
        return true; // Keep unscheduled ones since they are not scheduled for "another" day
      });
      setActiveServices(list);
      
      const cMap: Record<string, Cliente> = {};
      allClients.forEach(c => {
        if (c.id) {
          cMap[c.id] = c;
        }
      });
      setClientsMap(cMap);
      
      // Keep selected service reference fresh if it's in the list
      if (selectedService) {
        const updated = list.find(s => s.id === selectedService.id);
        if (updated) {
          setSelectedService(updated);
        } else {
          setSelectedService(null);
          setClientData(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeRoute = async () => {
    setIsOptimizing(true);
    setOptimizationError(null);
    setRouteRecommendation(null);
    
    try {
      const config = await GeminiConfigService.getConfig();
      if (!config.apiKey || !config.apiKey.trim()) {
        throw new Error("No hay ninguna API Key de Gemini configurada. Solicite al Administrador que la configure en la sección de Usuarios.");
      }

      const formattedOrders = activeServices.map(s => {
        const client = clientsMap[s.clienteId];
        const addressStr = client && client.calle 
          ? `${client.calle} ${client.numero || ""}, ${client.localidad || "Santo Tomé"}`
          : "Falta ingresar dirección de entrega";
        return {
          numeroServicio: s.numeroServicio,
          direccion: addressStr,
          clienteNombre: client?.nombreApellido || "Cliente s/d",
          aparato: s.aparato,
          marcaModelo: s.marcaModelo
        };
      });

      const response = await fetch("/api/tracker/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          orders: formattedOrders,
          apiKey: config.apiKey
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "No se pudo calcular la ruta recomendada.");
      }

      const data = await response.json();
      setRouteRecommendation(data);
    } catch (err: any) {
      console.error("Error optimizando ruta:", err);
      setOptimizationError(err.message || "Ocurrió un error al contactar al asistente.");
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  // Fetch client details whenever selected service changes
  useEffect(() => {
    if (selectedService) {
      ClientesService.getById(selectedService.clienteId).then(setClientData).catch(console.error);
    } else {
      setClientData(null);
    }
  }, [selectedService]);

  // Handle Geocoding and map rendering
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Standard center is positioned between Santo Tome and Santa Fe
    const defaultCenter = [-31.6420, -60.7200]; 
    
    // Initialize Leaflet map if not already done
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true
      }).setView(defaultCenter, 13);

      // Add clean, modern Map Tiles (CartoDB Positron is extremely elegant for dark & light)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      // We do not destroy the map instance on every render, just modify markers
    };
  }, [leafletLoaded]);

  // Update map markers when driver or client coordinates/data changes
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Define icons
    const truckIcon = L.divIcon({
      className: "custom-truck-marker",
      html: `
        <div class="flex items-center justify-center w-10 h-10 bg-amber-500 text-white rounded-full border-2 border-white shadow-lg animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M19 18h2a1 1 0 0 0 1-1v-5.14a1 1 0 0 0-.29-.71l-2.61-2.61a1 1 0 0 0-.71-.29H14v10"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const homeIcon = L.divIcon({
      className: "custom-home-marker",
      html: `
        <div class="flex items-center justify-center w-10 h-10 bg-emerald-600 text-white rounded-full border-2 border-white shadow-lg">
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

    // Plot driver
    if (effectiveGpsCoords) {
      const driverName = activeTrack?.operadorNombre || (isTrackingActive ? (profile?.nombre || "Vos") : "Encargado de Logística");
      driverMarkerRef.current = L.marker([effectiveGpsCoords.lat, effectiveGpsCoords.lng], { icon: truckIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`<strong>Móvil de Reparto (${driverName})</strong><br/>Transmitiendo señal en tiempo real.`);
      bounds.push([effectiveGpsCoords.lat, effectiveGpsCoords.lng]);
    }

    // Geocode client address and plot it
    if (clientData) {
      const { calle, numero, localidad } = clientData;
      if (calle) {
        geocodeAddress(calle, numero || "", localidad || "Santo Tome").then((coords) => {
          if (coords && mapInstanceRef.current) {
            clientMarkerRef.current = L.marker([coords.lat, coords.lng], { icon: homeIcon })
              .addTo(mapInstanceRef.current)
              .bindPopup(`<strong>Domicilio de Entrega</strong><br/>${calle} ${numero || ""}, ${localidad || ""}`);
            
            bounds.push([coords.lat, coords.lng]);

            // Draw clean dotted route if we have both driver and client
            if (effectiveGpsCoords) {
              routeLineRef.current = L.polyline([[effectiveGpsCoords.lat, effectiveGpsCoords.lng], [coords.lat, coords.lng]], {
                color: "#f59e0b",
                dashArray: "6, 8",
                weight: 3,
                opacity: 0.8
              }).addTo(mapInstanceRef.current);
            }

            // Adjust viewport to fit bounds nicely
            if (bounds.length > 0) {
              mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
            }
          }
        });
      }
    } else {
      // Zoom to standard Santa Fe / Santo Tome region
      mapInstanceRef.current.setView([-31.6420, -60.7200], 13);
    }

  }, [effectiveGpsCoords, clientData, leafletLoaded, activeTrack, profile?.nombre, isTrackingActive]);

  // Watch GPS Location of current device
  const startGpsTracking = () => {
    if (!selectedService) {
      alert("Por favor, selecciona primero un servicio para iniciar el reparto.");
      return;
    }

    if (!navigator.geolocation) {
      setGpsError("La geolocalización no está soportada por tu navegador / celular.");
      return;
    }

    setGpsError(null);
    setIsTrackingActive(true);

    // Set service status to ENTREGA_EN_PROGRESO
    ServiciosService.update(
      selectedService.id!, 
      { estado: "ENTREGA_EN_PROGRESO" as EstadoServicio },
      profile?.uid || "logistica",
      profile?.nombre || "Encargado de Logística",
      "Inicio de reparto logístico - GPS activado"
    ).then(() => {
      loadServices();
    }).catch(console.error);

    // Watch position in real-time
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coords = { lat: latitude, lng: longitude };
        setGpsCoords(coords);

        // Update Firestore public tracking collection in real-time
        try {
          await setDoc(doc(db, "tracking_envios", selectedService.id!), {
            servicioId: selectedService.id,
            numeroServicio: selectedService.numeroServicio,
            lat: latitude,
            lng: longitude,
            activo: true,
            actualizadoEn: new Date().toISOString(),
            operadorNombre: profile?.nombre || "Encargado de Logística",
            aparato: selectedService.aparato,
            marcaModelo: selectedService.marcaModelo
          }, { merge: true });
        } catch (e) {
          console.error("Error writing tracking coords to Firestore:", e);
        }
      },
      (error) => {
        console.error("GPS Watch error:", error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError("Permiso de GPS denegado. Por favor, habilita la ubicación en tu celular.");
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError("La señal del GPS no está disponible.");
            break;
          case error.TIMEOUT:
            setGpsError("Tiempo de espera del GPS agotado.");
            break;
          default:
            setGpsError("Error al obtener ubicación.");
        }
        setIsTrackingActive(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const stopGpsTracking = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTrackingActive(false);
    setGpsCoords(null);

    if (selectedService) {
      // Mark tracking session as inactive in Firestore
      try {
        await setDoc(doc(db, "tracking_envios", selectedService.id!), {
          activo: false,
          actualizadoEn: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error("Error writing stop tracking:", e);
      }
    }
  };

  // Complete delivery: set status to ENTREGADO, register payment methods/amounts, and stop tracking
  const handleConfirmDeliveryWithPayment = async () => {
    if (!paymentModalService?.id) return;
    
    // Validation
    if (!payEfectivo && !payTransferencia) {
      alert("Por favor, selecciona al menos un método de pago.");
      return;
    }
    if (payEfectivo && (!montoEfectivo || parseFloat(montoEfectivo) < 0)) {
      alert("Por favor, ingresa un monto válido para efectivo.");
      return;
    }
    if (payTransferencia && (!montoTransferencia || parseFloat(montoTransferencia) < 0)) {
      alert("Por favor, ingresa un monto válido para transferencia.");
      return;
    }

    setPaymentSaving(true);

    if (selectedService?.id === paymentModalService.id) {
      await stopGpsTracking();
    }

    try {
      const paymentMethods: string[] = [];
      if (payEfectivo) paymentMethods.push("Efectivo");
      if (payTransferencia) paymentMethods.push("Transferencia");

      await ServiciosService.update(
        paymentModalService.id,
        { 
          estado: "ENTREGADO" as EstadoServicio,
          entregado: true,
          citaEntrega: new Date(),
          metodoPago: paymentMethods.join(" + "),
          montoEfectivo: payEfectivo ? parseFloat(montoEfectivo) : 0,
          montoTransferencia: payTransferencia ? parseFloat(montoTransferencia) : 0
        },
        profile?.uid || "logistica",
        profile?.nombre || "Encargado de Logística",
        `Equipo entregado. Pago registrado: ${paymentMethods.join(" + ")} (Efectivo: $${montoEfectivo || 0}, Transferencia: $${montoTransferencia || 0})`
      );
      
      // Inactive the tracking document
      await setDoc(doc(db, "tracking_envios", paymentModalService.id), {
        activo: false,
        actualizadoEn: new Date().toISOString()
      }, { merge: true });

      alert("¡Entrega y pago registrados con éxito!");
      setPaymentModalService(null);
      setSelectedService(null);
      setClientData(null);
      loadServices();
    } catch (e) {
      console.error(e);
      alert("Ocurrió un error al registrar la entrega.");
    } finally {
      setPaymentSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const getShareUrl = (id: string) => {
    return `${window.location.origin}/#tracking/${id}`;
  };

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(getShareUrl(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWhatsAppLink = (service: Servicio) => {
    const shareUrl = getShareUrl(service.id!);
    const message = `¡Hola! EconoService le informa que su equipo (${service.aparato} ${service.marcaModelo}) se encuentra en camino para la entrega a su domicilio. Siga la ubicación del móvil de reparto en tiempo real ingresando aquí:\n\n${shareUrl}`;
    const cleanPhone = clientData?.telCel?.replace(/[^0-9]/g, "") || "";
    // Format to Argentina cell style if needed, or open universal wa link
    return `https://wa.me/${cleanPhone ? cleanPhone : ""}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="space-y-6">
      {!isEmbedded && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-7 h-7 text-amber-500" />
              Tracker Logístico
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Monitoreo en tiempo real de entregas, geolocalización satelital para clientes de Santo Tomé y Santa Fe.
            </p>
          </div>
          <button
            onClick={loadServices}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-750 transition-all text-xs font-semibold uppercase tracking-wider self-start cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar Lista
          </button>
        </div>
      )}

      {isEmbedded && (
        <div className="flex justify-end">
          <button
            onClick={loadServices}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-750 transition-all text-xs font-semibold uppercase tracking-wider cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar Lista
          </button>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - List and Controls */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Active Tracker Control Panel */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <Compass className="w-4 h-4 text-indigo-500" />
              Emisor GPS del Celular
            </h2>

            {activeServices.length === 0 ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-xl text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No hay órdenes en situación de <span className="font-semibold text-amber-500">Listo para Entrega</span> o <span className="font-semibold text-amber-500">Entrega en Progreso</span>.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Seleccionar Orden de Reparto Activa
                  </label>
                  <select
                    disabled={isTrackingActive}
                    value={selectedService?.id || ""}
                    onChange={(e) => {
                      const found = activeServices.find(s => s.id === e.target.value);
                      setSelectedService(found || null);
                    }}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-750 rounded-xl text-sm sm:text-base font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white transition-all cursor-pointer shadow-xs"
                  >
                    <option value="" className="font-bold text-slate-400">-- Seleccionar Orden --</option>
                    {activeServices.map(s => {
                      const client = clientsMap[s.clienteId];
                      const address = client ? [
                        client.calle ? `${client.calle} ${client.numero || ""}` : "",
                        client.barrio ? `B° ${client.barrio}` : "",
                        client.localidad || ""
                      ].filter(Boolean).join(", ") : "Dirección no registrada";
                      return (
                        <option key={s.id} value={s.id} className="font-bold text-slate-900 dark:text-white">
                          Orden #{s.numeroServicio} - {address}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedService && (() => {
                  const idx = activeServices.findIndex(s => s.id === selectedService.id);
                  const borderStrip = CARD_BORDER_COLORS[idx !== -1 ? idx % CARD_BORDER_COLORS.length : 0];
                  
                  let scheduleText = "";
                  if (selectedService.citaEntrega) {
                    const dt = selectedService.citaEntrega instanceof Date ? selectedService.citaEntrega : selectedService.citaEntrega.toDate();
                    const dateStr = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    scheduleText = `${dateStr}`;
                    if (selectedService.horaEntregaDesde || selectedService.horaEntregaHasta) {
                      scheduleText += ` (${selectedService.horaEntregaDesde || "?"} - ${selectedService.horaEntregaHasta || "?"})`;
                    }
                  }

                  const clientAddress = clientData 
                    ? `${clientData.calle || ""} ${clientData.numero || ""}, ${clientData.localidad || "Santo Tomé"}`
                    : "Cargando dirección...";

                  return (
                    <div className={`p-4 rounded-xl border text-xs bg-gray-50/50 dark:bg-gray-855/50 border-gray-100 dark:border-gray-800/80 ${borderStrip} space-y-3`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">
                          Orden #{selectedService.numeroServicio}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedService.estado === "ENTREGA_EN_PROGRESO"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                        }`}>
                          {getEstadoLabel(selectedService.estado)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Cliente</span>
                        <p className="font-bold text-sm text-slate-800 dark:text-white">
                          {clientData?.nombreApellido || "Cargando..."}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Equipo</span>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">
                          {selectedService.aparato} {selectedService.marcaModelo}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-gray-150 dark:border-gray-800">
                        <div className="flex items-start gap-2 text-slate-800 dark:text-slate-150" title={clientAddress}>
                          <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-[12px] sm:text-sm font-extrabold leading-tight tracking-tight">
                            {clientAddress}
                          </span>
                        </div>
                        
                        {scheduleText && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span className="text-[12px] sm:text-sm font-black tracking-wide text-indigo-650 dark:text-indigo-400">
                              {scheduleText}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="pt-3 border-t border-gray-150 dark:border-gray-800 space-y-2.5">
                        <div className="flex items-center gap-2">
                          {/* Copy tracking link */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(selectedService.id!);
                            }}
                            className="flex-1 px-2.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 rounded-xl flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-all"
                            title="Copiar Link de Seguimiento"
                          >
                            {copiedId === selectedService.id ? (
                              <><Check className="w-3 h-3 text-emerald-500" />Copiado</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" />Link</>
                            )}
                          </button>

                          {/* WhatsApp Client */}
                          <a
                            href={getWhatsAppLink(selectedService)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-all"
                            title="Enviar aviso WhatsApp al cliente"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>

                        {/* Complete Delivery — full width orange button */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm("¿Estás seguro de marcar este equipo como entregado?")) return;
                            
                            if (selectedService?.id) {
                              if (selectedService.id === selectedService.id) {
                                await stopGpsTracking();
                              }

                              try {
                                await ServiciosService.update(
                                  selectedService.id,
                                  { 
                                    estado: "ENTREGADO" as EstadoServicio,
                                    entregado: true,
                                    citaEntrega: new Date()
                                  },
                                  profile?.uid || "logistica",
                                  profile?.nombre || "Encargado de Logística",
                                  `Equipo entregado directamente por Logística`
                                );
                                
                                // Inactivate the tracking document
                                await setDoc(doc(db, "tracking_envios", selectedService.id), {
                                  activo: false,
                                  actualizadoEn: new Date().toISOString()
                                }, { merge: true });

                                alert("¡Entrega registrada con éxito!");
                                setSelectedService(null);
                                setClientData(null);
                                loadServices();
                              } catch (err) {
                                console.error(err);
                                alert("Ocurrió un error al registrar la entrega.");
                              }
                            }
                          }}
                          className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center gap-1.5 font-extrabold text-[11px] uppercase tracking-wider cursor-pointer transition-all shadow-md shadow-orange-500/10 active:scale-[0.98]"
                        >
                          <Check className="w-4 h-4" />
                          <span>Marcar como Entregado</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Conditional view based on role */}
                {isSuperadmin ? (
                  selectedService && (
                    <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                      {activeTrack?.activo ? (
                        <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs space-y-2">
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                            <span>GPS ACTIVADO</span>
                          </div>
                          <div className="space-y-1.5 text-gray-750 dark:text-gray-300">
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Iniciado por:</span>
                              <span className="font-bold text-gray-850 dark:text-white">{activeTrack.operadorNombre || "Encargado de Logística"}</span>
                            </div>
                            {activeTrack.actualizadoEn && (
                              <div>
                                <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Última actualización:</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-200">
                                  {new Date(activeTrack.actualizadoEn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Date(activeTrack.actualizadoEn).toLocaleDateString()})
                                </span>
                              </div>
                            )}
                            {activeTrack.lat && activeTrack.lng && (
                              <div className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded mt-1 inline-block">
                                Lat: {activeTrack.lat.toFixed(5)} | Lng: {activeTrack.lng.toFixed(5)}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-100/50 dark:bg-gray-850/50 border border-gray-150 dark:border-gray-800 rounded-xl p-4 text-xs text-center space-y-2">
                          <div className="flex items-center justify-center gap-1.5 text-gray-500 dark:text-gray-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
                            <span>NO ACTIVADO</span>
                          </div>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-normal">
                            La transmisión de ubicación para esta orden aún no ha sido iniciada por el personal de reparto.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  /* GPS Trigger Buttons and Live diagnostics for drivers / logistics */
                  selectedService && (
                    <>
                      <div className="space-y-2">
                        {!isTrackingActive ? (
                          <button
                            onClick={startGpsTracking}
                            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                          >
                            <Play className="w-4 h-4 fill-current" />
                            Iniciar Reparto e Instalar GPS Celular
                          </button>
                        ) : (
                          <button
                            onClick={stopGpsTracking}
                            className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/10 cursor-pointer"
                          >
                            <Square className="w-4 h-4 fill-current" />
                            Detener Transmisión GPS
                          </button>
                        )}
                      </div>

                      {/* GPS Live Diagnostics */}
                      {isTrackingActive && (
                        <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs space-y-1.5 animate-pulse">
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                            Emisor GPS Activo
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Transmitiendo coordenadas a la nube. Mantené tu pantalla activa y tu celular encima.
                          </p>
                          {gpsCoords && (
                            <div className="text-[10px] font-mono text-gray-400 mt-1">
                              Lat: {gpsCoords.lat.toFixed(5)} | Lng: {gpsCoords.lng.toFixed(5)}
                            </div>
                          )}
                        </div>
                      )}

                      {gpsError && (
                        <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Error del GPS:</span> {gpsError}
                          </div>
                        </div>
                      )}
                    </>
                  )
                )}
              </div>
            )}
          </div>



          {/* Delivery Scheduling Modal */}
          {scheduleModalService && (
            <div
              className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setScheduleModalService(null)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

              {/* Sheet / Modal */}
              <div
                className="relative w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-5 animate-slide-up"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">
                      Fecha de Entrega Acordada
                    </h3>
                  </div>
                  <button
                    onClick={() => setScheduleModalService(null)}
                    className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-all cursor-pointer"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-[11px] text-gray-400 -mt-2">
                  Orden #{scheduleModalService.numeroServicio} — {scheduleModalService.aparato} {scheduleModalService.marcaModelo}
                </p>

                {/* Date picker */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-850 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Time range — numeric HH:MM inputs */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Horario Acordado
                  </label>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="shrink-0 font-medium text-xs">de</span>
                    {/* DESDE */}
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number" inputMode="numeric" pattern="[0-9]*"
                        min="0" max="23" placeholder="HH"
                        value={scheduleHoraDesde ? scheduleHoraDesde.split(":")[0] : ""}
                        onChange={(e) => {
                          const hh = e.target.value.replace(/\D/g, "").slice(0, 2);
                          const mm = scheduleHoraDesde ? (scheduleHoraDesde.split(":")[1] || "00") : "00";
                          setScheduleHoraDesde(hh ? `${hh.padStart(2, "0")}:${mm}` : "");
                        }}
                        className="w-14 px-2 py-2 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <span className="font-bold text-gray-400">:</span>
                      <input
                        type="number" inputMode="numeric" pattern="[0-9]*"
                        min="0" max="59" placeholder="MM"
                        value={scheduleHoraDesde ? scheduleHoraDesde.split(":")[1] : ""}
                        onChange={(e) => {
                          const mm = e.target.value.replace(/\D/g, "").slice(0, 2);
                          const hh = scheduleHoraDesde ? (scheduleHoraDesde.split(":")[0] || "00") : "00";
                          setScheduleHoraDesde(mm ? `${hh}:${mm.padStart(2, "0")}` : hh ? `${hh}:` : "");
                        }}
                        className="w-14 px-2 py-2 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <span className="shrink-0 font-medium text-xs">hasta</span>
                    {/* HASTA */}
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number" inputMode="numeric" pattern="[0-9]*"
                        min="0" max="23" placeholder="HH"
                        value={scheduleHoraHasta ? scheduleHoraHasta.split(":")[0] : ""}
                        onChange={(e) => {
                          const hh = e.target.value.replace(/\D/g, "").slice(0, 2);
                          const mm = scheduleHoraHasta ? (scheduleHoraHasta.split(":")[1] || "00") : "00";
                          setScheduleHoraHasta(hh ? `${hh.padStart(2, "0")}:${mm}` : "");
                        }}
                        className="w-14 px-2 py-2 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <span className="font-bold text-gray-400">:</span>
                      <input
                        type="number" inputMode="numeric" pattern="[0-9]*"
                        min="0" max="59" placeholder="MM"
                        value={scheduleHoraHasta ? scheduleHoraHasta.split(":")[1] : ""}
                        onChange={(e) => {
                          const mm = e.target.value.replace(/\D/g, "").slice(0, 2);
                          const hh = scheduleHoraHasta ? (scheduleHoraHasta.split(":")[0] || "00") : "00";
                          setScheduleHoraHasta(mm ? `${hh}:${mm.padStart(2, "0")}` : hh ? `${hh}:` : "");
                        }}
                        className="w-14 px-2 py-2 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={saveSchedule}
                  disabled={scheduleSaving || !scheduleDate}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white font-bold rounded-xl text-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                >
                  {scheduleSaving ? (
                    <><span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin inline-block" />Guardando...</>
                  ) : (
                    <><CalendarClock className="w-4 h-4" />Guardar Fecha de Entrega</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Asistente de Ruta Inteligente (Gemini AI) */}
          <div className="bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/10 dark:to-gray-900 border border-indigo-100/60 dark:border-indigo-900/40 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-100/50 dark:border-indigo-900/20 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
                <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider">
                  Asistente de Ruta Inteligente
                </h2>
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-200/50 dark:border-indigo-900/50">
                Gemini AI
              </span>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
              El asistente analiza las direcciones registradas en tus órdenes de reparto activas y traza un orden de entrega lógico, identificando calles paralelas, alturas contiguas y la ruta ideal para ahorrar tiempo y combustible.
            </p>

            {activeServices.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2 italic bg-gray-50 dark:bg-gray-850/50 rounded-xl border border-gray-100 dark:border-gray-800/60">
                No hay órdenes de reparto activas para optimizar.
              </p>
            ) : (
              <div className="space-y-4 pt-1">
                <button
                  onClick={handleOptimizeRoute}
                  disabled={isOptimizing}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
                >
                  {isOptimizing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analizando calles y alturas...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Recomendar Orden de Entrega
                    </>
                  )}
                </button>

                {optimizationError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{optimizationError}</span>
                  </div>
                )}

                {routeRecommendation && (
                  <div className="space-y-4">
                    {/* Explicación / Comentario General del Asistente */}
                    <div className="p-3.5 bg-white dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl text-xs text-gray-700 dark:text-gray-300 leading-relaxed space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Análisis Geográfico del Asistente:
                      </div>
                      <p className="italic">"{routeRecommendation.explicacion}"</p>
                    </div>

                    {/* Pasos de Entrega Recomendados */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                        <ListOrdered className="w-3.5 h-3.5 text-indigo-500" />
                        Secuencia Recomendada de Reparto:
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {routeRecommendation.recomendaciones.map((rec, index) => {
                          const matchingService = activeServices.find(s => s.numeroServicio === Number(rec.numeroServicio) || String(s.numeroServicio) === String(rec.numeroServicio));
                          const isCurrentlySelected = selectedService?.numeroServicio === matchingService?.numeroServicio && matchingService !== undefined;

                          return (
                            <div
                              key={index}
                              onClick={() => {
                                if (matchingService) {
                                  setSelectedService(matchingService);
                                }
                              }}
                              className={`p-3 rounded-xl border text-xs flex gap-3 transition-all cursor-pointer ${
                                isCurrentlySelected
                                  ? "bg-amber-500/5 border-amber-500/50"
                                  : "bg-white dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-750"
                              }`}
                            >
                              {/* Step Badge */}
                              <div className="w-6 h-6 rounded-lg bg-indigo-500 text-white font-mono text-xs font-black flex items-center justify-center shrink-0 shadow-sm">
                                {rec.orden || (index + 1)}
                              </div>

                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-gray-800 dark:text-white truncate">
                                    Orden #{rec.numeroServicio} — {rec.cliente}
                                  </span>
                                  {matchingService && (
                                    <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                                      {matchingService.aparato}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-medium">
                                  <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                                  <span className="truncate">{rec.direccion}</span>
                                </div>

                                {rec.comentario && (
                                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 dark:bg-indigo-500/10 px-2.5 py-1 rounded-lg mt-1 italic font-medium">
                                    {rec.comentario}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right Column - Map Interface */}
        <div 
          ref={mapSectionRef}
          className={`lg:col-span-7 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 rounded-2xl p-4 shadow-sm flex flex-col transition-all duration-300 ${
            isFullscreen 
              ? "fixed inset-0 z-[9999] h-screen w-screen rounded-none p-6" 
              : "h-[380px] md:h-[550px] lg:h-[650px]"
          }`}
        >
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-800 pb-2">
            <span className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-indigo-500 animate-spin-slow" />
              Mapa de Cobertura EconoService (Santo Tomé & Santa Fe)
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full inline-block"></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Cliente
                </span>
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block"></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Móvil GPS
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full h-full rounded-xl overflow-hidden relative border border-gray-100 dark:border-gray-850">
            {/* Fullscreen Toggle Button */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-3.5 right-3.5 z-[1000] w-10 h-10 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 rounded-xl shadow-md border border-slate-200/80 dark:border-gray-700 transition-all flex items-center justify-center cursor-pointer active:scale-95"
              title={isFullscreen ? "Salir de pantalla completa" : "Ver en pantalla completa"}
              id="btn-map-fullscreen"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Maximize className="w-5 h-5 text-slate-600 dark:text-gray-400" />
              )}
            </button>

            {/* Loading splash screen */}
            {!leafletLoaded && (
              <div className="absolute inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cargando módulo de mapas satelitales...</p>
              </div>
            )}

            {/* Map hook container */}
            <div 
              ref={mapContainerRef} 
              id="leaflet-map-tracker" 
              className="w-full h-full bg-slate-50 dark:bg-slate-950" 
              style={{ minHeight: "100%" }}
            />
          </div>
          
          <div className="mt-3 text-[11px] text-gray-400 flex items-center gap-1.5 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>
              La ubicación del repartidor se transmite directamente usando la precisión satelital del navegador de su teléfono celular mientras la ruta esté en progreso.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
