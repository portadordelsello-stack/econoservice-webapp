import React, { useEffect, useState, useRef } from "react";
import { ServiciosService, ClientesService, EquiposService, TecnicosService, toDate, StockService, NotificationsService } from "../services/db";
import { Servicio, Cliente, Equipo, Tecnico, Historial, EstadoServicio, getEstadoLabel } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
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
  ChevronLeft,
  ChevronRight
} from "lucide-react";

type TabType = 
  | "generales" 
  | "cliente" 
  | "equipo" 
  | "diagnostico" 
  | "presupuesto" 
  | "repuestos" 
  | "logistica" 
  | "archivos" 
  | "historial";

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
  const { selectedId, navigate } = useNavigation();

  // Primary data states
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab state
  const [activeTab, setActiveTab] = useState<TabType>("generales");
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: "left" | "right") => {
    if (tabsContainerRef.current) {
      const scrollAmount = 200;
      tabsContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  // Form field edit states
  const [editEstado, setEditEstado] = useState<EstadoServicio>("RECIBIDO");
  const [editTecnicoId, setEditTecnicoId] = useState("");
  const [editDiagnostico, setEditDiagnostico] = useState("");
  const [editRepuestosComprar, setEditRepuestosComprar] = useState("");
  const [editRepuestosComprados, setEditRepuestosComprados] = useState("");
  
  // Budget values
  const [editPresupuesto, setEditPresupuesto] = useState(0);
  const [editPresupuestoTexto, setEditPresupuestoTexto] = useState("");
  
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
  const [editInfoLogistica, setEditInfoLogistica] = useState("");

  // Logistics Dates
  const [editCitaDia, setEditCitaDia] = useState("");
  const [editCitaEntrega, setEditCitaEntrega] = useState("");
  const [editHoraEntregaDesde, setEditHoraEntregaDesde] = useState("");
  const [editHoraEntregaHasta, setEditHoraEntregaHasta] = useState("");

  // File Upload states
  const [filesList, setFilesList] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

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

      // Sync form fields with DB immediately (doesn't depend on other documents)
      setEditEstado(serv.estado);
      setEditTecnicoId(serv.tecnicoId || "");
      setEditDiagnostico(serv.diagnostico || "");
      setEditRepuestosComprar(serv.repuestosComprar || "");
      setEditRepuestosComprados(serv.repuestosComprados || "");
      setEditPresupuesto(serv.presupuesto || 0);
      setEditPresupuestoTexto(serv.presupuestoTexto || "");
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
      let initialNotas = serv.notasInternas || "";
      if (!initialNotas && serv.diagnostico) {
        const diag = serv.diagnostico;
        const notasIndex = diag.indexOf("[Notas Internas]\n");
        if (notasIndex !== -1) {
          const nextHeaderIndex = diag.indexOf("[", notasIndex + 17);
          initialNotas = diag.substring(notasIndex + 17, nextHeaderIndex !== -1 ? nextHeaderIndex : undefined).trim();
        } else if (diag.startsWith("Notas: ")) {
          initialNotas = diag.substring(7).trim();
        } else if (!diag.includes("[Servicios Requeridos]")) {
          initialNotas = diag.trim();
        }
      }
      setEditNotasInternas(initialNotas);
      setEditInfoLogistica(serv.infoLogistica || "");
      
      // Sync Logistics dates
      if (serv.citaDia) {
        try {
          const dateVal = toDate(serv.citaDia);
          if (dateVal && !isNaN(dateVal.getTime())) {
            setEditCitaDia(dateVal.toISOString().split("T")[0]);
          }
        } catch (dateErr) {
          console.warn("Error parsing citaDia:", dateErr);
        }
      }
      if (serv.citaEntrega) {
        try {
          const dateVal = toDate(serv.citaEntrega);
          if (dateVal && !isNaN(dateVal.getTime())) {
            setEditCitaEntrega(dateVal.toISOString().split("T")[0]);
          }
        } catch (dateErr) {
          console.warn("Error parsing citaEntrega:", dateErr);
        }
      }
      setEditHoraEntregaDesde(serv.horaEntregaDesde || "");
      setEditHoraEntregaHasta(serv.horaEntregaHasta || "");

      // Load related client (Isolated)
      if (serv.clienteId) {
        try {
          const cli = await ClientesService.getById(serv.clienteId);
          setCliente(cli);
        } catch (cliErr) {
          console.error("Error loading related client:", cliErr);
        }
      }

      // Load related equipment (Isolated)
      if (serv.equipoId) {
        try {
          const eq = await EquiposService.getById(serv.equipoId);
          setEquipo(eq);
        } catch (eqErr) {
          console.error("Error loading related equipment:", eqErr);
        }
      }

      // Load technicians list (Isolated)
      try {
        const tecList = await TecnicosService.getAll();
        setTecnicos(tecList);
      } catch (tecErr) {
        console.error("Error loading technicians list:", tecErr);
      }

      // Load historical logs (Isolated)
      try {
        const histList = await ServiciosService.getHistorial(selectedId);
        setHistorial(histList);
      } catch (histErr) {
        console.error("Error loading historical timeline:", histErr);
      }

      // Load uploaded files list from Firebase Storage (Asynchronously in background)
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
      
      fetchStorageFiles();

    } catch (err) {
      console.error("Error loading primary service details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServiceDetails();
  }, [selectedId]);

  // Auth permissions
  const isAdmin = profile?.rol === "superadmin";
  const isRecepcion = profile?.rol === "superadmin" || profile?.rol === "logistica";
  const isTecnico = profile?.rol === "tecnico" || profile?.rol === "superadmin";
  const isConsulta = profile?.rol === "administracion" || profile?.rol === "consulta" || (!isAdmin && !isRecepcion && !isTecnico);

  const syncRepuestosToStock = async (repuestosText: string) => {
    if (!repuestosText || !repuestosText.trim() || !servicio) return;

    // Split by commas, semicolons, or newlines
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

        // Crear una notificación para el Taller (Técnicos)
        await NotificationsService.create({
          targetRole: "tecnico",
          title: "Repuesto Disponible en Stock 📦",
          message: `El repuesto "${item}" para "${servicio.aparato || ''} ${servicio.marcaModelo || ''}" (Orden #${servicio.numeroServicio || ''}) ya se encuentra en Stock.`,
          serviceId: servicio.id || ""
        });
      }
    } catch (err) {
      console.error("Error syncing repuestos to stock:", err);
    }
  };

  // Action Save changes
  const handleSave = async (tab: TabType, textMessage?: string) => {
    if (!selectedId || !profile) return;
    try {
      let fieldsToUpdate: Partial<Servicio> = {};

      if (tab === "generales") {
        fieldsToUpdate = {
          estado: editEstado,
          tecnicoId: editTecnicoId || undefined,
          garantia: editGarantia,
          esReclamoGarantia: editEsReclamoGarantia,
          ingresoTaller: editIngresoTaller,
          terminado: editTerminado,
          entregado: editEntregado,
          factura: editFactura,
          contado: editContado,
          notasInternas: editNotasInternas
        };
      } else if (tab === "diagnostico") {
        fieldsToUpdate = {
          diagnostico: editDiagnostico,
          estado: editEstado, // Technicians can modify state to 'DIAGNOSTICO' or 'PENDIENTE_APROBACION'
          tecnicoId: editTecnicoId || undefined
        };
      } else if (tab === "presupuesto") {
        fieldsToUpdate = {
          presupuesto: Number(editPresupuesto) || 0,
          presupuestoTexto: editPresupuestoTexto,
          acepta: editAcepta,
          rechazaDevolver: editRechazaDevolver,
          estado: editAcepta ? "EN_REPARACION" : editRechazaDevolver ? "CANCELADO" : editEstado
        };
      } else if (tab === "repuestos") {
        fieldsToUpdate = {
          repuestosComprar: editRepuestosComprar,
          repuestosComprados: editRepuestosComprados,
          pasaStock: editPasaStock
        };
      } else if (tab === "logistica") {
        fieldsToUpdate = {
          citaDia: editCitaDia ? new Date(editCitaDia) : undefined,
          citaEntrega: editCitaEntrega ? new Date(editCitaEntrega) : undefined,
          horaEntregaDesde: editHoraEntregaDesde,
          horaEntregaHasta: editHoraEntregaHasta,
          infoLogistica: editInfoLogistica
        };
      }

      await ServiciosService.update(
        selectedId,
        fieldsToUpdate,
        profile.uid,
        profile.nombre,
        textMessage || `Campos actualizados en la pestaña de ${tab.toUpperCase()}`
      );

      // Workflow notification triggers from DetalleServicio edits
      const newStatus = fieldsToUpdate.estado || editEstado;
      if (tab === "diagnostico" && (newStatus === "EN_ESPERA" || newStatus === "DIAGNOSTICO")) {
        await NotificationsService.create({
          targetRole: "admin",
          title: "Diagnóstico Completo",
          message: `El Taller completó el diagnóstico del Servicio #${servicio.numeroServicio}. Comunicar presupuesto.`,
          serviceId: selectedId
        });
      } else if (tab === "presupuesto" && editAcepta) {
        await NotificationsService.create({
          targetRole: "taller",
          title: "Presupuesto Aceptado",
          message: `El cliente aceptó el presupuesto del Servicio #${servicio.numeroServicio}. Iniciar reparación.`,
          serviceId: selectedId
        });
      }

      // Sincronizar automáticamente con el Stock Central (Inventario)
      if (tab === "repuestos" && editRepuestosComprados) {
        await syncRepuestosToStock(editRepuestosComprados);
      }

      // Refresh details
      await loadServiceDetails();
      alert("¡Cambios guardados con éxito!");
    } catch (err) {
      console.error("Error saving changes:", err);
      alert("No se pudieron guardar los cambios. Verifique sus permisos de red o rol.");
    }
  };

  // Upload Attachment Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedId) return;
    const file = e.target.files[0];
    try {
      setUploading(true);
      const fileRef = ref(storage, `servicios/${selectedId}/${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);

      // Log to history
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

  const getStatusBadgeColor = (status: EstadoServicio) => {
    switch (status) {
      case "RECIBIDO":
        return "bg-blue-500 text-white";
      case "DIAGNOSTICO":
        return "bg-purple-500 text-white";
      case "PENDIENTE_APROBACION":
        return "bg-indigo-600 text-white";
      case "EN_REPARACION":
        return "bg-orange-500 text-white";
      case "LISTO_PARA_ENTREGA":
        return "bg-indigo-500 text-white";
      case "ENTREGA_EN_PROGRESO":
        return "bg-amber-500 text-white";
      case "ENTREGADO":
        return "bg-emerald-500 text-white";
      case "CANCELADO":
        return "bg-rose-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  if (loading || !servicio) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Upper header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("servicios")}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer shrink-0 active:scale-95 group"
            title="Volver a la lista de servicios"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver</span>
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                Ficha de Servicio #{servicio.numeroServicio}
              </h1>
              <span className={`px-3 py-0.5 text-xs font-bold rounded-full uppercase ${getStatusBadgeColor(servicio.estado)}`}>
                {getEstadoLabel(servicio.estado)}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Aparato: <span className="font-bold">{servicio.aparato}</span> ({servicio.marcaModelo})
            </p>
          </div>
        </div>

        {/* Warning Badge for Problematic customer */}
        {cliente?.clienteProblematico && (
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-500/20 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Alerta: Cliente Conflictivo</span>
          </div>
        )}
      </div>

      {/* Tabs list selector */}
      <div className="relative flex items-center">
        {/* Left Scroll Arrow */}
        <button
          onClick={() => scrollTabs("left")}
          className="absolute left-0 z-10 p-1.5 rounded-full border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white shadow-sm hover:shadow-md cursor-pointer transition-all hover:scale-110 active:scale-95 flex items-center justify-center mr-1"
          title="Desplazar a la izquierda"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Scrollable tab bar */}
        <div 
          ref={tabsContainerRef}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto border-b border-gray-100 dark:border-gray-800 pb-px scrollbar-none mx-8 scroll-smooth"
        >
          {[
            { id: "generales", label: "Datos Generales", icon: Activity },
            { id: "cliente", label: "Cliente", icon: User },
            { id: "equipo", label: "Equipo", icon: Laptop },
            { id: "diagnostico", label: "Diagnóstico", icon: ShieldCheck },
            { id: "presupuesto", label: "Presupuesto", icon: DollarSign },
            { id: "repuestos", label: "Repuestos", icon: Wrench },
            { id: "logistica", label: "Logística", icon: Truck },
            { id: "archivos", label: "Archivos", icon: FileText },
            { id: "historial", label: "Historial", icon: History }
          ].map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600 font-bold"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-100"
                }`}
              >
                <IconComponent className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Scroll Arrow */}
        <button
          onClick={() => scrollTabs("right")}
          className="absolute right-0 z-10 p-1.5 rounded-full border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white shadow-sm hover:shadow-md cursor-pointer transition-all hover:scale-110 active:scale-95 flex items-center justify-center ml-1"
          title="Desplazar a la derecha"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* TAB 1: DATOS GENERALES */}
      {activeTab === "generales" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Estado e Ingreso del Taller</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Status & Tech assign */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Estado Actual de Reparación
                </label>
                <select
                  disabled={isConsulta || (!isRecepcion && !isTecnico)}
                  value={editEstado}
                  onChange={(e) => setEditEstado(e.target.value as EstadoServicio)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-750 rounded-xl text-sm focus:outline-none"
                >
                  <option value="RECIBIDO">Recibido</option>
                  <option value="DIAGNOSTICO">En Diagnóstico</option>
                  <option value="PENDIENTE_APROBACION">Pendiente Aprobación</option>
                  <option value="EN_REPARACION">En Reparación</option>
                  <option value="LISTO_PARA_ENTREGA">Listo para Entrega</option>
                  <option value="ENTREGA_EN_PROGRESO">Entrega en Progreso</option>
                  <option value="ENTREGADO">Entregado</option>
                  <option value="CANCELADO">Cancelado</option>
                  <option value="EN_ESPERA">En Espera</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Técnico Encargado
                </label>
                <select
                  disabled={isConsulta || !isRecepcion}
                  value={editTecnicoId}
                  onChange={(e) => setEditTecnicoId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-750 rounded-xl text-sm focus:outline-none"
                >
                  <option value="">-- Sin asignar --</option>
                  {tecnicos.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Checkboxes parameters */}
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Toggles Administrativos</span>
              
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isConsulta || !isRecepcion}
                    checked={editGarantia}
                    onChange={(e) => setEditGarantia(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-600 border-gray-300"
                  />
                  <span>Garantía Local</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isConsulta || !isRecepcion}
                    checked={editEsReclamoGarantia}
                    onChange={(e) => setEditEsReclamoGarantia(e.target.checked)}
                    className="rounded text-red-500 focus:ring-red-500 border-gray-300"
                  />
                  <span className="text-red-500 font-medium">Reclamo por Garantía</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isConsulta || !isRecepcion}
                    checked={editIngresoTaller}
                    onChange={(e) => setEditIngresoTaller(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-600 border-gray-300"
                  />
                  <span>Ingreso Físico Taller</span>
                </label>
              </div>
            </div>

            {/* Payments & status */}
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col justify-center">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Entrega y Pagos</span>
              
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isConsulta || (!isRecepcion && !isTecnico)}
                    checked={editTerminado}
                    onChange={(e) => setEditTerminado(e.target.checked)}
                    className="rounded text-indigo-600 border-gray-300"
                  />
                  <span className="font-semibold text-indigo-500">¿Reparación Terminada?</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isConsulta || !isRecepcion}
                    checked={editEntregado}
                    onChange={(e) => setEditEntregado(e.target.checked)}
                    className="rounded text-indigo-600 border-gray-300"
                  />
                  <span className="font-semibold text-emerald-500">¿Entregado a Cliente?</span>
                </label>

                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isConsulta || !isRecepcion}
                      checked={editFactura}
                      onChange={(e) => setEditFactura(e.target.checked)}
                      className="rounded text-indigo-600 border-gray-300"
                    />
                    <span>Factura</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isConsulta || !isRecepcion}
                      checked={editContado}
                      onChange={(e) => setEditContado(e.target.checked)}
                      className="rounded text-indigo-600 border-gray-300"
                    />
                    <span>Contado</span>
                  </label>
                </div>
              </div>
            </div>

          </div>

          {/* Notas internas */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Notas Internas y de Taller
            </label>
            <textarea
              rows={3}
              disabled={isConsulta || (!isRecepcion && !isTecnico)}
              value={editNotasInternas}
              onChange={(e) => setEditNotasInternas(e.target.value)}
              placeholder="Escriba comentarios para uso interno de secretaría o taller..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
            />
          </div>

          {!isConsulta && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleSave("generales", "Actualización general de datos y estado")}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Guardar Modificaciones
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLIENTE */}
      {activeTab === "cliente" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            Ficha del Cliente
          </h2>
          
          {cliente ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Identificación</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>{cliente.nombreApellido}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold border border-indigo-100 dark:border-indigo-900/30">
                    ID: {formatClienteId(cliente)}
                  </span>
                </h3>
                
                <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 pt-1">
                  <p><span className="font-semibold text-gray-400 mr-2">Celular Principal:</span> {cliente.telCel || "Sin registrar"}</p>
                  <p><span className="font-semibold text-gray-400 mr-2">Tel. Fijo:</span> {cliente.telFijo || "Sin registrar"}</p>
                  <p><span className="font-semibold text-gray-400 mr-2">Celular Bis:</span> {cliente.telCelBis || "Sin registrar"}</p>
                  <p><span className="font-semibold text-gray-400 mr-2">Celular Otro:</span> {cliente.telCelOtro || "Sin registrar"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Ubicación</span>
                <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                  <p><span className="font-semibold text-gray-400 mr-2">Localidad / Zona:</span> {cliente.localidad || "Sin registrar"} {cliente.zona ? `(${cliente.zona})` : ""}</p>
                  <p><span className="font-semibold text-gray-400 mr-2">Barrio:</span> {cliente.barrio || "Sin registrar"}</p>
                  <p><span className="font-semibold text-gray-400 mr-2">Calle y Número:</span> {cliente.calle} {cliente.numero}</p>
                  {(cliente.piso || cliente.depto) && (
                    <p><span className="font-semibold text-gray-400 mr-2">Piso / Depto:</span> {cliente.piso ? `Piso ${cliente.piso}` : ""} {cliente.depto ? `Depto ${cliente.depto}` : ""}</p>
                  )}
                </div>
              </div>

              {cliente.observaciones && (
                <div className="col-span-full p-4 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100 dark:border-gray-800">
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notas Históricas del Cliente</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{cliente.observaciones}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm italic text-gray-400">Cargando datos del cliente propietario...</p>
          )}
        </div>
      )}

      {/* TAB 3: EQUIPO */}
      {activeTab === "equipo" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Laptop className="w-5 h-5 text-indigo-600" />
            Especificaciones Técnicas del Equipo
          </h2>

          {equipo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">{equipo.tipo}</p>
                <p><span className="font-semibold text-gray-400 mr-2">Marca:</span> {equipo.marca}</p>
                <p><span className="font-semibold text-gray-400 mr-2">Modelo:</span> {equipo.modelo}</p>
                <p><span className="font-semibold text-gray-400 mr-2">N° de Serie:</span> <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">{equipo.serie || "S/N"}</span></p>
              </div>

              {equipo.observaciones && (
                <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100 dark:border-gray-800/80">
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Detalles de Fábrica o Carcasa</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{equipo.observaciones}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm italic text-gray-400">Cargando datos del equipo...</p>
          )}
        </div>
      )}

      {/* TAB 4: DIAGNÓSTICO */}
      {activeTab === "diagnostico" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Informe Técnico y Diagnóstico
          </h2>

          <div className="space-y-4">
            
            {/* Desperfecto inicial */}
            <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
              <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Problema Reportado por Recepción</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{servicio.desperfectoUsuario}"</p>
            </div>

            {/* Técnico detail */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Técnico que Diagnostica
              </label>
              <select
                disabled={isConsulta || !isRecepcion}
                value={editTecnicoId}
                onChange={(e) => setEditTecnicoId(e.target.value)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-750 rounded-xl text-sm focus:outline-none"
              >
                <option value="">-- Sin asignar --</option>
                {tecnicos.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>

            {/* Diagnóstico text */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Diagnóstico Técnico Detallado *
              </label>
              <textarea
                rows={5}
                disabled={isConsulta || (!isRecepcion && !isTecnico)}
                value={editDiagnostico}
                onChange={(e) => setEditDiagnostico(e.target.value)}
                placeholder="Escriba los desperfectos encontrados, mediciones eléctricas, componentes quemados..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
              />
            </div>

          </div>

          {!isConsulta && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-50 dark:border-gray-800/50">
              <button
                type="button"
                onClick={async () => {
                  setEditEstado("DIAGNOSTICO");
                  setTimeout(() => handleSave("diagnostico", "Técnico actualizó diagnóstico e inició etapa de DIAGNÓSTICO"), 100);
                }}
                className="px-4 py-2 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Marcar como "EN DIAGNÓSTICO"
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  setEditEstado("PENDIENTE_APROBACION");
                  setTimeout(() => handleSave("diagnostico", "Diagnóstico finalizado. Presupuesto listo para enviar a cliente"), 100);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Diagnóstico Listo
              </button>
            </div>
          )}

        </div>
      )}

      {/* TAB 5: PRESUPUESTO */}
      {activeTab === "presupuesto" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            Cálculo y Aprobación de Presupuesto
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Monto Total del Presupuesto ($)
                </label>
                <input
                  type="number"
                  disabled={isConsulta || !isRecepcion}
                  value={editPresupuesto}
                  onChange={(e) => setEditPresupuesto(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-750 rounded-xl text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Detalle del Presupuesto (Texto para cliente)
                </label>
                <textarea
                  rows={4}
                  disabled={isConsulta || !isRecepcion}
                  value={editPresupuestoTexto}
                  onChange={(e) => setEditPresupuestoTexto(e.target.value)}
                  placeholder="Ej. Cambio de bomba de desagote Drean original + rulemanes SKF y retén. Mano de obra incluida."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none text-xs"
                />
              </div>
            </div>

            {/* Right Customer decision panels */}
            <div className="p-5 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col justify-center space-y-4">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Resolución del Cliente</span>
              
              <div className="space-y-4 text-sm">
                
                <label className="relative flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isConsulta || !isRecepcion}
                    checked={editAcepta}
                    onChange={(e) => {
                      setEditAcepta(e.target.checked);
                      if (e.target.checked) setEditRechazaDevolver(false);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Acepta Presupuesto (Pasa a Reparación)</span>
                </label>

                <label className="relative flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isConsulta || !isRecepcion}
                    checked={editRechazaDevolver}
                    onChange={(e) => {
                      setEditRechazaDevolver(e.target.checked);
                      if (e.target.checked) setEditAcepta(false);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">Rechaza y Devolver (Pasa a Devolución)</span>
                </label>

              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                Al marcar **Acepta**, el estado cambiará automáticamente a **EN REPARACIÓN** al guardar. Al marcar **Rechaza**, se cambiará a **CANCELADO**.
              </p>
            </div>

          </div>

          {!isConsulta && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  let auditText = `Presupuesto guardado por $${editPresupuesto}.`;
                  if (editAcepta) auditText += " Presupuesto aprobado por el cliente.";
                  if (editRechazaDevolver) auditText += " Presupuesto RECHAZADO por el cliente.";
                  handleSave("presupuesto", auditText);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Guardar Presupuesto
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: REPUESTOS */}
      {activeTab === "repuestos" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            Repuestos Necesarios y Stock
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Repuestos a Comprar / Solicitar
              </label>
              <textarea
                rows={4}
                disabled={isConsulta || (!isRecepcion && !isTecnico)}
                value={editRepuestosComprar}
                onChange={(e) => setEditRepuestosComprar(e.target.value)}
                placeholder="Enumere las refacciones que se deben comprar en casa de repuestos..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Repuestos Comprados / Disponibles
              </label>
              <textarea
                rows={4}
                disabled={isConsulta || (!isRecepcion && !isTecnico)}
                value={editRepuestosComprados}
                onChange={(e) => setEditRepuestosComprados(e.target.value)}
                placeholder="Refacciones que ya están en el taller listas para colocar..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none text-xs"
              />
            </div>

            <div className="col-span-full pt-2 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isConsulta || !isRecepcion}
                  checked={editPasaStock}
                  onChange={(e) => setEditPasaStock(e.target.checked)}
                  className="rounded text-indigo-600 border-gray-300"
                />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Pasa a Stock de Taller (Registrar cobro de material)</span>
              </label>

              {!isConsulta && (
                <button
                  type="button"
                  onClick={() => handleSave("repuestos", "Información de repuestos para reparación guardada")}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Actualizar Repuestos
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 7: LOGÍSTICA */}
      {activeTab === "logistica" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            Logística y Agenda de Entregas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Dates */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Cita para Diagnóstico / Retiro
                </label>
                <input
                  type="date"
                  disabled={isConsulta || !isRecepcion}
                  value={editCitaDia}
                  onChange={(e) => setEditCitaDia(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-750 rounded-xl text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  Cita para Entrega de Equipo
                </label>
                <input
                  type="date"
                  disabled={isConsulta || !isRecepcion}
                  value={editCitaEntrega}
                  onChange={(e) => setEditCitaEntrega(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-750 rounded-xl text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Time windows */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Hora Desde (Entrega)
                  </label>
                  <input
                    type="text"
                    disabled={isConsulta || !isRecepcion}
                    placeholder="Ej. 10:00"
                    value={editHoraEntregaDesde}
                    onChange={(e) => setEditHoraEntregaDesde(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-750 rounded-xl text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Hora Hasta (Entrega)
                  </label>
                  <input
                    type="text"
                    disabled={isConsulta || !isRecepcion}
                    placeholder="Ej. 13:00"
                    value={editHoraEntregaHasta}
                    onChange={(e) => setEditHoraEntregaHasta(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-750 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Detalles y Datos Logísticos Especiales
                </label>
                <textarea
                  rows={2}
                  disabled={isConsulta || !isRecepcion}
                  value={editInfoLogistica}
                  onChange={(e) => setEditInfoLogistica(e.target.value)}
                  placeholder="Ej. Tocar timbre portón azul, llevar vuelto de $5000..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="col-span-full pt-2 border-t border-gray-50 dark:border-gray-800 flex items-center justify-end">
              {!isConsulta && (
                <button
                  type="button"
                  onClick={() => handleSave("logistica", `Agenda de logística actualizada para la fecha ${editCitaEntrega || editCitaDia}`)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Agendar Cita
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 8: ARCHIVOS */}
      {activeTab === "archivos" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-indigo-600" />
                Documentación y Archivos Adjuntos
              </h2>
              <p className="text-xs text-gray-400">Guarde facturas de repuestos, fotos de la carcasa, o copias firmadas en formato PDF.</p>
            </div>

            {!isConsulta && (
              <div className="relative shrink-0">
                <input
                  type="file"
                  id="file-attachment"
                  disabled={uploading}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="file-attachment"
                  className={`inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-xs rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 cursor-pointer ${uploading ? "opacity-50" : ""}`}
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? "Subiendo..." : "Adjuntar Archivo"}
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {filesList.length === 0 ? (
              <div className="col-span-full border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center text-gray-450 dark:text-gray-500 text-sm">
                No hay archivos adjuntos para este servicio técnico.
              </div>
            ) : (
              filesList.map((file, i) => (
                <div key={i} className="p-4 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 hover:bg-indigo-500/10 text-indigo-600 rounded-lg transition-colors shrink-0"
                    title="Descargar archivo"
                  >
                    <FileDown className="w-4 h-4" />
                  </a>
                </div>
              ))
            )}
          </div>

          {/* Fotos del Equipo en Google Drive */}
          {servicio?.fotosDrive && servicio.fotosDrive.length > 0 && (
            <div className="pt-6 border-t border-gray-150 dark:border-gray-800 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  Fotos del Equipo en Google Drive
                </h3>
                <p className="text-xs text-gray-400">Estas imágenes se subieron automáticamente a la carpeta de Google Drive al ingresar el equipo.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {servicio.fotosDrive.map((photo, i) => (
                  <div key={photo.id || i} className="group relative aspect-square bg-gray-50 dark:bg-gray-800 border border-gray-150 dark:border-gray-850 rounded-xl overflow-hidden shadow-xs hover:border-emerald-500/50 transition-all flex flex-col items-center justify-center p-4">
                    {/* Icon representing the image file */}
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-2">
                      <FileImage className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    {/* Name/Label */}
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center line-clamp-1 truncate w-full px-1">
                      {photo.name || `Foto_${i + 1}.jpg`}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono mt-1">
                      Foto #{i + 1}
                    </span>

                    {/* Hover Overlay with Ver en Drive */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 text-center gap-2">
                      <span className="text-[10px] font-medium text-white line-clamp-1 truncate w-full px-1">{photo.name}</span>
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver en Drive
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: HISTORIAL */}
      {activeTab === "historial" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Historial de Cambios y Bitácora
          </h2>

          <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-4 pl-6 space-y-6 py-2">
            {historial.length === 0 ? (
              <p className="text-sm italic text-gray-400">Cargando bitácora de auditoría...</p>
            ) : (
              historial.map((log) => (
                <div key={log.id} className="relative space-y-1">
                  
                  {/* Circle dot on line */}
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-600 bg-white dark:bg-gray-900" />
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                      {log.accion}
                    </span>
                    <span className="text-xs text-gray-400 font-semibold">
                      {toDate(log.fecha)?.toLocaleString() || "Hace un momento"}
                    </span>
                    <span className="text-xs text-gray-500">
                      por <strong className="text-gray-700 dark:text-gray-300">{log.usuarioNombre}</strong>
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pt-0.5">
                    {log.detalle}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
