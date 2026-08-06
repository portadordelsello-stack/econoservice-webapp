import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://zkoacqpewrsepboswacp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb2FjcXBld3JzZXBib3N3YWNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAzMjQxOCwiZXhwIjoyMTAxNjA4NDE4fQ.Bu7_VAa_yXeDYGBrns2kDQTwGx753pOTkynlmLuMy0I';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const parseDate = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  return null;
};

const runMigration = async () => {
  console.log("Cargando archivo de backup JSON...");
  const rawData = fs.readFileSync('/home/playcode/Documents/econoservice_backup_migracion_vieja.json', 'utf8');
  const backup = JSON.parse(rawData);

  console.log(`Leídos: ${backup.clientes.length} clientes, ${backup.equipos.length} equipos, ${backup.servicios.length} servicios.`);

  // 1. MIGRAR CLIENTES
  console.log("\n1. Migrando Clientes...");
  const mappedClientes = backup.clientes.map(c => ({
    id: c.id,
    numero_cliente: c.numeroCliente,
    nombre_apellido: c.nombreApellido || 'Cliente S/N',
    tel_fijo: c.telFijo || null,
    tel_cel: c.telCel || null,
    tel_cel_bis: c.telCelBis || null,
    tel_cel_otro: c.telCelOtro || null,
    localidad: c.localidad || null,
    barrio: c.barrio || null,
    zona: c.zona || null,
    calle: c.calle || null,
    numero: c.numero || null,
    piso: c.piso || null,
    depto: c.depto || null,
    cliente_problematico: !!c.clienteProblematico,
    observaciones: c.observaciones || null,
    created_at: parseDate(c.createdAt),
    updated_at: parseDate(c.updatedAt)
  }));

  const BATCH_SIZE = 100;
  for (let i = 0; i < mappedClientes.length; i += BATCH_SIZE) {
    const batch = mappedClientes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('clientes').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Error al hacer upsert de clientes batch ${i}:`, error.message);
    } else {
      console.log(`Clientes procesados (upsert): ${i + batch.length} / ${mappedClientes.length}`);
    }
  }

  // 2. MIGRAR EQUIPOS
  console.log("\n2. Migrando Equipos...");
  const mappedEquipos = backup.equipos.map(e => ({
    id: e.id,
    cliente_id: e.clienteId,
    tipo: e.tipo || 'Lavarropas',
    marca: e.marca || 'Genérico',
    modelo: e.modelo || 'Genérico',
    serie: e.serie || null,
    observaciones: e.observaciones || null,
    created_at: parseDate(e.createdAt)
  }));

  for (let i = 0; i < mappedEquipos.length; i += BATCH_SIZE) {
    const batch = mappedEquipos.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('equipos').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Error al hacer upsert de equipos batch ${i}:`, error.message);
    } else {
      console.log(`Equipos procesados (upsert): ${i + batch.length} / ${mappedEquipos.length}`);
    }
  }

  // 3. MIGRAR SERVICIOS
  console.log("\n3. Migrando Servicios...");
  const mappedServicios = backup.servicios.map(s => ({
    id: s.id,
    numero_servicio: s.numeroServicio,
    cliente_id: s.clienteId,
    equipo_id: s.equipoId,
    tecnico_id: s.tecnicoId || null,
    fecha_ingreso: parseDate(s.fechaIngreso),
    aparato: s.aparato || 'Lavarropas',
    marca_modelo: s.marcaModelo || 'Genérico',
    desperfecto_usuario: s.desperfectoUsuario || 'No especificado',
    servicios_requeridos: s.serviciosRequeridos || null,
    servicios_convenidos: s.serviciosConvenidos || null,
    diagnostico: s.diagnostico || null,
    presupuesto: s.presupuesto || 0,
    presupuesto_texto: s.presupuestoTexto || null,
    acepta: !!s.acepta,
    rechaza_devolver: !!s.rechazaDevolver,
    garantia: !!s.garantia,
    es_reclamo_garantia: !!s.esReclamoGarantia,
    ingreso_taller: s.ingresoTaller !== false,
    repuestos_comprar: s.repuestosComprar || null,
    repuestos_comprados: s.repuestosComprados || null,
    pasa_stock: !!s.pasaStock,
    cita_dia: parseDate(s.citaDia),
    cita_entrega: parseDate(s.citaEntrega),
    hora_entrega_desde: s.horaEntregaDesde || null,
    hora_entrega_hasta: s.horaEntregaHasta || null,
    entregado: !!s.entregado,
    terminado: !!s.terminado,
    factura: !!s.factura,
    contado: !!s.contado,
    info_logistica: s.infoLogistica || null,
    notas_internas: s.notasInternas || null,
    estado: s.estado || 'RECIBIDO',
    monto_efectivo: s.montoEfectivo || 0,
    monto_transferencia: s.montoTransferencia || 0,
    metodo_pago: s.metodoPago || null,
    created_at: parseDate(s.createdAt),
    updated_at: parseDate(s.updatedAt),
    created_by: s.createdBy || null,
    fotos_drive: s.fotosDrive || []
  }));

  for (let i = 0; i < mappedServicios.length; i += BATCH_SIZE) {
    const batch = mappedServicios.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('servicios').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Error al hacer upsert de servicios batch ${i}:`, error.message);
    } else {
      console.log(`Servicios procesados (upsert): ${i + batch.length} / ${mappedServicios.length}`);
    }
  }

  console.log("\n✅ Carga masiva (Upsert) a Supabase finalizada con éxito.");
};

runMigration().catch(err => {
  console.error("Migration script failed:", err);
});
