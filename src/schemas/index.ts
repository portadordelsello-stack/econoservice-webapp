import { z } from "zod";

export const ClienteSchema = z.object({
  nombreApellido: z.string().optional().or(z.literal("")),
  telFijo: z.string().optional().or(z.literal("")),
  telCel: z.string().optional().or(z.literal("")),
  telCelBis: z.string().optional().or(z.literal("")),
  telCelOtro: z.string().optional().or(z.literal("")),
  localidad: z.string().optional().or(z.literal("")),
  barrio: z.string().optional().or(z.literal("")),
  zona: z.string().optional().or(z.literal("")),
  calle: z.string().optional().or(z.literal("")),
  numero: z.string().optional().or(z.literal("")),
  piso: z.string().optional().or(z.literal("")),
  depto: z.string().optional().or(z.literal("")),
  clienteProblematico: z.boolean().default(false),
  observaciones: z.string().optional().or(z.literal("")),
});

export const TecnicoSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  telefono: z.string().optional().or(z.literal("")),
  especialidad: z.string().optional().or(z.literal("")),
  activo: z.boolean().default(true),
});

export const EquipoSchema = z.object({
  clienteId: z.string().min(1, "Debe seleccionar un cliente"),
  tipo: z.string().min(2, "El tipo de equipo es obligatorio"),
  marca: z.string().min(1, "La marca es obligatoria"),
  modelo: z.string().min(1, "El modelo es obligatorio"),
  serie: z.string().optional().or(z.literal("")),
  observaciones: z.string().optional().or(z.literal("")),
});

export const ServicioSchema = z.object({
  clienteId: z.string().min(1, "Debe seleccionar un cliente"),
  equipoId: z.string().min(1, "Debe seleccionar un equipo"),
  tecnicoId: z.string().optional().or(z.literal("")),
  aparato: z.string().min(2, "El aparato es obligatorio (ej. Lavarropas)"),
  marcaModelo: z.string().min(2, "La marca y modelo son obligatorios"),
  desperfectoUsuario: z.string().min(5, "El desperfecto reportado por el usuario es obligatorio"),
  serviciosRequeridos: z.string().optional().or(z.literal("")),
  serviciosConvenidos: z.string().optional().or(z.literal("")),
  diagnostico: z.string().optional().or(z.literal("")),
  presupuesto: z.coerce.number().nonnegative().optional().or(z.literal(0)),
  presupuestoTexto: z.string().optional().or(z.literal("")),
  acepta: z.boolean().default(false),
  rechazaDevolver: z.boolean().default(false),
  garantia: z.boolean().default(false),
  esReclamoGarantia: z.boolean().default(false),
  ingresoTaller: z.boolean().default(true),
  repuestosComprar: z.string().optional().or(z.literal("")),
  repuestosComprados: z.string().optional().or(z.literal("")),
  pasaStock: z.boolean().default(false),
  citaDia: z.string().optional().or(z.literal("")),
  citaEntrega: z.string().optional().or(z.literal("")),
  horaEntregaDesde: z.string().optional().or(z.literal("")),
  horaEntregaHasta: z.string().optional().or(z.literal("")),
  entregado: z.boolean().default(false),
  terminado: z.boolean().default(false),
  factura: z.boolean().default(false),
  contado: z.boolean().default(false),
  infoLogistica: z.string().optional().or(z.literal("")),
  notasInternas: z.string().optional().or(z.literal("")),
});

export const GastoSchema = z.object({
  concepto: z.string().min(3, "El concepto es obligatorio"),
  categoria: z.string().min(2, "La categoría es obligatoria"),
  monto: z.coerce.number().positive("El monto debe ser un número positivo"),
  observaciones: z.string().optional().or(z.literal("")),
});

export const PresupuestoSchema = z.object({
  servicioId: z.string().min(1, "Debe seleccionar un servicio"),
  aprobado: z.boolean().default(false),
  subtotal: z.coerce.number().nonnegative(),
  total: z.coerce.number().nonnegative(),
  observaciones: z.string().optional().or(z.literal("")),
});
