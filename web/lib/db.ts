import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant (web/.env.local)");

// prepare:false -> requis par le transaction pooler Supabase (pgbouncer)
export const sql = postgres(url, { prepare: false, ssl: "require" });
