import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy, deleteDoc, writeBatch, limit } from "firebase/firestore";
import { useAuth } from "../providers/AuthProvider";
import { supabase } from "../lib/supabase";
import { UserProfile, Role } from "../types";
import { DriveService } from "../services/drive";
import { GeminiConfigService } from "../services/geminiConfig";
import { BrandingService, DEFAULT_BRANDING } from "../services/branding";
import Papa from "papaparse";

import { 
  Users, 
  ShieldCheck, 
  UserX, 
  UserCheck, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  User,
  Shield,
  Clock,
  FolderOpen,
  Save,
  HardDrive,
  Trash2,
  Settings,
  ArrowLeft,
  ChevronRight,
  Lock,
  Sparkles,
  Palette,
  UploadCloud,
  Database,
  Download,
  Pencil,
  MessageSquare,
  QrCode,
  Loader2
} from "lucide-react";

export default function Usuarios() {
  const { profile } = useAuth();
  const [activeSubView, setActiveSubView] = useState<"menu" | "usuarios" | "drive" | "gemini" | "apariencia" | "importar" | "backup" | "restaurar" | "whatsapp">("menu");
  const [exportingBackup, setExportingBackup] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [backupErrorMsg, setBackupErrorMsg] = useState<string | null>(null);
  // Restore states
  const [restoreData, setRestoreData] = useState<Record<string, any[]> | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string | null>(null);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ done: number; total: number; currentCol: string } | null>(null);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const isSuperadmin = profile?.rol === "superadmin";
  const canManageConfig = profile?.rol === "superadmin" || profile?.rol === "admin" || profile?.rol === "administracion";

  // Branding Config states
  const [brandLogo, setBrandLogo] = useState("");
  const [brandTitulo, setBrandTitulo] = useState("");
  const [brandSubtitulo, setBrandSubtitulo] = useState("");
  const [brandBadge, setBrandBadge] = useState("");
  const [savingApariencia, setSavingApariencia] = useState(false);
  const [aparienciaSuccessMsg, setAparienciaSuccessMsg] = useState<string | null>(null);
  const [aparienciaErrorMsg, setAparienciaErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fetchBrandingConfig = async () => {
    try {
      const config = await BrandingService.getConfig();
      setBrandLogo(config.logo || "");
      setBrandTitulo(config.titulo || "");
      setBrandSubtitulo(config.subtitulo || "");
      setBrandBadge(config.badge || "");
    } catch (err) {
      console.error("Error fetching branding config in settings:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 500 * 1024) {
      setAparienciaErrorMsg("El logotipo es demasiado grande. Por favor, suba una imagen de menos de 500 KB.");
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setBrandLogo(reader.result as string);
      setAparienciaErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        setAparienciaErrorMsg("El logotipo es demasiado grande. Por favor, suba una imagen de menos de 500 KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBrandLogo(reader.result as string);
        setAparienciaErrorMsg(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperadmin) {
      setAparienciaErrorMsg("No tienes permisos suficientes para modificar la apariencia.");
      return;
    }
    setSavingApariencia(true);
    setAparienciaSuccessMsg(null);
    setAparienciaErrorMsg(null);
    try {
      await BrandingService.setConfig({
        logo: brandLogo,
        titulo: brandTitulo,
        subtitulo: brandSubtitulo,
        badge: brandBadge,
      });
      setAparienciaSuccessMsg("La apariencia y marca del sistema se han actualizado con éxito.");
    } catch (err: any) {
      console.error("Error saving branding config:", err);
      setAparienciaErrorMsg("No se pudo guardar la configuración de apariencia.");
    } finally {
      setSavingApariencia(false);
    }
  };

  // Restore Handler — reads uploaded JSON and writes to Firestore in batches of 400 docs
  const BATCH_SIZE = 400; // Firestore max is 500 ops; 400 is safe
  const handleRestoreDatabase = async () => {
    if (!restoreData) return;
    setRestoringBackup(true);
    setRestoreSuccessMsg(null);
    setRestoreErrorMsg(null);

    let totalDocs = 0;
    let doneCount = 0;

    // Count total docs first for accurate progress
    for (const docs of (Object.values(restoreData) as any[][])) {
      totalDocs += docs.length;
    }

    try {
      for (const [colName, docs] of Object.entries(restoreData)) {
        if (!Array.isArray(docs) || docs.length === 0) continue;

        setRestoreProgress({ done: doneCount, total: totalDocs, currentCol: colName });

        // Split collection into batches of BATCH_SIZE
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const chunk = docs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);

          for (const docData of chunk) {
            const { id, ...fields } = docData;
            if (!id) continue;
            const ref = doc(db, colName, id);
            batch.set(ref, fields, { merge: false });
          }

          await batch.commit();
          doneCount += chunk.length;
          setRestoreProgress({ done: doneCount, total: totalDocs, currentCol: colName });
        }
      }

      setRestoreProgress(null);
      setRestoreSuccessMsg(`¡Restauración completada! Se restauraron ${doneCount} registros en ${Object.keys(restoreData).length} colecciones.`);
    } catch (err: any) {
      console.error("Error restoring backup:", err);
      setRestoreProgress(null);
      setRestoreErrorMsg(`Error durante la restauración: ${err.message || "Error desconocido"}. Los lotes enviados antes del error sí fueron guardados.`);
    } finally {
      setRestoringBackup(false);
    }
  };

  // Backup Exporter Logic

  const handleExportDatabase = async () => {
    setExportingBackup(true);
    setBackupSuccessMsg(null);
    setBackupErrorMsg(null);
    try {
      const collectionsToExport = [
        "clientes",
        "equipos",
        "servicios",
        "presupuestos",
        "stock",
        "gastos",
        "proveedores",
        "notifications",
        "users",
        "config"
      ];

      const backupData: Record<string, any[]> = {};

      for (const colName of collectionsToExport) {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split("T")[0];
      const link = document.createElement("a");
      link.href = url;
      link.download = `econoservice_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupSuccessMsg(`Backup descargado con éxito. Se exportaron ${Object.values(backupData).reduce((acc, curr) => acc + curr.length, 0)} registros.`);
    } catch (err: any) {
      console.error("Error exporting database backup:", err);
      setBackupErrorMsg("Error al generar la copia de seguridad. Verifique sus permisos de red.");
    } finally {
      setExportingBackup(false);
    }
  };

  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [geminiVoiceName, setGeminiVoiceName] = useState("");
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [savingGeminiConfig, setSavingGeminiConfig] = useState(false);
  const [geminiSuccessMsg, setGeminiSuccessMsg] = useState<string | null>(null);
  const [geminiErrorMsg, setGeminiErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const spanishVoices = allVoices.filter(v => v.lang.toLowerCase().startsWith("es"));
      setBrowserVoices(spanishVoices);
    };
    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Drive Config states
  const [folderId, setFolderId] = useState("");
  const [savingDriveConfig, setSavingDriveConfig] = useState(false);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);
  const [driveErrorMsg, setDriveErrorMsg] = useState<string | null>(null);

  const fetchGeminiConfig = async () => {
    try {
      const config = await GeminiConfigService.getConfig();
      setGeminiApiKey(config.apiKey);
      setGeminiModel(config.model || "gemini-2.5-flash");
      setGeminiVoiceName(config.voiceName || "");
    } catch (err) {
      console.error("Error fetching Gemini config:", err);
    }
  };

  const fetchDriveConfig = async () => {
    try {
      const id = await DriveService.getFolderId();
      setFolderId(id);
    } catch (err) {
      console.error("Error fetching drive config:", err);
    }
  };

  // CSV Import States & Handlers
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRowsPreview, setParsedRowsPreview] = useState<any[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [importErrorMsg, setImportErrorMsg] = useState<string | null>(null);

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setCsvFile(file);
      setImportErrorMsg(null);
      setImportSuccessMsg(null);
      setImportProgress(0);
      setImportTotal(0);

      // Parse preview
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setParsedRowsPreview(results.data as any[]);
        },
        error: () => {
          setImportErrorMsg("Error al leer el archivo CSV.");
          setParsedRowsPreview(null);
        }
      });
    }
  };

  const processCsvImport = async () => {
    if (!csvFile || !parsedRowsPreview) {
      setImportErrorMsg("Debe seleccionar un archivo CSV válido.");
      return;
    }

    setIsImporting(true);
    setImportErrorMsg(null);
    setImportSuccessMsg(null);
    setImportProgress(0);
    setImportTotal(parsedRowsPreview.length);

    try {
      let nextClientNum = 1;
      try {
        const qHighestClient = query(collection(db, "clientes"), orderBy("numeroCliente", "desc"), limit(1));
        const highestClientSnap = await getDocs(qHighestClient);
        if (!highestClientSnap.empty) {
          const highestDoc = highestClientSnap.docs[0].data() as any;
          if (highestDoc && highestDoc.numeroCliente) {
            nextClientNum = Number(highestDoc.numeroCliente) + 1;
          }
        }
      } catch (e) {
        console.warn("Could not find highest numeroCliente:", e);
      }

      let nextSrvNum = 1001;
      try {
        const qHighestSrv = query(collection(db, "servicios"), orderBy("numeroServicio", "desc"), limit(1));
        const highestSrvSnap = await getDocs(qHighestSrv);
        if (!highestSrvSnap.empty) {
          const highestDoc = highestSrvSnap.docs[0].data() as any;
          if (highestDoc && highestDoc.numeroServicio) {
            nextSrvNum = Number(highestDoc.numeroServicio) + 1;
          }
        }
      } catch (e) {
        console.warn("Could not find highest numeroServicio:", e);
      }

      const mapCsvRow = (row: any) => {
        const parseBool = (val: any, defaultVal = false): boolean => {
          if (val === undefined || val === null || val === "") return defaultVal;
          const s = String(val).trim().toUpperCase();
          return s === "SI" || s === "TRUE" || s === "1" || s === "YES";
        };

        const parseFloatOrUndefined = (val: any): number | undefined => {
          if (val === undefined || val === null || val === "") return undefined;
          const cleanStr = String(val).replace(/[^0-9.-]/g, "");
          const num = parseFloat(cleanStr);
          return isNaN(num) ? undefined : num;
        };

        // 1 & 3. DATOS DEL CLIENTE Y CONTACTO (Domicilio de Retiro + Contacto)
        const telCel = row.telCel || row.celular || row.telefono || "";
        const nombreApellido = (
          row.nombreApellido || row.nombre || row.cliente || ""
        ).trim() || (telCel ? `Cel: ${telCel}` : "Cliente S/N");

        const clientData = {
          nombreApellido,
          telFijo:    row.telFijo    || "",
          telCel:     telCel         || "",
          telCelBis:  row.telCelBis  || "",
          telCelOtro: row.telCelOtro || "",
          localidad:  row.ciudad     || row.localidad || "",
          barrio:     row.barrio     || "",
          zona:       row.zona       || "",
          calle:      row.calle      || row.direccion || "",
          numero:     row.numero     || "",
          piso:       row.piso       || "",
          depto:      row.depto      || row.departamento || "",
          clienteProblematico: parseBool(row.clienteProblematico, false),
          observaciones: row.observaciones || row.observacionesCliente || ""
        };

        // 2. DATOS DEL EQUIPO
        const aparato = row.aparato || row.tipo || row.tipoEquipo || "";
        const marca   = row.marca   || "";
        const modelo  = row.modelo  || "";
        const serie   = row.serie   || row.numeroSerie || "";
        const observacionesEquipo = row.observacionesEquipo || "";

        const hasEquipment = !!(aparato || marca || modelo);
        const equipmentData = hasEquipment ? {
          tipo:         aparato || "Lavarropas",
          marca:        marca   || "Genérico",
          modelo:       modelo  || "Genérico",
          observaciones:observacionesEquipo,
          serie:        serie
        } : null;

        // 2 & 3. RETIRO Y LOGÍSTICA
        let fechaRetiroStr = row.fechaRetiro?.trim() || "";
        if (fechaRetiroStr && (row.horaRetiroDesde || row.horaRetiroHasta)) {
          const desde = row.horaRetiroDesde?.trim() || "09:00";
          const hasta = row.horaRetiroHasta?.trim() || "12:00";
          if (!fechaRetiroStr.includes("Tde")) {
            fechaRetiroStr = `${fechaRetiroStr}Tde ${desde} hasta ${hasta}`;
          }
        }

        const nsPartes = [
          parseBool(row.ns1) ? "NS1" : "",
          parseBool(row.ns2) ? "NS2" : "",
          parseBool(row.ns3) ? "NS3" : ""
        ].filter(Boolean).join(", ");

        const infoLogistica = row.infoLogistica || [
          fechaRetiroStr                     ? `Retiro acordado: ${fechaRetiroStr}` : "",
          row.notasRetiro?.trim()             ? `Notas retiro: ${row.notasRetiro.trim()}` : "",
          nsPartes                           ? `Config: ${nsPartes}` : ""
        ].filter(Boolean).join(" | ");

        // 4. ESTADO DEL SERVICIO EN TALLER Y LOGÍSTICA
        const desperfectoUsuario = row.desperfectoUsuario || row.desperfecto || "";
        const estadoRaw = (row.estado || row.estadoServicio || "RECIBIDO").toUpperCase();

        let citaEntregaVal = null;
        if (row.citaEntrega || row.fechaEntrega) {
          try {
            const dt = new Date(row.citaEntrega || row.fechaEntrega);
            if (!isNaN(dt.getTime())) citaEntregaVal = dt;
          } catch {}
        }

        let fechaIngresoVal = new Date();
        if (row.fechaIngreso) {
          try {
            const dt = new Date(row.fechaIngreso);
            if (!isNaN(dt.getTime())) fechaIngresoVal = dt;
          } catch {}
        }

        const isDelivered = estadoRaw === "ENTREGADO" || parseBool(row.entregado);
        const isFinished = estadoRaw === "LISTO_PARA_ENTREGA" || estadoRaw === "ENTREGADO" || parseBool(row.terminado);

        const hasService = hasEquipment || !!(desperfectoUsuario || infoLogistica || row.estado);
        const serviceData = hasService ? {
          aparato:             aparato || "Lavarropas",
          marcaModelo:         `${marca} ${modelo}`.trim() || "Genérico",
          desperfectoUsuario:  desperfectoUsuario || "No especificado",
          fechaIngreso:        fechaIngresoVal,
          serviciosRequeridos: row.serviciosRequeridos || row.diagnostico || "",
          serviciosConvenidos: row.serviciosConvenidos || row.presupuestoTexto || "",
          diagnostico:         row.diagnostico         || row.serviciosRequeridos || "",
          repuestosComprar:    row.repuestosComprar    || "",
          repuestosComprados:  row.repuestosComprados  || "",
          presupuesto:         parseFloatOrUndefined(row.presupuesto),
          presupuestoTexto:    row.presupuestoTexto    || row.serviciosConvenidos || "",
          estado: ["RECIBIDO","DIAGNOSTICO","PENDIENTE_APROBACION","EN_REPARACION",
                   "LISTO_PARA_ENTREGA","ENTREGA_EN_PROGRESO","ENTREGADO",
                   "CANCELADO","EN_ESPERA","ACEPTADO","RECHAZADO"].includes(estadoRaw)
                  ? estadoRaw : "RECIBIDO",
          notasInternas:      row.notasInternas       || "",
          infoLogistica:      infoLogistica,
          acepta:             parseBool(row.acepta, false),
          rechazaDevolver:    parseBool(row.rechazaDevolver, false),
          garantia:           parseBool(row.garantia, false),
          esReclamoGarantia: parseBool(row.esReclamoGarantia, false),
          ingresoTaller:      parseBool(row.ingresoTaller, true),
          pasaStock:          parseBool(row.pasaStock, false),
          terminado:          isFinished,
          entregado:          isDelivered,
          factura:            parseBool(row.factura, false),
          contado:            parseBool(row.contado, false),
          citaEntrega:        citaEntregaVal,
          horaEntregaDesde:   row.horaEntregaDesde || "",
          horaEntregaHasta:   row.horaEntregaHasta || "",
          metodoPago:         row.metodoPago       || "",
          montoEfectivo:      parseFloatOrUndefined(row.montoEfectivo)      || 0,
          montoTransferencia: parseFloatOrUndefined(row.montoTransferencia) || 0,
          fotosDrive:         []
        } : null;

        return { clientData, equipmentData, serviceData };
      };

      const mappedRows = parsedRowsPreview.map(mapCsvRow);

      let partes = 15;
      let chunkSize = Math.ceil(mappedRows.length / partes);
      if (chunkSize > 120) {
        chunkSize = 120;
        partes = Math.ceil(mappedRows.length / chunkSize);
      }

      let currentProcessed = 0;
      let clientIdxOffset = 0;
      let srvIdxOffset = 0;

      for (let i = 0; i < partes; i++) {
        const chunk = mappedRows.slice(i * chunkSize, (i + 1) * chunkSize);
        if (chunk.length === 0) continue;
        
        const batch = writeBatch(db);

        for (const row of chunk) {
          const clientRef = doc(collection(db, "clientes"));
          
          batch.set(clientRef, {
            ...row.clientData,
            numeroCliente: nextClientNum + clientIdxOffset,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          clientIdxOffset++;

          if (row.equipmentData) {
            const eqRef = doc(collection(db, "equipos"));
            batch.set(eqRef, {
              ...row.equipmentData,
              clienteId: clientRef.id,
              createdAt: new Date()
            });

            if (row.serviceData) {
              const srvRef = doc(collection(db, "servicios"));
              batch.set(srvRef, {
                ...row.serviceData,
                clienteId: clientRef.id,
                equipoId: eqRef.id,
                numeroServicio: nextSrvNum + srvIdxOffset,
                createdAt: new Date(),
                updatedAt: new Date()
              });

              const logRef = doc(collection(db, "servicios", srvRef.id, "historial"));
              batch.set(logRef, {
                fecha: new Date(),
                usuarioId: profile?.uid || "importador",
                usuarioNombre: profile?.nombre || "Importador CSV",
                descripcion: "Servicio creado mediante importación masiva de CSV",
                detalles: `Estado inicial: ${row.serviceData.estado}`
              });

              srvIdxOffset++;
            }
          }
        }

        await batch.commit();
        currentProcessed += chunk.length;
        setImportProgress(currentProcessed);
        await new Promise(resolve => setTimeout(resolve, 250));
      }

      setImportSuccessMsg(`Se han importado exitosamente ${mappedRows.length} órdenes de servicio.`);
      setCsvFile(null);
      setParsedRowsPreview(null);
    } catch (error) {
      console.error("Error importando datos desde CSV:", error);
      setImportErrorMsg("Hubo un error durante la importación.");
    } finally {
      setIsImporting(false);
    }
  };

  // Bulk Delete States
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");



  const processDeleteAllClientes = async () => {
    if (deleteConfirmInput !== "ELIMINAR") {
      setDeleteErrorMsg("Debe escribir 'ELIMINAR' exactamente para confirmar.");
      return;
    }

    setIsDeletingAll(true);
    setDeleteErrorMsg(null);
    setDeleteSuccessMsg(null);
    setDeleteProgress(0);
    setShowDeleteConfirmModal(false);

    try {
      // 1. Delete all Clientes
      const clientesCol = collection(db, "clientes");
      let totalDeleted = 0;
      while (true) {
        const q = query(clientesCol, limit(400));
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
          batch.delete(doc(db, "clientes", docSnap.id));
        });
        await batch.commit();
        totalDeleted += snapshot.size;
        setDeleteProgress(totalDeleted);
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // 2. Delete all Equipos
      const equiposCol = collection(db, "equipos");
      let totalEquiposDeleted = 0;
      while (true) {
        const q = query(equiposCol, limit(400));
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
          batch.delete(doc(db, "equipos", docSnap.id));
        });
        await batch.commit();
        totalEquiposDeleted += snapshot.size;
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // 3. Delete all Servicios
      const serviciosCol = collection(db, "servicios");
      let totalServiciosDeleted = 0;
      while (true) {
        const q = query(serviciosCol, limit(400));
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
          batch.delete(doc(db, "servicios", docSnap.id));
        });
        await batch.commit();
        totalServiciosDeleted += snapshot.size;
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      setDeleteSuccessMsg(`Se ha limpiado la base de datos por completo: se eliminaron ${totalDeleted} clientes, ${totalEquiposDeleted} equipos y ${totalServiciosDeleted} órdenes de servicio.`);
      setDeleteConfirmInput("");
    } catch (error: any) {
      console.error("Error al eliminar datos masivamente:", error);
      setDeleteErrorMsg("Hubo un error al eliminar los datos. Verifique su rol y conexión.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  useEffect(() => {
    fetchBrandingConfig();
    if (canManageConfig) {
      fetchDriveConfig();
      fetchGeminiConfig();
    }
  }, [canManageConfig]);

  const handleSaveDriveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDriveConfig(true);
    setDriveSuccessMsg(null);
    setDriveErrorMsg(null);
    try {
      await DriveService.setFolderId(folderId.trim());
      setDriveSuccessMsg("ID de carpeta de Google Drive actualizado con éxito.");
    } catch (err: any) {
      console.error("Error saving drive config:", err);
      setDriveErrorMsg("No se pudo guardar la configuración de Google Drive.");
    } finally {
      setSavingDriveConfig(false);
    }
  };

  const handleSaveGeminiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeminiConfig(true);
    setGeminiSuccessMsg(null);
    setGeminiErrorMsg(null);
    try {
      await GeminiConfigService.setConfig({
        apiKey: geminiApiKey,
        model: geminiModel,
        voiceName: geminiVoiceName,
      });
      setGeminiSuccessMsg("Configuración de Gemini actualizada con éxito.");
    } catch (err: any) {
      console.error("Error saving Gemini config:", err);
      setGeminiErrorMsg("No se pudo guardar la configuración de Gemini.");
    } finally {
      setSavingGeminiConfig(false);
    }
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const list: UserProfile[] = (data || []).map(u => ({
        uid: u.uid,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol as Role,
        activo: !!u.activo,
        createdAt: u.created_at
      }));
      setUsuarios(list);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setErrorMessage("No se pudieron cargar los usuarios del sistema.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleToggleActivo = async (user: UserProfile) => {
    if (user.rol === "superadmin" && user.activo) {
      setErrorMessage("No se puede desactivar a un Superadministrador.");
      return;
    }
    if (user.uid === profile?.uid) {
      setErrorMessage("No puedes desactivar tu propio usuario activo.");
      return;
    }

    setUpdatingId(user.uid);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const nuevoEstado = !user.activo;
      const { error } = await supabase.from("user_profiles").update({ activo: nuevoEstado }).eq("uid", user.uid);
      if (error) throw error;
      
      setUsuarios((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, activo: nuevoEstado } : u))
      );
      setSuccessMessage(`Usuario ${user.nombre} ${nuevoEstado ? "activado" : "desactivado"} con éxito.`);
    } catch (err: any) {
      console.error("Error updating user status:", err);
      setErrorMessage("Error al cambiar el estado del usuario.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.rol === "superadmin") {
      setErrorMessage("No se puede eliminar a un Superadministrador.");
      return;
    }
    if (user.uid === profile?.uid) {
      setErrorMessage("No puedes eliminar tu propia cuenta.");
      return;
    }

    setUpdatingId(user.uid);
    setErrorMessage(null);
    setSuccessMessage(null);
    setUserToDelete(null);

    try {
      const { error } = await supabase.from("user_profiles").delete().eq("uid", user.uid);
      if (error) throw error;
      
      setUsuarios((prev) => prev.filter((u) => u.uid !== user.uid));
      setSuccessMessage(`Usuario ${user.nombre} eliminado con éxito.`);
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setErrorMessage("Error al eliminar el usuario del sistema.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser || !editNombre.trim()) return;
    setSavingEdit(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { error } = await supabase.from("user_profiles").update({ nombre: editNombre.trim() }).eq("uid", editingUser.uid);
      if (error) throw error;
      setUsuarios((prev) =>
        prev.map((u) =>
          u.uid === editingUser.uid ? { ...u, nombre: editNombre.trim() } : u
        )
      );
      setSuccessMessage(`Nombre actualizado a "${editNombre.trim()}" correctamente.`);
      setEditingUser(null);
    } catch (err: any) {
      console.error("Error updating user name:", err);
      setErrorMessage("Error al actualizar el nombre del usuario.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleChangeRol = async (user: UserProfile, nuevoRol: Role) => {
    if (user.email.toLowerCase() === "juanpacheco@playcode.com.ar" && nuevoRol !== "superadmin") {
      setErrorMessage("No se puede cambiar el rol del administrador global primario.");
      return;
    }

    setUpdatingId(user.uid);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase.from("user_profiles").update({ rol: nuevoRol }).eq("uid", user.uid);
      if (error) throw error;
      
      setUsuarios((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, rol: nuevoRol } : u))
      );
      setSuccessMessage(`Rol de ${user.nombre} actualizado a ${getRoleLabel(nuevoRol)}.`);
    } catch (err: any) {
      console.error("Error updating user role:", err);
      setErrorMessage("Error al cambiar el rol del usuario.");
    } finally {
      setUpdatingId(null);
    }
  };

  const getRoleLabel = (rol: Role) => {
    switch (rol) {
      case "superadmin":
        return "Superadmin";
      case "administracion":
        return "Administración";
      case "tecnico":
        return "Técnico";
      case "logistica":
        return "Logística";
      case "admin":
        return "Administrador (Legacy)";
      case "recepcion":
        return "Recepcionista (Legacy)";
      case "consulta":
        return "Consulta / Auditor (Legacy)";
      default:
        return rol || "Desconocido";
    }
  };

  // Stats calculation
  const totalUsers = usuarios.length;
  const activeUsers = usuarios.filter((u) => u.activo).length;
  const pendingUsers = usuarios.filter((u) => !u.activo).length;

  if (activeSubView === "menu") {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-7 h-7 text-indigo-600" />
            Ajustes del Sistema
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestión de configuraciones del sistema, administración de cuentas de usuario y servicios conectados.
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card: Usuarios del Sistema */}
          <div 
            onClick={() => setActiveSubView("usuarios")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Usuarios del Sistema
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Administra las cuentas de Google Auth, activa accesos, asigna los roles correspondientes (superadmin, logística, técnico, etc.) o elimina cuentas.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Gestionar usuarios</span>
              <span className="bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 rounded-md text-[10px] font-mono text-indigo-700 dark:text-indigo-300">
                {totalUsers} Cuentas
              </span>
            </div>
          </div>

          {/* Card: Configuración de Google Drive */}
          <div 
            onClick={() => setActiveSubView("drive")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Configuración de Google Drive
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Configura el ID de la carpeta de Google Drive donde se almacenarán automáticamente las fotos tomadas por el personal de logística al realizar las entregas.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Configurar almacenamiento</span>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                folderId ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
              }`}>
                {folderId ? "Configurado" : "Pendiente"}
              </span>
            </div>
          </div>

          {/* Card: Configuración de Gemini */}
          <div 
            onClick={() => setActiveSubView("gemini")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Configuración de Gemini
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Configura el modelo de Inteligencia Artificial para el asistente de repuestos y gestiona tu clave API personalizada.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Configurar IA</span>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-300`}>
                {geminiModel}
              </span>
            </div>
          </div>

          {/* Card: Apariencia y Marca */}
          <div 
            onClick={() => setActiveSubView("apariencia")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Palette className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Apariencia y Marca
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Personaliza dinámicamente el logotipo, título principal, subtítulo y badge en la pantalla de inicio de sesión del sistema.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Personalizar pantalla</span>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-300`}>
                Configurado
              </span>
            </div>
          </div>

          {/* Card: Importar Servicios CSV */}
          <div 
            onClick={() => setActiveSubView("importar")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Importar Servicios CSV
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Carga masiva de órdenes de servicio incluyendo Domicilio de Retiro, Equipos, Logística, Contacto y Diagnóstico de Taller.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Importación Masiva</span>
              <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                CSV
              </span>
            </div>
          </div>

          {/* Card: WhatsApp Integración */}
          <div 
            onClick={() => setActiveSubView("whatsapp")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  WhatsApp (beta)
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-indigo-600 dark:text-indigo-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Conecte su número de teléfono para enviar notificaciones automáticas redactadas por Inteligencia Artificial.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>Configurar WhatsApp</span>
              <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
                BETA
              </span>
            </div>
          </div>
          <div 
            onClick={() => setActiveSubView("backup")}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Database className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Backup de Base de Datos
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-emerald-600 dark:text-emerald-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Genera y descarga un respaldo completo en formato JSON de todas las colecciones (clientes, servicios, taller, stock, gastos y usuarios).
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>Descargar copia de seguridad</span>
              <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
                JSON
              </span>
            </div>
          </div>

          {/* Card: Restaurar Backup */}
          <div 
            onClick={() => { setActiveSubView("restaurar"); setRestoreData(null); setRestoreFileName(null); setRestoreSuccessMsg(null); setRestoreErrorMsg(null); }}
            className="group p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs hover:shadow-md hover:border-amber-100 dark:hover:border-amber-950/40 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  Restaurar Backup
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-amber-600 dark:text-amber-400" />
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Sube un archivo JSON de respaldo y el sistema restaurará la base de datos enviando los datos en lotes seguros a Firestore.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
              <span>Importar copia de seguridad</span>
              <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
                JSON
              </span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (activeSubView === "apariencia") {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div>
          <button 
            onClick={() => setActiveSubView("menu")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group mb-2"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver a Ajustes</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
              <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-gray-800">
                <Palette className="w-5 h-5 text-indigo-600" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Personalización de Apariencia y Marca
                  </h2>
                  <p className="text-xs text-gray-450 dark:text-gray-500">
                    Establezca la identidad visual de la pantalla de inicio de sesión de la plataforma.
                  </p>
                </div>
              </div>

              {aparienciaSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{aparienciaSuccessMsg}</span>
                </div>
              )}

              {aparienciaErrorMsg && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{aparienciaErrorMsg}</span>
                </div>
              )}

              {!isSuperadmin && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/40 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
                  <Lock className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Acceso de Solo Lectura</span>
                    <p className="mt-0.5">La modificación de marca y apariencia está restringida exclusivamente para usuarios con rol de <strong>Superadministrador</strong>.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveBranding} className="space-y-6">
                
                {/* Título Principal */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Título Principal
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isSuperadmin || savingApariencia}
                    placeholder="Escriba el nombre del sistema (ej. EconoService)"
                    value={brandTitulo}
                    onChange={(e) => setBrandTitulo(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
                  />
                </div>

                {/* Subtítulo */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Subtítulo descriptivo
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isSuperadmin || savingApariencia}
                    placeholder="Breve descripción bajo el título"
                    value={brandSubtitulo}
                    onChange={(e) => setBrandSubtitulo(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
                  />
                </div>

                {/* Badge text */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Texto de Distintivo / Badge
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperadmin || savingApariencia}
                    placeholder="Ej. Migrado de MS Access • Google Auth Activo"
                    value={brandBadge}
                    onChange={(e) => setBrandBadge(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
                  />
                </div>

                {/* Logotipo upload or URL */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      Logotipo de la Marca
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Subir Archivo Drag-and-Drop */}
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all min-h-[140px] relative ${
                          !isSuperadmin 
                            ? "bg-gray-50/50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-800 opacity-60" 
                            : dragActive 
                              ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20" 
                              : "border-gray-200 dark:border-gray-800 hover:border-indigo-400 bg-gray-50/50 dark:bg-gray-850/50"
                        }`}
                      >
                        <UploadCloud className="w-7 h-7 text-gray-400 mb-2" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Arrastre y suelte una imagen aquí
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                          PNG, JPG o SVG (Max 500 KB)
                        </span>
                        
                        {isSuperadmin && (
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        )}
                      </div>

                      {/* URL Externa */}
                      <div className="p-4 bg-gray-50/50 dark:bg-gray-850/50 border border-gray-200 dark:border-gray-800 rounded-xl flex flex-col justify-between min-h-[140px]">
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">
                            URL de Imagen Externa
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            Si prefiere hospedar su logotipo externamente, pegue el enlace directo.
                          </span>
                        </div>
                        <input
                          type="text"
                          disabled={!isSuperadmin || savingApariencia}
                          placeholder="https://ejemplo.com/logo.png"
                          value={brandLogo && brandLogo.startsWith("data:") ? "" : brandLogo}
                          onChange={(e) => setBrandLogo(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {brandLogo && (
                      <div className="mt-4 flex items-center justify-between p-3 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100/40 dark:border-indigo-950/40 rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1 bg-white dark:bg-gray-900 rounded-md border border-gray-100 dark:border-gray-800">
                            <img src={brandLogo} alt="Mini logo" className="w-8 h-8 object-contain" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">Logotipo Personalizado Cargado</span>
                            <span className="text-[10px] text-gray-400 font-mono block truncate max-w-[250px]">
                              {brandLogo.startsWith("data:") ? "Imagen en Base64" : brandLogo}
                            </span>
                          </div>
                        </div>
                        {isSuperadmin && (
                          <button
                            type="button"
                            onClick={() => setBrandLogo("")}
                            className="px-2.5 py-1.5 bg-red-50 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-transparent shrink-0"
                          >
                            Eliminar Logo
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                {isSuperadmin && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="submit"
                      disabled={savingApariencia}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      {savingApariencia ? "Guardando..." : "Guardar Apariencia y Marca"}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Real-time Preview Column */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 sticky top-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white pb-3 border-b border-gray-100 dark:border-gray-800 mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                Vista Previa en Tiempo Real
              </h3>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-xl flex items-center justify-center min-h-[300px]">
                {/* Simulated Login Card */}
                <div className="w-full max-w-xs bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-md text-center">
                  
                  {/* Brand Header */}
                  <div className="mb-6">
                    {brandLogo ? (
                      <div className="inline-flex items-center justify-center mb-3">
                        <img 
                          src={brandLogo} 
                          alt="Logo Preview" 
                          className="max-h-16 max-w-[140px] object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white mb-3 shadow-sm">
                        <span className="text-xl font-bold font-mono">
                          {brandTitulo ? brandTitulo.substring(0, 2).toUpperCase() : "ES"}
                        </span>
                      </div>
                    )}
                    <h4 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white truncate">
                      {brandTitulo || "EconoService"}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                      {brandSubtitulo || "Gestión de Servicio Técnico"}
                    </p>
                    {brandBadge && (
                      <div className="inline-block bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium px-2 py-0.5 rounded-full mt-2">
                        {brandBadge}
                      </div>
                    )}
                  </div>

                  {/* Simulated login button */}
                  <div className="py-2.5 px-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.77-2.6-2.6-4.53-6.16-4.53z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    Iniciar Sesión con Google
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSubView === "drive") {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div>
          <button 
            onClick={() => setActiveSubView("menu")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group mb-2"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver a Ajustes</span>
          </button>
        </div>

        {canManageConfig ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
              <HardDrive className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Almacenamiento de Fotos (Firebase)
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Estado del almacenamiento de imágenes en la nube.
                </p>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-400 leading-relaxed space-y-2">
              <span className="font-bold text-emerald-950 dark:text-emerald-300 block">✓ Almacenamiento en Firebase Storage Activo</span>
              <p>
                Las fotos de respaldo de los equipos y las órdenes de trabajo ahora se almacenan de manera automática, rápida y directa en la infraestructura segura de <strong>Firebase Storage</strong>.
              </p>
              <p>
                Ya no es necesario configurar ni mantener carpetas de Google Drive, ni autorizar cuentas OAuth externas para el personal de logística o taller.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Acceso Restringido</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                La configuración de almacenamiento de Google Drive solo está disponible para usuarios con rol de <strong>Administrador o Superadministrador</strong>.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSubView === "gemini") {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div>
          <button 
            onClick={() => setActiveSubView("menu")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group mb-2"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver a Ajustes</span>
          </button>
        </div>

        {canManageConfig ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-gray-800">
              <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Configuración de Gemini (Inteligencia Artificial)
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Configure el modelo de procesamiento de lenguaje natural y administre la clave de API para el asistente de repuestos e insumos.
                </p>
              </div>
            </div>

            {geminiSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{geminiSuccessMsg}</span>
              </div>
            )}

            {geminiErrorMsg && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{geminiErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveGeminiConfig} className="space-y-6">
              
              {/* Dropdown for Model Select */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Modelo de Gemini (Capa Gratuita / Recomendados)
                </label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Más rápido, ultra liviano)</option>
                  <option value="gemini-3-flash">Gemini 3 Flash (Alta velocidad de respuesta)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Excelente relación velocidad/calidad)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Ideal para respuestas de desarrollo)</option>
                  <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (Bajo consumo de cuota)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Clásico estable)</option>
                  <option value="gemini-1.5-flash-lite">Gemini 1.5 Flash-Lite (Baja latencia)</option>
                </select>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Seleccione el modelo preferido. Gemini 2.5/3.1 Flash se recomiendan para una respuesta sumamente ágil sobre listas de stock grandes.
                </p>
              </div>

              {/* Dropdown for Voice Select */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Voz del Asistente Virtual (Salida de Voz)
                </label>
                <select
                  value={geminiVoiceName}
                  onChange={(e) => setGeminiVoiceName(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="">Por defecto del sistema / navegador</option>
                  {browserVoices.map((v, idx) => (
                    <option key={idx} value={v.name}>
                      {v.name} ({v.lang}) {v.localService ? "[Local]" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Seleccione la voz preferida para las respuestas leídas en voz alta. Se listan las voces en español de calidad premium instaladas en su navegador y sistema operativo (Google, Microsoft, etc. son completamente gratuitas).
                </p>
              </div>

              {/* API Key Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Clave de API personalizada (API Key)
                </label>
                <input
                  type="password"
                  placeholder="Pegue aquí su API Key de Google AI Studio (ej. AIzaSy...)"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Deje vacío para utilizar la clave de API por defecto de la plataforma. Si introduce una clave personalizada, se guardará de forma segura en la base de datos y se utilizará para todas las consultas del asistente.
                </p>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingGeminiConfig}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {savingGeminiConfig ? "Guardando..." : "Guardar Configuración"}
                </button>
              </div>

              <div className="p-4 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/40 dark:border-indigo-950/40 rounded-xl text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed space-y-1.5">
                <span className="font-bold text-gray-800 dark:text-gray-200 block">¿Cómo obtener una API Key gratuita de Gemini?</span>
                <p>
                  Puede obtener una clave de API completamente gratuita ingresando con su cuenta de Google a <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="font-bold underline text-indigo-700 dark:text-indigo-300">Google AI Studio</a> y haciendo clic en <strong>"Get API Key"</strong>. La capa gratuita le permite realizar hasta 15 consultas por minuto de forma gratuita.
                </p>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Acceso Restringido</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                La configuración de Gemini solo está disponible para usuarios con rol de <strong>Administrador o Superadministrador</strong>.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSubView === "restaurar") {
    const totalRestoreDocs = restoreData
      ? (Object.values(restoreData) as any[][]).reduce((acc: number, d) => acc + d.length, 0)
      : 0;
    const progressPct = restoreProgress && restoreProgress.total > 0
      ? Math.round((restoreProgress.done / restoreProgress.total) * 100)
      : 0;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setRestoreFileName(file.name);
      setRestoreSuccessMsg(null);
      setRestoreErrorMsg(null);
      setRestoreData(null);

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          // Validate: must be an object where each value is an array
          const isValid = typeof parsed === "object" && !Array.isArray(parsed) &&
            Object.values(parsed).every(v => Array.isArray(v));
          if (!isValid) throw new Error("Formato inválido");
          setRestoreData(parsed);
        } catch {
          setRestoreErrorMsg("El archivo no es un backup válido. Asegúrate de subir un JSON generado por este sistema.");
          setRestoreFileName(null);
        }
      };
      reader.readAsText(file);
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div>
          <button
            onClick={() => setActiveSubView("menu")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group mb-2"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver a Ajustes</span>
          </button>

          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Restaurar Backup</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sube un archivo JSON y el sistema lo enviará a Firestore en lotes seguros</p>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-red-700 dark:text-red-300">⚠️ Esta acción sobrescribirá los datos existentes</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/70 leading-relaxed">
              Los documentos del backup se escribirán sobre los actuales en Firestore. Los registros que <strong>no estén en el backup</strong> permanecerán sin cambios. Se recomienda hacer un backup previo antes de restaurar.
            </p>
          </div>
        </div>

        {/* File upload zone */}
        <div className="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center space-y-4 hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center mx-auto">
            <Database className="w-7 h-7" />
          </div>
          {restoreFileName ? (
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">📄 {restoreFileName}</p>
              {restoreData && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✅ Archivo válido — {Object.keys(restoreData).length} colecciones · {totalRestoreDocs} registros en total
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Selecciona tu archivo de backup</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Solo archivos <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">econoservice_backup_*.json</code></p>
            </div>
          )}
          <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm shadow-sm transition-all cursor-pointer active:scale-95">
            <UploadCloud className="w-4 h-4" />
            {restoreFileName ? "Cambiar archivo" : "Seleccionar archivo JSON"}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
              disabled={restoringBackup}
            />
          </label>
        </div>

        {/* Status messages */}
        {restoreSuccessMsg && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">¡Restauración completada!</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">{restoreSuccessMsg}</p>
            </div>
          </div>
        )}
        {restoreErrorMsg && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-300">Error en la restauración</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">{restoreErrorMsg}</p>
            </div>
          </div>
        )}

        {/* Preview table */}
        {restoreData && !restoreSuccessMsg && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-850/40">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Vista previa del backup</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Se restaurarán estas colecciones en lotes de hasta 400 documentos</p>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {Object.entries(restoreData).map(([colName, docs]: [string, any[]]) => (
                <div key={colName} className="flex items-center gap-3 px-6 py-3">
                  <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md w-28 shrink-0 text-center">
                    {colName}
                  </span>
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400 dark:bg-amber-500 transition-all"
                        style={{ width: `${totalRestoreDocs > 0 ? Math.max(4, (docs.length / totalRestoreDocs) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums w-20 text-right">
                    {docs.length.toLocaleString("es-AR")} docs
                  </span>
                </div>
              ))}
            </div>
            <div className="px-6 py-3 bg-gray-50/80 dark:bg-gray-850/40 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-sm font-extrabold text-gray-800 dark:text-gray-200">{Number(totalRestoreDocs).toLocaleString("es-AR")} documentos</span>
            </div>
          </div>
        )}

        {/* Progress bar while restoring */}
        {restoreProgress && (
          <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Restaurando...</span>
              </div>
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{progressPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Colección actual: <strong className="text-gray-700 dark:text-gray-300 font-mono">{restoreProgress.currentCol}</strong>
              &nbsp;·&nbsp;{restoreProgress.done.toLocaleString("es-AR")} / {restoreProgress.total.toLocaleString("es-AR")} documentos
            </p>
          </div>
        )}

        {/* Restore button */}
        {restoreData && !restoreSuccessMsg && (
          <div className="flex justify-center pt-2 pb-4">
            <button
              onClick={handleRestoreDatabase}
              disabled={restoringBackup}
              className="inline-flex items-center gap-3 px-8 py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl shadow-lg hover:shadow-amber-200 dark:hover:shadow-amber-900/40 transition-all duration-200 text-sm active:scale-95 cursor-pointer"
            >
              {restoringBackup ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Restaurando en Firestore...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  <span>Iniciar Restauración ({Number(totalRestoreDocs).toLocaleString("es-AR")} docs)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (activeSubView === "backup") {

    const collections = [
      { name: "clientes",      label: "Clientes",        icon: "👤" },
      { name: "equipos",       label: "Equipos",          icon: "🖥️" },
      { name: "servicios",     label: "Servicios / Órdenes", icon: "🔧" },
      { name: "presupuestos",  label: "Presupuestos",     icon: "📋" },
      { name: "stock",         label: "Stock / Insumos",  icon: "📦" },
      { name: "gastos",        label: "Gastos",           icon: "💸" },
      { name: "proveedores",   label: "Proveedores",      icon: "🏭" },
      { name: "notifications", label: "Notificaciones",   icon: "🔔" },
      { name: "users",         label: "Usuarios",         icon: "👥" },
      { name: "config",        label: "Configuración",    icon: "⚙️" },
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div>
          <button
            onClick={() => setActiveSubView("menu")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group mb-2"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver a Ajustes</span>
          </button>

          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Backup de Base de Datos</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Descarga una copia de seguridad completa en formato JSON</p>
            </div>
          </div>
        </div>

        {/* Status messages */}
        {backupSuccessMsg && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">¡Backup generado con éxito!</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">{backupSuccessMsg}</p>
            </div>
          </div>
        )}
        {backupErrorMsg && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-300">Error al generar el backup</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">{backupErrorMsg}</p>
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-850/40">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Colecciones incluidas en el backup</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Se exportarán todas las colecciones activas de Firestore</p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {collections.map((col) => (
              <div key={col.name} className="flex items-center gap-3 px-6 py-3">
                <span className="text-base">{col.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{col.label}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-gray-500 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md">
                  {col.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Format info */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
            <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Formato JSON — Portátil y legible</p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/70 leading-relaxed">
              El archivo descargado incluirá todos los documentos de cada colección con sus IDs. 
              El nombre del archivo será <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded text-[11px]">econoservice_backup_YYYY-MM-DD.json</code>.
            </p>
          </div>
        </div>

        {/* Export button */}
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={handleExportDatabase}
            disabled={exportingBackup}
            className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl shadow-lg hover:shadow-emerald-200 dark:hover:shadow-emerald-900/40 transition-all duration-200 text-sm active:scale-95 cursor-pointer"
          >
            {exportingBackup ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Generando backup...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Descargar Backup Ahora</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (activeSubView === "whatsapp") {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div>
          <button 
            onClick={() => setActiveSubView("menu")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group mb-2"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver a Ajustes</span>
          </button>
        </div>
        {canManageConfig ? (
          <WhatsAppConfigSubView onClose={() => setActiveSubView("menu")} />
        ) : (
          <div className="p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Acceso Restringido</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No tienes permisos para ver o modificar la configuración de WhatsApp.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (activeSubView === "importar") {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div>
          <button 
            onClick={() => setActiveSubView("menu")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group mb-2"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver a Ajustes</span>
          </button>
        </div>

        {canManageConfig ? (
          <div className="space-y-6">
            {/* Main Importer Card */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Importar Órdenes de Servicio por CSV
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Sube tu planilla de órdenes de servicio para crear automáticamente los Clientes, Equipos y Servicios en Firebase.
                    </p>
                  </div>
                </div>

                <a 
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                    "calle,numero,ciudad,depto,aparato,marca,modelo,desperfectoUsuario,fechaRetiro,horaRetiroDesde,horaRetiroHasta,telCel,nombreApellido,notasRetiro,ns1,ns2,ns3,observaciones,estado,notasInternas,diagnostico,repuestosComprar,citaEntrega,horaEntregaDesde,horaEntregaHasta,terminado,entregado,metodoPago,montoEfectivo,montoTransferencia\n" +
                    "7 de marzo,2701,Santo Tome,,Lavarropas,Samsung,Plus,se apaga,2026-08-07,10:00,12:00,3424123456,Juan Perez,Dejar en conserjería,SI,NO,SI,Cliente prefiere mañana,EN_ESPERA,Revisión inicial en taller,cambiar placa,una placa,2026-08-10,09:00,12:00,NO,NO,,0,0\n" +
                    "Rivadavia,456,Santo Tome,,Lavavajillas,Whirlpool,WLF12,Puerta no traba,2026-07-25,14:00,16:00,3425987654,,No atiende timbre,NO,SI,NO,Sin observaciones,ENTREGADO,Entregado a cliente,Cambio de resorte bisagra,Resorte Whirlpool,2026-07-30,10:00,12:00,SI,SI,Efectivo + Transferencia,15000,17000"
                  )}`}
                  download="plantilla_ordenes_servicio_oficial.csv"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all border border-indigo-200/60 dark:border-indigo-800/40"
                >
                  <Download className="w-4 h-4" />
                  Descargar Plantilla CSV Oficial
                </a>
              </div>

              {importSuccessMsg && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}

              {importErrorMsg && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 rounded-xl flex items-center gap-2.5 text-red-800 dark:text-red-300 text-xs font-medium animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{importErrorMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Seleccionar Archivo CSV
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvChange}
                      className="flex-1 px-3.5 py-3 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-900 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-800"
                      disabled={isImporting}
                    />
                    <button
                      onClick={processCsvImport}
                      disabled={!csvFile || !parsedRowsPreview || parsedRowsPreview.length === 0 || isImporting}
                      className="inline-flex items-center gap-1.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      <UploadCloud className="w-4 h-4" />
                      {isImporting ? "Importando..." : `Importar (${parsedRowsPreview?.length || 0} filas)`}
                    </button>
                  </div>
                </div>

                {isImporting && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-medium text-gray-500">
                      <span>Procesando e insertando órdenes de servicio en Firebase...</span>
                      <span className="font-bold text-indigo-600">{importProgress} / {importTotal} procesadas</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Pre-flight inspection preview table */}
                {parsedRowsPreview && parsedRowsPreview.length > 0 && !isImporting && (
                  <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Vista previa de pre-carga ({parsedRowsPreview.length} registros detectados):
                      </span>
                      <span className="text-[11px] text-gray-400">Mostrando hasta las primeras 5 filas</span>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 font-semibold">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Celular</th>
                            <th className="py-2.5 px-3">Domicilio</th>
                            <th className="py-2.5 px-3">Equipo</th>
                            <th className="py-2.5 px-3">Desperfecto</th>
                            <th className="py-2.5 px-3">Estado</th>
                            <th className="py-2.5 px-3 text-right">Validación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {parsedRowsPreview.slice(0, 5).map((row, idx) => {
                            const tel = row.telCel || row.celular || row.telefono;
                            const isValid = !!tel;
                            return (
                              <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50">
                                <td className="py-2 px-3 font-mono text-gray-400">{idx + 1}</td>
                                <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white">
                                  {tel || <span className="text-red-500 italic">Falta celular</span>}
                                </td>
                                <td className="py-2 px-3 text-gray-600 dark:text-gray-300">
                                  {row.calle ? `${row.calle} ${row.numero || ""}` : "-"}
                                </td>
                                <td className="py-2 px-3 text-gray-600 dark:text-gray-300">
                                  {row.aparato || "Lavarropas"} - {row.marca || "Genérico"}
                                </td>
                                <td className="py-2 px-3 text-amber-700 dark:text-amber-400 italic">
                                  "{row.desperfectoUsuario || "No especificado"}"
                                </td>
                                <td className="py-2 px-3 uppercase font-bold text-[10px]">
                                  {row.estado || "RECIBIDO"}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {isValid ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                                      VÁLIDO
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                                      INVÁLIDO
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card: Eliminación Masiva de Clientes */}
          <div className="bg-white dark:bg-gray-900 border border-red-100 dark:border-red-950/40 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-gray-800">
              <Trash2 className="w-5 h-5 text-red-600" />
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Eliminación Masiva de Clientes
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Elimina todos los clientes de la base de datos de manera definitiva e irreversible.
                </p>
              </div>
            </div>

            {deleteSuccessMsg && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {deleteSuccessMsg}
              </div>
            )}

            {deleteErrorMsg && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 rounded-xl flex items-center gap-2.5 text-red-800 dark:text-red-300 text-xs font-medium animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                {deleteErrorMsg}
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed bg-red-50/50 dark:bg-red-950/10 p-3.5 border border-red-100/50 dark:border-red-950/30 rounded-xl">
                <strong>Advertencia importante:</strong> Esta opción es ideal cuando has subido un archivo CSV por error y deseas limpiar el directorio completo para volver a cargarlo. Al presionar el botón, el sistema limpiará todos los clientes registrados utilizando lotes de Firestore de forma segura para evitar interrupciones.
              </p>

              {!isDeletingAll ? (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteErrorMsg(null);
                      setDeleteSuccessMsg(null);
                      setDeleteConfirmInput("");
                      setShowDeleteConfirmModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Vaciar Directorio de Clientes
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs font-medium text-gray-500">
                    <span>Progreso de la eliminación masiva...</span>
                    <span className="font-bold text-red-600">{deleteProgress} clientes eliminados</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-red-600 h-2 rounded-full animate-pulse w-full" />
                  </div>
                  <p className="text-[10px] text-gray-400 text-center">No cierres esta pestaña. Procesando eliminación en lotes para mayor estabilidad.</p>
                </div>
              )}
            </div>
          </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Acceso Restringido</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                La importación masiva solo está disponible para usuarios con rol de <strong>Administrador o Superadministrador</strong>.
              </p>
            </div>
          </div>
        )}

        {showDeleteConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 border border-red-150 dark:border-red-950 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 animate-bounce" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-base font-black text-gray-900 dark:text-white">
                    ¿Confirmar eliminación masiva?
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Estás a punto de eliminar <strong>todos los clientes</strong> registrados en el sistema de forma permanente e irreversible. Esto afectará también a los equipos o servicios asociados si estos clientes no existen más.
                  </p>
                  <div className="space-y-2 pt-2.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Escribe <span className="text-red-600 font-extrabold font-mono">ELIMINAR</span> para proceder:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmInput}
                      onChange={(e) => setDeleteConfirmInput(e.target.value)}
                      placeholder="Escribe ELIMINAR"
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold tracking-wider text-center focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setDeleteConfirmInput("");
                  }}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={processDeleteAllClientes}
                  disabled={deleteConfirmInput !== "ELIMINAR"}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar Todos los Clientes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Back button and Header */}
      <div>
        <button 
          onClick={() => setActiveSubView("menu")}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-white bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group mb-4"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Volver a Ajustes</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-indigo-600" />
              Usuarios del Sistema
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Administra las cuentas de Google Auth, activa accesos y asigna los roles correspondientes.
            </p>
          </div>
          <div>
            <button
              onClick={fetchUsuarios}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Card */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Total Usuarios</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">{totalUsers}</span>
          </div>
        </div>

        {/* Active Card */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Activos</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono text-emerald-500">{activeUsers}</span>
          </div>
        </div>

        {/* Pending Card */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Pendientes de Activación</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono text-amber-500">{pendingUsers}</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
          <Check className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Access Restriction Warning */}
      {!isSuperadmin && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/25 border border-indigo-150 dark:border-indigo-900/40 rounded-xl text-indigo-700 dark:text-indigo-400 text-sm flex items-center gap-2">
          <Shield className="w-5 h-5 shrink-0" />
          <span>Tiene acceso de solo lectura. Únicamente el Superadmin puede activar cuentas o cambiar roles del sistema.</span>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {loading && usuarios.length === 0 ? (
          <div className="flex items-center justify-center min-h-[250px]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No se encontraron usuarios registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 dark:bg-gray-850/50 border-b border-gray-100 dark:border-gray-800/80 text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Usuario</th>
                  <th className="p-4">Contacto</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Rol en Sistema</th>
                  <th className="p-4 pr-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                {usuarios.map((user) => {
                  const isPrimaryAdmin = user.email.toLowerCase() === "juanpacheco@playcode.com.ar";
                  const isSelf = user.uid === profile?.uid;
                  
                  return (
                    <tr key={user.uid} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      {/* Name / Avatar */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold uppercase ${
                            user.activo 
                              ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" 
                              : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                          }`}>
                            {user.nombre?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="font-bold text-gray-850 dark:text-white block flex items-center gap-1.5">
                              {user.nombre}
                              {isPrimaryAdmin && (
                                <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-indigo-600 text-white rounded-md uppercase tracking-wider">
                                  Global Creator
                                </span>
                              )}
                              {isSelf && (
                                <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-emerald-500 text-white rounded-md uppercase tracking-wider">
                                  Tú
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">ID: {user.uid.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact / Email */}
                      <td className="p-4 text-gray-600 dark:text-gray-300">
                        <span className="font-medium font-mono text-xs block">{user.email}</span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          user.activo
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30"
                            : "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-amber-100 dark:border-amber-900/30"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.activo ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {user.activo ? "Activo" : "Pendiente"}
                        </span>
                      </td>

                      {/* Role selection */}
                      <td className="p-4">
                        <select
                          value={user.rol}
                          disabled={!isSuperadmin || isPrimaryAdmin || updatingId === user.uid}
                          onChange={(e) => handleChangeRol(user, e.target.value as Role)}
                          className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer disabled:opacity-50"
                        >
                          <option value="superadmin">Superadmin</option>
                          <option value="administracion">Administración</option>
                          <option value="tecnico">Técnico</option>
                          <option value="logistica">Logística</option>
                          <option value="admin">Administrador (Legacy)</option>
                          <option value="recepcion">Recepcionista (Legacy)</option>
                          <option value="consulta">Consulta / Auditor (Legacy)</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {/* Edit button - available to admin and superadmin */}
                          {canManageConfig && (
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setEditNombre(user.nombre || "");
                              }}
                              disabled={updatingId === user.uid}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-indigo-100 dark:border-indigo-950/30 bg-indigo-50 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 disabled:opacity-40 cursor-pointer transition-all"
                              title="Editar nombre del usuario"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Editar
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleActivo(user)}
                            disabled={!isSuperadmin || isPrimaryAdmin || isSelf || updatingId === user.uid}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-all disabled:opacity-40 ${
                              user.activo
                                ? "bg-amber-50 dark:bg-amber-950/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-950/30 hover:bg-amber-100"
                                : "bg-emerald-50 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-950/30 hover:bg-emerald-100"
                            }`}
                          >
                            {user.activo ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                Desactivar
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Activar Cuenta
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setUserToDelete(user)}
                            disabled={!isSuperadmin || isPrimaryAdmin || isSelf || updatingId === user.uid}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-red-100 dark:border-red-950/30 bg-red-50 dark:bg-red-950/10 text-red-600 dark:text-red-400 hover:bg-red-100 disabled:opacity-40 cursor-pointer transition-all"
                            title="Eliminar Cuenta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edición de nombre de usuario */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                <Pencil className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Editar Usuario</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Modificá el nombre visible de <strong className="text-gray-700 dark:text-gray-300">{editingUser.email}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Nombre que se muestra
                </label>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  placeholder="Nombre completo del usuario"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editNombre.trim()) {
                      e.preventDefault();
                      handleEditUser();
                    }
                    if (e.key === "Escape") setEditingUser(null);
                  }}
                />
              </div>

              <div className="bg-gray-50 dark:bg-gray-850/60 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Datos actuales</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                    {editingUser.nombre?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 block">{editingUser.nombre}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{editingUser.email}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={savingEdit}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEditUser}
                disabled={savingEdit || !editNombre.trim() || editNombre.trim() === editingUser.nombre}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all"
              >
                {savingEdit ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                ) : (
                  <><Check className="w-3.5 h-3.5" /> Guardar Cambios</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ¿Eliminar cuenta de usuario?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará el perfil de <strong className="text-gray-900 dark:text-white">{userToDelete.nombre}</strong> ({userToDelete.email}) de la base de datos de forma permanente. El usuario ya no tendrá acceso ni roles asignados en el sistema.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(userToDelete)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all"
              >
                Sí, Eliminar Cuenta
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

interface WhatsAppConfigSubViewProps {
  onClose: () => void;
}

function WhatsAppConfigSubView({ onClose }: WhatsAppConfigSubViewProps) {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStatus = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status);
        setQr(data.qr);
      } else {
        setErrorMsg(data.error || "No se pudo obtener el estado de WhatsApp.");
      }
    } catch (err: any) {
      setErrorMsg("Error al comunicarse con el servidor.");
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus(true);
    const interval = setInterval(() => {
      fetchStatus(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      if (res.ok) {
        setStatus("disconnected");
        setQr(null);
        alert("WhatsApp desconectado correctamente.");
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "No se pudo desconectar.");
      }
    } catch (err) {
      setErrorMsg("Error al desconectar.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm p-6 space-y-6">
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-gray-800">
        <MessageSquare className="w-5 h-5 text-emerald-600" />
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            WhatsApp Integración (Beta)
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Conecte su número de WhatsApp para enviar notificaciones de retiro y diagnóstico automatizadas por un agente de IA.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Verificando conexión con WhatsApp...</p>
        </div>
      ) : status === "connected" ? (
        <div className="space-y-6 text-center py-6 max-w-md mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 mb-2">
            <Check className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">¡Conexión Activa!</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              El sistema se encuentra conectado a WhatsApp. El agente de IA enviará notificaciones automáticamente en los siguientes eventos:
            </p>
            <div className="text-left bg-slate-50 dark:bg-gray-850 p-4 rounded-xl space-y-2 text-xs font-semibold text-gray-750 dark:text-gray-300 border border-slate-200/50 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Confirmación de retiro de equipo (Logística)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Finalización de diagnóstico/presupuesto (Taller)</span>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-red-500/10 active:scale-95"
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>DESCONECTAR WHATSAPP</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-500" />
                Vincular Dispositivo
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Escanee el código QR para autenticar y guardar la sesión en el servidor. El procedimiento es igual a WhatsApp Web:
              </p>
            </div>
            
            <ol className="list-decimal list-inside text-xs space-y-2 text-gray-600 dark:text-gray-400 pl-1 font-medium">
              <li>Abra WhatsApp en su teléfono móvil.</li>
              <li>Vaya a <strong className="text-gray-900 dark:text-white">Ajustes / Dispositivos vinculados</strong>.</li>
              <li>Presione <strong className="text-gray-900 dark:text-white">Vincular un dispositivo</strong>.</li>
              <li>Apunte la cámara al código QR de la derecha.</li>
            </ol>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>Nota:</strong> Esta conexión utiliza la capa gratuita local. Se mantendrá activa en segundo plano mientras no cierre la sesión en su móvil.
            </div>
          </div>

          <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-gray-855 p-6 rounded-2xl border border-slate-200/60 dark:border-gray-800 min-h-[300px]">
            {qr ? (
              <div className="space-y-4 text-center">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=250x250`} 
                  className="mx-auto border-4 border-white dark:border-gray-800 p-2 rounded-2xl bg-white shadow-md" 
                  alt="WhatsApp QR Code" 
                />
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Código QR Listo
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Generando código de vinculación...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
