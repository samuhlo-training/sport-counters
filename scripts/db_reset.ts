import { db } from "../src/db/db";
import { sql } from "drizzle-orm";

/**
 * █ SCRIPT: DB RESET (HARD)
 * =====================================================================
 * DESC:   ELIMINA y RECREA el schema 'public'.
 *         ¡¡DESTRUCTIVO!! Borra todas las tablas y tipos.
 * USAGE:  bun scripts/db_reset.ts
 * =====================================================================
 */
async function resetDatabase() {
  console.log("🧨 STARTING HARD DATABASE RESET...");

  try {
    await db.execute(sql`DROP SCHEMA public CASCADE;`);
    await db.execute(sql`CREATE SCHEMA public;`);

    // Restaurar permisos básicos (opcional pero recomendado)
    await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);
    await db.execute(
      sql`COMMENT ON SCHEMA public IS 'standard public schema';`,
    );

    console.log("✅ DATABASE RESET SUCCESSFULLY");
    console.log("   - Schema 'public' dropped and recreated.");
  } catch (error) {
    console.error("❌ RESET FAILED:", error);
    process.exit(1);
  }

  process.exit(0);
}

resetDatabase();
