/**
 * █ [CONFIG_DB] :: CONEXIÓN_POSTGRES
 * =====================================================================
 * DESC:   Inicializa Drizzle ORM con el pool de Node-Postgres.
 * STATUS: ESTABLE
 * =====================================================================
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// =============================================================================
// █ NÚCLEO: CONFIGURACIÓN Y VALIDACIÓN
// =============================================================================
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no esta definida");
}

// =============================================================================
// █ INSTANCIA: CONEXIÓN A BASE DE DATOS
// =============================================================================
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);
