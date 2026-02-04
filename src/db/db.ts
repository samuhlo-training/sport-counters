/**
 * █ [DB_CONFIG] :: POSTGRES_CONNECTION
 * =====================================================================
 * DESC:   Initializes Drizzle ORM with Node-Postgres pool.
 * STATUS: STABLE
 * =====================================================================
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// =============================================================================
// █ CORE: CONFIG & VALIDATION
// =============================================================================
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

// =============================================================================
// █ INSTANCE: DATABASE CONNECTION
// =============================================================================
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);
