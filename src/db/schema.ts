/**
 * █ [CORE] :: DB_SCHEMA
 * =====================================================================
 * DESC:   Define el esquema de Postgres usando Drizzle ORM.
 * STATUS: STABLE
 * =====================================================================
 */
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

// =============================================================================
// █ ENUMS: CUSTOM TYPES
// =============================================================================
export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "live",
  "finished",
]);

// =============================================================================
// █ TABLES: DEFINITIONS
// =============================================================================

// MATCHES TABLE -> Almacena datos generales del juego
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  sport: text("sport").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  status: matchStatusEnum("status").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  homeScore: integer("home_score").default(0).notNull(),
  awayScore: integer("away_score").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// COMMENTARY TABLE -> Almacena el minuto a minuto en tiempo real (Real-time logs)
export const commentary = pgTable("commentary", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .references(() => matches.id)
    .notNull(),
  minute: integer("minute").notNull(),
  sequence: integer("sequence").notNull(),
  period: text("period").notNull(),
  eventType: text("event_type").notNull(),
  actor: text("actor"),
  team: text("team"),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
