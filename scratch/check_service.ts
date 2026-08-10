import { supabase } from "../src/lib/supabase";

async function run() {
  const { data, error } = await supabase
    .from("servicios")
    .select("*")
    .eq("id", "s_1786371690470")
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Full DB record for s_1786371690470:");
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
