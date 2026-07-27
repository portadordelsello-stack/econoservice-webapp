import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClienteSchema } from "../schemas";
import { ClientesService, EquiposService, ServiciosService, NotificationsService, toDate } from "../services/db";
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
  ImageIcon,
  Plus
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

  // Multiple equipments states
  const [formEquipos, setFormEquipos] = useState<{
    id?: string;
    marca: string;
    modelo: string;
    fotosDrive: { id: string; name: string; url: string }[];
  }[]>([]);
  const [deletedEquipoIds, setDeletedEquipoIds] = useState<string[]>([]);

  // Sub-modal states for adding/editing equipment
  const [isEquipoModalOpen, setIsEquipoModalOpen] = useState(false);
  const [equipoModalIndex, setEquipoModalIndex] = useState<number | null>(null);
  const [equipoModalMarca, setEquipoModalMarca] = useState("");
  const [equipoModalModelo, setEquipoModalModelo] = useState("");
  const [equipoModalPhotos, setEquipoModalPhotos] = useState<{ id: string; name: string; url: string }[]>([]);

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
      
      if (isEquipoModalOpen) {
        setEquipoModalPhotos(prev => [...prev, newPhoto]);
      } else {
        setUploadedPhotos(prev => [...prev, newPhoto]);
      }
      
      // Save immediately to Firestore if editing an existing equipment's service order in the modal
      if (isEquipoModalOpen && equipoModalIndex !== null && editingId) {
        const eq = formEquipos[equipoModalIndex];
        if (eq && eq.id) {
          const services = await ServiciosService.getAll();
          const srv = services.find(s => s.clienteId === editingId && s.equipoId === eq.id);
          if (srv && srv.id) {
            const existing = srv.fotosDrive || [];
            await ServiciosService.update(
              srv.id,
              { fotosDrive: [...existing, newPhoto] },
              profile?.uid || "system",
              profile?.nombre || "Usuario"
            );
          }
        }
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
    // Reset multiple equipment states
    setFormEquipos([]);
    setDeletedEquipoIds([]);
    setIsEquipoModalOpen(false);
    setEquipoModalIndex(null);
    setEquipoModalMarca("");
    setEquipoModalModelo("");
    setEquipoModalPhotos([]);
  };

  const handleCustomFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setFormSaving(true);
      setFormError("");

      let finalEquipos = [...formEquipos];
      if (finalEquipos.length === 0 && (formMarca.trim() || formModelo.trim())) {
        finalEquipos.push({
          marca: formMarca.trim() || "Genérico",
          modelo: formModelo.trim() || "Genérico",
          fotosDrive: uploadedPhotos
        });
      }

      if (finalEquipos.length === 0) {
        setFormError("Debe añadir al menos un equipo en la sección de Equipos.");
        setFormSaving(false);
        return;
      }
      
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

      // 2. Loop over finalEquipos and save them
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

      for (const eq of finalEquipos) {
        const equipoId = await EquiposService.create({
          clienteId,
          tipo: "Equipo",
          marca: eq.marca.trim() || "Genérico",
          modelo: eq.modelo.trim() || "Genérico",
          observaciones: ""
        });

        const newServId = await ServiciosService.create({
          clienteId,
          equipoId,
          fechaIngreso: new Date(),
          aparato: "Equipo",
          marcaModelo: `${eq.marca.trim()} ${eq.modelo.trim()}`.trim(),
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
          fotosDrive: eq.fotosDrive || [],
          createdBy: profile?.uid || "system"
        }, profile?.uid || "system", profile?.nombre || "Usuario");

        // Notify Logistica for each equipment
        await NotificationsService.create({
          targetRole: "logistica",
          title: "Nuevo Retiro Programado",
          message: `Se registró un nuevo servicio (${clientName}) con retiro/servicio a coordinar para ${eq.marca} ${eq.modelo}.`,
          serviceId: newServId
        });
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
        // Fetch all equipments of the client
        const equipments = await EquiposService.getByCliente(c.id);
        
        // Fetch all services to match the fotosDrive of each equipment
        const allServices = await ServiciosService.getAll();
        
        const mappedEquipos = equipments.map(eq => {
          // Find services for this client and this specific equipment
          const eqServices = allServices.filter(s => s.clienteId === c.id && s.equipoId === eq.id);
          const fotosDrive = eqServices.length > 0 ? (eqServices[0].fotosDrive || []) : [];
          return {
            id: eq.id,
            marca: eq.marca || "",
            modelo: eq.modelo || "",
            fotosDrive
          };
        });
        
        setFormEquipos(mappedEquipos);
        setDeletedEquipoIds([]);

        if (equipments.length > 0) {
          const eq = equipments[0];
          setEditingEquipoId(eq.id || null);
          setFormMarca(eq.marca || "");
          setFormModelo(eq.modelo || "");

          const clientServices = allServices.filter(s => s.clienteId === c.id && s.equipoId === eq.id);
          if (clientServices.length > 0) {
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

      let finalEquipos = [...formEquipos];
      if (finalEquipos.length === 0 && (formMarca.trim() || formModelo.trim())) {
        finalEquipos.push({
          marca: formMarca.trim() || "Genérico",
          modelo: formModelo.trim() || "Genérico",
          fotosDrive: uploadedPhotos
        });
      }

      if (finalEquipos.length === 0) {
        setFormError("Debe añadir al menos un equipo en la sección de Equipos.");
        setFormSaving(false);
        return;
      }

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

      // 2. Prepare logistics text
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

      // 3. Process equipments
      const allServices = await ServiciosService.getAll();
      
      for (const eq of finalEquipos) {
        if (eq.id) {
          // Existing equipment: update details
          await EquiposService.update(eq.id, {
            marca: eq.marca.trim() || "Genérico",
            modelo: eq.modelo.trim() || "Genérico"
          });

          // Update corresponding service order if it exists
          const eqServices = allServices.filter(s => s.clienteId === editingId && s.equipoId === eq.id);
          if (eqServices.length > 0) {
            const srv = eqServices[0];
            await ServiciosService.update(srv.id!, {
              marcaModelo: `${eq.marca.trim()} ${eq.modelo.trim()}`.trim(),
              fotosDrive: eq.fotosDrive || []
            }, profile?.uid || "system", profile?.nombre || "Usuario");
          }
        } else {
          // New equipment added in this editing session
          const newEqId = await EquiposService.create({
            clienteId: editingId,
            tipo: "Equipo",
            marca: eq.marca.trim() || "Genérico",
            modelo: eq.modelo.trim() || "Genérico",
            observaciones: ""
          });

          const newServId = await ServiciosService.create({
            clienteId: editingId,
            equipoId: newEqId,
            fechaIngreso: new Date(),
            aparato: "Equipo",
            marcaModelo: `${eq.marca.trim()} ${eq.modelo.trim()}`.trim(),
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
            fotosDrive: eq.fotosDrive || [],
            createdBy: profile?.uid || "system"
          }, profile?.uid || "system", profile?.nombre || "Usuario");

          // Notify Logistica for new equipment service order
          await NotificationsService.create({
            targetRole: "logistica",
            title: "Nuevo Retiro Programado",
            message: `Se registró un nuevo equipo (${eq.marca} ${eq.modelo}) para el servicio de ${clientName}.`,
            serviceId: newServId
          });
        }
      }

      // 4. Delete removed equipments from Firestore
      for (const delId of deletedEquipoIds) {
        await EquiposService.delete(delId);
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
            Panel de Servicios
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Seleccione una de las siguientes opciones para continuar.
          </p>
        </div>

        {/* Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto pt-6">
          
          {/* Card: Nuevo Servicio */}
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
                  Nuevo Servicio
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Registra un nuevo servicio junto con los datos de su domicilio, su equipo, la fecha de retiro acordada, desperfecto reportado y observaciones de cobro de forma manual y directa.
                </p>
              </div>
            </div>
            <div className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 gap-1 pt-2">
              <span>Comenzar registro</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card: Lista de Servicios */}
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
                  Lista de Servicios
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Explora la lista completa de servicios registrados, realiza búsquedas por dirección, nombre o teléfono, y visualiza el historial de equipos y servicios de cada registro.
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
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>{isEditMode ? "Volver a la lista" : "Volver al panel"}</span>
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white pt-2">
              {isEditMode ? "Editar Servicio" : "Ingresar Nuevo Servicio"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isEditMode 
                ? "Modifique los campos correspondientes para actualizar la ficha del servicio, su equipo y los datos del servicio."
                : "Complete el formulario para registrar el servicio, su equipo y los datos del retiro acordado."
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
                {isEditMode ? "¡Servicio Actualizado con Éxito!" : "¡Servicio Registrado con Éxito!"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                {isEditMode 
                  ? "La información del servicio, su equipo y los datos del servicio han sido actualizados de forma correcta."
                  : <>El servicio con teléfono <strong>{formTelCel || "S/N"}</strong> se ha guardado en la base de datos junto con su equipo y orden de servicio inicial.</>
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
                  Ingresar Otro Servicio
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCurrentSubView("directorio");
                }}
                className={`w-full sm:w-auto px-5 py-2.5 ${isEditMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-855 text-gray-700 dark:text-gray-300'} font-semibold text-sm rounded-xl cursor-pointer transition-colors`}
              >
                Ir a la Lista de Servicios
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

            {/* Section 3: Equipos */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-indigo-500" />
                  2. Equipos
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setEquipoModalIndex(null);
                    setEquipoModalMarca("");
                    setEquipoModalModelo("");
                    setEquipoModalPhotos([]);
                    setIsEquipoModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir Equipo
                </button>
              </div>

              {formEquipos.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-gray-400 dark:text-gray-500 text-xs">
                  No hay equipos registrados para este servicio. Agregue al menos un equipo.
                </div>
              ) : (
                <div className="space-y-2">
                  {formEquipos.map((eq, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-855 rounded-xl border border-gray-150 dark:border-gray-800 hover:border-indigo-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-bold text-[10px] text-gray-400 dark:text-gray-500 block uppercase tracking-wider">Marca / Modelo</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {eq.marca} - {eq.modelo}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {eq.fotosDrive && eq.fotosDrive.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded-lg shrink-0">
                            <ImageIcon className="w-3 h-3" />
                            <span>{eq.fotosDrive.length} fotos</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEquipoModalIndex(idx);
                              setEquipoModalMarca(eq.marca);
                              setEquipoModalModelo(eq.modelo);
                              setEquipoModalPhotos(eq.fotosDrive || []);
                              setIsEquipoModalOpen(true);
                            }}
                            className="p-1.5 text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg transition-colors cursor-pointer border border-indigo-150 dark:border-indigo-900/40"
                            title="Editar Equipo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (eq.id) {
                                setDeletedEquipoIds(prev => [...prev, eq.id!]);
                              }
                              setFormEquipos(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition-colors cursor-pointer border border-red-150 dark:border-red-900/40"
                            title="Eliminar Equipo"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

        {/* Modal Overlay: Añadir / Editar Equipo */}
        {isEquipoModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-indigo-500" />
                  {equipoModalIndex !== null ? "Editar Equipo" : "Añadir Nuevo Equipo"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEquipoModalOpen(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Marca *
                    </label>
                    <input
                      type="text"
                      value={equipoModalMarca}
                      onChange={(e) => setEquipoModalMarca(e.target.value)}
                      placeholder="Ej. Samsung, Whirlpool"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Modelo *
                    </label>
                    <input
                      type="text"
                      value={equipoModalModelo}
                      onChange={(e) => setEquipoModalModelo(e.target.value)}
                      placeholder="Ej. Active DualWash"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                {/* Photo Upload inside modal */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fotos de Respaldo
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

                    {/* Photos list */}
                    {equipoModalPhotos.map((photo) => (
                      <div key={photo.id} className="relative group shrink-0 animate-scale-up">
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-14 h-14 rounded-xl border border-indigo-150 dark:border-indigo-900/35 bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center overflow-hidden group-hover:ring-2 group-hover:ring-indigo-500 transition-all block"
                          title={photo.name}
                        >
                          <ImageIcon className="w-6 h-6 text-indigo-400" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setEquipoModalPhotos(prev => prev.filter(p => p.id !== photo.id));
                          }}
                          className="absolute -top-1 -right-1 bg-red-650 hover:bg-red-700 text-white rounded-full p-0.5 shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer bg-red-600"
                          title="Eliminar Foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {uploadError && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2 flex items-center gap-1 animate-pulse">
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

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 dark:bg-gray-855 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEquipoModalOpen(false)}
                  className="px-4 py-2 border border-gray-250 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!equipoModalMarca.trim() || !equipoModalModelo.trim()) {
                      alert("Por favor, complete Marca y Modelo.");
                      return;
                    }
                    const newEq = {
                      marca: equipoModalMarca.trim(),
                      modelo: equipoModalModelo.trim(),
                      fotosDrive: equipoModalPhotos
                    };
                    
                    if (equipoModalIndex !== null) {
                      setFormEquipos(prev => {
                        const next = [...prev];
                        next[equipoModalIndex] = {
                          ...next[equipoModalIndex],
                          ...newEq
                        };
                        return next;
                      });
                    } else {
                      setFormEquipos(prev => [...prev, newEq]);
                    }
                    setIsEquipoModalOpen(false);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer active:scale-95"
                >
                  Guardar Equipo
                </button>
              </div>
            </div>
          </div>
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
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-extrabold transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer active:scale-95 group"
            title="Volver al panel principal"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver</span>
          </button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Lista de Servicios
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gestión y hojas de servicio de todos los servicios registrados.
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
            Nuevo Servicio
          </button>
        )}
      </div>

      {/* Search and Action Bar */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar servicio por dirección, ID o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      </div>

      {/* List Layout of Clientes with separated rows/cards */}
      <div className="space-y-2 animate-scale-up">
        {filteredClientes.length > 0 && (
          <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 bg-white/50 dark:bg-gray-900/50 rounded-xl border border-gray-150/60 dark:border-gray-800/60 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <div className="col-span-7">Domicilio / ID</div>
            <div className="col-span-3">Celular</div>
            <div className="col-span-2 text-right">Acciones</div>
          </div>
        )}
        {filteredClientes.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-8 text-center text-gray-450 dark:text-gray-500 text-xs shadow-none">
            No se encontraron servicios.
          </div>
        ) : (
          filteredClientes.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 rounded-xl py-2.5 px-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-xs hover:border-indigo-500/20 dark:hover:border-indigo-900/40 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center transition-all duration-200"
            >
              {/* Col 1: ID & Address & Note */}
              <div className="sm:col-span-7 space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {c.id && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold border border-indigo-100/60 dark:border-indigo-900/20">
                      ID: {formatClienteId(c)}
                    </span>
                  )}
                  <span className="font-bold text-gray-900 dark:text-white text-sm">
                    {[
                      c.calle ? `${c.calle} ${c.numero || ""}` : "",
                      c.barrio ? `B° ${c.barrio}` : "",
                      c.localidad || ""
                    ].filter(Boolean).join(", ") || "Domicilio no registrado"}
                  </span>
                  {c.clienteProblematico && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 text-[9px] font-bold">
                      <AlertTriangle className="w-2.5 h-2.5 animate-pulse" />
                      Conflictivo
                    </span>
                  )}
                </div>
                {c.observaciones && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 italic max-w-2xl truncate">
                    Nota: {c.observaciones}
                  </p>
                )}
              </div>

              {/* Col 2: Celular */}
              <div className="sm:col-span-3 text-xs text-gray-600 dark:text-gray-400 font-semibold">
                {c.telCel ? (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{c.telCel}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-400 dark:text-gray-550 italic">No registrado</span>
                )}
              </div>

              {/* Col 3: Actions */}
              <div className="sm:col-span-2 flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => handleStartEdit(c)}
                  className="p-1.5 text-indigo-650 hover:text-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/20 hover:bg-indigo-100/80 dark:hover:bg-indigo-950/40 rounded-lg transition-all cursor-pointer border border-indigo-100/40 dark:border-indigo-900/20 flex items-center justify-center hover:scale-105 active:scale-95"
                  title="Editar Cliente"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {isSuperadmin && (
                  <button
                    onClick={() => handleDeleteCliente(c.id || "")}
                    className="p-1.5 text-red-650 hover:text-red-700 bg-red-50/60 dark:bg-red-950/20 hover:bg-red-100/80 dark:hover:bg-red-950/40 rounded-lg transition-all cursor-pointer border border-red-100/40 dark:border-red-900/20 flex items-center justify-center hover:scale-105 active:scale-95"
                    title="Eliminar Cliente"
                  >
                    <Trash className="w-3.5 h-3.5" />
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
                {editingCliente ? "Editar Perfil de Servicio" : "Ingresar Nuevo Servicio"}
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
                  ¿Eliminar servicio?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará de forma permanente este servicio de la base de datos de forma irreversible.
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
                Sí, Eliminar Servicio
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
                  ¿Eliminar {selectedIds.length} servicios?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará de forma permanente los {selectedIds.length} servicios seleccionados de la base de datos de forma irreversible.
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
                {isBulkDeleting ? "Eliminando..." : `Sí, Eliminar ${selectedIds.length} Servicios`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
