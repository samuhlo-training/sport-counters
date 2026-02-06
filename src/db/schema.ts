/**
 * █ [CORE] :: DB_SCHEMA
 * =====================================================================
 * DESC:   Define el esquema de Postgres usando Drizzle ORM.
 *         Refactorizado para Padel Doubles (2vs2).
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
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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

// 1. PLAYERS TABLE -> Usuarios individuales
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  country: text("country"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. MATCHES TABLE -> Configuración y Estado Global del Partido
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  sport: text("sport").default("padel").notNull(),

  // Display Names (pueden ser "Pareja A" vs "Pareja B" o nombres de torneo)
  homeTeamName: text("home_team_name").notNull(),
  awayTeamName: text("away_team_name").notNull(),

  // Players - Side A (Home)
  player1Id: integer("player1_id").references(() => players.id),
  player2Id: integer("player2_id").references(() => players.id),

  // Players - Side B (Away)
  player3Id: integer("player3_id").references(() => players.id),
  player4Id: integer("player4_id").references(() => players.id),

  status: matchStatusEnum("status").default("scheduled").notNull(),

  // Game State (JSONB para flexibilidad en Scoring y Sets)
  // Estructura esperada:
  // {
  //   sets: [{a: 6, b: 4}],
  //   current_set: {a: 2, b: 3},
  //   current_game: {a: "15", b: "30"},
  //   server_id: 12,
  //   is_tie_break: false
  // }
  matchState: jsonb("match_state").default({
    sets: [],
    currentSet: { a: 0, b: 0 },
    currentGame: { a: "0", b: "0" },
    isTieBreak: false,
  }),

  currentServerId: integer("current_server_id").references(() => players.id),

  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. MATCH STATS -> Estadísticas granulares por jugador
export const matchStats = pgTable("match_stats", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .references(() => matches.id)
    .notNull(),
  playerId: integer("player_id")
    .references(() => players.id)
    .notNull(),

  // Metrics
  pointsWon: integer("points_won").default(0).notNull(),
  winners: integer("winners").default(0).notNull(),
  unforcedErrors: integer("unforced_errors").default(0).notNull(),
  totalPointsPlayed: integer("total_points_played").default(0).notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 4. COMMENTARY TABLE -> Real-time logs
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

// =============================================================================
// █ RELATIONS
// =============================================================================

export const matchesRelations = relations(matches, ({ one, many }) => ({
  player1: one(players, {
    fields: [matches.player1Id],
    references: [players.id],
    relationName: "p1",
  }),
  player2: one(players, {
    fields: [matches.player2Id],
    references: [players.id],
    relationName: "p2",
  }),
  player3: one(players, {
    fields: [matches.player3Id],
    references: [players.id],
    relationName: "p3",
  }),
  player4: one(players, {
    fields: [matches.player4Id],
    references: [players.id],
    relationName: "p4",
  }),
  stats: many(matchStats),
  commentary: many(commentary),
}));

export const playersRelations = relations(players, ({ many }) => ({
  stats: many(matchStats),
}));

export const matchStatsRelations = relations(matchStats, ({ one }) => ({
  match: one(matches, {
    fields: [matchStats.matchId],
    references: [matches.id],
  }),
  player: one(players, {
    fields: [matchStats.playerId],
    references: [players.id],
  }),
}));

export const commentaryRelations = relations(commentary, ({ one }) => ({
  match: one(matches, {
    fields: [commentary.matchId],
    references: [matches.id],
  }),
}));
