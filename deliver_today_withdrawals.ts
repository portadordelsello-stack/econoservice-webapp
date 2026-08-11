import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zkoacqpewrsepboswacp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb2FjcXBld3JzZXBib3N3YWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMzI0MTgsImV4cCI6MjEwMTYwODQxOH0.Q9MHLR7F2RD10vg31z4z2PsRmPIvPna3u-TjGUF6QSU";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const todayStr = "2026-08-10";

function parseInfoLogistica(info?: string, fallbackDate?: string | Date) {
  let fechaRetiroStr = "";
  if (info) {
    const parts = info.split(" | ");
    parts.forEach(part => {
      if (part.startsWith("Retiro acordado: ")) {
        fechaRetiroStr = part.replace("Retiro acordado: ", "");
      }
    });
  }

  if (!fechaRetiroStr && info) {
    const dateMatch = info.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (dateMatch) {
      fechaRetiroStr = dateMatch[0];
    }
  }

  if (!fechaRetiroStr && fallbackDate) {
    try {
      const d = new Date(fallbackDate);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        fechaRetiroStr = `${year}-${month}-${day}`;
      }
    } catch (e) {}
  }

  if (!fechaRetiroStr) return null;
  return fechaRetiroStr;
}

async function fetchAllActive() {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const to = from + step - 1;
    const { data, error } = await supabase
      .from("servicios")
      .select("*")
      .neq("estado", "ENTREGADO")
      .range(from, to)
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    if (!data || data.length === 0) {
      break;
    }
    allData = allData.concat(data);
    if (data.length < step) {
      break;
    }
    from += step;
  }
  return allData;
}

async function main() {
  try {
    console.log("Fetching active services...");
    const servicios = await fetchAllActive();
    console.log(`Fetched ${servicios.length} active services.`);

    const toDeliverIds: string[] = [];
    for (const s of servicios) {
      if (s.ingreso_taller === false) {
        const fechaRetiroStr = parseInfoLogistica(s.info_logistica, s.fecha_ingreso || s.created_at);
        if (fechaRetiroStr) {
          const datePart = fechaRetiroStr.split("T")[0];
          if (datePart <= todayStr) {
            toDeliverIds.push(s.id);
          }
        }
      }
    }

    console.log(`Found ${toDeliverIds.length} withdrawals to mark as delivered.`);

    if (toDeliverIds.length === 0) {
      console.log("No services to update.");
      return;
    }

    console.log("Updating to ENTREGADO in batches...");
    const batchSize = 100;
    for (let i = 0; i < toDeliverIds.length; i += batchSize) {
      const batch = toDeliverIds.slice(i, i + batchSize);
      console.log(`Updating batch ${i / batchSize + 1} (${batch.length} rows)...`);
      const { error } = await supabase
        .from("servicios")
        .update({
          ingreso_taller: false,
          entregado: true,
          estado: "ENTREGADO"
        })
        .in("id", batch);
      if (error) {
        throw error;
      }
    }

    console.log("Successfully marked all as delivered!");
  } catch (error) {
    console.error("Migration error:", error);
  }
}

main();
