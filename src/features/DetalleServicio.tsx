import React, { useEffect, useState } from "react";
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
  MapPin,
  Cpu,
  Phone
} from "lucide-react";

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

      // Sync form fields with DB immediately
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
      setEditNotasInternas(serv.notasInternas || "");

      // Load related client
      if (serv.clienteId) {
        try {
          const cli = await ClientesService.getById(serv.clienteId);
          setCliente(cli);
        } catch (cliErr) {
          console.error("Error loading related client:", cliErr);
        }
      }

      // Load related equipment
      if (serv.equipoId) {
        try {
          const eq = await EquiposService.getById(serv.equipoId);
          setEquipo(eq);
        } catch (eqErr) {
          console.error("Error loading related equipment:", eqErr);
        }
      }

      // Load technicians list
      try {
        const tecList = await TecnicosService.getAll();
        setTecnicos(tecList);
      } catch (tecErr) {
        console.error("Error loading technicians list:", tecErr);
      }

      // Load historical logs
      try {
        const histList = await ServiciosService.getHistorial(selectedId);
        setHistorial(histList);
      } catch (histErr) {
        console.error("Error loading historical timeline:", histErr);
      }

      // Load uploaded files list from Firebase Storage
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
    try {
      const userUid = profile.uid;
      const userNombre = profile.nombre || "Usuario";

      const finalState = isFinished ? "LISTO_PARA_ENTREGA" : (targetState || editEstado);
      const isReparacionTerminada = isFinished !== undefined ? isFinished : editTerminado;

      const fieldsToUpdate: Partial<Servicio> = {
        estado: finalState,
        tecnicoId: editTecnicoId || undefined,
        diagnostico: editDiagnostico,
        serviciosRequeridos: editDiagnostico,
        notasInternas: editNotasInternas,
        repuestosComprar: editRepuestosComprar,
        repuestosComprados: editRepuestosComprados,
        presupuesto: Number(editPresupuesto) || 0,
        presupuestoTexto: editPresupuestoTexto,
        serviciosConvenidos: editPresupuestoTexto,
        acepta: editAcepta,
        rechazaDevolver: editRechazaDevolver,
        garantia: editGarantia,
        esReclamoGarantia: editEsReclamoGarantia,
        ingresoTaller: editIngresoTaller,
        pasaStock: editPasaStock,
        terminado: isReparacionTerminada,
        entregado: editEntregado,
        factura: editFactura,
        contado: editContado
      };

      if (finalState === "ACEPTADO" || finalState === "LISTO_PARA_ENTREGA" || editAcepta) {
        fieldsToUpdate.acepta = true;
        fieldsToUpdate.rechazaDevolver = false;
      } else if (finalState === "RECHAZADO" || editRechazaDevolver) {
        fieldsToUpdate.acepta = false;
        fieldsToUpdate.rechazaDevolver = true;
      }

      await ServiciosService.update(
        selectedId,
        fieldsToUpdate,
        userUid,
        userNombre,
        customAuditText || "Actualización de Orden de Servicio"
      );

      // Workflow triggers
      if (profile?.rol === "tecnico") {
        if (finalState === "EN_ESPERA") {
          await NotificationsService.create({
            targetRole: "admin",
            title: "Diagnóstico Completo",
            message: `El Taller completó el diagnóstico del Servicio #${servicio.numeroServicio}. Comunicar presupuesto.`,
            serviceId: selectedId
          });
        }
      }

      // Sync central stock if parts bought changes
      if (editRepuestosComprados) {
        await syncRepuestosToStock(editRepuestosComprados);
      }

      await loadServiceDetails();
      alert("¡Cambios guardados con éxito!");
    } catch (err) {
      console.error("Error saving changes:", err);
      alert("Error al guardar cambios.");
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
        return "bg-red-500 text-white";
      case "EN_ESPERA":
        return "bg-slate-500 text-white";
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

  // Address construct helper
  const addressStr = cliente
    ? `${cliente.calle || ""} ${cliente.numero || ""}`.trim() +
      (cliente.piso || cliente.depto ? `, Piso ${cliente.piso || "-"} Depto ${cliente.depto || "-"}` : "") +
      `, ${cliente.localidad || "Santo Tomé"}`
    : "Sin Domicilio Registrado";

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-10">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-150 dark:border-gray-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("servicios")}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer shrink-0 active:scale-95 group"
            title="Volver a la lista de taller"
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
              Cliente: <span className="font-bold text-gray-700 dark:text-gray-300">{cliente?.nombreApellido || "Sin nombre"}</span>
            </p>
          </div>
        </div>

        {/* Warning Badge for Problematic customer */}
        {cliente?.clienteProblematico && (
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-500/20 flex items-center gap-1.5 self-start sm:self-auto">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Alerta: Cliente Conflictivo</span>
          </div>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column - Service info: Domicilio & Equipo details */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Card: Domicilio de Entrega */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 border-b border-gray-50 dark:border-gray-800 pb-2">
              <MapPin className="w-4 h-4 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Domicilio de Entrega</h3>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-white leading-relaxed">
                {addressStr}
              </p>
              {cliente?.barrio && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Barrio: <span className="font-medium text-gray-700 dark:text-gray-300">{cliente.barrio}</span>
                </p>
              )}
              {cliente?.zona && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Zona: <span className="font-medium text-gray-700 dark:text-gray-300">{cliente.zona}</span>
                </p>
              )}
              {cliente?.telCel && (
                <div className="pt-2 border-t border-gray-50 dark:border-gray-800/60">
                  <a
                    href={`https://wa.me/${cliente.telCel.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-750 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>WhatsApp: {cliente.telCel}</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Card: Datos del Equipo */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 border-b border-gray-50 dark:border-gray-800 pb-2">
              <Cpu className="w-4 h-4 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Datos del Equipo</h3>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-white">
                  {servicio.aparato} - {servicio.marcaModelo}
                </p>
                {equipo?.serie && (
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Nº de Serie: <span className="font-mono text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-850 px-1 py-0.5 rounded">{equipo.serie}</span>
                  </p>
                )}
                {equipo?.observaciones && (
                  <p className="text-gray-400 dark:text-gray-500 italic mt-1.5">
                    Observaciones: "{equipo.observaciones}"
                  </p>
                )}
              </div>

              {/* User defect description */}
              <div className="pt-3 border-t border-gray-50 dark:border-gray-800/60 space-y-1">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wide">Desperfecto Usuario</span>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/10 p-2.5 rounded-lg border border-amber-100/50 dark:border-amber-950/20 italic leading-relaxed">
                  "{servicio.desperfectoUsuario || "No se detalló desperfecto."}"
                </p>
              </div>

              {/* Agreed retrieval date */}
              {servicio.infoLogistica && (
                <div className="pt-3 border-t border-gray-50 dark:border-gray-800/60 space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Retiro Acordado</span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{servicio.infoLogistica}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right column - Forms: Diagnóstico & Administración */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: Diagnóstico Técnico */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 border-b border-gray-50 dark:border-gray-800 pb-2">
              <Wrench className="w-4 h-4 shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Panel de Diagnóstico Técnico</h3>
            </div>
            
            <div className="space-y-4">
              {/* Technician selection */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Técnico Asignado
                </label>
                <select
                  disabled={isConsulta || !isRecepcion}
                  value={editTecnicoId}
                  onChange={(e) => setEditTecnicoId(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-750 rounded-xl text-xs focus:outline-none"
                >
                  <option value="">-- Sin asignar --</option>
                  {tecnicos.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Diagnosis inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Trabajos a realizar / Diagnóstico *
                  </label>
                  <textarea
                    rows={3}
                    disabled={isConsulta || (!isRecepcion && !isTecnico)}
                    value={editDiagnostico}
                    onChange={(e) => setEditDiagnostico(e.target.value)}
                    placeholder="Escriba los trabajos técnicos a realizar o el diagnóstico..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Notas Internas del Taller
                  </label>
                  <textarea
                    rows={3}
                    disabled={isConsulta || (!isRecepcion && !isTecnico)}
                    value={editNotasInternas}
                    onChange={(e) => setEditNotasInternas(e.target.value)}
                    placeholder="Notas exclusivas para uso interno..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Needed parts input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Repuestos Necesarios (Opcional)
                </label>
                <textarea
                  rows={2}
                  disabled={isConsulta || (!isRecepcion && !isTecnico)}
                  value={editRepuestosComprar}
                  onChange={(e) => setEditRepuestosComprar(e.target.value)}
                  placeholder="Repuestos requeridos para completar la orden..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card: Fotos de Respaldo y Documentos */}
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 pb-2">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <HardDrive className="w-4 h-4 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Fotos de Respaldo y Documentación</h3>
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-slate-700 dark:text-gray-300 font-semibold text-[10px] rounded-lg shadow-2xs border border-gray-200 dark:border-gray-700 cursor-pointer ${uploading ? "opacity-50" : ""}`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? "Subiendo..." : "Adjuntar PDF"}</span>
                  </label>
                </div>
              )}
            </div>

            {/* Google Drive Photos Gallery */}
            {servicio.fotosDrive && servicio.fotosDrive.length > 0 ? (
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Fotos en Google Drive</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {servicio.fotosDrive.map((photo, i) => (
                    <div key={photo.id || i} className="group relative aspect-square bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-850 rounded-xl overflow-hidden shadow-2xs hover:border-emerald-500/50 transition-all flex flex-col items-center justify-center p-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-1">
                        <FileImage className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 text-center truncate w-full px-1">
                        {photo.name || `Foto_${i + 1}.jpg`}
                      </span>
                      <span className="text-[9px] text-gray-400 mt-0.5">#{i + 1}</span>

                      {/* Hover overlay with Drive Link */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center gap-1.5">
                        <span className="text-[9px] font-medium text-white line-clamp-1 truncate w-full px-1">{photo.name}</span>
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] rounded shadow-sm transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Ver en Drive
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-450 dark:text-gray-500 italic">No hay fotos de respaldo registradas para este equipo.</p>
            )}

            {/* Document attachments from Firebase Storage */}
            {filesList.length > 0 && (
              <div className="pt-3 border-t border-gray-50 dark:border-gray-800/50 space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Documentación y Archivos Adjuntos</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filesList.map((file, i) => (
                    <div key={i} className="p-2.5 bg-gray-50 dark:bg-gray-850 border border-gray-100 dark:border-gray-800 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                      <div className="min-w-0 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate" title={file.name}>
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
              </div>
            )}
          </div>

          {/* Card: Administración y Presupuesto (Hidden for technicians) */}
          {!isConsulta && profile?.rol !== "tecnico" && (
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 border-b border-gray-50 dark:border-gray-800 pb-2">
                <DollarSign className="w-4 h-4 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Aprobación de Presupuesto y Administración</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Admin Select status */}
                <div className="space-y-4 md:col-span-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Estado del Servicio
                    </label>
                    <select
                      value={editEstado}
                      onChange={(e) => setEditEstado(e.target.value as EstadoServicio)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-750 rounded-xl text-xs focus:outline-none"
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
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Monto Presupuesto ($)
                    </label>
                    <input
                      type="number"
                      value={editPresupuesto}
                      onChange={(e) => setEditPresupuesto(Number(e.target.value))}
                      placeholder="Monto total..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Textarea for detailed budget */}
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Servicios Convenidos / Detalle para Cliente
                  </label>
                  <textarea
                    rows={4}
                    value={editPresupuestoTexto}
                    onChange={(e) => setEditPresupuestoTexto(e.target.value)}
                    placeholder="Detalles sobre lo que se presupuestó para informar al cliente..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Toggles grid */}
              <div className="pt-3 border-t border-gray-50 dark:border-gray-800/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={editAcepta}
                    onChange={(e) => {
                      setEditAcepta(e.target.checked);
                      if (e.target.checked) setEditRechazaDevolver(false);
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span>¿Aprobó Presupuesto?</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={editRechazaDevolver}
                    onChange={(e) => {
                      setEditRechazaDevolver(e.target.checked);
                      if (e.target.checked) setEditAcepta(false);
                    }}
                    className="rounded text-red-500 focus:ring-red-500 border-gray-300"
                  />
                  <span>¿Rechazó Presupuesto?</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={editGarantia}
                    onChange={(e) => setEditGarantia(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span>Garantía Local</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-red-500">
                  <input
                    type="checkbox"
                    checked={editEsReclamoGarantia}
                    onChange={(e) => setEditEsReclamoGarantia(e.target.checked)}
                    className="rounded text-red-500 focus:ring-red-500 border-gray-300"
                  />
                  <span>Reclamo de Garantía</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={editIngresoTaller}
                    onChange={(e) => setEditIngresoTaller(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span>Ingreso Físico Taller</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-indigo-500 font-semibold">
                  <input
                    type="checkbox"
                    checked={editTerminado}
                    onChange={(e) => setEditTerminado(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span>¿Reparación Terminada?</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-emerald-500 font-semibold">
                  <input
                    type="checkbox"
                    checked={editEntregado}
                    onChange={(e) => setEditEntregado(e.target.checked)}
                    className="rounded text-emerald-550 focus:ring-emerald-550 border-gray-300"
                  />
                  <span>¿Entregado a Cliente?</span>
                </label>

                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={editFactura}
                      onChange={(e) => setEditFactura(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span>Factura</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={editContado}
                      onChange={(e) => setEditContado(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span>Contado</span>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Audit timeline at the bottom */}
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 border-b border-gray-50 dark:border-gray-800 pb-2">
          <History className="w-4 h-4 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Historial de Cambios y Bitácora</h3>
        </div>
        
        <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-4 pl-6 space-y-5 py-2 text-xs">
          {historial.length === 0 ? (
            <p className="text-xs italic text-gray-400">Sin registros históricos.</p>
          ) : (
            historial.map((log) => (
              <div key={log.id} className="relative space-y-1">
                <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-indigo-600 bg-white dark:bg-gray-900" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                    {log.accion}
                  </span>
                  <span className="text-gray-400 font-semibold">
                    {toDate(log.fecha)?.toLocaleString() || "Hace un momento"}
                  </span>
                  <span className="text-gray-500">
                    por <strong className="text-gray-700 dark:text-gray-300">{log.usuarioNombre}</strong>
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed pt-0.5">
                  {log.detalle}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      {!isConsulta && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-150 dark:border-gray-850 p-4 flex items-center justify-end gap-3 z-30 shadow-lg md:pl-72">
          <div className="max-w-7xl w-full mx-auto flex items-center justify-end gap-3 px-4">
            {profile?.rol === "tecnico" ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    setEditEstado("EN_ESPERA");
                    setTimeout(() => handleSave("EN_ESPERA", false, "Técnico guardó el diagnóstico y marcó como DIAGNOSTICADO"), 100);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  DIAGNOSTICADO
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setEditEstado("LISTO_PARA_ENTREGA");
                    setEditTerminado(true);
                    setTimeout(() => handleSave("LISTO_PARA_ENTREGA", true, "Técnico completó la reparación y marcó como TERMINADO"), 100);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  TERMINADO
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleSave()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                Guardar Modificaciones
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
