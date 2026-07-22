import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ServicioSchema } from "../schemas";
import { ServiciosService, ClientesService, EquiposService, TecnicosService } from "../services/db";
import { DriveService } from "../services/drive";
import { Cliente, Equipo, Tecnico } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { 
  ArrowLeft, 
  Check, 
  Wrench, 
  User, 
  Laptop, 
  PlusCircle, 
  AlertTriangle,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Loader2
} from "lucide-react";

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

export default function CrearServicio() {
  const { profile } = useAuth();
  const { navigate } = useNavigation();

  // Google Drive photo states
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [targetFolderId, setTargetFolderId] = useState("");
  const [photos, setPhotos] = useState<{ id: string; name: string; url: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  
  // Camera capture stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Sync current token
    setDriveToken(DriveService.getAccessToken());
    
    // Get target Folder ID
    DriveService.getFolderId().then(id => {
      setTargetFolderId(id);
    });
  }, []);

  const handleConnectDrive = async () => {
    try {
      setUploadError(null);
      const token = await DriveService.connect();
      setDriveToken(token);
    } catch (err: any) {
      console.error("Error connecting to Google Drive:", err);
      setUploadError("No se pudo conectar a Google Drive. Intente de nuevo.");
    }
  };

  const uploadFileToDrive = async (file: File | Blob) => {
    setUploadingPhoto(true);
    setUploadError(null);
    try {
      const filename = `equipo_${Date.now()}.jpg`;
      const result = await DriveService.uploadPhoto(file, filename);
      setPhotos(prev => [...prev, result]);
    } catch (err: any) {
      console.error("Error uploading to Google Drive:", err);
      setUploadError(err.message || "Error al subir la foto a Google Drive.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFileToDrive(file);
  };

  const startCamera = async () => {
    try {
      setUploadError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      setStream(mediaStream);
      setShowCameraModal(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setUploadError("No se pudo acceder a la cámara del dispositivo. Puede que los permisos estén bloqueados en este navegador o iframe. Use el botón 'Subir Foto Nativa' que funciona siempre.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCameraModal(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (blob) {
          stopCamera();
          await uploadFileToDrive(blob);
        }
      }, "image/jpeg", 0.85);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  // DB options
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected states for dynamic filtering
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [filteredEquipos, setFilteredEquipos] = useState<Equipo[]>([]);

  // Inline creators toggles
  const [showInlineCliente, setShowInlineCliente] = useState(false);
  const [inlineClienteName, setInlineClienteName] = useState("");
  const [inlineClientePhone, setInlineClientePhone] = useState("");

  const [showInlineEquipo, setShowInlineEquipo] = useState(false);
  const [inlineEquipoTipo, setInlineEquipoTipo] = useState("");
  const [inlineEquipoMarca, setInlineEquipoMarca] = useState("");
  const [inlineEquipoModelo, setInlineEquipoModelo] = useState("");

  const { 
    register, 
    handleSubmit, 
    setValue, 
    watch, 
    formState: { errors, isSubmitting } 
  } = useForm({
    resolver: zodResolver(ServicioSchema),
    defaultValues: {
      clienteId: "",
      equipoId: "",
      tecnicoId: "",
      aparato: "",
      marcaModelo: "",
      desperfectoUsuario: "",
      serviciosRequeridos: "",
      serviciosConvenidos: "",
      garantia: false,
      esReclamoGarantia: false,
      ingresoTaller: true,
      pasaStock: false,
      entregado: false,
      terminado: false,
      factura: false,
      contado: false,
    }
  });

  const selectedEquipoId = watch("equipoId");

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [cliList, eqList, tecList] = await Promise.all([
        ClientesService.getAll(),
        EquiposService.getAll(),
        TecnicosService.getAll()
      ]);
      setClientes(cliList);
      setEquipos(eqList);
      setTecnicos(tecList.filter(t => t.activo)); // Only load active technicians
    } catch (err) {
      console.error("Error loading create service data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter equipment when client selection changes
  useEffect(() => {
    if (selectedClienteId) {
      const filtered = equipos.filter(e => e.clienteId === selectedClienteId);
      setFilteredEquipos(filtered);
      setValue("clienteId", selectedClienteId);
      setValue("equipoId", ""); // Reset equipment selection
    } else {
      setFilteredEquipos([]);
    }
  }, [selectedClienteId, equipos, setValue]);

  // Auto-fill Apparato & Brand/Model when equipment selection changes
  useEffect(() => {
    if (selectedEquipoId) {
      const eq = equipos.find(e => e.id === selectedEquipoId);
      if (eq) {
        setValue("aparato", eq.tipo);
        setValue("marcaModelo", `${eq.marca} ${eq.modelo}`);
      }
    } else {
      setValue("aparato", "");
      setValue("marcaModelo", "");
    }
  }, [selectedEquipoId, equipos, setValue]);

  // Inline Creators Handlers
  const handleCreateInlineCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineClienteName.trim()) return;

    try {
      const newClientId = await ClientesService.create({
        nombreApellido: inlineClienteName,
        telCel: inlineClientePhone,
        clienteProblematico: false
      });
      
      // Re-load list and auto-select
      await loadAllData();
      setSelectedClienteId(newClientId);
      
      // Reset inputs
      setInlineClienteName("");
      setInlineClientePhone("");
      setShowInlineCliente(false);
    } catch (err) {
      console.error("Error creating inline cliente:", err);
    }
  };

  const handleCreateInlineEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClienteId || !inlineEquipoTipo.trim() || !inlineEquipoMarca.trim() || !inlineEquipoModelo.trim()) return;

    try {
      const newEqId = await EquiposService.create({
        clienteId: selectedClienteId,
        tipo: inlineEquipoTipo,
        marca: inlineEquipoMarca,
        modelo: inlineEquipoModelo
      });

      // Re-load and auto-select
      await loadAllData();
      setTimeout(() => {
        setValue("equipoId", newEqId);
      }, 150);

      // Reset inputs
      setInlineEquipoTipo("");
      setInlineEquipoMarca("");
      setInlineEquipoModelo("");
      setShowInlineEquipo(false);
    } catch (err) {
      console.error("Error creating inline equipo:", err);
    }
  };

  const onSubmitForm = async (data: any) => {
    if (!profile) return;
    try {
      await ServiciosService.create(
        {
          ...data,
          createdBy: profile.uid,
          presupuesto: Number(data.presupuesto) || 0,
          fotosDrive: photos
        },
        profile.uid,
        profile.nombre
      );
      navigate("servicios");
    } catch (err) {
      console.error("Error creating service order:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("servicios")}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer shrink-0 active:scale-95 group"
          title="Volver a la lista de servicios"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Volver</span>
        </button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Nueva Orden de Ingreso
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Complete los datos para generar el ticket del electrodoméstico ingresado.
          </p>
        </div>
      </div>

      {/* Main Intake Layout */}
      <form onSubmit={handleSubmit(onSubmitForm)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Client and machine selectors */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Client Selection */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                1. Selección de Cliente
              </h2>
              <button
                type="button"
                onClick={() => setShowInlineCliente(!showInlineCliente)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Crear Cliente Nuevo
              </button>
            </div>

            {/* Inline Client Creator Panel */}
            {showInlineCliente && (
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3 animate-fade-in">
                <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Rápido: Registrar Cliente
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre y Apellido *"
                    value={inlineClienteName}
                    onChange={(e) => setInlineClienteName(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Teléfono Celular"
                    value={inlineClientePhone}
                    onChange={(e) => setInlineClientePhone(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowInlineCliente(false)}
                    className="px-2.5 py-1 text-gray-400 hover:underline"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateInlineCliente}
                    className="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                  >
                    Crear y Seleccionar
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Seleccione un Cliente Propietario *
              </label>
              <select
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
              >
                <option value="">-- Buscar / Seleccionar Cliente --</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    [ID: {formatClienteId(c)}] {c.nombreApellido} {c.telCel ? `(${c.telCel})` : ""} {c.clienteProblematico ? "⚠️" : ""}
                  </option>
                ))}
              </select>
              {errors.clienteId && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.clienteId.message as string}</p>
              )}
            </div>
          </div>

          {/* Card 2: Equipment Selection */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Laptop className="w-5 h-5 text-indigo-600" />
                2. Selección de Equipo
              </h2>
              {selectedClienteId && (
                <button
                  type="button"
                  onClick={() => setShowInlineEquipo(!showInlineEquipo)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Crear Equipo Nuevo
                </button>
              )}
            </div>

            {/* Inline Equipment Creator Panel */}
            {showInlineEquipo && selectedClienteId && (
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3 animate-fade-in">
                <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Rápido: Registrar Equipo para este Cliente
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Tipo (Lavarropas, etc) *"
                    value={inlineEquipoTipo}
                    onChange={(e) => setInlineEquipoTipo(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Marca *"
                    value={inlineEquipoMarca}
                    onChange={(e) => setInlineEquipoMarca(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Modelo *"
                    value={inlineEquipoModelo}
                    onChange={(e) => setInlineEquipoModelo(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowInlineEquipo(false)}
                    className="px-2.5 py-1 text-gray-400 hover:underline"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateInlineEquipo}
                    className="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                  >
                    Crear y Seleccionar
                  </button>
                </div>
              </div>
            )}

            {!selectedClienteId ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 text-center text-xs text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                Seleccione un cliente primero para ver sus equipos o crear uno nuevo.
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Seleccione el Equipo del Cliente *
                </label>
                <select
                  {...register("equipoId")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                >
                  <option value="">-- Seleccionar Equipo --</option>
                  {filteredEquipos.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.tipo} • {eq.marca} ({eq.modelo})</option>
                  ))}
                </select>
                {errors.equipoId && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.equipoId.message as string}</p>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Service details */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-50 dark:border-gray-800 pb-3">
              <Wrench className="w-5 h-5 text-indigo-600" />
              3. Detalles del Servicio
            </h2>

            {/* Autofilled Fields but customizable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Aparato / Tipo de Equipo *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Lavarropas"
                  {...register("aparato")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
                {errors.aparato && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.aparato.message as string}</p>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Marca y Modelo *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Drean Excellent 6.0"
                  {...register("marcaModelo")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
                {errors.marcaModelo && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.marcaModelo.message as string}</p>
                )}
              </div>
            </div>

            {/* Desperfecto reportado por usuario */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Desperfecto Reportado por el Usuario *
              </label>
              <textarea
                rows={3}
                placeholder="Ej. No centrifuga, hace ruido excesivo al desagotar..."
                {...register("desperfectoUsuario")}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
              />
              {errors.desperfectoUsuario && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.desperfectoUsuario.message as string}</p>
              )}
            </div>

            {/* Servicios requeridos / convenidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Servicios Requeridos (Taller)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Revisar bomba de desagote, verificar carbones..."
                  {...register("serviciosRequeridos")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Servicios Convenidos con Cliente
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Cambio de bomba y rulemanes si el presupuesto es menor a $15000..."
                  {...register("serviciosConvenidos")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none text-xs"
                />
              </div>
            </div>

          </div>

          {/* Card 4: Fotos del Equipo (Google Drive Integration) */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                4. Fotos del Equipo (Google Drive)
              </h2>
              {/* Connection state */}
              <div className="flex items-center gap-1.5">
                {driveToken ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Drive Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    Drive Desconectado
                  </span>
                )}
              </div>
            </div>

            {/* Error notifications */}
            {uploadError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {!targetFolderId && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                ⚠️ <strong>Falta configuración del Administrador:</strong> El administrador general aún no ha configurado el ID de la carpeta de destino de Google Drive. Por favor, pídale que lo asigne en el panel de "Usuarios Sistema".
              </div>
            )}

            {targetFolderId && (
              <div className="space-y-4">
                {/* Auth section if not signed in */}
                {!driveToken ? (
                  <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex flex-col items-center justify-center text-center gap-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm">
                      Para subir las fotos de ingreso directamente a la carpeta de Google Drive de la empresa, autorice el acceso de su cuenta a Google Drive.
                    </p>
                    <button
                      type="button"
                      onClick={handleConnectDrive}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Conectar Google Drive
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Camera and Upload trigger panel */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Access Device Camera */}
                      <button
                        type="button"
                        onClick={startCamera}
                        disabled={uploadingPhoto}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4" />
                        Acceder a la Cámara
                      </button>

                      {/* Native / Upload File fallback */}
                      <div className="relative">
                        <input
                          type="file"
                          id="drive-image-upload"
                          accept="image/*"
                          capture="environment"
                          disabled={uploadingPhoto}
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="drive-image-upload"
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs cursor-pointer transition-all text-center"
                        >
                          <Upload className="w-4 h-4" />
                          Subir Foto Nativa / Archivo
                        </label>
                      </div>
                    </div>

                    {/* Upload progress state */}
                    {uploadingPhoto && (
                      <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900/30 rounded-xl flex items-center justify-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Subiendo foto directamente a Google Drive...</span>
                      </div>
                    )}

                    {/* Previews Grid */}
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Fotos capturadas para esta orden ({photos.length})
                      </span>
                      
                      {photos.length === 0 ? (
                        <div className="p-8 border border-dashed border-gray-150 dark:border-gray-800 rounded-2xl text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
                          <ImageIcon className="w-8 h-8 text-gray-300 dark:text-gray-700" />
                          <span>No se han tomado fotos para este equipo todavía.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {photos.map((photo, index) => (
                            <div key={photo.id} className="group relative aspect-square bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xs">
                              <img
                                src={photo.url}
                                alt={`Capture ${index + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <a
                                  href={photo.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                                  title="Ver en Google Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(photo.id)}
                                  className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar de la orden"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/65 text-[9px] text-white font-mono rounded">
                                #{index + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Assignment & Logistics */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-md">
              Asignación y Diagnóstico
            </h3>

            {/* Tecnico select */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Técnico Inicial Asignado
              </label>
              <select
                {...register("tecnicoId")}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl text-xs focus:outline-none"
              >
                <option value="">-- Sin asignar / Espera taller --</option>
                {tecnicos.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre} ({t.especialidad || "General"})</option>
                ))}
              </select>
            </div>

            {/* Warranty & options */}
            <div className="space-y-3 pt-3 border-t border-gray-50 dark:border-gray-800/50">
              <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Parámetros Especiales
              </span>
              
              <div className="flex flex-col gap-2">
                <label className="relative flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("esReclamoGarantia")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">¿Reclamo de Garantía?</span>
                </label>

                <label className="relative flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("ingresoTaller")}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Ingreso Físico a Taller</span>
                </label>
              </div>
            </div>

          </div>

          {/* Form Actions */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-md">
              Confirmar Ingreso
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Al guardar la orden de ingreso, el estado se establecerá por defecto en **RECIBIDO**, se creará la primera entrada en la bitácora de historial de auditoría y se generará un número de orden secuencial autoincremental de taller.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? "Generando Orden..." : "Guardar e Imprimir Orden"}
            </button>
          </div>

        </div>

      </form>

      {/* CAMERA OVERLAY MODAL */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-sm text-white">Capturar Foto del Equipo</span>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Viewport */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[9px] font-mono text-indigo-300 border border-indigo-500/20 tracking-wider">
                CÁMARA TRASERA
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-5 bg-slate-950 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={capturePhoto}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Capturar y Subir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
