import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cqjqewlzxebszpnqhmev.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_rTd12RguCfNQYezz4febZA_xuIJW3OM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
