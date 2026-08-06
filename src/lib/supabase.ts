import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zkoacqpewrsepboswacp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb2FjcXBld3JzZXBib3N3YWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMzI0MTgsImV4cCI6MjEwMTYwODQxOH0.Q9MHLR7F2RD10vg31z4z2PsRmPIvPna3u-TjGUF6QSU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
