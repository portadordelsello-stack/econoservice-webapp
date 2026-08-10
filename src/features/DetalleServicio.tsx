import React, { useEffect, useState } from "react";
import { ServiciosService, ClientesService, EquiposService, TecnicosService, toDate, StockService, NotificationsService } from "../services/db";
import { Servicio, Cliente, Equipo, Tecnico, Historial, EstadoServicio, getEstadoLabel } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { storage, db as firestoreDb } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { 
  ArrowLeft, 
  Check, 
  Wrench, 
  User, 
  Laptop, 
  Activity, 
  DollarSign, 
  ShieldCheck, 
  FileText, 
  Truck, 
  Calendar,
  History,
  AlertTriangle,
  Upload,
  FileDown,
  Paperclip,
  Trash2,
  HardDrive,
  ExternalLink,
  FileImage,
  MapPin,
  Cpu,
  Phone,
  MessageSquare,
  Handshake,
  CheckCircle,
  Clock,
  XCircle,
  Save,
  Loader2
} from "lucide-react";

const getEstadoBadgeClass = (estado: string) => {
  switch (estado) {
    case "RECIBIDO":
      return "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30";
    case "EN_ESPERA":
      return "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30";
    case "ACEPTADO":
      return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100/30 dark:border-emerald-900/30";
    case "LISTO_PARA_ENTREGA":
      return "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-100/30 dark:border-teal-900/30";
    case "ENTREGA_EN_PROGRESO":
      return "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-100/30 dark:border-sky-900/30";
    case "ENTREGADO":
      return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30";
    case "RECHAZADO":
    case "CANCELADO":
      return "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/30 dark:border-rose-900/30";
    default:
      return "bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700";
  }
};

const getEstadoLabelBadgeClass = (estado: string) => {
  switch (estado) {
    case "RECIBIDO":
      return "bg-amber-100/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400";
    case "EN_ESPERA":
      return "bg-indigo-100/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400";
    case "ACEPTADO":
      return "bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400";
    case "LISTO_PARA_ENTREGA":
      return "bg-teal-100/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400";
    case "ENTREGA_EN_PROGRESO":
      return "bg-sky-100/70 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400";
    case "ENTREGADO":
      return "bg-emerald-200 dark:bg-emerald-905 text-emerald-850 dark:text-emerald-200";
    case "RECHAZADO":
    case "CANCELADO":
      return "bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400";
    default:
      return "bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300";
  }
};

const formatClienteId = (c: Cliente): string => {
  if (c.numeroCliente) {
    return String(c.numeroCliente).padStart(6, "0");
  }
  if (c.id) {
    let hash = 0;
    for (let i = 0; i < c.id.length; i++) {
      hash = c.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const num = Math.abs(hash) % 1000000;
    return String(num).padStart(6, "0");
  }
  return "000000";
};

export default function DetalleServicio() {
  const { profile } = useAuth();
  const { selectedId, navigationData, navigate } = useNavigation();

  // Primary data states
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form field edit states
  const [editEstado, setEditEstado] = useState<EstadoServicio>("RECIBIDO");
  const [editTecnicoId, setEditTecnicoId] = useState("");
  const [editDiagnostico, setEditDiagnostico] = useState("");
  const [editRepuestosComprar, setEditRepuestosComprar] = useState("");
  const [editRepuestosComprados, setEditRepuestosComprados] = useState("");
  
  const [editPresupuesto, setEditPresupuesto] = useState(0);
  const [editPresupuestoTexto, setEditPresupuestoTexto] = useState("");
  const [editPresupuestado, setEditPresupuestado] = useState(false);
  const [editServiciosConvenidos, setEditServiciosConvenidos] = useState("");
  
  // Toggles
  const [editAcepta, setEditAcepta] = useState(false);
  const [editRechazaDevolver, setEditRechazaDevolver] = useState(false);
  const [editGarantia, setEditGarantia] = useState(false);
  const [editEsReclamoGarantia, setEditEsReclamoGarantia] = useState(false);
  const [editIngresoTaller, setEditIngresoTaller] = useState(true);
  const [editPasaStock, setEditPasaStock] = useState(false);
  const [editTerminado, setEditTerminado] = useState(false);
  const [editEntregado, setEditEntregado] = useState(false);
  const [editFactura, setEditFactura] = useState(false);
  const [editContado, setEditContado] = useState(false);

  // Notes
  const [editNotasInternas, setEditNotasInternas] = useState("");

  // Logistics fields
  const [editCitaEntrega, setEditCitaEntrega] = useState("");
  const [editHoraEntregaDesde, setEditHoraEntregaDesde] = useState("");
  const [editHoraEntregaHasta, setEditHoraEntregaHasta] = useState("");
  const [editInfoLogistica, setEditInfoLogistica] = useState("");

  // File Upload states
  const [filesList, setFilesList] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  // History Modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyServices, setHistoryServices] = useState<Servicio[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadServiceDetails = async () => {
    if (!selectedId) return;
    try {
      setLoading(true);

      const serv = await ServiciosService.getById(selectedId);
      if (!serv) {
        navigate("servicios");
        return;
      }
      setServicio(serv);

      // Sync form fields immediately
      setEditEstado(serv.estado);
      setEditTecnicoId(serv.tecnicoId || "");
      setEditDiagnostico(serv.diagnostico || serv.serviciosRequeridos || "");
      setEditRepuestosComprar(serv.repuestosComprar || "");
      setEditRepuestosComprados(serv.repuestosComprados || "");
      setEditPresupuesto(serv.presupuesto || 0);
      setEditPresupuestoTexto(serv.presupuestoTexto || "");
      setEditPresupuestado(serv.presupuestado || false);
      setEditServiciosConvenidos(serv.serviciosConvenidos || "");
      setEditAcepta(serv.acepta || false);
      setEditRechazaDevolver(serv.rechazaDevolver || false);
      setEditGarantia(serv.garantia || false);
      setEditEsReclamoGarantia(serv.esReclamoGarantia || false);
      setEditIngresoTaller(serv.ingresoTaller !== false);
      setEditPasaStock(serv.pasaStock || false);
      setEditTerminado(serv.terminado || false);
      setEditEntregado(serv.entregado || false);
      setEditFactura(serv.factura || false);
      setEditContado(serv.contado || false);
      setEditNotasInternas(serv.notasInternas || "");

      // Sync logistics fields
      let formattedCita = "";
      if (serv.citaEntrega) {
        try {
          const d = new Date(serv.citaEntrega);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            formattedCita = `${yyyy}-${mm}-${dd}`;
          }
        } catch {}
      }
      setEditCitaEntrega(formattedCita);
      setEditHoraEntregaDesde(serv.horaEntregaDesde || "");
      setEditHoraEntregaHasta(serv.horaEntregaHasta || "");
      setEditInfoLogistica(serv.infoLogistica || "");

      // If pre-loaded client/equipo are available, use them right away
      if (navigationData?.cliente) setCliente(navigationData.cliente as Cliente);
      if (navigationData?.equipo) setEquipo(navigationData.equipo as Equipo);

      // Stop showing spinner immediately once we have the service
      setLoading(false);

      // Execute remaining dependency loads in parallel in background
      const clientPromise = (!navigationData?.cliente && serv.clienteId)
        ? ClientesService.getById(serv.clienteId).then(cli => setCliente(cli)).catch(err => console.error("Error loading related client:", err))
        : Promise.resolve();

      const eqPromise = (!navigationData?.equipo && serv.equipoId)
        ? EquiposService.getById(serv.equipoId).then(eq => setEquipo(eq)).catch(err => console.error("Error loading related equipment:", err))
        : Promise.resolve();

      const tecPromise = TecnicosService.getAll().then(tecList => setTecnicos(tecList)).catch(err => console.error("Error loading technicians list:", err));

      const histPromise = ServiciosService.getHistorial(selectedId).then(histList => setHistorial(histList)).catch(err => console.error("Error loading historical timeline:", err));

      const fetchStorageFiles = async () => {
        try {
          const storageRef = ref(storage, `servicios/${selectedId}`);
          const result = await listAll(storageRef);
          const filePromises = result.items.map(async (item) => {
            const url = await getDownloadURL(item);
            return { name: item.name, url };
          });
          const resolvedFiles = await Promise.all(filePromises);
          setFilesList(resolvedFiles);
        } catch (storageErr) {
          console.warn("Storage bucket list error:", storageErr);
        }
      };

      await Promise.all([clientPromise, eqPromise, tecPromise, histPromise, fetchStorageFiles()]);

    } catch (err) {
      console.error("Error loading primary service details:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServiceDetails();
  }, [selectedId]);

  const handleLoadEquiposHistory = async () => {
    if (!servicio || !servicio.clienteId) return;
    try {
      setLoadingHistory(true);
      setShowHistoryModal(true);
      
      // Fetch all services
      const allServs = await ServiciosService.getAll();
      // Filter for this client, excluding current service
      const clientServs = allServs.filter(s => s.clienteId === servicio.clienteId && s.id !== servicio.id);
      
      // Sort by date descending
      clientServs.sort((a, b) => {
        const dateA = toDate(a.fechaIngreso)?.getTime() || 0;
        const dateB = toDate(b.fechaIngreso)?.getTime() || 0;
        return dateB - dateA;
      });

      setHistoryServices(clientServs);
    } catch (err) {
      console.error("Error loading client service history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Auth permissions
  const isAdmin = profile?.rol === "superadmin" || profile?.rol === "admin" || profile?.rol === "administracion";
  const isRecepcion = profile?.rol === "superadmin" || profile?.rol === "logistica";
  const isTecnico = profile?.rol === "tecnico" || profile?.rol === "superadmin";
  const isConsulta = profile?.rol === "administracion" || profile?.rol === "consulta" || (!isAdmin && !isRecepcion && !isTecnico);

  const syncRepuestosToStock = async (repuestosText: string) => {
    if (!repuestosText || !repuestosText.trim() || !servicio) return;

    const items = repuestosText
      .split(/[,;\n•\-*]+/)
      .map(i => i.trim())
      .filter(i => i.length > 2 && !i.toLowerCase().includes("ninguno") && !i.toLowerCase().includes("no se requ"));

    if (items.length === 0) return;

    try {
      const latestStock = await StockService.getAll();

      for (const item of items) {
        const existingItem = latestStock.find(
          st => st.nombre.toLowerCase().trim() === item.toLowerCase().trim()
        );

        if (existingItem && existingItem.id) {
          if (existingItem.cantidad < 1) {
            await StockService.update(existingItem.id, {
              cantidad: 1,
              marcaModeloCompatible: existingItem.marcaModeloCompatible || servicio.marcaModelo || ""
            });
          }
        } else {
          await StockService.create({
            nombre: item,
            descripcion: `Sincronizado de repuestos comprados en Orden #${servicio.numeroServicio || ''} (${servicio.aparato || ''} ${servicio.marcaModelo || ''})`,
            cantidad: 1,
            unidad: "unidades",
            marcaModeloCompatible: servicio.marcaModelo || "",
            ubicacion: "Taller / Por asignar",
            precioCompra: 0,
            precioVenta: 0,
            stockMinimo: 0,
            proveedorId: ""
          });
        }
      }
    } catch (err) {
      console.error("Error syncing repuestos to stock:", err);
    }
  };

  // Action Save changes
  const handleSave = async (targetState?: EstadoServicio, isFinished?: boolean, customAuditText?: string) => {
    if (!selectedId || !profile || !servicio) return;
    setSubmitting(true);
    try {
      const userUid = profile.uid;
      const userNombre = profile.nombre || "Usuario";

      const finalState = isFinished ? "LISTO_PARA_ENTREGA" : (targetState || editEstado);
      const isReparacionTerminada = isFinished !== undefined ? isFinished : editTerminado;

      let fieldsToUpdate: Partial<Servicio>;

      if (profile?.rol === "tecnico") {
        fieldsToUpdate = {
          estado: finalState,
          diagnostico: editDiagnostico,
          serviciosRequeridos: editDiagnostico,
          notasInternas: editNotasInternas,
          repuestosComprar: editRepuestosComprar,
          repuestosComprados: editRepuestosComprados,
          pasaStock: editPasaStock,
          terminado: isReparacionTerminada,
        };
      } else {
        fieldsToUpdate = {
          estado: finalState,
          tecnicoId: editTecnicoId || "",
          diagnostico: editDiagnostico,
          serviciosRequeridos: editDiagnostico,
          notasInternas: editNotasInternas,
          repuestosComprar: editRepuestosComprar,
          repuestosComprados: editRepuestosComprados,
          presupuesto: Number(editPresupuesto) || 0,
          presupuestoTexto: editPresupuestoTexto,
          presupuestado: editPresupuestado,
          serviciosConvenidos: editServiciosConvenidos,
          acepta: editAcepta,
          rechazaDevolver: editRechazaDevolver,
          garantia: editGarantia,
          esReclamoGarantia: editEsReclamoGarantia,
          ingresoTaller: editIngresoTaller,
          pasaStock: editPasaStock,
          terminado: isReparacionTerminada,
          entregado: editEntregado,
          factura: editFactura,
          contado: editContado,
          citaEntrega: editCitaEntrega ? new Date(`${editCitaEntrega}T12:00:00`) : null,
          horaEntregaDesde: editHoraEntregaDesde,
          horaEntregaHasta: editHoraEntregaHasta,
          infoLogistica: editInfoLogistica
        };

        if (finalState === "ACEPTADO" || finalState === "LISTO_PARA_ENTREGA" || editAcepta) {
          fieldsToUpdate.acepta = true;
          fieldsToUpdate.rechazaDevolver = false;
        } else if (finalState === "RECHAZADO" || editRechazaDevolver) {
          fieldsToUpdate.acepta = false;
          fieldsToUpdate.rechazaDevolver = true;
        }
      }

      if (profile?.rol === "tecnico") {
        // Use the dedicated tecnico update function that only sends whitelisted fields
        await ServiciosService.updateTecnico(
          selectedId,
          fieldsToUpdate,
          userUid,
          userNombre,
          customAuditText || "Actualización de Orden de Servicio"
        );
      } else {
        await ServiciosService.update(
          selectedId,
          fieldsToUpdate,
          userUid,
          userNombre,
          customAuditText || "Actualización de Orden de Servicio"
        );
      }

      // Workflow triggers: Notify admin & logistica when finished, or notify admin when diagnosed
      if (isReparacionTerminada || finalState === "LISTO_PARA_ENTREGA") {
        await NotificationsService.create({
          targetRole: "admin",
          title: "Reparación Terminada",
          message: `El técnico ${userNombre} dio por terminada la reparación del Servicio #${servicio.numeroServicio} (${servicio.aparato || "Equipo"} ${servicio.marcaModelo || ""}).`,
          serviceId: selectedId
        });
        await NotificationsService.create({
          targetRole: "logistica",
          title: "Equipo Listo para Entrega",
          message: `El Servicio #${servicio.numeroServicio} fue marcado como listo para entrega. Coordinar despacho.`,
          serviceId: selectedId
        });
      } else if (profile?.rol === "tecnico") {
        const hasDiagnosis = Boolean(editDiagnostico && editDiagnostico.trim());
        if (hasDiagnosis || finalState === "DIAGNOSTICO" || finalState === "EN_ESPERA") {
          await NotificationsService.create({
            targetRole: "admin",
            title: "Equipo Diagnosticado",
            message: `El técnico ${userNombre} completó/actualizó el diagnóstico del Servicio #${servicio.numeroServicio} (${servicio.aparato || "Equipo"} ${servicio.marcaModelo || ""}).`,
            serviceId: selectedId
          });
          // WhatsApp Notification
          fetch("/api/whatsapp/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "diagnosis", serviceId: selectedId })
          }).catch(err => console.error("Error sending WhatsApp diagnosis notify:", err));
        }
        if (finalState === "ACEPTADO" || finalState === "EN_REPARACION" || editAcepta) {
          await NotificationsService.create({
            targetRole: "taller",
            title: "Reparación Confirmada",
            message: `El Administrador confirmó la reparación del Servicio #${servicio.numeroServicio} (${servicio.aparato || "Equipo"} ${servicio.marcaModelo || ""}). Proceder con la reparación.`,
            serviceId: selectedId
          });
        }
      }

      // Sync central stock if parts bought changes
      if (editRepuestosComprados) {
        await syncRepuestosToStock(editRepuestosComprados);
      }

      alert("¡Cambios guardados con éxito!");
      navigate(navigationData?.fromView || "servicios");
    } catch (err) {
      console.error("Error saving changes:", err);
      alert("Error al guardar cambios.");
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================================
  // TERMINADO — standalone function, bypasses all service layers.
  // Writes directly to Firestore with ONLY whitelisted technician fields.
  // =====================================================================
  const handleTerminado = async () => {
    if (!selectedId || !profile || !servicio) return;
    setSubmitting(true);
    try {
      const userUid = profile.uid || "usuario";
      const userNombre = profile.nombre || "Técnico";

      const fieldsToUpdate = {
        estado: "LISTO_PARA_ENTREGA" as EstadoServicio,
        terminado: true,
      };

      if (profile?.rol === "tecnico") {
        await ServiciosService.updateTecnico(
          selectedId,
          fieldsToUpdate,
          userUid,
          userNombre,
          "Técnico completó la reparación y marcó como TERMINADO"
        );
      } else {
        await ServiciosService.update(
          selectedId,
          fieldsToUpdate,
          userUid,
          userNombre,
          "Técnico completó la reparación y marcó como TERMINADO"
        );
      }

      // Notify admin and logistica
      try {
        await NotificationsService.create({
          targetRole: "admin",
          title: "Reparación Terminada",
          message: `El técnico ${userNombre} dio por terminada la reparación del Servicio #${servicio.numeroServicio} (${servicio.aparato || "Equipo"} ${servicio.marcaModelo || ""}).`,
          serviceId: selectedId
        });
        await NotificationsService.create({
          targetRole: "logistica",
          title: "Equipo Listo para Entrega",
          message: `El Servicio #${servicio.numeroServicio} fue marcado como listo para entrega. Coordinar despacho.`,
          serviceId: selectedId
        });
      } catch (notifErr) {
        console.warn("No se pudo enviar notificación:", notifErr);
      }

      alert("¡Reparación marcada como TERMINADA!");
      navigate(navigationData?.fromView || "servicios");
    } catch (err) {
      console.error("Error al marcar como terminado:", err);
      alert("Error al marcar como terminado: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;

    try {
      setUploading(true);
      const fileRef = ref(storage, `servicios/${selectedId}/${file.name}`);
      await uploadBytes(fileRef, file);
      
      await ServiciosService.registrarHistorial(
        selectedId,
        profile?.uid || "user",
        profile?.nombre || "Usuario",
        "MODIFICACION",
        `Archivo adjunto subido: ${file.name}`
      );

      await loadServiceDetails();
      alert("Archivo subido con éxito.");
    } catch (err) {
      console.error("File upload error:", err);
      alert("No se pudo subir el archivo. El bucket de almacenamiento podría requerir configuración.");
    } finally {
      setUploading(false);
    }
  };

  if (loading || !servicio) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Address formatting
  const addressStr = cliente ? [
    cliente.calle ? `${cliente.calle} ${cliente.numero || ""}`.trim() : "",
    cliente.torre ? `Torre ${cliente.torre}` : "",
    cliente.piso ? `Piso ${cliente.piso}` : "",
    cliente.depto ? `Depto ${cliente.depto}` : "",
    cliente.barrio ? `Barrio ${cliente.barrio}` : "",
    cliente.localidad || "Santo Tomé"
  ].filter(Boolean).join(", ") : "Sin Domicilio";

  const isSaveDisabled = 
    profile?.rol === "tecnico" 
      ? (!editDiagnostico.trim()) 
      : profile?.rol === "logistica"
        ? (!editCitaEntrega || !editHoraEntregaDesde.trim() || !editHoraEntregaHasta.trim() || !editInfoLogistica.trim())
        : false;

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-10">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-150 dark:border-gray-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(navigationData?.fromView || "servicios")}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer shrink-0 active:scale-95 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver</span>
          </button>
          
          {profile?.rol !== "tecnico" && (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`p-2.5 rounded-xl text-xs font-bold shrink-0 ${getEstadoBadgeClass(servicio.estado)}`}>
                  Orden #{servicio.numeroServicio}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                      ID del Cliente: {cliente ? formatClienteId(cliente) : "S/D"}
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${getEstadoLabelBadgeClass(servicio.estado)}`}>
                      {getEstadoLabel(servicio.estado)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Warning Badge for Problematic customer */}
        {cliente?.clienteProblematico && (
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-500/20 flex items-center gap-1.5 self-start sm:self-auto">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Alerta: Cliente Conflictivo</span>
          </div>
        )}
      </div>

      {/* Main Accordion-styled Page Container */}
      <div className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800/80 rounded-2xl shadow-3xs p-5 sm:p-6 space-y-6">
        
        {/* Row 1: Datos Cliente, Equipo & Desperfecto */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Domicilio del Cliente */}
          <div className="bg-slate-50/50 dark:bg-gray-850 p-4 rounded-xl border border-slate-150 dark:border-gray-800/60 shadow-3xs">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Domicilio de Entrega</h4>
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white leading-relaxed">
              {addressStr}
            </p>
            {cliente?.barrio && (
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                Barrio: <span className="font-medium text-slate-600 dark:text-gray-300">{cliente.barrio}</span>
              </p>
            )}
            {cliente?.zona && (
              <p className="text-xs text-slate-400 dark:text-gray-500">
                Zona de Reparación: <span className="font-medium text-slate-600 dark:text-gray-300">{cliente.zona}</span>
              </p>
            )}
          </div>

          {/* Datos del Equipo */}
          <div className="bg-slate-50/50 dark:bg-gray-850 p-4 rounded-xl border border-slate-150 dark:border-gray-800/60 shadow-3xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Datos del Equipo</h4>
              </div>
              <button
                type="button"
                onClick={handleLoadEquiposHistory}
                title="Ver historial de reparaciones de este cliente"
                className="p-1.5 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-indigo-150 dark:hover:border-indigo-900/30 shadow-3xs"
              >
                <Wrench className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5 text-xs">
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                {servicio.aparato} - {servicio.marcaModelo}
              </p>
              {equipo?.serie && (
                <p className="text-slate-500 dark:text-gray-400">
                  Nº de Serie: <span className="font-mono text-slate-700 dark:text-gray-200 bg-slate-100 dark:bg-gray-800 px-1 py-0.5 rounded">{equipo.serie}</span>
                </p>
              )}
              {equipo?.observaciones && (
                <p className="text-slate-400 dark:text-gray-500 italic mt-1">
                  Observaciones: "{equipo.observaciones}"
                </p>
              )}
              {profile?.rol !== "tecnico" && servicio.infoLogistica && (
                <p className="text-slate-500 dark:text-gray-400 font-semibold mt-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-450" />
                  <span>Retiro: {servicio.infoLogistica}</span>
                </p>
              )}
            </div>
          </div>

          {/* Desperfecto reportado por el usuario */}
          <div className="bg-slate-50/50 dark:bg-gray-850 p-4 rounded-xl border border-slate-150 dark:border-gray-800/60 shadow-3xs">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Desperfecto Usuario</h4>
            </div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/10 p-2.5 rounded-lg border border-amber-100/50 dark:border-amber-950/20 italic leading-relaxed">
              "{servicio.desperfectoUsuario || "No se ha detallado un desperfecto específico."}"
            </p>
          </div>

        </div>

        {/* Row 2: Technician Form Inputs */}
        <div className="border-t border-slate-150 dark:border-gray-800/80 pt-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 dark:text-gray-300">
              Panel de Diagnóstico Técnico
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Referencias Internas */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Reseña Interna Servicios
              </label>
              <textarea
                value={editNotasInternas}
                onChange={(e) => setEditNotasInternas(e.target.value)}
                placeholder="Escriba comentarios, códigos internos, estado general o notas confidenciales de taller..."
                rows={3}
                disabled={isConsulta}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Servicios Requeridos */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Servicios Requeridos / Diagnóstico Técnico <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editDiagnostico}
                onChange={(e) => setEditDiagnostico(e.target.value)}
                placeholder="Describa el trabajo técnico a realizar (ej: Cambio de rulemanes, reparación de placa, etc.)..."
                rows={3}
                disabled={isConsulta}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Repuestos Necesarios (Opcional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
              Repuestos Necesarios <span className="text-slate-400 lowercase font-semibold">(opcional)</span>
            </label>
            <textarea
              value={editRepuestosComprar}
              onChange={(e) => setEditRepuestosComprar(e.target.value)}
              placeholder="Indique si se necesitan repuestos para concretar la reparación..."
              rows={2}
              disabled={isConsulta}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Row 3: Fotos de Respaldo & Documentos */}
        {profile?.rol !== "tecnico" && (
          <div className="border-t border-slate-150 dark:border-gray-800/80 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 dark:text-gray-300">
                  Fotos de Respaldo y Documentación
                </h4>
              </div>

              {!isConsulta && (
                <div className="relative">
                  <input
                    type="file"
                    id="file-attachment"
                    disabled={uploading}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-attachment"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-55 hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 font-semibold text-[10px] rounded-lg shadow-2xs border border-gray-200 dark:border-gray-700 cursor-pointer ${uploading ? "opacity-50" : ""}`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? "Subiendo..." : "Adjuntar Archivo"}</span>
                  </label>
                </div>
              )}
            </div>

            {/* Drive photos rendering */}
            {servicio.fotosDrive && servicio.fotosDrive.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {servicio.fotosDrive.map((photo, i) => (
                  <div key={photo.id || i} className="group relative aspect-square bg-white dark:bg-gray-850 border border-slate-150 dark:border-gray-800 rounded-xl overflow-hidden shadow-3xs flex flex-col items-center justify-center p-3">
                    <div className="w-8 h-8 rounded bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-1">
                      <FileImage className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 text-center truncate w-full px-1">
                      {photo.name || `Foto_${i + 1}.jpg`}
                    </span>
                    <span className="text-[9px] text-gray-400 mt-0.5">#{i + 1}</span>

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center gap-1">
                      <span className="text-[9px] font-medium text-white truncate w-full px-1">{photo.name}</span>
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] rounded transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        Ver en Drive
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No hay fotos de respaldo cargadas en Google Drive.</p>
            )}

            {/* Firebase Storage files rendering */}
            {filesList.length > 0 && (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {filesList.map((file, i) => (
                  <div key={i} className="p-2.5 bg-slate-55/40 dark:bg-gray-850 border border-slate-150 dark:border-gray-800 rounded-xl flex items-center justify-between gap-3 shadow-3xs">
                    <div className="min-w-0 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-gray-750 dark:text-gray-300 truncate" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 hover:bg-indigo-500/10 text-indigo-600 rounded transition-colors shrink-0"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Row 3.5: Logística / Entrega (Cita & Horarios) */}
        {profile?.rol !== "tecnico" && (
          <div className="border-t border-slate-150 dark:border-gray-800/80 pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 dark:text-gray-300 flex items-center gap-1.5">
                <span>Planificación de Entrega / Logística</span>
                {profile?.rol === "logistica" && (
                  <span className="text-[9px] font-extrabold text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 px-2 py-0.5 rounded tracking-wide uppercase">
                    Obligatorio
                  </span>
                )}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Fecha de Entrega */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Fecha de Entrega {profile?.rol === "logistica" && <span className="text-red-500 font-extrabold">*</span>}
                </label>
                <input
                  type="date"
                  value={editCitaEntrega}
                  onChange={(e) => setEditCitaEntrega(e.target.value)}
                  disabled={isConsulta}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                />
              </div>

              {/* Hora Desde */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Horario Desde (HH:MM) {profile?.rol === "logistica" && <span className="text-red-500 font-extrabold">*</span>}
                </label>
                <input
                  type="text"
                  value={editHoraEntregaDesde}
                  onChange={(e) => setEditHoraEntregaDesde(e.target.value.replace(/[^\d:]/g, ""))}
                  placeholder="Ej: 09:00"
                  disabled={isConsulta}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              {/* Hora Hasta */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Horario Hasta (HH:MM) {profile?.rol === "logistica" && <span className="text-red-500 font-extrabold">*</span>}
                </label>
                <input
                  type="text"
                  value={editHoraEntregaHasta}
                  onChange={(e) => setEditHoraEntregaHasta(e.target.value.replace(/[^\d:]/g, ""))}
                  placeholder="Ej: 12:00"
                  disabled={isConsulta}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            {/* Info Logística */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Observaciones de Logística / Envío {profile?.rol === "logistica" && <span className="text-red-500 font-extrabold">*</span>}
              </label>
              <textarea
                value={editInfoLogistica}
                onChange={(e) => setEditInfoLogistica(e.target.value)}
                placeholder="Indique indicaciones del reparto, observaciones, etc."
                rows={2}
                disabled={isConsulta}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Row 4: Admin Panel (Presupuesto & Convenios) */}
        {isAdmin && (
          <div className="border-t border-slate-150 dark:border-gray-800/80 pt-5 space-y-4">
            
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Handshake className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-800 dark:text-gray-300">
                  Panel de servicios convenidos
                </h4>
              </div>
              
              {(() => {
                const rawPhone = cliente?.telCel || cliente?.telCelBis || cliente?.telCelOtro || cliente?.telFijo || "";
                const cleanPhone = rawPhone.replace(/\D/g, "");
                if (!cleanPhone) return null;
                // Prepend Argentina country code if not already present
                const intlPhone = cleanPhone.startsWith("54") ? cleanPhone : `54${cleanPhone}`;
                return (
                  <a
                    href={`https://wa.me/${intlPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Escribirle al Cliente</span>
                  </a>
                );
              })()}
            </div>

            {/* Detailed Convenios description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                Servicios Convenidos <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editServiciosConvenidos}
                onChange={(e) => setEditServiciosConvenidos(e.target.value)}
                placeholder="Escriba los servicios convenidos con el cliente..."
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Presupuesto (Text-only) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Presupuesto
                </label>
                {isAdmin && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPresupuestado}
                      onChange={(e) => setEditPresupuestado(e.target.checked)}
                      className="rounded border-slate-200 dark:border-gray-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">¿Presupuestado?</span>
                  </label>
                )}
              </div>
              <input
                type="text"
                value={editPresupuestoTexto}
                onChange={(e) => setEditPresupuestoTexto(e.target.value)}
                placeholder="Ej. $45000, A convenir, Sin cargo..."
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-medium rounded-xl border border-slate-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

          </div>
        )}



        {/* Row 6: Action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 dark:border-gray-800 pt-4 mt-2">
          <div>
            {isSaveDisabled && (
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500">
                * Complete todos los campos obligatorios para guardar.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(navigationData?.fromView || "servicios")}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
            >
              Cancelar
            </button>
            
            {profile?.rol === "tecnico" ? (
              <>
                {/* 1. If RECIBIDO, show DIAGNOSTICADO */}
                {servicio.estado === "RECIBIDO" && (
                  <button
                    type="button"
                    disabled={submitting || isSaveDisabled}
                    onClick={async () => {
                      setEditEstado("EN_ESPERA");
                      setTimeout(() => handleSave("EN_ESPERA", false, "Técnico guardó el diagnóstico y marcó como DIAGNOSTICADO"), 100);
                    }}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 dark:disabled:bg-gray-800 disabled:text-slate-450 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>DIAGNOSTICADO</span>
                      </>
                    )}
                  </button>
                )}

                {/* 2. If ACEPTADO, show TERMINADO */}
                {servicio.estado === "ACEPTADO" && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleTerminado()}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 dark:disabled:bg-gray-800 disabled:text-slate-450 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>TERMINADO</span>
                      </>
                    )}
                  </button>
                )}

                {/* 3. Guardar button is always available for technician */}
                <button
                  type="button"
                  disabled={submitting || isSaveDisabled}
                  onClick={() => handleSave()}
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 dark:disabled:bg-gray-800 disabled:text-slate-450 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                {/* Admin/Superadmin confirm and reject buttons */}
                {isAdmin && servicio.estado === "EN_ESPERA" && (
                  <>
                    <button
                      type="button"
                      disabled={submitting || isSaveDisabled}
                      onClick={async () => {
                        await handleSave("ACEPTADO", false, "Administrador confirmó la reparación");
                      }}
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 dark:disabled:bg-gray-800 disabled:text-slate-450 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer uppercase"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Confirmar Reparación</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={submitting || isSaveDisabled}
                      onClick={async () => {
                        await handleSave("RECHAZADO", false, "Administrador rechazó la reparación");
                      }}
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-100 dark:disabled:bg-gray-800 disabled:text-slate-450 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer uppercase"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Rechazar</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {/* Confirm repair option if not in EN_ESPERA but in eligible state */}
                {isAdmin && servicio.estado !== "EN_ESPERA" && editEstado !== "ACEPTADO" && editEstado !== "EN_REPARACION" && editEstado !== "LISTO_PARA_ENTREGA" && editEstado !== "ENTREGADO" && (
                  <button
                    type="button"
                    disabled={submitting || isSaveDisabled}
                    onClick={async () => {
                      await handleSave("ACEPTADO", false, "Administrador confirmó la reparación");
                    }}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 dark:disabled:bg-gray-800 disabled:text-slate-450 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer uppercase"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Confirmar Reparación</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  disabled={submitting || isSaveDisabled}
                  onClick={() => handleSave()}
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 dark:disabled:bg-gray-800 disabled:text-slate-450 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar Modificaciones</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col animate-fade-in">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center bg-slate-50/50 dark:bg-gray-850">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Historial de Reparaciones del Cliente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-450 hover:text-slate-655 dark:text-gray-500 dark:hover:text-gray-300 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : historyServices.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-gray-400 italic text-center py-6">
                  No se registran órdenes de servicio anteriores para este cliente.
                </p>
              ) : (
                <div className="space-y-4">
                  {historyServices.map((histSrv) => (
                    <div
                      key={histSrv.id}
                      className="p-4 bg-slate-55/50 dark:bg-gray-850 border border-slate-150 dark:border-gray-800 rounded-xl space-y-2.5 shadow-3xs hover:border-indigo-150 dark:hover:border-indigo-900/30 transition-all"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                            Orden #{histSrv.numeroServicio}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {toDate(histSrv.fechaIngreso)?.toLocaleDateString() || "Sin Fecha"}
                          </span>
                        </div>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${getEstadoLabelBadgeClass(histSrv.estado)}`}>
                          {getEstadoLabel(histSrv.estado)}
                        </span>
                      </div>

                      <div className="text-xs space-y-1">
                        <p className="font-bold text-slate-800 dark:text-white">
                          {histSrv.aparato} - {histSrv.marcaModelo}
                        </p>
                        
                        <div className="mt-2 space-y-1 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-slate-100 dark:border-gray-850">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Desperfecto Reportado:</p>
                          <p className="text-slate-600 dark:text-gray-300 italic">"{histSrv.desperfectoUsuario || "No detallado"}"</p>
                        </div>

                        {(histSrv.diagnostico || histSrv.serviciosRequeridos) && (
                          <div className="mt-2 space-y-1 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-slate-100 dark:border-gray-850">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Trabajo Técnico Realizado:</p>
                            <p className="text-slate-600 dark:text-gray-350">{histSrv.diagnostico || histSrv.serviciosRequeridos}</p>
                          </div>
                        )}

                        {histSrv.serviciosConvenidos && (
                          <div className="mt-2 space-y-1 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-slate-100 dark:border-gray-850">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Servicios Convenidos / Notas:</p>
                            <p className="text-slate-655 dark:text-gray-350">{histSrv.serviciosConvenidos}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-gray-800 flex justify-end bg-slate-50/50 dark:bg-gray-855">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
