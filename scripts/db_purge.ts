import { db } from "../src/db/db";
import { sql } from "drizzle-orm";

/**
 * █ SCRIPT: DB PURGE
 * =====================================================================
 * DESC:   Limpia TODAS las tablas de la base de datos.
 *         Usa TRUNCATE ... CASCADE para manejar claves foráneas.
 * USAGE:  bun run db:purge
 * =====================================================================
 */
async function purgeDatabase() {
  console.log("🧨 STARTING DATABASE PURGE...");

  try {
    // Ordenado: TRUNCATE handlea las dependencias con CASCADE
    // Reiniciamos IDs con RESTART IDENTITY
    await db.execute(sql`
      TRUNCATE TABLE 
        point_history,
        match_sets,
        match_stats, 
        commentary, 
        matches, 
        players 
      RESTART IDENTITY CASCADE;
    `);

    console.log("✅ DATABASE PURGED SUCCESSFULLY");
    console.log("   - point_history [CLEARED]");
    console.log("   - match_sets    [CLEARED]");
    console.log("   - match_stats   [CLEARED]");
    console.log("   - commentary    [CLEARED]");
    console.log("   - matches       [CLEARED]");
    console.log("   - players       [CLEARED]");
  } catch (error) {
    console.error("❌ PURGE FAILED:", error);
    process.exit(1);
  }

  process.exit(0);
}

purgeDatabase();
