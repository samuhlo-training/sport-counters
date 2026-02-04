/**
 * █ [CONFIG] :: DRIZZLE_KIT_CONFIG
 * =====================================================================
 * DESC:   Configuración para las migraciones y herramientas de Drizzle.
 * STATUS: ESTABLE
 * =====================================================================
 */
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida en el archivo .env");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
