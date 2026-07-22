import React, { useEffect, useState } from "react";
import { ServiciosService, ClientesService, TecnicosService, StockService, ProveedoresService, NotificationsService } from "../services/db";
import { Servicio, Cliente, Tecnico, EstadoServicio, ItemStock, Proveedor, getEstadoLabel } from "../types";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { GeminiConfigService } from "../services/geminiConfig";
import { 
  Search, 
  Filter, 
  Package, 
  Eye, 
  Edit2, 
  User, 
  Wrench, 
  Check, 
  X, 
  RefreshCw, 
  AlertCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  ClipboardList,
  MessageSquare,
  Sparkles,
  Send,
  Bot,
  Plus,
  Trash2,
  Store,
  ArrowLeft,
  Tag
} from "lucide-react";

export default function Insumos() {
  const { user, profile } = useAuth();
  const { navigate } = useNavigation();

  const isSuperadmin = profile?.rol === "superadmin";

  const [stockItemToDelete, setStockItemToDelete] = useState<string | null>(null);
  const [proveedorToDelete, setProveedorToDelete] = useState<string | null>(null);

  // Data states
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & search states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPurchaseState, setFilterPurchaseState] = useState<string>("todos"); // todos, pendientes, comprados

  // Mapping states
  const [clientMap, setClientMap] = useState<Record<string, Cliente>>({});
  const [tecnicMap, setTecnicMap] = useState<Record<string, string>>({});

  // Chat states
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "¡Hola! Soy tu asistente de almacén e insumos. Estoy listo para ayudarte a analizar el inventario y las compras pendientes del taller. ¿Qué necesitas comprar o revisar hoy?"
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Edit/Detail modal states
  const [selectedService, setSelectedService] = useState<Servicio | null>(null);
  const [editRepuestosComprar, setEditRepuestosComprar] = useState("");
  const [editRepuestosComprados, setEditRepuestosComprados] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Stock and Suppliers View States
  const [viewMode, setViewMode] = useState<"orders" | "stock">("orders");
  const [activeStockTab, setActiveStockTab] = useState<"items" | "proveedores">("items");
  const [stockItems, setStockItems] = useState<ItemStock[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockSearchTerm, setStockSearchTerm] = useState("");
  const [proveedorSearchTerm, setProveedorSearchTerm] = useState("");

  // Stock Form States
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<ItemStock | null>(null);
  const [stockForm, setStockForm] = useState<Omit<ItemStock, "id" | "createdAt" | "updatedAt">>({
    nombre: "",
    descripcion: "",
    cantidad: 0,
    unidad: "unidades",
    precioCompra: 0,
    precioVenta: 0,
    proveedorId: "",
    marcaModeloCompatible: "",
    ubicacion: "",
    stockMinimo: 0,
  });

  // Supplier Form States
  const [isProveedorModalOpen, setIsProveedorModalOpen] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [proveedorForm, setProveedorForm] = useState<Omit<Proveedor, "id" | "createdAt">>({
    nombre: "",
    contacto: "",
    telefono: "",
    direccion: "",
    email: "",
    observaciones: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [servList, cliList, tecList] = await Promise.all([
        ServiciosService.getAll(),
        ClientesService.getAll(),
        TecnicosService.getAll()
      ]);

      setServicios(servList);
      setClientes(cliList);
      setTecnicos(tecList);

      const cMap: Record<string, Cliente> = {};
      cliList.forEach(c => {
        if (c.id) cMap[c.id] = c;
      });
      setClientMap(cMap);

      const tMap: Record<string, string> = {};
      tecList.forEach(t => {
        if (t.id) tMap[t.id] = t.nombre;
      });
      setTecnicMap(tMap);

    } catch (err) {
      console.error("Error loading insumos data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadStockData = async () => {
    try {
      setLoadingStock(true);
      const [itemsList, provList] = await Promise.all([
        StockService.getAll(),
        ProveedoresService.getAll()
      ]);
      setStockItems(itemsList);
      setProveedores(provList);
    } catch (err) {
      console.error("Error loading stock data:", err);
    } finally {
      setLoadingStock(false);
    }
  };

  useEffect(() => {
    loadData();
    loadStockData();
  }, []);

  const getStatusBadgeColor = (status: EstadoServicio) => {
    switch (status) {
      case "RECIBIDO":
        return "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/30";
      case "DIAGNOSTICO":
        return "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900/30";
      case "PENDIENTE_APROBACION":
        return "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/30";
      case "EN_REPARACION":
        return "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-900/30";
      case "LISTO_PARA_ENTREGA":
        return "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/30";
      case "ENTREGA_EN_PROGRESO":
        return "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30";
      case "ENTREGADO":
        return "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30";
      case "CANCELADO":
        return "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900/30";
      default:
        return "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-700";
    }
  };

  const handleOpenEdit = (servicio: Servicio) => {
    setSelectedService(servicio);
    setEditRepuestosComprar(servicio.repuestosComprar || "");
    setEditRepuestosComprados(servicio.repuestosComprados || "");
    setIsEditing(false);
  };

  const handleCloseEdit = () => {
    setSelectedService(null);
    setEditRepuestosComprar("");
    setEditRepuestosComprados("");
    setIsEditing(false);
  };

  const formatAssistantMessage = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} className="font-extrabold text-gray-950 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || chatLoading) return;

    if (!textToSend) {
      setInputMessage("");
    }

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setChatLoading(true);

    try {
      const config = await GeminiConfigService.getConfig();

      const contextInsumos = baseInsumoServicios.map(s => ({
        numeroServicio: s.numeroServicio,
        aparato: s.aparato,
        marcaModelo: s.marcaModelo,
        clienteNombre: clientMap[s.clienteId]?.nombreApellido || "S/D",
        tecnicoNombre: s.tecnicoId ? tecnicMap[s.tecnicoId] || "S/D" : "Sin asignar",
        estado: s.estado,
        repuestosComprar: s.repuestosComprar,
        repuestosComprados: s.repuestosComprados,
      }));

      const res = await fetch("/api/insumos/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: newMessages,
          contextInsumos,
          apiKey: config.apiKey,
          model: config.model
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo obtener respuesta del asistente.");
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: "assistant", content: err.message || "Lo siento, ocurrió un error al procesar tu solicitud. Por favor intenta de nuevo." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const syncRepuestosToStock = async (repuestosText: string, servicio: Servicio) => {
    if (!repuestosText || !repuestosText.trim()) return;

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
      await loadStockData();
    } catch (err) {
      console.error("Error syncing repuestos to stock:", err);
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedService.id) return;

    try {
      setSaving(true);
      const uid = user?.uid || "";
      const uName = profile?.nombre || user?.email || "Usuario";
      
      const updatedFields: Partial<Servicio> = {
        repuestosComprar: editRepuestosComprar,
        repuestosComprados: editRepuestosComprados
      };

      await ServiciosService.update(
        selectedService.id,
        updatedFields,
        uid,
        uName,
        "Repuestos actualizados desde la sección de Insumos"
      );

      // Sincronizar automáticamente con el Stock Central (Inventario)
      if (editRepuestosComprados) {
        await syncRepuestosToStock(editRepuestosComprados, selectedService);
      }

      handleCloseEdit();
      await loadData();
    } catch (err) {
      console.error("Error updating spare parts:", err);
      alert("No se pudieron guardar los cambios. Intente de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsPurchased = async (servicio: Servicio) => {
    if (!servicio || !servicio.id) return;
    try {
      setSaving(true);
      const uid = user?.uid || "";
      const uName = profile?.nombre || user?.email || "Usuario";

      const targetRepuestos = servicio.repuestosComprar || "Todos los repuestos adquiridos";
      const updatedFields: Partial<Servicio> = {
        repuestosComprados: targetRepuestos
      };

      await ServiciosService.update(
        servicio.id,
        updatedFields,
        uid,
        uName,
        "Repuestos marcados como comprados desde la sección de Insumos"
      );

      // Sincronizar automáticamente con el Stock Central (Inventario)
      await syncRepuestosToStock(targetRepuestos, servicio);

      handleCloseEdit();
      await loadData();
    } catch (err) {
      console.error("Error marking as purchased:", err);
      alert("No se pudo actualizar el estado a comprado. Intente de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const isNew = !(selectedStockItem && selectedStockItem.id);
      const prevQty = selectedStockItem ? (selectedStockItem.cantidad || 0) : 0;
      const newQty = Number(stockForm.cantidad) || 0;

      if (selectedStockItem && selectedStockItem.id) {
        await StockService.update(selectedStockItem.id, stockForm);
      } else {
        await StockService.create(stockForm);
      }

      // Sincronizar notificación si entra stock
      if (newQty > 0 && (isNew || prevQty === 0)) {
        await NotificationsService.create({
          targetRole: "tecnico",
          title: "Repuesto en Stock Central 📦",
          message: `El repuesto "${stockForm.nombre}"${stockForm.marcaModeloCompatible ? ` compatible con "${stockForm.marcaModeloCompatible}"` : ''} ahora se encuentra disponible en Stock.`,
        });
      }

      setIsStockModalOpen(false);
      setSelectedStockItem(null);
      setStockForm({
        nombre: "",
        descripcion: "",
        cantidad: 0,
        unidad: "unidades",
        precioCompra: 0,
        precioVenta: 0,
        proveedorId: "",
        marcaModeloCompatible: "",
        ubicacion: "",
        stockMinimo: 0,
      });
      await loadStockData();
    } catch (err) {
      console.error("Error saving stock item:", err);
      alert("No se pudo guardar el insumo. Intente de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStockItem = (id: string) => {
    if (!id) return;
    setStockItemToDelete(id);
  };

  const confirmDeleteStockItem = async () => {
    if (!stockItemToDelete) return;
    try {
      setSaving(true);
      await StockService.delete(stockItemToDelete);
      await loadStockData();
      setStockItemToDelete(null);
    } catch (err) {
      console.error("Error deleting stock item:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (selectedProveedor && selectedProveedor.id) {
        await ProveedoresService.update(selectedProveedor.id, proveedorForm);
      } else {
        await ProveedoresService.create(proveedorForm);
      }
      setIsProveedorModalOpen(false);
      setSelectedProveedor(null);
      setProveedorForm({
        nombre: "",
        contacto: "",
        telefono: "",
        direccion: "",
        email: "",
        observaciones: "",
      });
      await loadStockData();
    } catch (err) {
      console.error("Error saving proveedor:", err);
      alert("No se pudo guardar el proveedor. Intente de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProveedor = (id: string) => {
    if (!id) return;
    setProveedorToDelete(id);
  };

  const confirmDeleteProveedor = async () => {
    if (!proveedorToDelete) return;
    try {
      setSaving(true);
      await ProveedoresService.delete(proveedorToDelete);
      await loadStockData();
      setProveedorToDelete(null);
    } catch (err) {
      console.error("Error deleting proveedor:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenStockModal = (item: ItemStock | null = null) => {
    if (item) {
      setSelectedStockItem(item);
      setStockForm({
        nombre: item.nombre || "",
        descripcion: item.descripcion || "",
        cantidad: item.cantidad || 0,
        unidad: item.unidad || "unidades",
        precioCompra: item.precioCompra || 0,
        precioVenta: item.precioVenta || 0,
        proveedorId: item.proveedorId || "",
        marcaModeloCompatible: item.marcaModeloCompatible || "",
        ubicacion: item.ubicacion || "",
        stockMinimo: item.stockMinimo || 0,
      });
    } else {
      setSelectedStockItem(null);
      setStockForm({
        nombre: "",
        descripcion: "",
        cantidad: 0,
        unidad: "unidades",
        precioCompra: 0,
        precioVenta: 0,
        proveedorId: "",
        marcaModeloCompatible: "",
        ubicacion: "",
        stockMinimo: 0,
      });
    }
    setIsStockModalOpen(true);
  };

  const handleOpenProveedorModal = (prov: Proveedor | null = null) => {
    if (prov) {
      setSelectedProveedor(prov);
      setProveedorForm({
        nombre: prov.nombre || "",
        contacto: prov.contacto || "",
        telefono: prov.telefono || "",
        direccion: prov.direccion || "",
        email: prov.email || "",
        observaciones: prov.observaciones || "",
      });
    } else {
      setSelectedProveedor(null);
      setProveedorForm({
        nombre: "",
        contacto: "",
        telefono: "",
        direccion: "",
        email: "",
        observaciones: "",
      });
    }
    setIsProveedorModalOpen(true);
  };

  // 1. First, we filter only work orders that HAVE needed spare parts list (i.e. s.repuestosComprar is defined and not empty)
  const baseInsumoServicios = servicios.filter(s => {
    return s.repuestosComprar && s.repuestosComprar.trim().length > 0;
  });

  // 2. Then, apply searching and other filters
  const filteredInsumos = baseInsumoServicios.filter(s => {
    const client = clientMap[s.clienteId];
    const clientName = client?.nombreApellido.toLowerCase() || "";
    const tecName = s.tecnicoId ? tecnicMap[s.tecnicoId]?.toLowerCase() || "" : "";
    const searchTermLower = searchTerm.toLowerCase();

    // Match text search (N° Servicio, Aparato, Marca, Cliente, Repuesto)
    const matchesSearch = 
      s.numeroServicio.toString().includes(searchTermLower) ||
      s.aparato.toLowerCase().includes(searchTermLower) ||
      s.marcaModelo.toLowerCase().includes(searchTermLower) ||
      clientName.includes(searchTermLower) ||
      (s.repuestosComprar && s.repuestosComprar.toLowerCase().includes(searchTermLower)) ||
      (s.repuestosComprados && s.repuestosComprados.toLowerCase().includes(searchTermLower)) ||
      tecName.includes(searchTermLower);

    // Match status of service
    const matchesStatus = !filterStatus || s.estado === filterStatus;

    // Match purchase state (stock/comprados vs pending)
    let matchesPurchase = true;
    if (filterPurchaseState === "pendientes") {
      // Pending: has things to buy, but 'repuestosComprados' is empty or significantly shorter/incomplete
      matchesPurchase = !s.repuestosComprados || s.repuestosComprados.trim().length === 0;
    } else if (filterPurchaseState === "comprados") {
      // Completed / with stock: has some comments in repuestosComprados
      matchesPurchase = !!(s.repuestosComprados && s.repuestosComprados.trim().length > 0);
    }

    return matchesSearch && matchesStatus && matchesPurchase;
  });

  // Stats calculation
  const totalInsumosPendientes = baseInsumoServicios.filter(s => !s.repuestosComprados || s.repuestosComprados.trim().length === 0).length;
  const totalInsumosComprados = baseInsumoServicios.filter(s => s.repuestosComprados && s.repuestosComprados.trim().length > 0).length;

  // Filtered Stock Items and Providers
  const filteredStockItems = stockItems.filter(item => {
    const search = stockSearchTerm.toLowerCase();
    return (
      item.nombre.toLowerCase().includes(search) ||
      (item.descripcion && item.descripcion.toLowerCase().includes(search)) ||
      (item.marcaModeloCompatible && item.marcaModeloCompatible.toLowerCase().includes(search)) ||
      (item.ubicacion && item.ubicacion.toLowerCase().includes(search))
    );
  });

  const filteredProveedores = proveedores.filter(p => {
    const search = proveedorSearchTerm.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(search) ||
      (p.contacto && p.contacto.toLowerCase().includes(search)) ||
      (p.telefono && p.telefono.toLowerCase().includes(search)) ||
      (p.email && p.email.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-8 h-8 text-indigo-600 shrink-0" />
            Control de Insumos y Repuestos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Lista de órdenes de trabajo con repuestos requeridos para compras y seguimiento de stock.
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            {viewMode === "orders" ? (
              <>
                <button
                  onClick={() => setViewMode("stock")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all cursor-pointer uppercase tracking-wider"
                >
                  <Store className="w-4 h-4" />
                  VER STOCK
                </button>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Actualizar Lista
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setViewMode("orders")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl text-xs font-extrabold shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 group"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  <span>Volver a Requerimientos</span>
                </button>
                <button
                  onClick={loadStockData}
                  disabled={loadingStock}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingStock ? "animate-spin" : ""}`} />
                  Actualizar Stock
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {viewMode === "stock" ? (
        <div className="space-y-6 animate-fade-in">
          {/* Sub-view Header Tabs */}
          <div className="flex border-b border-gray-150 dark:border-gray-800">
            <button
              onClick={() => setActiveStockTab("items")}
              className={`px-6 py-3 font-bold text-sm tracking-wide border-b-2 transition-all cursor-pointer ${
                activeStockTab === "items"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                INSUMOS Y REPUESTOS EN STOCK
              </span>
            </button>
            <button
              onClick={() => setActiveStockTab("proveedores")}
              className={`px-6 py-3 font-bold text-sm tracking-wide border-b-2 transition-all cursor-pointer ${
                activeStockTab === "proveedores"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                PROVEEDORES Y CONTACTOS
              </span>
            </button>
          </div>

          {activeStockTab === "items" ? (
            <div className="space-y-4">
              {/* Search & Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl shadow-xs">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar insumos por nombre, marca compatible..."
                    value={stockSearchTerm}
                    onChange={(e) => setStockSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>
                <button
                  onClick={() => handleOpenStockModal(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  NUEVO INSUMO
                </button>
              </div>

              {/* Items Grid/Table */}
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden">
                {loadingStock ? (
                  <div className="p-12 text-center text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
                    <span>Cargando insumos...</span>
                  </div>
                ) : filteredStockItems.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 space-y-2">
                    <Package className="w-12 h-12 mx-auto text-gray-300" />
                    <p className="font-bold text-gray-800 dark:text-gray-200">No se encontraron insumos</p>
                    <p className="text-xs">Añada repuestos de stock para administrarlos de manera centralizada.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-850 bg-gray-50/50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                          <th className="p-4">Insumo / Repuesto</th>
                          <th className="p-4">Compatibilidad</th>
                          <th className="p-4">Cantidad</th>
                          <th className="p-4">Precio Compra</th>
                          <th className="p-4">Precio Venta</th>
                          <th className="p-4">Ubicación / Proveedor</th>
                          <th className="p-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-850 text-xs">
                        {filteredStockItems.map((item) => {
                          const provName = proveedores.find(p => p.id === item.proveedorId)?.nombre || "Sin especificar";
                          const isLowStock = item.cantidad <= (item.stockMinimo || 0);
                          return (
                            <tr key={item.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-900/30 transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-gray-900 dark:text-white">{item.nombre}</div>
                                {item.descripcion && (
                                  <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 max-w-xs truncate">{item.descripcion}</div>
                                )}
                              </td>
                              <td className="p-4">
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                  {item.marcaModeloCompatible || "Universal / Multimarca"}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <span className={`font-black text-xs px-2 py-0.5 rounded-lg border ${
                                    isLowStock 
                                      ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100/50" 
                                      : "bg-gray-50 dark:bg-gray-850 text-gray-800 dark:text-gray-200 border-gray-100 dark:border-gray-800"
                                  }`}>
                                    {item.cantidad} {item.unidad}
                                  </span>
                                  {isLowStock && (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider animate-pulse">
                                      ¡Bajo!
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 font-mono font-bold text-gray-500">
                                ${item.precioCompra || 0}
                              </td>
                              <td className="p-4 font-mono font-black text-indigo-600 dark:text-indigo-400">
                                ${item.precioVenta || 0}
                              </td>
                              <td className="p-4 space-y-1">
                                {item.ubicacion && (
                                  <div className="text-[10px] font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md inline-block">
                                    📍 {item.ubicacion}
                                  </div>
                                )}
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 block font-semibold">
                                  🏢 {provName}
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleOpenStockModal(item)}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  {isSuperadmin && (
                                    <button
                                      onClick={() => item.id && handleDeleteStockItem(item.id)}
                                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
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
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search & Actions Bar for Providers */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl shadow-xs">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar proveedor por nombre, contacto, teléfono..."
                    value={proveedorSearchTerm}
                    onChange={(e) => setProveedorSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>
                <button
                  onClick={() => handleOpenProveedorModal(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  NUEVO PROVEEDOR
                </button>
              </div>

              {/* Providers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingStock ? (
                  <div className="col-span-full p-12 text-center text-gray-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
                    <span>Cargando proveedores...</span>
                  </div>
                ) : filteredProveedores.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-gray-400 space-y-2">
                    <Store className="w-12 h-12 mx-auto text-gray-300" />
                    <p className="font-bold text-gray-800 dark:text-gray-200">No se encontraron proveedores</p>
                    <p className="text-xs">Cargue contactos de proveedores para agilizar los pedidos de insumos.</p>
                  </div>
                ) : (
                  filteredProveedores.map((p) => (
                    <div 
                      key={p.id}
                      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-black text-sm text-gray-900 dark:text-white">{p.nombre}</h3>
                            {p.contacto && (
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold flex items-center gap-1">
                                <User className="w-3.5 h-3.5" /> Contacto: {p.contacto}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenProveedorModal(p)}
                              className="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isSuperadmin && (
                              <button
                                onClick={() => p.id && handleDeleteProveedor(p.id)}
                                className="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                          {p.telefono && (
                            <div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Teléfono</span>
                              <span className="font-mono text-gray-700 dark:text-gray-300 font-semibold">{p.telefono}</span>
                            </div>
                          )}
                          {p.email && (
                            <div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Email</span>
                              <span className="text-gray-700 dark:text-gray-300 truncate block text-[11px]" title={p.email}>{p.email}</span>
                            </div>
                          )}
                          {p.direccion && (
                            <div className="col-span-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Dirección</span>
                              <span className="text-gray-700 dark:text-gray-300 block">📍 {p.direccion}</span>
                            </div>
                          )}
                        </div>

                        {p.observaciones && (
                          <div className="p-3 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-100 dark:border-gray-800/60 text-[11px] text-gray-500 dark:text-gray-400">
                            <strong>Obs:</strong> {p.observaciones}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/25 rounded-xl text-indigo-600 dark:text-indigo-400">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-2xl font-black text-gray-900 dark:text-white">
                  {baseInsumoServicios.length}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  Órdenes con Repuestos
                </span>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/25 rounded-xl text-amber-600 dark:text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-2xl font-black text-gray-900 dark:text-white">
                  {totalInsumosPendientes}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  Pendientes de Compra
                </span>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/25 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-2xl font-black text-gray-900 dark:text-white">
                  {totalInsumosComprados}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                  Con Repuestos Listos
                </span>
              </div>
            </div>
          </div>

          {/* Grid layout with Insumos List and AI Assistant */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Filters and Insumos List */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Filter and Search Bar */}
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-xs space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="md:col-span-2 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por N° de orden, repuesto, cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                    />
                  </div>

                  {/* Estado de compra filter */}
                  <div className="relative">
                    <select
                      value={filterPurchaseState}
                      onChange={(e) => setFilterPurchaseState(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 font-semibold"
                    >
                      <option value="todos">Todos los Repuestos</option>
                      <option value="pendientes">Pendientes de Compra</option>
                      <option value="comprados">Adquiridos / En Stock</option>
                    </select>
                  </div>

                  {/* Estado de servicio filter */}
                  <div className="relative">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 font-semibold"
                    >
                      <option value="">Todos los Estados</option>
                      <option value="RECIBIDO">Recibido</option>
                      <option value="DIAGNOSTICO">Diagnóstico</option>
                      <option value="PENDIENTE_APROBACION">Pendiente Aprobación</option>
                      <option value="EN_REPARACION">En Reparación</option>
                      <option value="LISTO_PARA_ENTREGA">Listo para Entrega</option>
                      <option value="ENTREGA_EN_PROGRESO">Entrega en Progreso</option>
                      <option value="ENTREGADO">Entregado</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Main content grid of required items */}
              {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
              ) : filteredInsumos.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-12 text-center space-y-4 shadow-xs">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sin insumos pendientes</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      No se encontraron órdenes de trabajo con repuestos requeridos o que coincidan con la búsqueda actual.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                    {filteredInsumos.map((s) => {
                      const isFullyStocked = s.repuestosComprados && s.repuestosComprados.trim().length > 0;
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleOpenEdit(s)}
                          className={`group flex items-center justify-center h-24 border rounded-2xl shadow-xs hover:shadow-lg transition-all cursor-pointer relative overflow-hidden ${
                            isFullyStocked 
                              ? "bg-emerald-50/20 hover:bg-emerald-50 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 hover:border-emerald-400 dark:hover:border-emerald-600 text-emerald-600 dark:text-emerald-400" 
                              : "bg-amber-50/20 hover:bg-amber-50 dark:bg-amber-950/10 dark:hover:bg-amber-950/20 border-amber-100 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-600 text-amber-600 dark:text-amber-400"
                          }`}
                          title={`${s.aparato} (${s.marcaModelo}) - ${getEstadoLabel(s.estado)}`}
                        >
                          <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight select-none">
                            #{s.numeroServicio}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Right Column: AI Chat Assistant */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xs flex flex-col h-[550px] overflow-hidden">
                
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-indigo-50/10 dark:bg-indigo-950/10 flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                      Asistente de Repuestos
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400">
                        IA
                      </span>
                    </h3>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium block">
                      Analiza stock y compras en tiempo real
                    </span>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  {messages.map((m, idx) => (
                    <div key={idx} className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`p-1.5 rounded-lg shrink-0 ${
                        m.role === "user" 
                          ? "bg-indigo-600 text-white" 
                          : "bg-gray-100 dark:bg-gray-850 text-gray-500 dark:text-gray-400"
                      }`}>
                        {m.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                      </div>
                      <div className={`p-3 rounded-2xl max-w-[85%] whitespace-pre-line leading-relaxed ${
                        m.role === "user"
                          ? "bg-indigo-600 text-white font-semibold rounded-tr-none"
                          : "bg-gray-50 dark:bg-gray-950 border border-gray-100/50 dark:border-gray-800/40 text-gray-700 dark:text-gray-300 rounded-tl-none"
                      }`}>
                        {m.role === "assistant" ? formatAssistantMessage(m.content) : m.content}
                      </div>
                    </div>
                  ))}
                  
                  {chatLoading && (
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-lg shrink-0 bg-gray-100 dark:bg-gray-850 text-gray-500">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-100/50 dark:border-gray-800/40 text-gray-400 flex items-center gap-1.5 font-medium rounded-tl-none">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Helper Questions */}
                <div className="px-4 py-2 border-t border-gray-100/60 dark:border-gray-850 bg-gray-50/40 dark:bg-gray-950/20">
                  <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1.5">
                    Preguntas sugeridas:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleSendMessage("¿Qué hay que comprar para hoy?")}
                      disabled={chatLoading}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-50/40 dark:bg-gray-900 dark:hover:bg-indigo-950/20 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800/80 rounded-full text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      🛒 ¿Qué comprar hoy?
                    </button>
                    <button
                      onClick={() => handleSendMessage("¿Cuáles órdenes tienen repuestos listos?")}
                      disabled={chatLoading}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-50/40 dark:bg-gray-900 dark:hover:bg-indigo-950/20 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800/80 rounded-full text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ✅ Repuestos listos
                    </button>
                    <button
                      onClick={() => handleSendMessage("¿Qué repuestos faltan conseguir?")}
                      disabled={chatLoading}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-50/40 dark:bg-gray-900 dark:hover:bg-indigo-950/20 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800/80 rounded-full text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ⏳ Pendientes
                    </button>
                  </div>
                </div>

                {/* Input Form */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 bg-gray-50/50 dark:bg-gray-950/40"
                >
                  <input
                    type="text"
                    placeholder="Pregunta al asistente de repuestos..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={chatLoading}
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-1.5 focus:ring-indigo-600 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || chatLoading}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-indigo-600 text-white rounded-xl transition-all cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

              </div>
            </div>

          </div>
        </>
      )}

      {/* Unified Details & Edit Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/40 dark:bg-gray-900/30">
              <div>
                <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400 tracking-wider">
                  ORDEN DE TRABAJO N° #{selectedService.numeroServicio}
                </span>
                <h2 className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                  {isEditing ? "Editar Insumos/Repuestos" : "Detalle de Insumos"}
                </h2>
              </div>
              <button 
                onClick={handleCloseEdit}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            {!isEditing ? (
              /* READ-ONLY DETAILS VIEW */
              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Device Info */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">APARATO / EQUIPO</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-white">{selectedService.aparato}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">MARCA Y MODELO</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-white">{selectedService.marcaModelo}</span>
                  </div>
                </div>

                {/* Status, Client & Technician info */}
                <div className="space-y-3.5 bg-gray-50/50 dark:bg-gray-950/30 p-4 rounded-xl border border-gray-100/50 dark:border-gray-800/40">
                  <div className="grid grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">CLIENTE</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {clientMap[selectedService.clienteId]?.nombreApellido || "No especificado"}
                      </span>
                      {clientMap[selectedService.clienteId]?.telCel && (
                        <span className="block text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                          {clientMap[selectedService.clienteId].telCel}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">TÉCNICO TALLER</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {selectedService.tecnicoId ? (tecnicMap[selectedService.tecnicoId] || "Asignado") : "Sin asignar"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100/50 dark:border-gray-800/40 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ESTADO DE SERVICIO</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getStatusBadgeColor(selectedService.estado)}`}>
                      {getEstadoLabel(selectedService.estado)}
                    </span>
                  </div>
                </div>

                {/* Necessary spare parts */}
                <div className="space-y-1.5 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Repuestos Necesarios a Comprar
                  </span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium whitespace-pre-line leading-relaxed pl-2.5">
                    {selectedService.repuestosComprar || "Ningún repuesto cargado."}
                  </p>
                </div>

                {/* Stock / Bought Info */}
                <div className={`space-y-1.5 p-4 rounded-xl border ${
                  selectedService.repuestosComprados && selectedService.repuestosComprados.trim().length > 0 
                    ? "bg-emerald-500/5 border-emerald-500/10" 
                    : "bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80"
                }`}>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                    selectedService.repuestosComprados && selectedService.repuestosComprados.trim().length > 0 
                      ? "text-emerald-700 dark:text-emerald-400" 
                      : "text-gray-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedService.repuestosComprados && selectedService.repuestosComprados.trim().length > 0 ? "bg-emerald-500" : "bg-gray-400"
                    }`}></span>
                    Repuestos Comprados / Disponibles (En Stock)
                  </span>
                  <p className={`text-sm leading-relaxed pl-2.5 ${
                    selectedService.repuestosComprados && selectedService.repuestosComprados.trim().length > 0 
                      ? "text-gray-700 dark:text-gray-300 font-medium" 
                      : "text-gray-400 italic"
                  }`}>
                    {selectedService.repuestosComprados || "Ninguno marcado como comprado o disponible en stock todavía."}
                  </p>
                </div>

                {/* Footer buttons for read-only */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => {
                      handleCloseEdit();
                      navigate("detalle-servicio", selectedService.id);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Ficha Completa
                  </button>

                  <div className="flex gap-2 flex-wrap justify-end">
                    {!(selectedService.repuestosComprados && selectedService.repuestosComprados.trim().length > 0) && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsPurchased(selectedService)}
                        disabled={saving}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Marcar como Comprado
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCloseEdit}
                      className="px-4 py-2 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Actualizar Repuestos
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* EDIT MODE VIEW */
              <form onSubmit={handleSaveChanges} className="p-6 space-y-4">
                
                {/* Repuestos a comprar */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Repuestos a Comprar / Solicitar
                  </label>
                  <textarea
                    rows={4}
                    value={editRepuestosComprar}
                    onChange={(e) => setEditRepuestosComprar(e.target.value)}
                    placeholder="Enumere los repuestos que deben comprarse..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                {/* Repuestos comprados */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Repuestos Comprados / Disponibles (Stock)
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditRepuestosComprados(editRepuestosComprar || "Todos los repuestos adquiridos")}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Copiar de necesarios (Marcar Comprado)
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={editRepuestosComprados}
                    onChange={(e) => setEditRepuestosComprados(e.target.value)}
                    placeholder="Ej: Carcasa comprada el 24/06. Filtro disponible en stock de taller."
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}
          </div>
        </div>
      )}

      {/* Stock Item Add/Edit Modal */}
      {isStockModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/40 dark:bg-gray-900/30">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  {selectedStockItem ? "Editar Insumo de Stock" : "Nuevo Insumo / Repuesto"}
                </h2>
                <p className="text-xs text-gray-400">Complete los datos del repuesto para inventario</p>
              </div>
              <button 
                onClick={() => setIsStockModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form 
              onSubmit={handleSaveStockItem}
              className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre del Insumo / Repuesto *</label>
                  <input
                    type="text"
                    required
                    value={stockForm.nombre}
                    onChange={(e) => setStockForm({ ...stockForm, nombre: e.target.value })}
                    placeholder="Ej: Pantalla de LED 32' Samsung"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Descripción</label>
                  <input
                    type="text"
                    value={stockForm.descripcion}
                    onChange={(e) => setStockForm({ ...stockForm, descripcion: e.target.value })}
                    placeholder="Especificaciones o detalles..."
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Marca/Modelo Compatible</label>
                  <input
                    type="text"
                    value={stockForm.marcaModeloCompatible}
                    onChange={(e) => setStockForm({ ...stockForm, marcaModeloCompatible: e.target.value })}
                    placeholder="Ej: Samsung UN32F5000"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Ubicación física en taller</label>
                  <input
                    type="text"
                    value={stockForm.ubicacion}
                    onChange={(e) => setStockForm({ ...stockForm, ubicacion: e.target.value })}
                    placeholder="Ej: Estante A, Fila 2"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Cantidad *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={stockForm.cantidad}
                    onChange={(e) => setStockForm({ ...stockForm, cantidad: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Unidad de Medida *</label>
                  <select
                    value={stockForm.unidad}
                    onChange={(e) => setStockForm({ ...stockForm, unidad: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold"
                  >
                    <option value="unidades">Unidades (u)</option>
                    <option value="metros">Metros (m)</option>
                    <option value="litros">Litros (l)</option>
                    <option value="paquetes">Paquetes</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Precio Compra ($) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={stockForm.precioCompra}
                    onChange={(e) => setStockForm({ ...stockForm, precioCompra: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Precio Venta sugerido ($) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={stockForm.precioVenta}
                    onChange={(e) => setStockForm({ ...stockForm, precioVenta: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="0"
                    value={stockForm.stockMinimo}
                    onChange={(e) => setStockForm({ ...stockForm, stockMinimo: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Proveedor</label>
                  <select
                    value={stockForm.proveedorId}
                    onChange={(e) => setStockForm({ ...stockForm, proveedorId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold"
                  >
                    <option value="">Ninguno / Sin especificar</option>
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingStock}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingStock ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Guardar Insumo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proveedor Add/Edit Modal */}
      {isProveedorModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/40 dark:bg-gray-900/30">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  {selectedProveedor ? "Editar Proveedor" : "Nuevo Proveedor / Contacto"}
                </h2>
                <p className="text-xs text-gray-400">Complete los datos de contacto y detalles comerciales</p>
              </div>
              <button 
                onClick={() => setIsProveedorModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form 
              onSubmit={handleSaveProveedor}
              className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre del Proveedor *</label>
                  <input
                    type="text"
                    required
                    value={proveedorForm.nombre}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, nombre: e.target.value })}
                    placeholder="Ej: Distribuidora Electrónica Sur"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Persona de Contacto</label>
                  <input
                    type="text"
                    value={proveedorForm.contacto}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, contacto: e.target.value })}
                    placeholder="Ej: Juan Carlos"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Teléfono</label>
                  <input
                    type="text"
                    value={proveedorForm.telefono}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, telefono: e.target.value })}
                    placeholder="Ej: +54 9 11 2345-6789"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Correo Electrónico</label>
                  <input
                    type="email"
                    value={proveedorForm.email}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, email: e.target.value })}
                    placeholder="proveedor@empresa.com"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Dirección Física</label>
                  <input
                    type="text"
                    value={proveedorForm.direccion}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, direccion: e.target.value })}
                    placeholder="Ej: Av. Rivadavia 1234, CABA"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Observaciones / Notas</label>
                  <textarea
                    rows={2}
                    value={proveedorForm.observaciones}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, observaciones: e.target.value })}
                    placeholder="Descuentos, plazos de entrega, garantías..."
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-850 text-gray-950 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsProveedorModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingStock}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingStock ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Guardar Proveedor
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Stock Item Modal */}
      {stockItemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ¿Eliminar insumo de inventario?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará de forma permanente este insumo/repuesto del stock de la base de datos de forma irreversible.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setStockItemToDelete(null)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteStockItem}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all"
              >
                Sí, Eliminar Insumo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Supplier Modal */}
      {proveedorToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ¿Eliminar proveedor?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Esta acción eliminará de forma permanente este proveedor de la base de datos de forma irreversible.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setProveedorToDelete(null)}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-750 dark:text-gray-250 cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteProveedor}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer transition-all"
              >
                Sí, Eliminar Proveedor
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
