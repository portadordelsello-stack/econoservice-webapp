import { supabase } from "../src/lib/supabase";

async function run() {
  console.log("Fetching services created recently...");
  const { data, error } = await supabase
    .from("servicios")
    .select("id, numero_servicio, cliente_id, equipo_id, ingreso_taller, info_logistica, estado, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Error:", error);
    return;
  }

  data.forEach(s => {
    console.log(`- ID: ${s.id} | No: ${s.numero_servicio} | IngresoTaller: ${s.ingreso_taller} | Estado: ${s.estado} | InfoLog: ${s.info_logistica} | Created: ${s.created_at}`);
  });
}

run().catch(console.error);
