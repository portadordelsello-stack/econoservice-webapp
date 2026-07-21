export type Role = "superadmin" | "administracion" | "tecnico" | "logistica" | "admin" | "recepcion" | "consulta";

export type EstadoServicio =
  | "RECIBIDO"
  | "DIAGNOSTICO"
  | "PENDIENTE_APROBACION"
  | "EN_REPARACION"
  | "LISTO_PARA_ENTREGA"
  | "ENTREGA_EN_PROGRESO"
  | "ENTREGADO"
  | "CANCELADO"
  | "EN_ESPERA"
  | "ACEPTADO"
  | "RECHAZADO";

export const ESTADO_LABELS: Record<EstadoServicio, string> = {
  RECIBIDO: "Recibido",
  DIAGNOSTICO: "En Diagnóstico",
  PENDIENTE_APROBACION: "Pendiente Aprobación",
  EN_REPARACION: "En Reparación",
  LISTO_PARA_ENTREGA: "Listo para Entrega",
  ENTREGA_EN_PROGRESO: "Entrega en Progreso",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
  EN_ESPERA: "En Espera",
  ACEPTADO: "Aceptado",
  RECHAZADO: "Rechazado"
};

export function getEstadoLabel(estado: string): string {
  return ESTADO_LABELS[estado as EstadoServicio] || estado;
}

export interface UserProfile {
  uid: string;
  nombre: string;
  email: string;
  rol: Role;
  activo: boolean;
  createdAt: any;
}

export interface Cliente {
  id?: string;
  numeroCliente?: number;
  nombreApellido: string;
  telFijo?: string;
  telCel?: string;
  telCelBis?: string;
  telCelOtro?: string;
  localidad?: string;
  barrio?: string;
  zona?: string;
  calle?: string;
  numero?: string;
  piso?: string;
  depto?: string;
  clienteProblematico: boolean;
  observaciones?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Tecnico {
  id?: string;
  nombre: string;
  telefono?: string;
  especialidad?: string;
  activo: boolean;
  createdAt: any;
}

export interface Equipo {
  id?: string;
  clienteId: string;
  tipo: string;
  marca: string;
  modelo: string;
  serie?: string;
  observaciones?: string;
  createdAt: any;
}

export interface Servicio {
  id?: string;
  numeroServicio: number;
  clienteId: string;
  equipoId: string;
  tecnicoId?: string;
  fechaIngreso: any;
  aparato: string;
  marcaModelo: string;
  desperfectoUsuario: string;
  serviciosRequeridos?: string;
  serviciosConvenidos?: string;
  diagnostico?: string;
  presupuesto?: number;
  presupuestoTexto?: string;
  acepta: boolean;
  rechazaDevolver: boolean;
  garantia: boolean;
  esReclamoGarantia: boolean;
  ingresoTaller: boolean;
  repuestosComprar?: string;
  repuestosComprados?: string;
  pasaStock: boolean;
  citaDia?: any;
  citaEntrega?: any;
  horaEntregaDesde?: string;
  horaEntregaHasta?: string;
  entregado: boolean;
  terminado: boolean;
  factura: boolean;
  contado: boolean;
  infoLogistica?: string;
  notasInternas?: string;
  estado: EstadoServicio;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  fotosDrive?: { id: string; name: string; url: string }[];
}

export interface Historial {
  id?: string;
  fecha: any;
  usuarioId: string;
  usuarioNombre?: string;
  accion: string;
  detalle?: string;
}

export interface Presupuesto {
  id?: string;
  servicioId: string;
  aprobado: boolean;
  fechaCreacion: any;
  subtotal: number;
  total: number;
  observaciones?: string;
}

export interface PresupuestoItem {
  id?: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  total: number;
}

export interface Gasto {
  id?: string;
  fecha: any;
  concepto: string;
  categoria: string;
  monto: number;
  observaciones?: string;
}

export interface Proveedor {
  id?: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  direccion?: string;
  email?: string;
  observaciones?: string;
  createdAt: any;
}

export interface ItemStock {
  id?: string;
  nombre: string;
  descripcion?: string;
  cantidad: number;
  unidad?: string;
  precioCompra?: number;
  precioVenta?: number;
  proveedorId?: string;
  marcaModeloCompatible?: string;
  ubicacion?: string;
  stockMinimo?: number;
  createdAt: any;
  updatedAt: any;
}

export interface AppNotification {
  id?: string;
  targetRole?: Role | "all" | "taller"; // Target role or workshop group
  targetUserId?: string;
  title: string;
  message: string;
  read: boolean;
  readBy?: string[]; // list of user uids who have read/dismissed this
  createdAt: any;
  serviceId?: string;
}

export interface BrandingConfig {
  logo?: string;
  titulo: string;
  subtitulo: string;
  badge: string;
}

