import { db } from "../src/db/db";
import { sql } from "drizzle-orm";

/**
 * █ SCRIPT: DB RESET (HARD)
 * =====================================================================
 * DESC:   ELIMINA y RECREA el schema 'public'.
 *         ¡¡DESTRUCTIVO!! Borra tablas, tipos, vistas y datos.
 * USAGE:  bun scripts/db_reset.ts
 * =====================================================================
 */
async function resetDatabase() {
  console.log("🧨 STARTING HARD DATABASE RESET...");

  try {
    // -------------------------------------------------------------------------
    // █ SCHEMA RECREATION
    // -------------------------------------------------------------------------
    // [WARNING] -> Esto elimina TODO. Es más agresivo que un truncate.
    // Útil cuando las migraciones están rotas o inconsistentes.
    await db.execute(sql`DROP SCHEMA public CASCADE;`);
    await db.execute(sql`CREATE SCHEMA public;`);

    // [CONFIG] -> Restaurar permisos estándar para que el usuario pueda crear tablas
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
