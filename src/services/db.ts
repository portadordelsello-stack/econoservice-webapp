import { supabase } from "../lib/supabase";
import { 
  Cliente, 
  Tecnico, 
  Equipo, 
  Servicio, 
  Historial, 
  Presupuesto, 
  PresupuestoItem, 
  Gasto, 
  EstadoServicio, 
  Proveedor, 
  ItemStock, 
  AppNotification 
} from "../types";

// Helper to clean dates
export const toDate = (val: any): Date | null => {
  if (!val) return null;
  return new Date(val);
};

// ============================================================================
// CLIENTE MAPPERS & SERVICE
// ============================================================================
const mapToFrontendCliente = (c: any): Cliente => ({
  id: c.id,
  numeroCliente: c.numero_cliente,
  nombreApellido: c.nombre_apellido,
  telFijo: c.tel_fijo || "",
  telCel: c.tel_cel || "",
  telCelBis: c.tel_cel_bis || "",
  telCelOtro: c.tel_cel_otro || "",
  localidad: c.localidad || "",
  barrio: c.barrio || "",
  zona: c.zona || "",
  calle: c.calle || "",
  numero: c.numero || "",
  piso: c.piso || "",
  depto: c.depto || "",
  clienteProblematico: !!c.cliente_problematico,
  observaciones: c.observaciones || "",
  createdAt: c.created_at,
  updatedAt: c.updated_at
});

const mapToDbCliente = (c: Partial<Cliente>): any => {
  const db: any = {};
  if (c.numeroCliente !== undefined) db.numero_cliente = c.numeroCliente;
  if (c.nombreApellido !== undefined) db.nombre_apellido = c.nombreApellido;
  if (c.telFijo !== undefined) db.tel_fijo = c.telFijo;
  if (c.telCel !== undefined) db.tel_cel = c.telCel;
  if (c.telCelBis !== undefined) db.tel_cel_bis = c.telCelBis;
  if (c.telCelOtro !== undefined) db.tel_cel_otro = c.telCelOtro;
  if (c.localidad !== undefined) db.localidad = c.localidad;
  if (c.barrio !== undefined) db.barrio = c.barrio;
  if (c.zona !== undefined) db.zona = c.zona;
  if (c.calle !== undefined) db.calle = c.calle;
  if (c.numero !== undefined) db.numero = c.numero;
  if (c.piso !== undefined) db.piso = c.piso;
  if (c.depto !== undefined) db.depto = c.depto;
  if (c.clienteProblematico !== undefined) db.cliente_problematico = c.clienteProblematico;
  if (c.observaciones !== undefined) db.observaciones = c.observaciones;
  return db;
};

export const ClientesService = {
  async getAll(limitCount?: number): Promise<Cliente[]> {
    let query = supabase.from("clientes").select("*");
    if (limitCount) {
      query = query.order("numero_cliente", { ascending: false }).limit(limitCount);
    } else {
      query = query.order("nombre_apellido", { ascending: true });
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapToFrontendCliente);
  },

  async search(term: string): Promise<Cliente[]> {
    const termClean = term.trim();
    if (!termClean) return this.getAll(10);

    let query = supabase.from("clientes").select("*");
    if (/^\d+$/.test(termClean)) {
      query = query.or(`numero_cliente.eq.${termClean},tel_cel.eq.${termClean}`);
    } else {
      query = query.ilike("nombre_apellido", `%${termClean}%`);
    }

    const { data, error } = await query.limit(30);
    if (error) throw error;
    return (data || []).map(mapToFrontendCliente);
  },

  async getById(id: string): Promise<Cliente | null> {
    if (!id) return null;
    const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
    if (error) return null;
    return data ? mapToFrontendCliente(data) : null;
  },

  async create(cliente: Omit<Cliente, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const docId = `c_${Date.now()}`;
    
    // Calculate sequence
    const { data } = await supabase.from("clientes").select("numero_cliente").order("numero_cliente", { ascending: false }).limit(1);
    const nextNum = data && data[0] ? (data[0].numero_cliente || 0) + 1 : 1;

    const { error } = await supabase.from("clientes").insert({
      id: docId,
      ...mapToDbCliente(cliente),
      numero_cliente: nextNum
    });
    if (error) throw error;
    return docId;
  },

  async update(id: string, cliente: Partial<Cliente>): Promise<void> {
    const { error } = await supabase.from("clientes").update(mapToDbCliente(cliente)).eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) throw error;
  },

  async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase.from("clientes").delete().in("id", ids);
    if (error) throw error;
  }
};

// ============================================================================
// TECNICOS SERVICES
// ============================================================================
export const TecnicosService = {
  async getAll(): Promise<Tecnico[]> {
    const { data: list, error: errList } = await supabase.from("tecnicos").select("*").order("nombre", { ascending: true });
    if (errList) throw errList;

    const mappedList = (list || []).map(t => ({
      id: t.id,
      nombre: t.nombre,
      telefono: t.telefono || "",
      especialidad: t.especialidad || "",
      activo: !!t.activo,
      createdAt: t.created_at
    }));

    try {
      const { data: usersList, error: errUsers } = await supabase.from("user_profiles").select("*").eq("rol", "tecnico");
      if (errUsers) throw errUsers;

      const mergedMap = new Map<string, Tecnico>();
      mappedList.forEach(t => {
        if (t.id) mergedMap.set(t.id, t);
      });

      (usersList || []).forEach(u => {
        if (u.uid && !mergedMap.has(u.uid)) {
          mergedMap.set(u.uid, {
            id: u.uid,
            nombre: u.nombre || "Técnico de Sistema",
            telefono: u.tel_cel || "",
            especialidad: "",
            activo: !!u.activo,
            createdAt: u.created_at
          });
        }
      });

      const mergedList = Array.from(mergedMap.values());
      mergedList.sort((a, b) => a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase()));
      return mergedList;
    } catch (e) {
      return mappedList;
    }
  },

  async create(tecnico: Omit<Tecnico, "id" | "createdAt">): Promise<string> {
    const docId = `t_${Date.now()}`;
    const { error } = await supabase.from("tecnicos").insert({
      id: docId,
      nombre: tecnico.nombre,
      telefono: tecnico.telefono || null,
      especialidad: tecnico.especialidad || null,
      activo: tecnico.activo
    });
    if (error) throw error;
    return docId;
  },

  async update(id: string, tecnico: Partial<Tecnico>): Promise<void> {
    const { error } = await supabase.from("tecnicos").update({
      nombre: tecnico.nombre,
      telefono: tecnico.telefono,
      especialidad: tecnico.especialidad,
      activo: tecnico.activo
    }).eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("tecnicos").delete().eq("id", id);
    if (error) throw error;
  }
};

// ============================================================================
// EQUIPOS SERVICES
// ============================================================================
export const EquiposService = {
  async getAll(): Promise<Equipo[]> {
    const { data, error } = await supabase.from("equipos").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(e => ({
      id: e.id,
      clienteId: e.cliente_id,
      tipo: e.tipo,
      marca: e.marca,
      modelo: e.modelo,
      serie: e.serie || "",
      observaciones: e.observaciones || "",
      createdAt: e.created_at
    }));
  },

  async getByCliente(clienteId: string): Promise<Equipo[]> {
    const { data, error } = await supabase.from("equipos").select("*").eq("cliente_id", clienteId);
    if (error) throw error;
    return (data || []).map(e => ({
      id: e.id,
      clienteId: e.cliente_id,
      tipo: e.tipo,
      marca: e.marca,
      modelo: e.modelo,
      serie: e.serie || "",
      observaciones: e.observaciones || "",
      createdAt: e.created_at
    }));
  },

  async create(equipo: Omit<Equipo, "id" | "createdAt">): Promise<string> {
    const docId = `e_${Date.now()}`;
    const { error } = await supabase.from("equipos").insert({
      id: docId,
      cliente_id: equipo.clienteId,
      tipo: equipo.tipo,
      marca: equipo.marca,
      modelo: equipo.modelo,
      serie: equipo.serie || null,
      observaciones: equipo.observaciones || null
    });
    if (error) throw error;
    return docId;
  },

  async update(id: string, equipo: Partial<Equipo>): Promise<void> {
    const { error } = await supabase.from("equipos").update({
      cliente_id: equipo.clienteId,
      tipo: equipo.tipo,
      marca: equipo.marca,
      modelo: equipo.modelo,
      serie: equipo.serie,
      observaciones: equipo.observaciones
    }).eq("id", id);
    if (error) throw error;
  },

  async getById(id: string): Promise<Equipo | null> {
    if (!id) return null;
    const { data, error } = await supabase.from("equipos").select("*").eq("id", id).single();
    if (error) return null;
    return data ? {
      id: data.id,
      clienteId: data.cliente_id,
      tipo: data.tipo,
      marca: data.marca,
      modelo: data.modelo,
      serie: data.serie || "",
      observaciones: data.observaciones || "",
      createdAt: data.created_at
    } : null;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("equipos").delete().eq("id", id);
    if (error) throw error;
  }
};

// ============================================================================
// SERVICIOS MAPPERS & SERVICE
// ============================================================================
const mapToFrontendServicio = (s: any): Servicio => ({
  id: s.id,
  numeroServicio: s.numero_servicio,
  clienteId: s.cliente_id,
  equipoId: s.equipo_id,
  tecnicoId: s.tecnico_id || "",
  fechaIngreso: s.fecha_ingreso,
  aparato: s.aparato,
  marcaModelo: s.marca_modelo,
  desperfectoUsuario: s.desperfecto_usuario || "No especificado",
  serviciosRequeridos: s.servicios_requeridos || "",
  serviciosConvenidos: s.servicios_convenidos || "",
  diagnostico: s.diagnostico || "",
  presupuesto: Number(s.presupuesto || 0),
  presupuestoTexto: s.presupuesto_texto || "",
  acepta: !!s.acepta,
  rechazaDevolver: !!s.rechaza_devolver,
  garantia: !!s.garantia,
  esReclamoGarantia: !!s.es_reclamo_garantia,
  ingresoTaller: s.ingreso_taller !== false,
  repuestosComprar: s.repuestos_comprar || "",
  repuestosComprados: s.repuestos_comprados || "",
  pasaStock: !!s.pasa_stock,
  citaDia: s.cita_dia,
  citaEntrega: s.cita_entrega,
  horaEntregaDesde: s.hora_entrega_desde || "",
  horaEntregaHasta: s.hora_entrega_hasta || "",
  entregado: !!s.entregado,
  terminado: !!s.terminado,
  factura: !!s.factura,
  contado: !!s.contado,
  infoLogistica: s.info_logistica || "",
  notasInternas: s.notas_internas || "",
  estado: s.estado as EstadoServicio,
  montoEfectivo: Number(s.monto_efectivo || 0),
  montoTransferencia: Number(s.monto_transferencia || 0),
  metodoPago: s.metodo_pago || "",
  createdAt: s.created_at,
  updatedAt: s.updated_at,
  createdBy: s.created_by || "",
  fotosDrive: s.fotos_drive || []
});

const mapToDbServicio = (s: Partial<Servicio>): any => {
  const db: any = {};
  if (s.numeroServicio !== undefined) db.numero_servicio = s.numeroServicio;
  if (s.clienteId !== undefined) db.cliente_id = s.clienteId;
  if (s.equipoId !== undefined) db.equipo_id = s.equipoId;
  if (s.tecnicoId !== undefined) db.tecnico_id = s.tecnicoId || null;
  if (s.fechaIngreso !== undefined) db.fecha_ingreso = s.fechaIngreso;
  if (s.aparato !== undefined) db.aparato = s.aparato;
  if (s.marcaModelo !== undefined) db.marca_modelo = s.marcaModelo;
  if (s.desperfectoUsuario !== undefined) db.desperfecto_usuario = s.desperfectoUsuario;
  if (s.serviciosRequeridos !== undefined) db.servicios_requeridos = s.serviciosRequeridos;
  if (s.serviciosConvenidos !== undefined) db.servicios_convenidos = s.serviciosConvenidos;
  if (s.diagnostico !== undefined) db.diagnostico = s.diagnostico;
  if (s.presupuesto !== undefined) db.presupuesto = s.presupuesto;
  if (s.presupuestoTexto !== undefined) db.presupuesto_texto = s.presupuestoTexto;
  if (s.acepta !== undefined) db.acepta = s.acepta;
  if (s.rechazaDevolver !== undefined) db.rechaza_devolver = s.rechazaDevolver;
  if (s.garantia !== undefined) db.garantia = s.garantia;
  if (s.esReclamoGarantia !== undefined) db.es_reclamo_garantia = s.esReclamoGarantia;
  if (s.ingresoTaller !== undefined) db.ingreso_taller = s.ingresoTaller;
  if (s.repuestosComprar !== undefined) db.repuestos_comprar = s.repuestosComprar;
  if (s.repuestosComprados !== undefined) db.repuestos_comprados = s.repuestosComprados;
  if (s.pasaStock !== undefined) db.pasa_stock = s.pasaStock;
  if (s.citaDia !== undefined) db.cita_dia = s.citaDia;
  if (s.citaEntrega !== undefined) db.cita_entrega = s.citaEntrega;
  if (s.horaEntregaDesde !== undefined) db.hora_entrega_desde = s.horaEntregaDesde;
  if (s.horaEntregaHasta !== undefined) db.hora_entrega_hasta = s.horaEntregaHasta;
  if (s.entregado !== undefined) db.entregado = s.entregado;
  if (s.terminado !== undefined) db.terminado = s.terminado;
  if (s.factura !== undefined) db.factura = s.factura;
  if (s.contado !== undefined) db.contado = s.contado;
  if (s.infoLogistica !== undefined) db.info_logistica = s.infoLogistica;
  if (s.notasInternas !== undefined) db.notas_internas = s.notasInternas;
  if (s.estado !== undefined) db.estado = s.estado;
  if (s.montoEfectivo !== undefined) db.monto_efectivo = s.montoEfectivo;
  if (s.montoTransferencia !== undefined) db.monto_transferencia = s.montoTransferencia;
  if (s.metodoPago !== undefined) db.metodo_pago = s.metodoPago || null;
  if (s.createdBy !== undefined) db.created_by = s.createdBy;
  if (s.fotosDrive !== undefined) db.fotos_drive = s.fotosDrive;
  return db;
};

export const ServiciosService = {
  async getAll(limitCount?: number): Promise<Servicio[]> {
    let query = supabase.from("servicios").select("*").order("numero_servicio", { ascending: false });
    if (limitCount) query = query.limit(limitCount);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapToFrontendServicio);
  },

  async search(term: string): Promise<Servicio[]> {
    const termClean = term.trim();
    if (!termClean) return this.getAll(10);

    let query = supabase.from("servicios").select("*");
    if (/^\d+$/.test(termClean)) {
      query = query.eq("numero_servicio", Number(termClean));
    } else {
      query = query.ilike("marca_modelo", `%${termClean}%`);
    }

    const { data, error } = await query.limit(30);
    if (error) throw error;
    return (data || []).map(mapToFrontendServicio);
  },

  async getById(id: string): Promise<Servicio | null> {
    if (!id) return null;
    const { data, error } = await supabase.from("servicios").select("*").eq("id", id).single();
    if (error) return null;
    return data ? mapToFrontendServicio(data) : null;
  },

  async create(
    servicio: Omit<Servicio, "id" | "numeroServicio" | "createdAt" | "updatedAt" | "estado">,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<string> {
    const docId = `s_${Date.now()}`;

    // Get sequence
    const { data } = await supabase.from("servicios").select("numero_servicio").order("numero_servicio", { ascending: false }).limit(1);
    const nextNum = data && data[0] ? (data[0].numero_servicio || 0) + 1 : 1001;

    const { error } = await supabase.from("servicios").insert({
      id: docId,
      ...mapToDbServicio(servicio),
      numero_servicio: nextNum,
      estado: "RECIBIDO"
    });
    if (error) throw error;

    await this.registrarHistorial(docId, usuarioId, usuarioNombre, "CREACION", "Servicio técnico ingresado al taller");
    return docId;
  },

  async update(
    id: string,
    fields: Partial<Servicio>,
    usuarioId: string,
    usuarioNombre: string,
    cambioDetalle?: string
  ): Promise<void> {
    // Save original for audit log
    const original = await this.getById(id);

    const { error } = await supabase.from("servicios").update({
      ...mapToDbServicio(fields),
      updated_at: new Date().toISOString()
    }).eq("id", id);
    if (error) throw error;

    // Registrar Historial changes
    try {
      if (original) {
        if (fields.estado && fields.estado !== original.estado) {
          await this.registrarHistorial(id, usuarioId, usuarioNombre, "CAMBIO_ESTADO", `Estado modificado de ${original.estado} a ${fields.estado}`);
        }
        if (fields.tecnicoId && fields.tecnicoId !== original.tecnicoId) {
          let tecName = "Técnico";
          const { data: tec } = await supabase.from("tecnicos").select("nombre").eq("id", fields.tecnicoId).single();
          if (tec) {
            tecName = tec.nombre;
          } else {
            const { data: userPrf } = await supabase.from("user_profiles").select("nombre").eq("uid", fields.tecnicoId).single();
            if (userPrf) tecName = userPrf.nombre;
          }
          await this.registrarHistorial(id, usuarioId, usuarioNombre, "ASIGNACION_TECNICO", `Técnico asignado: ${tecName}`);
        }
        if (fields.presupuesto !== undefined && fields.presupuesto !== original.presupuesto) {
          await this.registrarHistorial(id, usuarioId, usuarioNombre, "EDICION_PRESUPUESTO", `Monto de presupuesto actualizado a $${fields.presupuesto}`);
        }
        if (fields.entregado !== undefined && fields.entregado !== original.entregado) {
          await this.registrarHistorial(id, usuarioId, usuarioNombre, fields.entregado ? "ENTREGA" : "MODIFICACION", fields.entregado ? "Equipo entregado al cliente final" : "Marcado de entrega removido");
        }
      }
      if (cambioDetalle) {
        await this.registrarHistorial(id, usuarioId, usuarioNombre, "MODIFICACION", cambioDetalle);
      }
    } catch (hErr) {
      console.warn("Audit logs error:", hErr);
    }
  },

  async updateTecnico(
    id: string,
    fields: Partial<Servicio>,
    usuarioId: string,
    usuarioNombre: string,
    cambioDetalle?: string
  ): Promise<void> {
    await this.update(id, fields, usuarioId, usuarioNombre, cambioDetalle);
  },

  async delete(id: string): Promise<void> {
    const original = await this.getById(id);
    if (original && original.equipoId) {
      await supabase.from("equipos").delete().eq("id", original.equipoId);
    }
    const { error } = await supabase.from("servicios").delete().eq("id", id);
    if (error) throw error;
  },

  // Historial Table operations
  async getHistorial(servicioId: string): Promise<Historial[]> {
    const { data, error } = await supabase
      .from("historial")
      .select("*")
      .eq("servicio_id", servicioId)
      .order("fecha", { ascending: false });
    if (error) throw error;

    return (data || []).map(h => ({
      id: h.id,
      fecha: h.fecha,
      usuarioId: h.usuario_id,
      usuarioNombre: h.usuario_nombre || "",
      accion: h.accion,
      detalle: h.detalle || ""
    }));
  },

  async registrarHistorial(
    servicioId: string,
    usuarioId: string,
    usuarioNombre: string,
    accion: string,
    detalle?: string
  ): Promise<void> {
    await supabase.from("historial").insert({
      servicio_id: servicioId,
      usuario_id: usuarioId,
      usuario_nombre: usuarioNombre,
      accion,
      detalle: detalle || null
    });
  }
};

// ============================================================================
// PRESUPUESTOS SERVICES
// ============================================================================
// For compatibility, we define budgets structure with Supabase if tables exist, or fall back to json mock if not
export const PresupuestosService = {
  async getByServicio(servicioId: string): Promise<Presupuesto[]> {
    const { data, error } = await supabase.from("presupuestos").select("*").eq("servicio_id", servicioId);
    if (error) return [];
    return (data || []).map(p => ({
      id: p.id,
      servicioId: p.servicio_id,
      aprobado: !!p.aprobado,
      fechaCreacion: p.fecha_creacion,
      subtotal: Number(p.subtotal || 0),
      total: Number(p.total || 0),
      observaciones: p.observaciones || ""
    }));
  },

  async getById(id: string): Promise<Presupuesto | null> {
    const { data, error } = await supabase.from("presupuestos").select("*").eq("id", id).single();
    if (error) return null;
    return data ? {
      id: data.id,
      servicioId: data.servicio_id,
      aprobado: !!data.aprobado,
      fechaCreacion: data.fecha_creacion,
      subtotal: Number(data.subtotal || 0),
      total: Number(data.total || 0),
      observaciones: data.observaciones || ""
    } : null;
  },

  async create(
    presupuesto: Omit<Presupuesto, "id" | "fechaCreacion">, 
    items: Omit<PresupuestoItem, "id">[]
  ): Promise<string> {
    const docId = `p_${Date.now()}`;
    const { error } = await supabase.from("presupuestos").insert({
      id: docId,
      servicio_id: presupuesto.servicioId,
      aprobado: presupuesto.aprobado,
      subtotal: presupuesto.subtotal,
      total: presupuesto.total,
      observaciones: presupuesto.observaciones || null
    });
    if (error) throw error;

    if (items.length > 0) {
      const mappedItems = items.map(it => ({
        presupuesto_id: docId,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio: it.precio,
        total: it.total
      }));
      await supabase.from("presupuesto_items").insert(mappedItems);
    }
    return docId;
  },

  async update(
    id: string, 
    presupuesto: Partial<Presupuesto>, 
    items?: Omit<PresupuestoItem, "id">[]
  ): Promise<void> {
    await supabase.from("presupuestos").update({
      aprobado: presupuesto.aprobado,
      subtotal: presupuesto.subtotal,
      total: presupuesto.total,
      observaciones: presupuesto.observaciones
    }).eq("id", id);

    if (items) {
      await supabase.from("presupuesto_items").delete().eq("presupuesto_id", id);
      if (items.length > 0) {
        const mappedItems = items.map(it => ({
          presupuesto_id: id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio: it.precio,
          total: it.total
        }));
        await supabase.from("presupuesto_items").insert(mappedItems);
      }
    }
  },

  async getItems(presupuestoId: string): Promise<PresupuestoItem[]> {
    const { data, error } = await supabase.from("presupuesto_items").select("*").eq("presupuesto_id", presupuestoId);
    if (error) return [];
    return (data || []).map(it => ({
      id: it.id,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio: Number(it.precio || 0),
      total: Number(it.total || 0)
    }));
  },

  async delete(id: string): Promise<void> {
    await supabase.from("presupuestos").delete().eq("id", id);
  }
};

// ============================================================================
// GASTOS SERVICES
// ============================================================================
export const GastosService = {
  async getAll(): Promise<Gasto[]> {
    const { data, error } = await supabase.from("gastos").select("*").order("fecha", { ascending: false });
    if (error) throw error;
    return (data || []).map(g => ({
      id: g.id,
      fecha: g.fecha,
      concepto: g.concepto,
      categoria: g.categoria,
      monto: Number(g.monto || 0),
      observaciones: g.observaciones || ""
    }));
  },

  async create(gasto: Omit<Gasto, "id" | "fecha">): Promise<string> {
    const docId = `g_${Date.now()}`;
    const { error } = await supabase.from("gastos").insert({
      id: docId,
      concepto: gasto.concepto,
      categoria: gasto.categoria,
      monto: gasto.monto,
      observaciones: gasto.observaciones || null
    });
    if (error) throw error;
    return docId;
  },

  async update(id: string, gasto: Partial<Gasto>): Promise<void> {
    const { error } = await supabase.from("gastos").update({
      concepto: gasto.concepto,
      categoria: gasto.categoria,
      monto: gasto.monto,
      observaciones: gasto.observaciones
    }).eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("gastos").delete().eq("id", id);
    if (error) throw error;
  }
};

// ============================================================================
// PROVEEDORES SERVICES
// ============================================================================
export const ProveedoresService = {
  async getAll(): Promise<Proveedor[]> {
    const { data, error } = await supabase.from("proveedores").select("*").order("nombre", { ascending: true });
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      nombre: p.nombre,
      contacto: p.contacto || "",
      telefono: p.telefono || "",
      direccion: p.direccion || "",
      email: p.email || "",
      observaciones: p.observaciones || "",
      createdAt: p.created_at
    }));
  },

  async create(proveedor: Omit<Proveedor, "id" | "createdAt">): Promise<string> {
    const docId = `prov_${Date.now()}`;
    const { error } = await supabase.from("proveedores").insert({
      id: docId,
      nombre: proveedor.nombre,
      contacto: proveedor.contacto || null,
      telefono: proveedor.telefono || null,
      direccion: proveedor.direccion || null,
      email: proveedor.email || null,
      observaciones: proveedor.observaciones || null
    });
    if (error) throw error;
    return docId;
  },

  async update(id: string, proveedor: Partial<Proveedor>): Promise<void> {
    const { error } = await supabase.from("proveedores").update({
      nombre: proveedor.nombre,
      contacto: proveedor.contacto,
      telefono: proveedor.telefono,
      direccion: proveedor.direccion,
      email: proveedor.email,
      observaciones: proveedor.observaciones
    }).eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("proveedores").delete().eq("id", id);
    if (error) throw error;
  }
};

// ============================================================================
// STOCK (INVENTARIO) SERVICES
// ============================================================================
export const StockService = {
  async getAll(): Promise<ItemStock[]> {
    const { data, error } = await supabase.from("stock").select("*").order("nombre", { ascending: true });
    if (error) throw error;
    return (data || []).map(item => ({
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion || "",
      cantidad: item.cantidad,
      unidad: item.unidad || "",
      precioCompra: Number(item.precio_compra || 0),
      precioVenta: Number(item.precio_venta || 0),
      proveedorId: item.proveedor_id || "",
      marcaModeloCompatible: item.marca_modelo_compatible || "",
      ubicacion: item.ubicacion || "",
      stockMinimo: item.stock_minimo || 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  },

  async create(item: Omit<ItemStock, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const docId = `st_${Date.now()}`;
    const { error } = await supabase.from("stock").insert({
      id: docId,
      nombre: item.nombre,
      descripcion: item.descripcion || null,
      cantidad: item.cantidad,
      unidad: item.unidad || null,
      precio_compra: item.precioCompra || 0,
      precio_venta: item.precioVenta || 0,
      proveedor_id: item.proveedorId || null,
      marca_modelo_compatible: item.marcaModeloCompatible || null,
      ubicacion: item.ubicacion || null,
      stock_minimo: item.stockMinimo || 0
    });
    if (error) throw error;
    return docId;
  },

  async update(id: string, item: Partial<ItemStock>): Promise<void> {
    const { error } = await supabase.from("stock").update({
      nombre: item.nombre,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      unidad: item.unidad,
      precio_compra: item.precioCompra,
      precio_venta: item.precioVenta,
      proveedor_id: item.proveedorId,
      marca_modelo_compatible: item.marcaModeloCompatible,
      ubicacion: item.ubicacion,
      stock_minimo: item.stockMinimo,
      updated_at: new Date().toISOString()
    }).eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("stock").delete().eq("id", id);
    if (error) throw error;
  }
};

// ============================================================================
// NOTIFICATIONS SERVICES
// ============================================================================
const mapToFrontendNotification = (n: any): AppNotification => ({
  id: n.id,
  targetRole: n.target_role,
  targetUserId: n.target_user_id || "",
  title: n.title,
  message: n.message,
  read: !!n.read,
  readBy: n.read_by || [],
  createdAt: n.created_at,
  serviceId: n.service_id || ""
});

export const NotificationsService = {
  async create(notification: Omit<AppNotification, "id" | "createdAt" | "read" | "readBy">): Promise<string> {
    const docId = `n_${Date.now()}`;
    const { error } = await supabase.from("notifications").insert({
      id: docId,
      target_role: notification.targetRole || null,
      target_user_id: notification.targetUserId || null,
      title: notification.title,
      message: notification.message,
      read: false,
      read_by: [],
      service_id: notification.serviceId || null
    });
    if (error) throw error;
    return docId;
  },

  async markAsRead(id: string, userId: string): Promise<void> {
    const { data: n } = await supabase.from("notifications").select("read_by").eq("id", id).single();
    if (n) {
      const readBy = n.read_by || [];
      if (!readBy.includes(userId)) {
        await supabase.from("notifications").update({
          read_by: [...readBy, userId]
        }).eq("id", id);
      }
    }
  },

  async markAllAsReadForUser(userId: string, notifications: AppNotification[]): Promise<void> {
    for (const notif of notifications) {
      if (notif.id && (!notif.readBy || !notif.readBy.includes(userId))) {
        await this.markAsRead(notif.id, userId);
      }
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) throw error;
  },

  listenToNotifications(
    role: string,
    userId: string,
    onUpdate: (notifications: AppNotification[]) => void
  ) {
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, async () => {
        const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
        if (data) {
          const filtered = data.map(mapToFrontendNotification).filter(notif => {
            if (notif.targetUserId && notif.targetUserId !== userId) return false;
            if (notif.targetRole && notif.targetRole !== "all") {
              const isTallerTarget = notif.targetRole === "taller" || notif.targetRole === "tecnico";
              const isUserTaller = role === "tecnico";
              if (isTallerTarget) return isUserTaller;
              const isAdminTarget = notif.targetRole === "admin" || notif.targetRole === "superadmin";
              const isUserAdmin = role === "admin" || role === "superadmin";
              if (isAdminTarget) return isUserAdmin;
              return notif.targetRole === role;
            }
            return true;
          });
          onUpdate(filtered);
        }
      })
      .subscribe();

    // Initial query
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50).then(({ data }) => {
      if (data) {
        const filtered = data.map(mapToFrontendNotification).filter(notif => {
          if (notif.targetUserId && notif.targetUserId !== userId) return false;
          if (notif.targetRole && notif.targetRole !== "all") {
            const isTallerTarget = notif.targetRole === "taller" || notif.targetRole === "tecnico";
            const isUserTaller = role === "tecnico";
            if (isTallerTarget) return isUserTaller;
            const isAdminTarget = notif.targetRole === "admin" || notif.targetRole === "superadmin";
            const isUserAdmin = role === "admin" || role === "superadmin";
            if (isAdminTarget) return isUserAdmin;
            return notif.targetRole === role;
          }
          return true;
        });
        onUpdate(filtered);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
