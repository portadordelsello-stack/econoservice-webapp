import { supabase } from "../src/lib/supabase";

async function run() {
  const { data, error } = await supabase
    .from("historial")
    .select("*")
    .eq("servicio_id", "s_1786368973282")
    .order("fecha", { ascending: true });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Audit log history for s_1786368973282:");
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
