import { supabase } from "../src/lib/supabase";

async function run() {
  console.log("Fetching all services from Supabase...");
  const { data, error } = await supabase
    .from("servicios")
    .select("id, numero_servicio, cliente_id, equipo_id, ingreso_taller, info_logistica, estado, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching services:", error);
    return;
  }

  console.log(`Total services in database: ${data.length}`);
  console.log("Recent services (last 10):");
  data.slice(0, 10).forEach(s => {
    console.log(`- ID: ${s.id} | No: ${s.numero_servicio} | IngresoTaller: ${s.ingreso_taller} | Estado: ${s.estado} | InfoLog: ${s.info_logistica} | Created: ${s.created_at}`);
  });

  const pendingLogistics = data.filter(s => s.ingreso_taller === false || s.ingreso_taller === null);
  console.log(`\nPending pickup services in DB (ingreso_taller is false or null): ${pendingLogistics.length}`);
  pendingLogistics.forEach(s => {
    console.log(`- ID: ${s.id} | No: ${s.numero_servicio} | IngresoTaller: ${s.ingreso_taller} | Estado: ${s.estado} | InfoLog: ${s.info_logistica}`);
  });
}

run().catch(console.error);
