/**
 * █ [API_ROUTE] :: MATCHES_HANDLER (HONO EDITION)
 * =====================================================================
 * DESC:   Gestiona operaciones CRUD para partidos.
 *         Refactorizado para usar el Framework Hono (DX Superior).
 * STATUS: STABLE
 * =====================================================================
 */
import { Hono } from "hono";
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches.ts";
import { db } from "../db/db.ts";
import { matches, matchStats } from "../db/schema.ts";
import { getMatchStatus } from "../utils/match-status.ts";
import { desc } from "drizzle-orm";
import { broadcastMatchCreated } from "../ws/server.ts";

/**
 * ◼️ HONO CONTEXT ('c')
 * ---------------------------------------------------------
 * En Hono, 'c' significa Context. Reemplaza a 'req' y 'res'.
 * Es la navaja suiza (Swiss-army knife) del framework:
 * - c.req  -> El objeto Request (headers, query, body)
 * - c.json -> Helper para retornar respuestas JSON de forma segura
 * - c.text -> Helper para retornar respuestas de texto
 * - c.env  -> Variables de entorno definidas en Bun.serve (o Hono)
 */

// =============================================================================
// █ CONFIG: HONO MINI-APP
// =============================================================================
export const matchesApp = new Hono();

// [CONST] -> MAX_LIMIT estricto para prevenir sobrecarga de la DB
const MAX_LIMIT = 100;

// =============================================================================
// █ ENDPOINT: GET /
// =============================================================================
// DESC: Listar partidos mediante parámetros de consulta.
matchesApp.get("/", async (c) => {
  // 1. VALIDATION
  // c.req.query() devuelve un objeto simple. Zod lo valida.
  const parsed = listMatchesQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    console.log(`[API]   :: INVALID_REQ   :: path: GET /matches`);
    return c.json(
      {
        error: "Failed to load matches",
        details: JSON.stringify(parsed.error),
      },
      400,
    );
  }

  // 2. BUSINESS LOGIC
  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    // 3. ORM QUERY
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);

    // [SUCCESS] -> Log retrieval
    // console.log(`[DB]    ++ FETCHED       :: count: ${data.length}`);
    // ^ Comentado para evitar ruido, habilitar si es necesario.

    return c.json({ data });
  } catch (error) {
    console.error(`[ERR]   :: DB_QUERY_ERR  :: ${error}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// =============================================================================
// █ ENDPOINT: POST /
// =============================================================================
matchesApp.post("/", async (c) => {
  // [START] -> Processing Request

  // 1. BODY VALIDATION
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const result = createMatchSchema.safeParse(body);

  if (!result.success) {
    console.log(
      `[API]   :: INVALID_BODY  :: ${JSON.stringify(result.error).slice(0, 100)}...`,
    );
    return c.json(
      {
        error: "Validation failed",
        details: JSON.stringify(result.error),
      },
      400,
    );
  }

  // Destructure validated data
  const {
    startTime,
    endTime,
    player1Id,
    player2Id,
    player3Id,
    player4Id,
    sport,
    homeTeamName,
    awayTeamName,
  } = result.data;

  // 2. BUSINESS RULE -> Estado inicial
  let calculatedStatus = "scheduled";
  if (endTime) {
    const status = getMatchStatus(startTime, endTime);
    if (status) calculatedStatus = status;
  } else {
    // Si no tenemos fin, y ya pasó la hora de inicio -> live
    if (new Date(startTime) <= new Date()) {
      calculatedStatus = "live";
    }
  }

  try {
    // 3. TRANSACTION (Match + Initial Stats)
    const newMatch = await db.transaction(async (tx) => {
      // A. Insertar Partido
      const [match] = await tx
        .insert(matches)
        .values({
          sport,
          homeTeamName,
          awayTeamName,
          player1Id,
          player2Id,
          player3Id,
          player4Id,
          currentServerId: player1Id, // Empezamos sacando el P1
          matchState: {
            sets: [], // Historial de Sets
            currentSet: { a: 0, b: 0 }, // Set actual
            currentGame: { a: "0", b: "0" }, // Juego actual
            isTieBreak: false,
          },
          startTime: new Date(startTime),
          endTime: endTime ? new Date(endTime) : null,
          status: calculatedStatus as "scheduled" | "live" | "finished",
        })
        .returning();

      if (!match) throw new Error("Match insert failed");

      // B. Inicializar Stats para los 4 jugadores
      const baseStats = {
        matchId: match.id,
        pointsWon: 0,
        winners: 0,
        unforcedErrors: 0,
      };

      await tx.insert(matchStats).values([
        { ...baseStats, playerId: player1Id },
        { ...baseStats, playerId: player2Id },
        { ...baseStats, playerId: player3Id },
        { ...baseStats, playerId: player4Id },
      ]);

      return match;
    });

    // [SUCCESS] -> Log
    console.log(`[DB]    ++ SAVED         :: id: ${newMatch.id}`);

    // 4. BROADCAST
    try {
      broadcastMatchCreated(newMatch);
    } catch (broadcastError) {
      console.error(
        `[ERR]   :: BROADCAST_FAIL :: id: ${newMatch.id}`,
        broadcastError,
      );
    }

    return c.json({ data: newMatch }, 201);
  } catch (error) {
    console.error(`[ERR]   :: CREATE_MATCH_ERR :: ${error}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
