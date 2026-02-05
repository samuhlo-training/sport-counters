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
import { matches } from "../db/schema.ts";
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
  // "await c.req.json()" es la forma moderna de obtener el JSON Body.
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

  const { startTime, endTime, homeScore, awayScore, ...matchData } =
    result.data;

  // 2. BUSINESS RULE -> Cálculo del estado en el servidor
  const calculatedStatus = getMatchStatus(startTime, endTime);

  if (!calculatedStatus) {
    return c.json({ error: "Invalid dates for status calculation" }, 400);
  }

  try {
    // 3. PERSISTENCE
    console.log(`[DB]    >> INSERTING     :: sport: ${matchData.sport}`);
    const [event] = await db
      .insert(matches)
      .values({
        ...matchData,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: calculatedStatus,
      })
      .returning();

    if (!event) {
      console.error(`[ERR]   :: CREATE_MATCH  :: Insert returned no rows`);
      return c.json({ error: "Failed to create match" }, 500);
    }

    console.log(`[DB]    ++ SAVED         :: id: ${event.id}`);

    // 4. BROADCAST -> Magia en tiempo real (Real-time magic)
    broadcastMatchCreated(event);

    return c.json({ data: event }, 201);
  } catch (error) {
    console.error(`[ERR]   :: CREATE_MATCH_ERR :: ${error}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
