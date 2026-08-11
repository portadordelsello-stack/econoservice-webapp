import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClienteSchema } from "../schemas";
import { ClientesService, EquiposService, ServiciosService, NotificationsService, toDate } from "../services/db";
import { StorageService } from "../services/storage";
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
  Plus,
  MessageSquare,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Loader2
} from "lucide-react";

const getWhatsAppUrl = (phone?: string) => {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (clean.length === 10 && !clean.startsWith("54")) {
    clean = "54" + clean;
  }
  return `https://wa.me/${clean}`;
};

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Clientes() {
  const { profile } = useAuth();
  const { navigate, selectedId, navigationData } = useNavigation();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Cliente[] | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [dateFilteredClientIds, setDateFilteredClientIds] = useState<string[] | null>(null);
  const [loadingDateFilter, setLoadingDateFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Server-side search with debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const results = await ClientesService.search(searchTerm.trim());
        setSearchResults(results);
      } catch (err) {
        console.error("Error searching clientes:", err);
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchClientsForDate = async () => {
      if (!selectedDate) {
        setDateFilteredClientIds(null);
        return;
      }
      setLoadingDateFilter(true);
      try {
        const ids = await ServiciosService.getClientIdsByFechaIngreso(selectedDate);
        setDateFilteredClientIds(ids);
      } catch (err) {
        console.error("Error fetching client IDs for date:", err);
        setDateFilteredClientIds([]);
      } finally {
        setLoadingDateFilter(false);
      }
    };
    
    fetchClientsForDate();
  }, [selectedDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDate]);

  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteEquipos, setClienteEquipos] = useState<Equipo[]>([]);
  const [clienteServicios, setClienteServicios] = useState<Servicio[]>([]);
  
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);
  
  // Bulk Delete States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  
  const isAdmin = profile?.rol === "superadmin" || profile?.rol === "admin" || profile?.rol === "administracion";

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
      await refreshSearchAndList();
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
  const [formCiudadOtros, setFormCiudadOtros] = useState("");
  const [formDepto, setFormDepto] = useState("");
  const [formPiso, setFormPiso] = useState("");
  const [formTorre, setFormTorre] = useState("");
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
    tipo: string;
    marca: string;
    modelo: string;
    desperfectoUsuario: string;
    fechaRetiro: string;
    fotosDrive: { id: string; name: string; url: string }[];
    newDesperfecto?: string;
    newFechaRetiro?: string;
    newFotosDrive?: { id: string; name: string; url: string }[];
  }[]>([]);
  const [deletedEquipoIds, setDeletedEquipoIds] = useState<string[]>([]);

  // Sub-view source state for adding/editing equipment
  const [equipmentSourceSubView, setEquipmentSourceSubView] = useState<"nuevo" | "editar" | null>(null);
  const [equipoModalIndex, setEquipoModalIndex] = useState<number | null>(null);
  const [equipoModalTipo, setEquipoModalTipo] = useState("Lavarropas");
  const [equipoModalMarca, setEquipoModalMarca] = useState("");
  const [equipoModalModelo, setEquipoModalModelo] = useState("");
  const [equipoModalDesperfecto, setEquipoModalDesperfecto] = useState("");
  const [equipoModalFecha, setEquipoModalFecha] = useState(getTodayDateString());
  const [equipoModalHoraDesdeHH, setEquipoModalHoraDesdeHH] = useState("");
  const [equipoModalHoraDesdeMM, setEquipoModalHoraDesdeMM] = useState("");
  const [equipoModalHoraHastaHH, setEquipoModalHoraHastaHH] = useState("");
  const [equipoModalHoraHastaMM, setEquipoModalHoraHastaMM] = useState("");
  const [equipoModalPhotos, setEquipoModalPhotos] = useState<{ id: string; name: string; url: string }[]>([]);
  const [allServices, setAllServices] = useState<Servicio[]>([]);
  const [showNewWorkOrderForm, setShowNewWorkOrderForm] = useState(false);
  const [modalIsEditingActiveOrder, setModalIsEditingActiveOrder] = useState(false);
  const [expandedHistoryServiceId, setExpandedHistoryServiceId] = useState<string | null>(null);

  const parseFechaRetiro = (fechaRetiroStr: string) => {
    if (!fechaRetiroStr) {
      return { date: "", desde: "", hasta: "" };
    }
    const parts = fechaRetiroStr.split("T");
    const date = parts[0] || "";
    const timePart = parts[1] || "";
    
    const rangeMatch = timePart.match(/de\s+(\d{2}:\d{2})\s+hasta\s+(\d{2}:\d{2})/);
    if (rangeMatch) {
      return { date, desde: rangeMatch[1], hasta: rangeMatch[2] };
    }
    
    const simpleMatch = timePart.match(/^(\d{2}:\d{2})/);
    if (simpleMatch) {
      return { date, desde: simpleMatch[1], hasta: "" };
    }
    
    return { date, desde: "", hasta: "" };
  };

  const formatFechaRetiro = (date: string, desde: string, hasta: string) => {
    if (!date) return "";
    if (desde && hasta) {
      return `${date}Tde ${desde} hasta ${hasta}`;
    }
    if (desde) {
      return `${date}T${desde}`;
    }
    return date;
  };

  // Step 1 - button click: open picker directly
  const handleConnectAndUpload = () => {
    setUploadError(null);
    photoInputRef.current?.click();
  };

  // Step 2 - file selected: upload to Firebase Storage
  const uploadFileToDrive = async (file: File) => {
    setUploadingPhoto(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const direccion = [formCalle.trim(), formNumero.trim()].filter(Boolean).join("_");
      const dirClean = direccion.replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚüÜñÑ]/g, "_").replace(/_+/g, "_");
      const filename = `equipo_${dirClean || "sin_dir"}_${Date.now()}.${ext}`;
      const result = await StorageService.uploadPhoto(file, filename);
      const newPhoto = { id: result.id, name: result.name, url: result.url };
      
      if (currentSubView === "equipo-form") {
        setEquipoModalPhotos(prev => [...prev, newPhoto]);
      } else {
        setUploadedPhotos(prev => [...prev, newPhoto]);
      }
      
      // Save immediately to Firestore if editing an existing equipment's service order in the modal
      if (currentSubView === "equipo-form" && equipoModalIndex !== null && editingId) {
        const eq = formEquipos[equipoModalIndex];
        if (eq && eq.id && !showNewWorkOrderForm) {
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
      setUploadError(err.message || "Error al subir la foto a Firebase Storage.");
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
    setFormCiudadOtros("");
    setFormDepto("");
    setFormPiso("");
    setFormTorre("");
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
    setEquipoModalIndex(null);
    setEquipoModalTipo("Lavarropas");
    setEquipoModalMarca("");
    setEquipoModalModelo("");
    setEquipoModalDesperfecto("");
    setEquipoModalFecha(getTodayDateString());
    setEquipoModalHoraDesdeHH("");
    setEquipoModalHoraDesdeMM("");
    setEquipoModalHoraHastaHH("");
    setEquipoModalHoraHastaMM("");
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
          tipo: "Lavarropas",
          marca: formMarca.trim() || "Genérico",
          modelo: formModelo.trim() || "Genérico",
          desperfectoUsuario: formDesperfectoUsuario.trim() || "No especificado",
          fechaRetiro: formFechaRetiro.trim() || "",
          fotosDrive: uploadedPhotos
        });
      }

      if (finalEquipos.length === 0) {
        setFormError("Debe añadir al menos un equipo en la sección de Equipos.");
        setFormSaving(false);
        return;
      }

      // Validation warning for logistics users
      if (profile?.rol === "logistica") {
        const warnings: string[] = [];
        if (!formNS1 && !formNS2 && !formNS3) {
          warnings.push("Debe seleccionar al menos una de las Opciones Logísticas (NS1, NS2, NS3)");
        }

        for (let i = 0; i < finalEquipos.length; i++) {
          const eq = finalEquipos[i];
          const isNewEq = !eq.id;
          const isPendingPickup = eq.id && eq.ingresoTaller === false;
          const isCreatingNewOrder = eq.id && eq.newDesperfecto !== undefined;

          if (isNewEq || isPendingPickup) {
            const eqLabel = `${eq.tipo || eq.marca || "Equipo"} #${i + 1}`;
            if (!eq.desperfectoUsuario || !eq.desperfectoUsuario.trim()) {
              warnings.push(`Falta desperfecto del usuario para ${eqLabel}`);
            }
            if (!eq.fotosDrive || eq.fotosDrive.length === 0) {
              warnings.push(`Faltan fotos de respaldo para ${eqLabel}`);
            }
            if (!eq.fechaRetiro || !eq.fechaRetiro.trim()) {
              warnings.push(`Falta fecha y horario de retiro para ${eqLabel}`);
            }
          } else if (isCreatingNewOrder) {
            const eqLabel = `${eq.tipo || eq.marca || "Equipo"} #${i + 1}`;
            if (!eq.newDesperfecto || !eq.newDesperfecto.trim()) {
              warnings.push(`Falta desperfecto del usuario para la nueva orden de ${eqLabel}`);
            }
            if (!eq.newFotosDrive || eq.newFotosDrive.length === 0) {
              warnings.push(`Faltan fotos de respaldo para la nueva orden de ${eqLabel}`);
            }
            if (!eq.newFechaRetiro || !eq.newFechaRetiro.trim()) {
              warnings.push(`Falta fecha y horario de retiro para la nueva orden de ${eqLabel}`);
            }
          }
        }

        if (warnings.length > 0) {
          alert(`Atención Logística:\n\nFaltan completar algunos datos requeridos:\n- ${warnings.join("\n- ")}\n\nEl pedido se guardará de todas formas.`);
        }
      }
      
      let calle = formCalle.trim();
      let numero = formNumero.trim();
      const numMatch = calle.match(/(.*?)\s+(\d+[\w\s/-]*)$/);
      if (numMatch) {
        calle = numMatch[1].trim();
        numero = numMatch[2].trim();
      }

      const clientName = formNombreApellido.trim() || 
        ((calle && numero) ? `${calle} ${numero}` : 
        (formTelCel.trim() ? `Cel: ${formTelCel.trim()}` : "Cliente S/N"));

      // 1. Create client
      const clienteId = await ClientesService.create({
        nombreApellido: clientName,
        telCel: formTelCel.trim() || "",
        calle,
        numero,
        localidad: (formCiudad === "Otros" ? formCiudadOtros : formCiudad).trim() || "",
        depto: formDepto.trim() || "",
        piso: formPiso.trim() || "",
        torre: formTorre.trim() || "",
        clienteProblematico: false,
        observaciones: formObservaciones.trim() || ""
      });

      // 2. Loop over finalEquipos and save them
      const selectedNS = [
        formNS1 ? "NS1" : "",
        formNS2 ? "NS2" : "",
        formNS3 ? "NS3" : ""
      ].filter(Boolean).join(", ");

      for (const eq of finalEquipos) {
        const equipoId = await EquiposService.create({
          clienteId,
          tipo: eq.tipo || "Lavarropas",
          marca: eq.marca.trim() || "Genérico",
          modelo: eq.modelo.trim() || "Genérico",
          observaciones: ""
        });

        const infoLogisticaFull = [
          eq.fechaRetiro && eq.fechaRetiro.trim() ? `Retiro acordado: ${eq.fechaRetiro.trim()}` : "",
          formNotasRetiro.trim() ? `Notas retiro: ${formNotasRetiro.trim()}` : "",
          selectedNS ? `Config: ${selectedNS}` : ""
        ].filter(Boolean).join(" | ");

        const newServId = await ServiciosService.create({
          clienteId,
          equipoId,
          fechaIngreso: new Date(),
          aparato: eq.tipo || "Lavarropas",
          marcaModelo: `${eq.marca.trim()} ${eq.modelo.trim()}`.trim(),
          desperfectoUsuario: eq.desperfectoUsuario || "No especificado",
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
      await refreshSearchAndList();
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
      const isPredefined = ["Santa Fe", "Santo Tomé", "Sauce", "Colastiné Norte", "Rincon", "Recreo", "Colastiné Sur"].includes(c.localidad || "");
      if (c.localidad && !isPredefined) {
        setFormCiudad("Otros");
        setFormCiudadOtros(c.localidad);
      } else {
        setFormCiudad(c.localidad || "");
        setFormCiudadOtros("");
      }
      setFormDepto(c.depto || "");
      setFormPiso(c.piso || "");
      setFormTorre(c.torre || "");
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
        
        // Fetch only services of this client
        const clientServices = await ServiciosService.getByCliente(c.id);
        setAllServices(clientServices);
        
        const mappedEquipos = equipments.map(eq => {
          // Find services for this specific equipment
          const eqServices = clientServices.filter(s => s.equipoId === eq.id)
            .sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });

          const latestSrv = eqServices.length > 0 ? eqServices[0] : null;
          const fotosDrive = latestSrv ? (latestSrv.fotosDrive || []) : [];
          const desperfectoUsuario = latestSrv ? (latestSrv.desperfectoUsuario || "") : "";
          const ingresoTaller = latestSrv ? (latestSrv.ingresoTaller || false) : false;
          
          let fechaRetiro = "";
          if (latestSrv) {
            const logistica = latestSrv.infoLogistica || "";
            const parts = logistica.split(" | ");
            parts.forEach(part => {
              if (part.startsWith("Retiro acordado: ")) {
                const val = part.replace("Retiro acordado: ", "").trim();
                // Accept new format: "YYYY-MM-DDTde HH:MM hasta HH:MM" OR legacy "YYYY-MM-DDTHH:MM"
                if (val) {
                  fechaRetiro = val;
                }
              }
            });
          }

          return {
            id: eq.id,
            tipo: eq.tipo || "Lavarropas",
            marca: eq.marca || "",
            modelo: eq.modelo || "",
            desperfectoUsuario,
            fotosDrive,
            fechaRetiro,
            ingresoTaller: ingresoTaller !== false
          };
        });
        
        setFormEquipos(mappedEquipos);
        setDeletedEquipoIds([]);

        if (equipments.length > 0) {
          const eq = equipments[0];
          setEditingEquipoId(eq.id || null);
          setFormMarca(eq.marca || "");
          setFormModelo(eq.modelo || "");

          const activeEqServices = clientServices.filter(s => s.equipoId === eq.id);
          if (activeEqServices.length > 0) {
            const srv = activeEqServices[0];
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

      // Auto-open equipment modal if requested via navigationData
      const autoOpenId = navigationData?.autoOpenEquipoId;
      if (autoOpenId) {
        const autoIdx = mappedEquipos.findIndex(eq => eq.id === autoOpenId);
        if (autoIdx !== -1) {
          const autoEq = mappedEquipos[autoIdx];
          setEquipmentSourceSubView("editar");
          setEquipoModalIndex(autoIdx);
          setEquipoModalTipo(autoEq.tipo || "Lavarropas");
          const combined = autoEq.marca && autoEq.modelo && autoEq.modelo !== "-" && autoEq.modelo !== "Genérico"
            ? `${autoEq.marca} ${autoEq.modelo}`.trim()
            : (autoEq.marca || autoEq.modelo || "");
          setEquipoModalMarca(combined);
          setEquipoModalModelo("");
          
          if (autoEq.id) {
            if (autoEq.ingresoTaller === false) {
              setEquipoModalDesperfecto(autoEq.desperfectoUsuario || "");
              const parsed = parseFechaRetiro(autoEq.fechaRetiro || "");
              setEquipoModalFecha(parsed.date);
              setEquipoModalHoraDesdeHH(parsed.desde ? parsed.desde.split(":")[0] || "" : "");
              setEquipoModalHoraDesdeMM(parsed.desde ? parsed.desde.split(":")[1] || "" : "");
              setEquipoModalHoraHastaHH(parsed.hasta ? parsed.hasta.split(":")[0] || "" : "");
              setEquipoModalHoraHastaMM(parsed.hasta ? parsed.hasta.split(":")[1] || "" : "");
              setEquipoModalPhotos(autoEq.fotosDrive || []);
              setShowNewWorkOrderForm(true);
            } else {
              setEquipoModalDesperfecto(autoEq.newDesperfecto || "");
              const parsed = parseFechaRetiro(autoEq.newFechaRetiro || "");
              setEquipoModalFecha(parsed.date);
              setEquipoModalHoraDesdeHH(parsed.desde ? parsed.desde.split(":")[0] || "" : "");
              setEquipoModalHoraDesdeMM(parsed.desde ? parsed.desde.split(":")[1] || "" : "");
              setEquipoModalHoraHastaHH(parsed.hasta ? parsed.hasta.split(":")[0] || "" : "");
              setEquipoModalHoraHastaMM(parsed.hasta ? parsed.hasta.split(":")[1] || "" : "");
              setEquipoModalPhotos(autoEq.newFotosDrive || []);
              setShowNewWorkOrderForm(!!autoEq.newDesperfecto);
            }
          }
          setExpandedHistoryServiceId(null);
          setCurrentSubView("equipo-form");
        } else {
          setCurrentSubView("editar");
        }
      } else {
        setCurrentSubView("editar");
      }
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

      // 1. Process deletions FIRST so deleted equipments & services are removed regardless of remaining count
      const clientServices = await ServiciosService.getByCliente(editingId);
      for (const delId of deletedEquipoIds) {
        const eqServices = clientServices.filter(s => s.equipoId === delId);
        for (const srv of eqServices) {
          if (srv.id) {
            await ServiciosService.delete(srv.id);
          }
        }
        await EquiposService.delete(delId);
      }
      setDeletedEquipoIds([]);

      let finalEquipos = [...formEquipos];
      if (finalEquipos.length === 0 && (formMarca.trim() || formModelo.trim())) {
        finalEquipos.push({
          tipo: "Lavarropas",
          marca: formMarca.trim() || "Genérico",
          modelo: formModelo.trim() || "Genérico",
          desperfectoUsuario: formDesperfectoUsuario.trim() || "No especificado",
          fechaRetiro: formFechaRetiro.trim() || "",
          fotosDrive: uploadedPhotos
        });
      }

      let calle = formCalle.trim();
      let numero = formNumero.trim();
      const numMatch = calle.match(/(.*?)\s+(\d+[\w\s/-]*)$/);
      if (numMatch) {
        calle = numMatch[1].trim();
        numero = numMatch[2].trim();
      }

      const currentClient = clientes.find(c => c.id === editingId);
      const oldAddressName = currentClient 
        ? `${currentClient.calle || ""} ${currentClient.numero || ""}`.trim() 
        : "";
      const isAutoName = !formNombreApellido.trim() || 
                         (oldAddressName && formNombreApellido.trim() === oldAddressName);

      const clientName = isAutoName
        ? ((calle && numero) ? `${calle} ${numero}` : (formTelCel.trim() ? `Cel: ${formTelCel.trim()}` : "Cliente S/N"))
        : formNombreApellido.trim();

      // 2. Update client details
      await ClientesService.update(editingId, {
        nombreApellido: clientName,
        telCel: formTelCel.trim() || "",
        calle,
        numero,
        localidad: (formCiudad === "Otros" ? formCiudadOtros : formCiudad).trim() || "",
        depto: formDepto.trim() || "",
        piso: formPiso.trim() || "",
        torre: formTorre.trim() || "",
        observaciones: formObservaciones.trim() || ""
      });

      if (finalEquipos.length === 0) {
        setFormSuccess(true);
        await refreshSearchAndList();
        setFormSaving(false);
        return;
      }

      // Validation warning for logistics users
      if (profile?.rol === "logistica") {
        const warnings: string[] = [];
        if (!formNS1 && !formNS2 && !formNS3) {
          warnings.push("Debe seleccionar al menos una de las Opciones Logísticas (NS1, NS2, NS3)");
        }

        for (let i = 0; i < finalEquipos.length; i++) {
          const eq = finalEquipos[i];
          const isNewEq = !eq.id;
          const isPendingPickup = eq.id && eq.ingresoTaller === false;
          const isCreatingNewOrder = eq.id && eq.newDesperfecto !== undefined;

          if (isNewEq || isPendingPickup) {
            const eqLabel = `${eq.tipo || eq.marca || "Equipo"} #${i + 1}`;
            if (!eq.desperfectoUsuario || !eq.desperfectoUsuario.trim()) {
              warnings.push(`Falta desperfecto del usuario para ${eqLabel}`);
            }
            if (!eq.fotosDrive || eq.fotosDrive.length === 0) {
              warnings.push(`Faltan fotos de respaldo para ${eqLabel}`);
            }
            if (!eq.fechaRetiro || !eq.fechaRetiro.trim()) {
              warnings.push(`Falta fecha y horario de retiro para ${eqLabel}`);
            }
          } else if (isCreatingNewOrder) {
            const eqLabel = `${eq.tipo || eq.marca || "Equipo"} #${i + 1}`;
            if (!eq.newDesperfecto || !eq.newDesperfecto.trim()) {
              warnings.push(`Falta desperfecto del usuario para la nueva orden de ${eqLabel}`);
            }
            if (!eq.newFotosDrive || eq.newFotosDrive.length === 0) {
              warnings.push(`Faltan fotos de respaldo para la nueva orden de ${eqLabel}`);
            }
            if (!eq.newFechaRetiro || !eq.newFechaRetiro.trim()) {
              warnings.push(`Falta fecha y horario de retiro para la nueva orden de ${eqLabel}`);
            }
          }
        }

        if (warnings.length > 0) {
          alert(`Atención Logística:\n\nFaltan completar algunos datos requeridos:\n- ${warnings.join("\n- ")}\n\nEl pedido se actualizará de todas formas.`);
        }
      }

      // 3. Prepare logistics text
      const selectedNS = [
        formNS1 ? "NS1" : "",
        formNS2 ? "NS2" : "",
        formNS3 ? "NS3" : ""
      ].filter(Boolean).join(", ");

      // 4. Process remaining equipments
      for (const eq of finalEquipos) {
        if (eq.id) {
          // Existing equipment: update details
          await EquiposService.update(eq.id, {
            tipo: eq.tipo || "Lavarropas",
            marca: eq.marca.trim() || "Genérico",
            modelo: eq.modelo.trim() || "Genérico"
          });

          // Propagate brand/model corrections to all services for this equipment
          const eqServices = allServices.filter(s => s.clienteId === editingId && s.equipoId === eq.id);
          for (const srv of eqServices) {
            await ServiciosService.update(srv.id!, {
              aparato: eq.tipo || "Lavarropas",
              marcaModelo: `${eq.marca.trim()} ${eq.modelo.trim()}`.trim()
            }, profile?.uid || "system", profile?.nombre || "Usuario");
          }

          // If the equipment has an active service order pending pickup (ingresoTaller === false), update its desperfecto and logistics info
          const sortedServices = eqServices.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });

          if (sortedServices.length > 0) {
            const activeSrv = sortedServices[0];
            const infoLogisticaFull = [
              eq.fechaRetiro && eq.fechaRetiro.trim() ? `Retiro acordado: ${eq.fechaRetiro.trim()}` : "",
              formNotasRetiro.trim() ? `Notas retiro: ${formNotasRetiro.trim()}` : "",
              selectedNS ? `Config: ${selectedNS}` : ""
            ].filter(Boolean).join(" | ");

            await ServiciosService.update(activeSrv.id!, {
              desperfectoUsuario: eq.desperfectoUsuario || "No especificado",
              infoLogistica: infoLogisticaFull,
              fotosDrive: eq.fotosDrive || []
            }, profile?.uid || "system", profile?.nombre || "Usuario");
          }

          // If there is a pending new work order, create it!
          if (eq.newDesperfecto) {
            const newLogisticaFull = [
              eq.newFechaRetiro && eq.newFechaRetiro.trim() ? `Retiro acordado: ${eq.newFechaRetiro.trim()}` : "",
              formNotasRetiro.trim() ? `Notas retiro: ${formNotasRetiro.trim()}` : "",
              selectedNS ? `Config: ${selectedNS}` : ""
            ].filter(Boolean).join(" | ");

            const newServId = await ServiciosService.create({
              clienteId: editingId,
              equipoId: eq.id,
              fechaIngreso: new Date(),
              aparato: eq.tipo || "Lavarropas",
              marcaModelo: `${eq.marca.trim()} ${eq.modelo.trim()}`.trim(),
              desperfectoUsuario: eq.newDesperfecto,
              infoLogistica: newLogisticaFull,
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
              fotosDrive: eq.newFotosDrive || [],
              createdBy: profile?.uid || "system"
            }, profile?.uid || "system", profile?.nombre || "Usuario");

            // Notify Logistica for new work order
            await NotificationsService.create({
              targetRole: "logistica",
              title: "Nueva Orden de Trabajo (Aparato Existente)",
              message: `Se registró una nueva orden de trabajo (${eq.marca} ${eq.modelo}) para el cliente ${formNombreApellido}.`,
              serviceId: newServId
            });
          }
        } else {
          // New equipment added in this editing session
          const infoLogisticaFull = [
            eq.fechaRetiro && eq.fechaRetiro.trim() ? `Retiro acordado: ${eq.fechaRetiro.trim()}` : "",
            formNotasRetiro.trim() ? `Notas retiro: ${formNotasRetiro.trim()}` : "",
            selectedNS ? `Config: ${selectedNS}` : ""
          ].filter(Boolean).join(" | ");

          const newEqId = await EquiposService.create({
            clienteId: editingId,
            tipo: eq.tipo || "Lavarropas",
            marca: eq.marca.trim() || "Genérico",
            modelo: eq.modelo.trim() || "Genérico",
            observaciones: ""
          });
          eq.id = newEqId;

          const newServId = await ServiciosService.create({
            clienteId: editingId,
            equipoId: newEqId,
            fechaIngreso: new Date(),
            aparato: eq.tipo || "Lavarropas",
            marcaModelo: `${eq.marca.trim()} ${eq.modelo.trim()}`.trim(),
            desperfectoUsuario: eq.desperfectoUsuario || "No especificado",
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

      setFormSuccess(true);
      await refreshSearchAndList();
      if (editingId) {
        const clientServices = await ServiciosService.getByCliente(editingId);
        setAllServices(clientServices);
      }
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
    watch,
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
      localidadOtros: "",
      barrio: "",
      zona: "",
      calle: "",
      numero: "",
      torre: "",
      piso: "",
      depto: "",
      clienteProblematico: false,
      observaciones: ""
    }
  });

  const watchedLocalidad = watch("localidad");

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

  const refreshSearchAndList = async () => {
    await loadClientes();
    if (searchTerm.trim()) {
      try {
        const results = await ClientesService.search(searchTerm.trim());
        setSearchResults(results);
      } catch (err) {
        console.error("Error refreshing search results:", err);
      }
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
      localidadOtros: "",
      barrio: "",
      zona: "",
      calle: "",
      numero: "",
      torre: "",
      piso: "",
      depto: "",
      clienteProblematico: false,
      observaciones: ""
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    const isPredefined = ["Santa Fe", "Santo Tomé", "Sauce", "Colastiné Norte", "Rincon", "Recreo", "Colastiné Sur"].includes(cliente.localidad || "");
    const finalLocalidad = isPredefined ? (cliente.localidad || "") : (cliente.localidad ? "Otros" : "");
    const customLocalidadValue = !isPredefined ? (cliente.localidad || "") : "";

    reset({
      nombreApellido: cliente.nombreApellido,
      telFijo: cliente.telFijo || "",
      telCel: cliente.telCel || "",
      telCelBis: cliente.telCelBis || "",
      telCelOtro: cliente.telCelOtro || "",
      localidad: finalLocalidad,
      localidadOtros: customLocalidadValue,
      barrio: cliente.barrio || "",
      zona: cliente.zona || "",
      calle: cliente.calle || "",
      numero: cliente.numero || "",
      torre: cliente.torre || "",
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
      if (finalData.localidad === "Otros") {
        finalData.localidad = finalData.localidadOtros || "";
      }
      delete finalData.localidadOtros;
      if (!finalData.nombreApellido || finalData.nombreApellido.trim() === "") {
        if (finalData.calle?.trim() && finalData.numero?.trim()) {
          finalData.nombreApellido = `${finalData.calle.trim()} ${finalData.numero.trim()}`;
        } else {
          finalData.nombreApellido = finalData.telCel?.trim() ? `Cel: ${finalData.telCel.trim()}` : "Cliente S/N";
        }
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
      await refreshSearchAndList();
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

  // Use server-side search results when searching, otherwise use all loaded clientes filtered by date
  const baseList = searchResults !== null ? searchResults : clientes;
  const filteredClientes = baseList.filter(c => {
    if (selectedDate) {
      if (!dateFilteredClientIds || !dateFilteredClientIds.includes(c.id!)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredClientes.length / itemsPerPage));
  const paginatedClientes = filteredClientes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            Panel de Pedidos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Seleccione una de las siguientes opciones para continuar.
          </p>
        </div>

        {/* Option Cards */}
        <div className={`grid grid-cols-1 ${profile?.rol === "logistica" ? "max-w-2xl" : "md:grid-cols-2 max-w-4xl"} mx-auto pt-6 gap-6`}>
          
          {/* Card: Nuevo Pedido */}
          {profile?.rol !== "logistica" && (
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
                    Nuevo Pedido
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Registra un nuevo pedido junto con los datos de su domicilio, su equipo, la fecha de retiro acordada, desperfecto reportado y observaciones de cobro de forma manual y directa.
                  </p>
                </div>
              </div>
              <div className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 gap-1 pt-2">
                <span>Comenzar registro</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          )}

          {/* Card: Pedidos */}
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
                  Pedidos
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Explora la lista completa de pedidos registrados, realiza búsquedas por dirección, nombre o teléfono, y visualiza el historial de equipos y servicios de cada registro.
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
              {isEditMode ? "Editar Pedido" : "Ingresar Nuevo Pedido"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isEditMode 
                ? "Modifique los campos correspondientes para actualizar la ficha del pedido, su equipo y los datos del pedido."
                : "Complete el formulario para registrar el pedido, su equipo y los datos del retiro acordado."
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
                {isEditMode ? "¡Pedido Actualizado con Éxito!" : "¡Pedido Registrado con Éxito!"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                {isEditMode 
                  ? "La información del pedido, su equipo y los datos del pedido han sido actualizados de forma correcta."
                  : <>El pedido con teléfono <strong>{formTelCel || "S/N"}</strong> se ha guardado en la base de datos junto con su equipo y orden de servicio inicial.</>
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
                  Ingresar Otro Pedido
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCurrentSubView("directorio");
                }}
                className={`w-full sm:w-auto px-5 py-2.5 ${isEditMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-855 text-gray-700 dark:text-gray-300'} font-semibold text-sm rounded-xl cursor-pointer transition-colors`}
              >
                Ir a Pedidos
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
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-4">
                <div className="sm:col-span-2 md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Calle
                  </label>
                  <input
                    type="text"
                    value={formCalle}
                    onChange={(e) => setFormCalle(e.target.value)}
                    placeholder="Ej. Av. Siempreviva"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Número
                  </label>
                  <input
                    type="text"
                    value={formNumero}
                    onChange={(e) => setFormNumero(e.target.value)}
                    placeholder="Ej. 742"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Ciudad / Localidad
                  </label>
                  <select
                    value={formCiudad}
                    onChange={(e) => setFormCiudad(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="">Seleccione una localidad...</option>
                    <option value="Santa Fe">Santa Fe</option>
                    <option value="Santo Tomé">Santo Tomé</option>
                    <option value="Sauce">Sauce</option>
                    <option value="Colastiné Norte">Colastiné Norte</option>
                    <option value="Rincon">Rincon</option>
                    <option value="Recreo">Recreo</option>
                    <option value="Colastiné Sur">Colastiné Sur</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                {formCiudad === "Otros" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Especificar Localidad
                    </label>
                    <input
                      type="text"
                      value={formCiudadOtros}
                      onChange={(e) => setFormCiudadOtros(e.target.value)}
                      placeholder="Ej. Esperanza"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Torre
                  </label>
                  <input
                    type="text"
                    value={formTorre}
                    onChange={(e) => setFormTorre(e.target.value)}
                    placeholder="Ej. A o 1"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Piso
                  </label>
                  <input
                    type="text"
                    value={formPiso}
                    onChange={(e) => setFormPiso(e.target.value)}
                    placeholder="Ej. 3"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Dpto
                  </label>
                  <input
                    type="text"
                    value={formDepto}
                    onChange={(e) => setFormDepto(e.target.value)}
                    placeholder="Ej. B"
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
                    setEquipmentSourceSubView(currentSubView as "nuevo" | "editar");
                    setModalIsEditingActiveOrder(true);
                    setEquipoModalIndex(null);
                    setEquipoModalTipo("Lavarropas");
                    setEquipoModalMarca("");
                    setEquipoModalModelo("");
                    setEquipoModalDesperfecto("");
                    setEquipoModalFecha(getTodayDateString());
                    setEquipoModalHoraDesdeHH("");
                    setEquipoModalHoraDesdeMM("");
                    setEquipoModalHoraHastaHH("");
                    setEquipoModalHoraHastaMM("");
                    setEquipoModalPhotos([]);
                    setShowNewWorkOrderForm(true);
                    setExpandedHistoryServiceId(null);
                    setCurrentSubView("equipo-form");
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
                <div className="grid grid-cols-1 gap-3">
                  {formEquipos.map((eq, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setEquipmentSourceSubView(currentSubView as "nuevo" | "editar");
                        setEquipoModalIndex(idx);
                        setEquipoModalTipo(eq.tipo || "Lavarropas");
                        const combined = eq.marca && eq.modelo && eq.modelo !== "-" && eq.modelo !== "Genérico"
                          ? `${eq.marca} ${eq.modelo}`.trim()
                          : (eq.marca || eq.modelo || "");
                        setEquipoModalMarca(combined);
                        setEquipoModalModelo("");
                        
                        if (eq.id) {
                          // Existing equipment: always show the history list first, do not open any order form automatically
                          setModalIsEditingActiveOrder(false);
                          setShowNewWorkOrderForm(false);
                          setEquipoModalDesperfecto(eq.desperfectoUsuario || "");
                          const parsed = parseFechaRetiro(eq.fechaRetiro || "");
                          setEquipoModalFecha(parsed.date || getTodayDateString());
                          setEquipoModalHoraDesdeHH(parsed.desde ? parsed.desde.split(":")[0] || "" : "");
                          setEquipoModalHoraDesdeMM(parsed.desde ? parsed.desde.split(":")[1] || "" : "");
                          setEquipoModalHoraHastaHH(parsed.hasta ? parsed.hasta.split(":")[0] || "" : "");
                          setEquipoModalHoraHastaMM(parsed.hasta ? parsed.hasta.split(":")[1] || "" : "");
                          setEquipoModalPhotos(eq.fotosDrive || []);
                        } else {
                          // New equipment: show form immediately
                          setModalIsEditingActiveOrder(true);
                          setEquipoModalDesperfecto(eq.desperfectoUsuario || "");
                          const parsed = parseFechaRetiro(eq.fechaRetiro || "");
                          setEquipoModalFecha(parsed.date || getTodayDateString());
                          setEquipoModalHoraDesdeHH(parsed.desde ? parsed.desde.split(":")[0] || "" : "");
                          setEquipoModalHoraDesdeMM(parsed.desde ? parsed.desde.split(":")[1] || "" : "");
                          setEquipoModalHoraHastaHH(parsed.hasta ? parsed.hasta.split(":")[0] || "" : "");
                          setEquipoModalHoraHastaMM(parsed.hasta ? parsed.hasta.split(":")[1] || "" : "");
                          setEquipoModalPhotos(eq.fotosDrive || []);
                          setShowNewWorkOrderForm(true);
                        }
                        
                        setExpandedHistoryServiceId(null);
                        setCurrentSubView("equipo-form");
                      }}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-855 rounded-2xl border border-gray-150 dark:border-gray-800/80 hover:border-indigo-500/50 dark:hover:border-indigo-900/60 hover:bg-white dark:hover:bg-gray-900/40 hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-extrabold text-[10px] text-indigo-600 dark:text-indigo-400 block uppercase tracking-wider mb-0.5">
                            {eq.tipo || "Lavarropas"}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {eq.marca} - {eq.modelo}
                          </span>
                          {eq.fechaRetiro && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                              Retiro: {eq.fechaRetiro.includes("Tde") ? eq.fechaRetiro.replace("Tde", " de") : eq.fechaRetiro.replace("T", " ")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Teléfono Celular
                      </label>
                      {formTelCel && (
                        <a
                          href={getWhatsAppUrl(formTelCel)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-[10px] font-bold transition-all shadow-xs cursor-pointer"
                          title="Enviar mensaje por WhatsApp"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formTelCel}
                      onChange={(e) => setFormTelCel(e.target.value)}
                      placeholder="Ej. +54 9 11 1234-5678"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </div>
                 {/* Info Logística */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Info Logística
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
                {isAdmin && (
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
                )}
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

  if (currentSubView === "equipo-form") {
    const isEditMode = equipoModalIndex !== null;
    return (
      <div className="space-y-6 animate-fade-in font-sans">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={() => {
                if (equipmentSourceSubView) {
                  setCurrentSubView(equipmentSourceSubView);
                } else {
                  setCurrentSubView("menu");
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-55 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Volver</span>
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Laptop className="w-8 h-8 text-indigo-500 shrink-0" />
              {isEditMode ? "Editar Equipo" : "Añadir Nuevo Equipo"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isEditMode ? "Modifique los detalles del equipo seleccionado." : "Complete los datos para agregar un nuevo equipo al servicio."}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Tipo de Aparato *
              </label>
              <select
                value={equipoModalTipo}
                onChange={(e) => setEquipoModalTipo(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
              >
                <option value="Lavarropas">Lavarropas</option>
                <option value="Lavavajillas">Lavavajillas</option>
                <option value="Microondas">Microondas</option>
                <option value="Secarropas Centrifugo">Secarropas Centrifugo</option>
                <option value="Lavarropas Calor">Lavarropas Calor</option>
                <option value="Ventilador">Ventilador</option>
              </select>
            </div>
            
             <div>
               <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                 Marca y Modelo {isAdmin ? "(opcional)" : "*"}
               </label>
               <input
                 type="text"
                 value={equipoModalMarca}
                 onChange={(e) => setEquipoModalMarca(e.target.value)}
                 placeholder="Ej. Samsung Active DualWash"
                 className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
               />
             </div>
            </div>
            
          {/* History list for existing equipment */}
          {isEditMode && !showNewWorkOrderForm && (
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-indigo-500" />
                  Historial de Órdenes de Trabajo
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setModalIsEditingActiveOrder(false); // Creating a new O.T.
                    setEquipoModalDesperfecto("");
                    setEquipoModalFecha(getTodayDateString());
                    setEquipoModalHoraDesdeHH("");
                    setEquipoModalHoraDesdeMM("");
                    setEquipoModalHoraHastaHH("");
                    setEquipoModalHoraHastaMM("");
                    setEquipoModalPhotos([]);
                    setShowNewWorkOrderForm(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva Orden de Trabajo
                </button>
              </div>

              {(() => {
                const currentEqId = formEquipos[equipoModalIndex!]?.id;
                const eqServices = allServices
                  .filter(s => s.equipoId === currentEqId)
                  .sort((a, b) => {
                    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return dateB - dateA;
                  });

                if (eqServices.length === 0) {
                  return (
                    <p className="text-xs text-slate-400 py-2 italic text-center">
                      No hay órdenes de trabajo previas para este equipo.
                    </p>
                  );
                }

                return (
                  <div className="space-y-2">
                    {eqServices.map((srv, idx) => {
                      const isExpanded = expandedHistoryServiceId === srv.id;
                      const isLastOrder = idx === 0;
                      const canEditOrder = isLastOrder && (profile?.rol === "superadmin" || profile?.rol === "admin" || profile?.rol === "logistica");
                      
                      let serviceDateStr = "Sin fecha";
                      const dateToUse = srv.fechaIngreso || srv.createdAt;
                      if (dateToUse) {
                        try {
                          const isoStr = typeof dateToUse === "string" ? dateToUse : new Date(dateToUse).toISOString();
                          const ymd = isoStr.substring(0, 10);
                          const [y, m, d] = ymd.split("-");
                          serviceDateStr = `${d}/${m}/${y}`;
                        } catch {
                          serviceDateStr = "Sin fecha";
                        }
                      }
                      return (
                        <div
                          key={srv.id}
                          className="bg-slate-50 dark:bg-gray-855 border border-slate-200/60 dark:border-gray-800 rounded-xl overflow-hidden transition-all duration-200"
                        >
                          <div
                            onClick={() => setExpandedHistoryServiceId(isExpanded ? null : srv.id!)}
                            className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-gray-800/40 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                                O.T. #{srv.numeroServicio || "S/N"}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-gray-850 text-slate-600 dark:text-gray-300">
                                {serviceDateStr}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {canEditOrder && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModalIsEditingActiveOrder(true); // Editing active order
                                    const eq = formEquipos[equipoModalIndex!];
                                    if (eq) {
                                      setEquipoModalDesperfecto(eq.desperfectoUsuario || "");
                                      const parsed = parseFechaRetiro(eq.fechaRetiro || "");
                                      setEquipoModalFecha(parsed.date);
                                      setEquipoModalHoraDesdeHH(parsed.desde ? parsed.desde.split(":")[0] || "" : "");
                                      setEquipoModalHoraDesdeMM(parsed.desde ? parsed.desde.split(":")[1] || "" : "");
                                      setEquipoModalHoraHastaHH(parsed.hasta ? parsed.hasta.split(":")[0] || "" : "");
                                      setEquipoModalHoraHastaMM(parsed.hasta ? parsed.hasta.split(":")[1] || "" : "");
                                      setEquipoModalPhotos(eq.fotosDrive || []);
                                      setShowNewWorkOrderForm(true);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-55 dark:bg-indigo-950/40 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer mr-1"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>EDITAR</span>
                                </button>
                              )}
                              {(profile?.rol === "superadmin" || profile?.rol === "admin") && srv.id && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm("¿Está seguro que desea eliminar esta orden de trabajo? Esta acción eliminará permanentemente la orden y todos sus registros asociados.")) {
                                      try {
                                        await ServiciosService.delete(srv.id!);
                                        setAllServices(prev => prev.filter(s => s.id !== srv.id));
                                        alert("Orden de trabajo eliminada correctamente.");
                                      } catch (err: any) {
                                        console.error("Error deleting service order:", err);
                                        alert("Error al intentar eliminar la orden de trabajo.");
                                      }
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 dark:bg-red-950/40 hover:bg-red-650 dark:hover:bg-red-650 hover:text-white text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/30 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer mr-1"
                                  title="Eliminar Orden"
                                >
                                  <Trash className="w-3 h-3" />
                                  <span>ELIMINAR</span>
                                </button>
                              )}
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                srv.estado === "ENTREGADO"
                                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                                  : srv.estado === "TERMINADO"
                                  ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                              }`}>
                                {getEstadoLabel(srv.estado)}
                              </span>
                              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-3.5 border-t border-slate-200/50 dark:border-gray-850 bg-white dark:bg-gray-900/40 text-xs space-y-2.5">
                              <div>
                                <span className="block font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">
                                  Problema reportado (Cliente):
                                </span>
                                <p className="text-slate-800 dark:text-gray-200 font-medium whitespace-pre-line">
                                  {srv.desperfectoUsuario || "No especificado"}
                                </p>
                              </div>
                              {srv.notasInternas && (
                                <div>
                                  <span className="block font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">
                                    Reseña Interna Servicios:
                                  </span>
                                  <p className="text-slate-800 dark:text-gray-200 font-medium whitespace-pre-line bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                                    {srv.notasInternas}
                                  </p>
                                </div>
                              )}
                              {(srv.serviciosRequeridos || srv.diagnostico) && (
                                <div>
                                  <span className="block font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">
                                    Servicios Requeridos / Diagnóstico Técnico:
                                  </span>
                                  <p className="text-slate-700 dark:text-gray-300 font-medium whitespace-pre-line bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2">
                                    {[srv.serviciosRequeridos, srv.diagnostico].filter(Boolean).join("\n— ")}
                                  </p>
                                </div>
                              )}
                              {profile?.rol === "superadmin" && (
                                <div className="pt-2.5 border-t border-slate-150 dark:border-gray-800 space-y-2.5">
                                  <span className="block font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[9px]">
                                    Panel de servicios convenidos
                                  </span>
                                  {srv.serviciosConvenidos && (
                                    <div>
                                      <span className="block font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">
                                        Servicios Convenidos:
                                      </span>
                                      <p className="text-slate-700 dark:text-gray-300 font-medium whitespace-pre-line">
                                        {srv.serviciosConvenidos}
                                      </p>
                                    </div>
                                  )}
                                  {(srv.presupuestoTexto || srv.presupuesto) && (
                                    <div>
                                      <span className="block font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">
                                        Presupuesto:
                                      </span>
                                      <p className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        {srv.presupuestoTexto || `$${srv.presupuesto}`}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {srv.fotosDrive && srv.fotosDrive.length > 0 && (
                                <div>
                                  <span className="block font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider text-[9px] mb-1">
                                    Fotos de Respaldo:
                                  </span>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {srv.fotosDrive.map((photo: any) => (
                                      <a
                                        key={photo.id}
                                        href={photo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-lg border border-indigo-150 dark:border-indigo-900/35 bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all block"
                                        title={photo.name}
                                      >
                                        <ImageIcon className="w-5 h-5 text-indigo-400" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {canEditOrder && (
                                <div className="pt-2.5 border-t border-slate-150 dark:border-gray-800 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModalIsEditingActiveOrder(true);
                                      const eq = formEquipos[equipoModalIndex!];
                                      if (eq) {
                                        setEquipoModalDesperfecto(eq.desperfectoUsuario || "");
                                        const parsed = parseFechaRetiro(eq.fechaRetiro || "");
                                        setEquipoModalFecha(parsed.date);
                                        setEquipoModalHoraDesdeHH(parsed.desde ? parsed.desde.split(":")[0] || "" : "");
                                        setEquipoModalHoraDesdeMM(parsed.desde ? parsed.desde.split(":")[1] || "" : "");
                                        setEquipoModalHoraHastaHH(parsed.hasta ? parsed.hasta.split(":")[0] || "" : "");
                                        setEquipoModalHoraHastaMM(parsed.hasta ? parsed.hasta.split(":")[1] || "" : "");
                                        setEquipoModalPhotos(eq.fotosDrive || []);
                                        setShowNewWorkOrderForm(true);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-extrabold shadow-sm hover:shadow active:scale-95 cursor-pointer uppercase"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Editar Orden de Trabajo</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* New Work Order/Initial service form */}
          {(!isEditMode || showNewWorkOrderForm) && (
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  {isEditMode ? (modalIsEditingActiveOrder ? "Editar Orden de Trabajo" : "Nueva Orden de Trabajo") : "Detalles del Servicio Inicial"}
                </h3>
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setEquipoModalDesperfecto("");
                      setEquipoModalFecha(getTodayDateString());
                      setEquipoModalHoraDesdeHH("");
                      setEquipoModalHoraDesdeMM("");
                      setEquipoModalHoraHastaHH("");
                      setEquipoModalHoraHastaMM("");
                      setEquipoModalPhotos([]);
                      setShowNewWorkOrderForm(false);
                    }}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    {modalIsEditingActiveOrder ? "Cancelar Edición" : "Cancelar Nueva Orden"}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Desperfecto Usuario (Lo que el cliente dice del problema) *
                </label>
                <textarea
                  rows={3}
                  value={equipoModalDesperfecto}
                  onChange={(e) => setEquipoModalDesperfecto(e.target.value)}
                  placeholder="Ej. El lavarropas no desagota y hace ruido al centrifugar."
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    Fecha de Retiro
                  </label>
                  <input
                    type="date"
                    value={equipoModalFecha}
                    onChange={(e) => setEquipoModalFecha(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Horario de Retiro
                  </label>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="shrink-0 font-medium">de</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="HH"
                        value={equipoModalHoraDesdeHH}
                        onChange={(e) => setEquipoModalHoraDesdeHH(e.target.value.replace(/\D/g, ""))}
                        className="w-14 px-2 py-2 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <span className="font-bold text-gray-400">:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="MM"
                        value={equipoModalHoraDesdeMM}
                        onChange={(e) => setEquipoModalHoraDesdeMM(e.target.value.replace(/\D/g, ""))}
                        className="w-14 px-2 py-2 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <span className="shrink-0 font-medium">hasta</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="HH"
                        value={equipoModalHoraHastaHH}
                        onChange={(e) => setEquipoModalHoraHastaHH(e.target.value.replace(/\D/g, ""))}
                        className="w-14 px-2 py-2 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                      <span className="font-bold text-gray-400">:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="MM"
                        value={equipoModalHoraHastaMM}
                        onChange={(e) => setEquipoModalHoraHastaMM(e.target.value.replace(/\D/g, ""))}
                        className="w-14 px-2 py-2 bg-gray-50 dark:bg-gray-855 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Photo Upload */}
              <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Fotos de Respaldo
                </label>
                <div className="flex flex-wrap items-center gap-3">
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
                  
                  <button
                    type="button"
                    onClick={handleConnectAndUpload}
                    disabled={uploadingPhoto}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                  >
                    {uploadingPhoto ? (
                      <><span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block"></span> Subiendo...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Subir Foto</>
                    )}
                  </button>

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
                        className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5 shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
                        title="Eliminar Foto"
                      >
                        <X className="w-3.5 h-3.5" />
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
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
            <div>
              {isEditMode && (profile?.rol === "superadmin" || profile?.rol === "admin") && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("¿Está seguro que desea eliminar este equipo?")) {
                      const eq = formEquipos[equipoModalIndex!];
                      if (eq && eq.id) {
                        setDeletedEquipoIds(prev => [...prev, eq.id!]);
                      }
                      setFormEquipos(prev => prev.filter((_, i) => i !== equipoModalIndex));
                      if (equipmentSourceSubView) {
                        setCurrentSubView(equipmentSourceSubView);
                      } else {
                        setCurrentSubView("menu");
                      }
                    }
                  }}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-600/10 cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <Trash className="w-3.5 h-3.5" />
                  <span>ELIMINAR EQUIPO</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (equipmentSourceSubView) {
                    setCurrentSubView(equipmentSourceSubView);
                  } else {
                    setCurrentSubView("menu");
                  }
                }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-600/10 cursor-pointer active:scale-95"
              >
                CANCELAR
              </button>
            <button
              type="button"
              onClick={() => {
                const isNewEquipment = equipoModalIndex === null;

                if (!isAdmin && !equipoModalMarca.trim()) {
                  alert("Por favor, complete Marca y Modelo.");
                  return;
                }

                if (isNewEquipment || showNewWorkOrderForm) {
                  if (!isAdmin && !equipoModalDesperfecto.trim()) {
                    alert("Por favor, complete el desperfecto del usuario.");
                    return;
                  }
                  if (profile?.rol === "logistica") {
                    const missing = [];
                    if (!equipoModalDesperfecto.trim()) missing.push("desperfecto del usuario");
                    if (!equipoModalFecha) missing.push("fecha de retiro");
                    if (!equipoModalHoraDesdeHH || !equipoModalHoraHastaHH) missing.push("horario de retiro");
                    if (!equipoModalPhotos || equipoModalPhotos.length === 0) missing.push("fotos de respaldo");
                    if (missing.length > 0) {
                      alert(`Aviso de Logística: Faltan completar los siguientes campos: ${missing.join(", ")}. Se permitirá guardar de todas formas.`);
                    }
                  }
                }
                
                const parts = equipoModalMarca.trim().split(/\s+/);
                const brand = parts[0] || "Genérico";
                const model = parts.slice(1).join(" ") || "-";
                
                const formatTimePart = (hh: string, mm: string) => {
                  if (!hh.trim() && !mm.trim()) return "";
                  const paddedHH = hh.trim() ? hh.trim().padStart(2, "0") : "00";
                  const paddedMM = mm.trim() ? mm.trim().padStart(2, "0") : "00";
                  return `${paddedHH}:${paddedMM}`;
                };

                const horaDesde = formatTimePart(equipoModalHoraDesdeHH, equipoModalHoraDesdeMM);
                const horaHasta = formatTimePart(equipoModalHoraHastaHH, equipoModalHoraHastaMM);

                const newEq: any = {
                  tipo: equipoModalTipo,
                  marca: brand,
                  modelo: model
                };

                if (isNewEquipment || !formEquipos[equipoModalIndex!]?.id || modalIsEditingActiveOrder) {
                   newEq.desperfectoUsuario = equipoModalDesperfecto.trim();
                   newEq.fechaRetiro = formatFechaRetiro(equipoModalFecha, horaDesde, horaHasta);
                   newEq.fotosDrive = equipoModalPhotos;
                   // Clear new order properties if editing active order
                   newEq.newDesperfecto = undefined;
                   newEq.newFechaRetiro = undefined;
                   newEq.newFotosDrive = undefined;
                 } else {
                   if (showNewWorkOrderForm) {
                     newEq.newDesperfecto = equipoModalDesperfecto.trim();
                     newEq.newFechaRetiro = formatFechaRetiro(equipoModalFecha, horaDesde, horaHasta);
                     newEq.newFotosDrive = equipoModalPhotos;
                   } else {
                     newEq.newDesperfecto = undefined;
                     newEq.newFechaRetiro = undefined;
                     newEq.newFotosDrive = undefined;
                   }
                 }
                
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
                
                if (equipmentSourceSubView) {
                  setCurrentSubView(equipmentSourceSubView);
                } else {
                  setCurrentSubView("menu");
                }
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/10 cursor-pointer active:scale-95"
            >
              GUARDAR EQUIPO
            </button>
          </div>
          </div>
        </div>
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
              Pedidos
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gestión y hojas de pedidos de todos los registros.
            </p>
          </div>
        </div>
        {canWrite && profile?.rol !== "logistica" && (
          <button
            onClick={() => {
              resetCustomForm();
              setCurrentSubView("nuevo");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Pedido
          </button>
        )}
      </div>

      {/* Search and Action Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            {loadingSearch
              ? <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-indigo-500 animate-spin" />
              : <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
            }
            <input
              type="text"
              placeholder="Buscar pedido por dirección, ID o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Date Input */}
          <div className="relative shrink-0 w-full sm:w-auto flex items-center">
            <div className="relative flex items-center bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus-within:ring-2 focus-within:ring-indigo-600 transition-all w-full sm:w-auto select-none">
              <Calendar className="w-4.5 h-4.5 text-gray-400 shrink-0 mr-2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-semibold focus:outline-none border-none text-slate-700 dark:text-gray-200 w-[115px] cursor-pointer scheme-light dark:scheme-dark"
              />
              {selectedDate && !loadingDateFilter && (
                <button
                  onClick={() => setSelectedDate("")}
                  className="ml-1.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-400 hover:text-slate-600 dark:hover:text-gray-250 transition-colors shrink-0"
                  title="Limpiar fecha"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {loadingDateFilter && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 ml-1.5 shrink-0" />
              )}
            </div>
          </div>
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
          paginatedClientes.map((c) => (
            <div
              key={c.id}
              onClick={() => handleStartEdit(c)}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 rounded-xl py-2.5 px-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-sm hover:border-indigo-500/40 dark:hover:border-indigo-900/60 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center transition-all duration-200 cursor-pointer group"
            >
              {/* Col 1: ID & Address & Note */}
              <div className="sm:col-span-7 space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {c.id && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold border border-indigo-100/60 dark:border-indigo-900/20">
                      ID: {formatClienteId(c)}
                    </span>
                  )}
                  <span className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {[
                      c.calle ? `${c.calle} ${c.numero || ""}` : "",
                      c.torre ? `Torre ${c.torre}` : "",
                      c.piso ? `Piso ${c.piso}` : "",
                      c.depto ? `Depto ${c.depto}` : "",
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
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{c.telCel}</span>
                    </div>
                    <a
                      href={getWhatsAppUrl(c.telCel)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all text-[11px] font-bold shrink-0 shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                      title="Enviar mensaje por WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-400 dark:text-gray-550 italic">No registrado</span>
                )}
              </div>

              {/* Col 3: Actions */}
              <div className="sm:col-span-2 flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center">
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCliente(c.id || "");
                    }}
                    className="p-1.5 text-red-600 hover:text-red-700 bg-red-50/60 dark:bg-red-950/20 hover:bg-red-100/80 dark:hover:bg-red-950/40 rounded-lg transition-all cursor-pointer border border-red-100/40 dark:border-red-900/20 flex items-center justify-center hover:scale-105 active:scale-95"
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

      {/* Pagination Controls */}
      {filteredClientes.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-gray-850/40 p-4 border border-slate-150 dark:border-gray-850 rounded-2xl select-none">
          <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">
            Mostrando <span className="font-extrabold text-slate-700 dark:text-white">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredClientes.length)}</span> - <span className="font-extrabold text-slate-700 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredClientes.length)}</span> de <span className="font-extrabold text-slate-700 dark:text-white">{filteredClientes.length}</span> clientes
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Primera página"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-extrabold text-slate-700 dark:text-white px-2">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Última página"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                  <select
                    {...register("localidad")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  >
                    <option value="">Seleccione una localidad...</option>
                    <option value="Santa Fe">Santa Fe</option>
                    <option value="Santo Tomé">Santo Tomé</option>
                    <option value="Sauce">Sauce</option>
                    <option value="Colastiné Norte">Colastiné Norte</option>
                    <option value="Rincon">Rincon</option>
                    <option value="Recreo">Recreo</option>
                    <option value="Colastiné Sur">Colastiné Sur</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                {watchedLocalidad === "Otros" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Especificar Localidad
                    </label>
                    <input
                      type="text"
                      {...register("localidadOtros")}
                      placeholder="Ej. Esperanza"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                    />
                  </div>
                )}
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
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                <div className="col-span-3 md:col-span-2">
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
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Torre
                  </label>
                  <input
                    type="text"
                    {...register("torre")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Piso
                  </label>
                  <input
                    type="text"
                    {...register("piso")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm"
                  />
                </div>
                <div>
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
