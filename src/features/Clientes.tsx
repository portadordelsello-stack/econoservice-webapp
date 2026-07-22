import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClienteSchema } from "../schemas";
import { ClientesService, EquiposService, ServiciosService, toDate } from "../services/db";
import { DriveService } from "../services/drive";
import { Cliente, Equipo, Servicio, getEstadoLabel } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { 
  UserPlus, 
  Search, 
  Edit2, 
  AlertTriangle, 
  Eye, 
  MapPin, 
  Phone, 
  Wrench, 
  Laptop, 
  X, 
  Check,
  ChevronRight,
  ArrowLeft,
  Trash,
  Calendar,
  Upload,
  ImageIcon
} from "lucide-react";

export default function Clientes() {
  const { profile } = useAuth();
  const { navigate, selectedId } = useNavigation();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteEquipos, setClienteEquipos] = useState<Equipo[]>([]);
  const [clienteServicios, setClienteServicios] = useState<Servicio[]>([]);
  
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);
  
  // Bulk Delete States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  
  const isSuperadmin = profile?.rol === "superadmin";

  const handleDeleteCliente = (id: string) => {
    if (!id) return;
    setClienteToDelete(id);
  };

  const handleToggleSelectClient = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allFilteredIds = filteredClientes.map(c => c.id).filter(Boolean) as string[];
    const allSelected = allFilteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      // Unselect all filtered
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      // Select all filtered
      setSelectedIds(prev => {
        const union = new Set([...prev, ...allFilteredIds]);
        return Array.from(union);
      });
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBulkDeleting(true);
      await ClientesService.batchDelete(selectedIds);
      if (selectedCliente?.id && selectedIds.includes(selectedCliente.id)) {
        setSelectedCliente(null);
      }
      setSelectedIds([]);
      setBulkDeleteConfirmOpen(false);
      loadClientes();
    } catch (err) {
      console.error("Error bulk deleting clientes:", err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const confirmDeleteCliente = async () => {
    if (!clienteToDelete) return;
    try {
      await ClientesService.delete(clienteToDelete);
      if (selectedCliente?.id === clienteToDelete) {
        setSelectedCliente(null);
      }
      loadClientes();
      setClienteToDelete(null);
    } catch (err) {
      console.error("Error deleting client:", err);
    }
  };
  
  // UI states
  const [currentSubView, setCurrentSubView] = useState<"menu" | "nuevo" | "directorio" | "editar">("menu");

  // Editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEquipoId, setEditingEquipoId] = useState<string | null>(null);
  const [editingServicioId, setEditingServicioId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // New Client Custom Form States
  const [formNombreApellido, setFormNombreApellido] = useState("");
  const [formTelCel, setFormTelCel] = useState("");
  const [formCalle, setFormCalle] = useState("");
  const [formNumero, setFormNumero] = useState("");
  const [formCiudad, setFormCiudad] = useState("");
  const [formDepto, setFormDepto] = useState("");
  const [formMarca, setFormMarca] = useState("");
  const [formModelo, setFormModelo] = useState("");
  const [formFechaRetiro, setFormFechaRetiro] = useState("");
  const [formNotasRetiro, setFormNotasRetiro] = useState("");
  const [formDesperfectoUsuario, setFormDesperfectoUsuario] = useState("");
  const [formNS1, setFormNS1] = useState(false);
  const [formNS2, setFormNS2] = useState(false);
  const [formNS3, setFormNS3] = useState(false);
  const [formObservaciones, setFormObservaciones] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState("");

  // Drive photo upload states
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveFolderId, setDriveFolderId] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<{id: string; name: string; url: string}[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = DriveService.getAccessToken();
    if (token) setDriveToken(token);
    DriveService.getFolderId().then(id => setDriveFolderId(id || "")).catch(() => {});
  }, []);

  // Step 1 - button click: connect if needed, then open picker
  const handleConnectAndUpload = async () => {
    setUploadError(null);
    let token = driveToken || DriveService.getAccessToken();
    if (!token) {
      try {
        setConnectingDrive(true);
        token = await DriveService.connect();
        setDriveToken(token);
      } catch (err: any) {
        console.error("Error connecting to Drive:", err);
        setUploadError("No se pudo conectar a Google Drive. Intentá de nuevo.");
        setConnectingDrive(false);
        return;
      } finally {
        setConnectingDrive(false);
      }
    }
    // Token OK → open file picker
    photoInputRef.current?.click();
  };

  // Step 2 - file selected: upload to Drive
  const uploadFileToDrive = async (file: File) => {
    setUploadingPhoto(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const direccion = [formCalle.trim(), formNumero.trim()].filter(Boolean).join("_");
      const dirClean = direccion.replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚüÜñÑ]/g, "_").replace(/_+/g, "_");
      const filename = `equipo_${dirClean || "sin_dir"}_${Date.now()}.${ext}`;
      const result = await DriveService.uploadPhoto(file, filename);
      const newPhoto = { id: result.id, name: result.name, url: result.url };
      setUploadedPhotos(prev => [...prev, newPhoto]);
      // Save immediately to Firestore if servicio exists
      if (editingServicioId) {
        const srv = clienteServicios.find(s => s.id === editingServicioId);
        const existing = srv?.fotosDrive || [];
        await ServiciosService.update(
          editingServicioId,
          { fotosDrive: [...existing, newPhoto] },
          profile?.uid || "system",
          profile?.nombre || "Usuario"
        );
      }
    } catch (err: any) {
      console.error("Error uploading photo:", err);
      setUploadError(err.message || "Error al subir la foto a Google Drive.");
    } finally {
      setUploadingPhoto(false);
    }
  };


  const resetCustomForm = () => {
    setFormNombreApellido("");
    setFormTelCel("");
    setFormCalle("");
    setFormNumero("");
    setFormCiudad("");
    setFormDepto("");
    setFormMarca("");
    setFormModelo("");
    setFormFechaRetiro("");
    setFormNotasRetiro("");
    setFormDesperfectoUsuario("");
    setFormNS1(false);
    setFormNS2(false);
    setFormNS3(false);
    setFormObservaciones("");
    setFormSuccess(false);
    setFormError("");
    setUploadedPhotos([]);
    setUploadError(null);
  };

  const handleCustomFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setFormSaving(true);
      setFormError("");
      
      const clientName = formNombreApellido.trim() || (formTelCel.trim() ? `Cel: ${formTelCel.trim()}` : "Cliente S/N");

      // 1. Create client
      const clienteId = await ClientesService.create({
        nombreApellido: clientName,
        telCel: formTelCel.trim() || "",
        calle: formCalle.trim() || "",
        numero: formNumero.trim() || "",
        localidad: formCiudad.trim() || "",
        depto: formDepto.trim() || "",
        clienteProblematico: false,
        observaciones: formObservaciones.trim() || ""
      });

      // 2. Create equipment (if any marca or modelo is filled)
      let equipoId = "";
      if (formMarca.trim() || formModelo.trim()) {
        equipoId = await EquiposService.create({
          clienteId,
          tipo: "Equipo",
          marca: formMarca.trim() || "Genérico",
          modelo: formModelo.trim() || "Genérico",
          observaciones: ""
        });
      }

      // 3. Create service order (if we have an equipment, create service order)
      if (equipoId) {
        const selectedNS = [
          formNS1 ? "NS1" : "",
          formNS2 ? "NS2" : "",
          formNS3 ? "NS3" : ""
        ].filter(Boolean).join(", ");

        const infoLogisticaFull = [
          formFechaRetiro.trim() ? `Retiro acordado: ${formFechaRetiro.trim()}` : "",
          formNotasRetiro.trim() ? `Notas retiro: ${formNotasRetiro.trim()}` : "",
          selectedNS ? `Config: ${selectedNS}` : ""
        ].filter(Boolean).join(" | ");

        await ServiciosService.create({
          clienteId,
          equipoId,
          fechaIngreso: new Date(),
          aparato: "Equipo",
          marcaModelo: `${formMarca.trim()} ${formModelo.trim()}`.trim(),
          desperfectoUsuario: formDesperfectoUsuario.trim() || "No especificado",
          infoLogistica: infoLogisticaFull,
          notasInternas: formObservaciones.trim() || "",
          acepta: false,
          rechazaDevolver: false,
          garantia: false,
          esReclamoGarantia: false,
          ingresoTaller: false,
          pasaStock: false,
          entregado: false,
          terminado: false,
          factura: false,
          contado: false,
          createdBy: profile?.uid || "system"
        }, profile?.uid || "system", profile?.nombre || "Usuario");
      }

      setFormSuccess(true);
      loadClientes();
    } catch (err: any) {
      console.error("Error creating custom client & service:", err);
      setFormError("Hubo un error al registrar el cliente. Intente nuevamente.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleStartEdit = async (c: Cliente) => {
    try {
      setFormLoading(true);
      setEditingId(c.id || null);
      setFormError("");
      setFormSuccess(false);

      // Set client states
      setFormNombreApellido(c.nombreApellido || "");
      setFormTelCel(c.telCel || "");
      setFormCalle(c.calle || "");
      setFormNumero(c.numero || "");
      setFormCiudad(c.localidad || "");
      setFormDepto(c.depto || "");
      setFormObservaciones(c.observaciones || "");

      // Initialize associated equipment and service states to empty
      setEditingEquipoId(null);
      setFormMarca("");
      setFormModelo("");

      setEditingServicioId(null);
      setFormFechaRetiro("");
      setFormNotasRetiro("");
      setFormDesperfectoUsuario("");
      setFormNS1(false);
      setFormNS2(false);
      setFormNS3(false);

      if (c.id) {
        // Fetch equipment
        const equipments = await EquiposService.getByCliente(c.id);
        if (equipments.length > 0) {
          const eq = equipments[0];
          setEditingEquipoId(eq.id || null);
          setFormMarca(eq.marca || "");
          setFormModelo(eq.modelo || "");

          // Fetch services (retrieve all and filter client-side to minimize index errors)
          const services = await ServiciosService.getAll();
          const clientServices = services.filter(s => s.clienteId === c.id && s.equipoId === eq.id);
          if (clientServices.length > 0) {
            // Get the most recent service
            const srv = clientServices[0];
            setEditingServicioId(srv.id || null);
            setFormDesperfectoUsuario(srv.desperfectoUsuario || "");

            // Parse infoLogistica
            const logistica = srv.infoLogistica || "";
            if (logistica) {
              const parts = logistica.split(" | ");
              parts.forEach(part => {
                if (part.startsWith("Retiro acordado: ")) {
                  const val = part.replace("Retiro acordado: ", "");
                  const isDatetimeLocal = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val);
                  if (isDatetimeLocal) {
                    setFormFechaRetiro(val);
                  } else {
                    setFormFechaRetiro("");
                    setFormNotasRetiro(prev => prev ? `${val} - ${prev}` : val);
                  }
                } else if (part.startsWith("Notas retiro: ")) {
                  const val = part.replace("Notas retiro: ", "");
                  setFormNotasRetiro(prev => prev ? `${prev} | ${val}` : val);
                } else if (part.startsWith("Config: ")) {
                  const configStr = part.replace("Config: ", "");
                  setFormNS1(configStr.includes("NS1"));
                  setFormNS2(configStr.includes("NS2"));
                  setFormNS3(configStr.includes("NS3"));
                }
              });
            }
          }
        }
      }

      setCurrentSubView("editar");
    } catch (err) {
      console.error("Error loading client data for editing:", err);
      setFormError("Error al cargar los datos del cliente.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    try {
      setFormSaving(true);
      setFormError("");

      const clientName = formNombreApellido.trim() || (formTelCel.trim() ? `Cel: ${formTelCel.trim()}` : "Cliente S/N");

      // 1. Update client
      await ClientesService.update(editingId, {
        nombreApellido: clientName,
        telCel: formTelCel.trim() || "",
        calle: formCalle.trim() || "",
        numero: formNumero.trim() || "",
        localidad: formCiudad.trim() || "",
        depto: formDepto.trim() || "",
        observaciones: formObservaciones.trim() || ""
      });

      // 2. Handle Equipment
      let currentEquipoId = editingEquipoId;
      if (formMarca.trim() || formModelo.trim()) {
        if (currentEquipoId) {
          // Update equipment
          await EquiposService.update(currentEquipoId, {
            marca: formMarca.trim() || "Genérico",
            modelo: formModelo.trim() || "Genérico"
          });
        } else {
          // Create equipment
          currentEquipoId = await EquiposService.create({
            clienteId: editingId,
            tipo: "Equipo",
            marca: formMarca.trim() || "Genérico",
            modelo: formModelo.trim() || "Genérico",
            observaciones: ""
          });
          setEditingEquipoId(currentEquipoId);
        }
      }

      // 3. Handle Service Order
      const selectedNS = [
        formNS1 ? "NS1" : "",
        formNS2 ? "NS2" : "",
        formNS3 ? "NS3" : ""
      ].filter(Boolean).join(", ");

      const infoLogisticaFull = [
        formFechaRetiro.trim() ? `Retiro acordado: ${formFechaRetiro.trim()}` : "",
        formNotasRetiro.trim() ? `Notas retiro: ${formNotasRetiro.trim()}` : "",
        selectedNS ? `Config: ${selectedNS}` : ""
      ].filter(Boolean).join(" | ");

      if (currentEquipoId) {
        if (editingServicioId) {
          // Update service order
          await ServiciosService.update(editingServicioId, {
            marcaModelo: `${formMarca.trim()} ${formModelo.trim()}`.trim(),
            desperfectoUsuario: formDesperfectoUsuario.trim() || "No especificado",
            infoLogistica: infoLogisticaFull,
            notasInternas: formObservaciones.trim() || ""
          }, profile?.uid || "system", profile?.nombre || "Usuario");
        } else {
          // Create service order
          const newServId = await ServiciosService.create({
            clienteId: editingId,
            equipoId: currentEquipoId,
            fechaIngreso: new Date(),
            aparato: "Equipo",
            marcaModelo: `${formMarca.trim()} ${formModelo.trim()}`.trim(),
            desperfectoUsuario: formDesperfectoUsuario.trim() || "No especificado",
            infoLogistica: infoLogisticaFull,
            notasInternas: formObservaciones.trim() || "",
            acepta: false,
            rechazaDevolver: false,
            garantia: false,
            esReclamoGarantia: false,
            ingresoTaller: false,
            pasaStock: false,
            entregado: false,
            terminado: false,
            factura: false,
            contado: false,
            createdBy: profile?.uid || "system"
          }, profile?.uid || "system", profile?.nombre || "Usuario");
          setEditingServicioId(newServId);
        }
      }

      setFormSuccess(true);
      loadClientes();
    } catch (err: any) {
      console.error("Error editing custom client & service:", err);
      setFormError("Hubo un error al actualizar el cliente. Intente nuevamente.");
    } finally {
      setFormSaving(false);
    }
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);

  // Zod & React Hook Form
  const { 
    register, 
    handleSubmit, 
    reset, 
    formState: { errors, isSubmitting } 
  } = useForm({
    resolver: zodResolver(ClienteSchema),
    defaultValues: {
      nombreApellido: "",
      telFijo: "",
      telCel: "",
      telCelBis: "",
      telCelOtro: "",
      localidad: "",
      barrio: "",
      zona: "",
      calle: "",
      numero: "",
      piso: "",
      depto: "",
      clienteProblematico: false,
      observaciones: ""
    }
  });

  const loadClientes = async () => {
    try {
      setLoading(true);
      const data = await ClientesService.getAll();
      setClientes(data);
    } catch (err) {
      console.error("Error loading clientes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    if (selectedId && clientes.length > 0) {
      const found = clientes.find(c => c.id === selectedId);
      if (found) {
        handleStartEdit(found);
      }
    }
  }, [selectedId, clientes]);

  const handleSelectCliente = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    try {
      if (cliente.id) {
        const [equipos, servicios] = await Promise.all([
          EquiposService.getByCliente(cliente.id),
          ServiciosService.getAll() // Retrieve all and filter client-side to minimize index errors
        ]);
        setClienteEquipos(equipos);
        setClienteServicios(servicios.filter(s => s.clienteId === cliente.id));
      }
    } catch (err) {
      console.error("Error loading cliente details:", err);
    }
  };

  const handleOpenCreate = () => {
    setEditingCliente(null);
    reset({
      nombreApellido: "",
      telFijo: "",
      telCel: "",
      telCelBis: "",
      telCelOtro: "",
      localidad: "",
      barrio: "",
      zona: "",
      calle: "",
      numero: "",
      piso: "",
      depto: "",
      clienteProblematico: false,
      observaciones: ""
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    reset({
      nombreApellido: cliente.nombreApellido,
      telFijo: cliente.telFijo || "",
      telCel: cliente.telCel || "",
      telCelBis: cliente.telCelBis || "",
      telCelOtro: cliente.telCelOtro || "",
      localidad: cliente.localidad || "",
      barrio: cliente.barrio || "",
      zona: cliente.zona || "",
      calle: cliente.calle || "",
      numero: cliente.numero || "",
      piso: cliente.piso || "",
      depto: cliente.depto || "",
      clienteProblematico: cliente.clienteProblematico,
      observaciones: cliente.observaciones || ""
    });
    setIsFormOpen(true);
  };

  const onSubmitForm = async (data: any) => {
    try {
      const finalData = { ...data };
      if (!finalData.nombreApellido || finalData.nombreApellido.trim() === "") {
        finalData.nombreApellido = finalData.telCel?.trim() ? `Cel: ${finalData.telCel.trim()}` : "Cliente S/N";
      }
      if (editingCliente && editingCliente.id) {
        await ClientesService.update(editingCliente.id, finalData);
        if (selectedCliente?.id === editingCliente.id) {
          setSelectedCliente({ ...selectedCliente, ...finalData });
        }
      } else {
        await ClientesService.create(finalData);
      }
      setIsFormOpen(false);
      reset();
      loadClientes();
    } catch (err) {
      console.error("Error saving cliente:", err);
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

  // Filter clients locally
  const filteredClientes = clientes.filter(c => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    
    const formattedId = formatClienteId(c);
    const idMatches = formattedId.includes(term);
    const phoneMatches = [c.telCel, c.telFijo, c.telCelBis, c.telCelOtro]
      .some(phone => phone && phone.includes(searchTerm));
    const addressMatches = [c.calle, c.numero, c.barrio, c.localidad, c.zona]
      .some(field => field && field.toLowerCase().includes(term));
      
    return idMatches || phoneMatches || addressMatches;
  });

  const canWrite = profile?.rol === "superadmin" || profile?.rol === "logistica";

  if (loading && clientes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (currentSubView === "menu") {
    return (
      <div className="space-y-6 animate-fade-in font-sans">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Panel de Clientes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Seleccione una de las siguientes opciones para continuar.
          </p>
        </div>

        {/* Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto pt-6">
          
          {/* Card: Nuevo Cliente */}
          <button 
            type="button"
            onClick={() => {
              resetCustomForm();
              setCurrentSubView("nuevo");
            }}
            className="group w-full cursor-pointer bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm p-6 hover:shadow-md hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all text-left flex flex-col justify-between space-y-8"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserPlus className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Nuevo Cliente
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Registra un nuevo cliente junto con los datos de su domicilio, su equipo, la fecha de retiro acordada, desperfecto reportado y observaciones de cobro de forma manual y directa.
                </p>
              </div>
            </div>
            <div className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 gap-1 pt-2">
              <span>Comenzar registro</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card: Directorio de Clientes */}
          <button 
            type="button"
            onClick={() => {
              setCurrentSubView("directorio");
            }}
            className="group w-full cursor-pointer bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 hover:shadow-md hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all text-left flex flex-col justify-between space-y-8"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Eye className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Directorio de Clientes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Explora la lista completa de clientes registrados, realiza búsquedas por dirección, nombre o teléfono, y visualiza el historial de equipos y servicios de cada cliente.
                </p>
              </div>
            </div>
            <div className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 gap-1 pt-2">
              <span>Abrir directorio</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

        </div>
      </div>
    );
  }

  if (currentSubView === "nuevo" || currentSubView === "editar") {
    const isEditMode = currentSubView === "editar";
    return (
      <div className="space-y-6 animate-fade-in font-sans">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={() => setCurrentSubView(isEditMode ? "directorio" : "menu")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-gray-50 dark:bg-gray-855 rounded-xl border border-gray-150 dark:border-gray-800 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {isEditMode ? "Volver al directorio" : "Volver al panel"}
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white pt-2">
              {isEditMode ? "Editar Cliente" : "Ingresar Nuevo Cliente"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isEditMode 
                ? "Modifique los campos correspondientes para actualizar la ficha del cliente, su equipo y los datos del servicio."
                : "Complete el formulario para registrar el cliente, su equipo y los datos del retiro acordado."
              }
            </p>
          </div>
        </div>

        {formSuccess ? (
          <div className="bg-white dark:bg-gray-900 border border-emerald-100 dark:border-emerald-950/40 rounded-2xl shadow-sm p-8 text-center max-w-2xl mx-auto space-y-6 animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isEditMode ? "¡Cliente Actualizado con Éxito!" : "¡Cliente Registrado con Éxito!"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                {isEditMode 
                  ? "La información del cliente, su equipo y los datos del servicio han sido actualizados de forma correcta."
                  : <>El cliente con teléfono <strong>{formTelCel || "S/N"}</strong> se ha guardado en la base de datos junto con su equipo y orden de servicio inicial.</>
                }
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              {!isEditMode && (
                <button
                  type="button"
                  onClick={() => {
                    resetCustomForm();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Ingresar Otro Cliente
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCurrentSubView("directorio");
                }}
                className={`w-full sm:w-auto px-5 py-2.5 ${isEditMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-855 text-gray-700 dark:text-gray-300'} font-semibold text-sm rounded-xl cursor-pointer transition-colors`}
              >
                Ir al Directorio de Clientes
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={isEditMode ? handleEditFormSubmit : handleCustomFormSubmit} className="max-w-4xl mx-auto space-y-6">
            
            {formError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 rounded-xl flex items-center gap-2.5 text-red-800 dark:text-red-300 text-xs font-medium animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 animate-pulse" />
                {formError}
              </div>
            )}

            {/* Section 2: Domicilio */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 pb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" />
                1. Domicilio de Retiro
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Calle y Número
                  </label>
                  <input
                    type="text"
                    value={formCalle}
                    onChange={(e) => setFormCalle(e.target.value)}
                    placeholder="Ej. Av. Siempreviva 742"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Ciudad / Localidad
                  </label>
                  <input
                    type="text"
                    value={formCiudad}
                    onChange={(e) => setFormCiudad(e.target.value)}
                    placeholder="Ej. Córdoba"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Dpto. / Piso / Of.
                  </label>
                  <input
                    type="text"
                    value={formDepto}
                    onChange={(e) => setFormDepto(e.target.value)}
                    placeholder="Ej. 2B o N/A"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Equipo */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 pb-2 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-indigo-500" />
                2. Datos del Equipo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Marca del Equipo
                  </label>
                  <input
                    type="text"
                    value={formMarca}
                    onChange={(e) => setFormMarca(e.target.value)}
                    placeholder="Ej. Samsung, Whirlpool"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Modelo del Equipo
                  </label>
                  <input
                    type="text"
                    value={formModelo}
                    onChange={(e) => setFormModelo(e.target.value)}
                    placeholder="Ej. Active DualWash"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Foto del Equipo
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Hidden file input */}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await uploadFileToDrive(file);
                      e.target.value = "";
                    }}
                  />
                  {/* Upload button */}
                  <button
                    type="button"
                    onClick={handleConnectAndUpload}
                    disabled={uploadingPhoto || connectingDrive}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                  >
                    {connectingDrive ? (
                      <><span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block"></span> Conectando Drive...</>
                    ) : uploadingPhoto ? (
                      <><span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block"></span> Subiendo...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> {driveToken ? "Subir Foto" : "Conectar Drive y Subir"}</>
                    )}
                  </button>

                  {/* Existing servicio photos */}
                  {editingServicioId && clienteServicios.find(s => s.id === editingServicioId)?.fotosDrive?.map(photo => (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative group flex-shrink-0"
                      title={photo.name}
                    >
                      <div className="w-14 h-14 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center overflow-hidden group-hover:ring-2 group-hover:ring-indigo-500 transition-all">
                        <ImageIcon className="w-6 h-6 text-indigo-400" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-indigo-600 text-white rounded px-1 py-0.5 font-bold">Drive</span>
                    </a>
                  ))}

                  {/* Newly uploaded in this session */}
                  {uploadedPhotos.map(photo => (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative group flex-shrink-0"
                      title={photo.name}
                    >
                      <div className="w-14 h-14 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center overflow-hidden group-hover:ring-2 group-hover:ring-emerald-500 transition-all">
                        <Check className="w-6 h-6 text-emerald-500" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-emerald-600 text-white rounded px-1 py-0.5 font-bold">✓</span>
                    </a>
                  ))}
                </div>
                {/* Error message */}
                {uploadError && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {uploadError}
                  </p>
                )}
                {!driveFolderId && (
                  <p className="text-xs text-amber-500 dark:text-amber-400 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Configurá el ID de carpeta de Drive en <strong>Ajustes</strong> para habilitar la subida de fotos.
                  </p>
                )}
              </div>
            </div>

            {/* Section 4: Logística y Notas */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 pb-2 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-500" />
                3. Logística y Datos de Contacto
              </h3>
              
              <div className="space-y-4">
                {/* Celular input */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Teléfono Celular
                    </label>
                    <input
                      type="text"
                      value={formTelCel}
                      onChange={(e) => setFormTelCel(e.target.value)}
                      placeholder="Ej. +54 9 11 1234-5678"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </div>
                 {/* Fecha y Horario de retiro con Notas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      Fecha y horario de retiro acordado
                    </label>
                    <input
                      type="datetime-local"
                      value={formFechaRetiro}
                      onChange={(e) => setFormFechaRetiro(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Haga clic para abrir el selector de fecha y hora.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Notas del Retiro
                    </label>
                    <input
                      type="text"
                      value={formNotasRetiro}
                      onChange={(e) => setFormNotasRetiro(e.target.value)}
                      placeholder='Ej. "llamar antes por las dudas", "tocar timbre 2"'
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Anotaciones especiales para el personal de retiro.
                    </p>
                  </div>
                </div>

                {/* Logistics Info / Desperfecto */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Desperfecto Usuario (Lo que el cliente dice del problema)
                  </label>
                  <textarea
                    rows={3}
                    value={formDesperfectoUsuario}
                    onChange={(e) => setFormDesperfectoUsuario(e.target.value)}
                    placeholder="Ej. El cliente indica que no enciende y hace un pitido extraño al enchufar."
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                {/* Checkboxes NS1 NS2 NS3 */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Opciones Logísticas (Seleccione las que correspondan)
                  </label>
                  <div className="flex flex-wrap items-center gap-6 bg-gray-50 dark:bg-gray-850 p-4 rounded-xl border border-gray-150 dark:border-gray-800">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={formNS1}
                        onChange={(e) => setFormNS1(e.target.checked)}
                        className="w-4.5 h-4.5 rounded text-indigo-600 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-855 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>NS1</span>
                    </label>

                    <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={formNS2}
                        onChange={(e) => setFormNS2(e.target.checked)}
                        className="w-4.5 h-4.5 rounded text-indigo-600 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-855 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>NS2</span>
                    </label>

                    <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={formNS3}
                        onChange={(e) => setFormNS3(e.target.checked)}
                        className="w-4.5 h-4.5 rounded text-indigo-600 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-855 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>NS3</span>
                    </label>
                  </div>
                </div>

                {/* Internal Notes / Billing */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Observaciones Internas o de Cobro
                  </label>
                  <textarea
                    rows={3}
                    value={formObservaciones}
                    onChange={(e) => setFormObservaciones(e.target.value)}
                    placeholder="Instrucciones para llegar, advertencias de cobros, etc."
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentSubView("menu")}
                className="px-5 py-3 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-855 cursor-pointer transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formSaving}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-colors shadow-md text-sm"
              >
                {formSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Guardar Registro Completo</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentSubView("menu")}
            className="p-2 bg-gray-55 dark:bg-gray-855 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-150 dark:border-gray-800 rounded-xl text-gray-500 dark:text-gray-400 cursor-pointer transition-colors"
            title="Volver al panel principal"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Directorio de Clientes
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gestión y hojas de servicio de todos los clientes registrados.
            </p>
          </div>
        </div>
        {canWrite && (
          <button
            onClick={() => {
              resetCustomForm();
              setCurrentSubView("nuevo");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        )}
      </div>

      {/* Search and Action Bar */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente por dirección, ID o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      </div>

      {/* List Layout of Clientes */}
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-gray-800/50 animate-scale-up">
        {filteredClientes.length > 0 && (
          <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-850 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <div className="col-span-7">Domicilio / ID</div>
            <div className="col-span-3">Celular</div>
            <div className="col-span-2 text-right">Acciones</div>
          </div>
        )}
        {filteredClientes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
            No se encontraron clientes.
          </div>
        ) : (
          filteredClientes.map((c) => (
            <div
              key={c.id}
              className="p-5 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all"
            >
              {/* Col 1: ID & Address & Note */}
              <div className="sm:col-span-7 space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {c.id && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold border border-indigo-100 dark:border-indigo-900/30">
                      ID: {formatClienteId(c)}
                    </span>
                  )}
                  <span className="font-bold text-gray-900 dark:text-white text-base">
                    {[
                      c.calle ? `${c.calle} ${c.numero || ""}` : "",
                      c.barrio ? `B° ${c.barrio}` : "",
                      c.localidad || ""
                    ].filter(Boolean).join(", ") || "Domicilio no registrado"}
                  </span>
                  {c.clienteProblematico && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 text-[10px] font-bold">
                      <AlertTriangle className="w-3 h-3 animate-pulse" />
                      Conflictivo
                    </span>
                  )}
                </div>
                {c.observaciones && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic max-w-2xl truncate">
                    Nota: {c.observaciones}
                  </p>
                )}
              </div>

              {/* Col 2: Celular */}
              <div className="sm:col-span-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
                {c.telCel ? (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{c.telCel}</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">No registrado</span>
                )}
              </div>

              {/* Col 3: Actions */}
              <div className="sm:col-span-2 flex items-center justify-end gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => handleStartEdit(c)}
                  className="p-2.5 text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-900/40 flex items-center justify-center"
                  title="Editar Cliente"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {isSuperadmin && (
                  <button
                    onClick={() => handleDeleteCliente(c.id || "")}
                    className="p-2.5 text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-200 dark:hover:border-red-900/40 flex items-center justify-center"
                    title="Eliminar Cliente"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Slide Modal for Create / Edit */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center sm:items-start sm:pt-[2vh] justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in sm:ml-[30vw]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingCliente ? "Editar Perfil de Cliente" : "Ingresar Nuevo Cliente"}
              </h2>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit(onSubmitForm)} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Name & Problematic flag */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    {...register("nombreApellido")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  {errors.nombreApellido && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.nombreApellido.message as string}</p>
                  )}
                </div>

                <div className="flex items-center h-10">
                  <label className="relative flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register("clienteProblematico")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">¿Cliente Conflictivo?</span>
                  </label>
                </div>
              </div>

              {/* Telephones */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Fijo
                  </label>
                  <input
                    type="text"
                    {...register("telFijo")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Celular
                  </label>
                  <input
                    type="text"
                    {...register("telCel")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Celular Bis
                  </label>
                  <input
                    type="text"
                    {...register("telCelBis")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Celular Otro
                  </label>
                  <input
                    type="text"
                    {...register("telCelOtro")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Location details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Localidad / Ciudad
                  </label>
                  <input
                    type="text"
                    {...register("localidad")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Barrio
                  </label>
                  <input
                    type="text"
                    {...register("barrio")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Zona / Sector
                  </label>
                  <input
                    type="text"
                    {...register("zona")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Address detail */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Calle
                  </label>
                  <input
                    type="text"
                    {...register("calle")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    {...register("numero")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Piso
                    </label>
                    <input
                      type="text"
                      {...register("piso")}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Depto
                    </label>
                    <input
                      type="text"
                      {...register("depto")}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Observaciones / Comentarios Internos
                </label>
                <textarea
                  rows={3}
                  {...register("observaciones")}
                  placeholder="Instrucciones para llegar, advertencias de cobros, etc."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSubmitting ? "Guardando..." : "Guardar Registro"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {clienteToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ¿Eliminar cliente?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará de forma permanente este cliente de la base de datos de forma irreversible.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setClienteToDelete(null)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteCliente}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all"
              >
                Sí, Eliminar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ¿Eliminar {selectedIds.length} clientes?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará de forma permanente los {selectedIds.length} clientes seleccionados de la base de datos de forma irreversible.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(false)}
                disabled={isBulkDeleting}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                disabled={isBulkDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1"
              >
                {isBulkDeleting ? "Eliminando..." : `Sí, Eliminar ${selectedIds.length} Clientes`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
