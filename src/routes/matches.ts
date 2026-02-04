/**
 * █ [API_ROUTE] :: MATCHES_HANDLER (HONO EDITION)
 * =====================================================================
 * DESC:   Manages CRUD operations for matches.
 *         Refactored to use Hono Framework (Superior DX).
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
 * In Hono, 'c' stands for Context. It replaces 'req' and 'res'.
 * It is the swiss-army knife of the framework:
 * - c.req  -> The Request object (headers, query, body)
 * - c.json -> Helper to return JSON responses type-safely
 * - c.text -> Helper to return text responses
 * - c.env  -> Environment variables defined in Hono
 */

// =============================================================================
// █ CONFIG: HONO MIN-APP
// =============================================================================
export const matchesApp = new Hono();

// [CONST] -> Hard limit to prevent DB overload
const MAX_LIMIT = 100;

// =============================================================================
// █ ENDPOINT: GET /
// =============================================================================
// DESC: List matches via query params.
matchesApp.get("/", async (c) => {
  // 1. VALIDATION
  // c.req.query() returns a simple object. Zod validates it.
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
    // ^ Commented out to avoid noise, enable if needed.

    return c.json({ data });
  } catch (error) {
    console.error(`[ERR]   :: DB_QUERY      :: ${error}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// =============================================================================
// █ ENDPOINT: POST /
// =============================================================================
matchesApp.post("/", async (c) => {
  // [START] -> Request processing

  // 1. BODY VALIDATION
  // "await c.req.json()" is the modern way to get body content.
  const body = await c.req.json();
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

  // 2. BUSINESS RULE -> Server-side status calculation
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

    console.log(`[DB]    ++ SAVED         :: id: ${event?.id}`);

    // 4. BROADCAST -> Real-time magic
    broadcastMatchCreated(event);

    return c.json({ data: event }, 201);
  } catch (error) {
    console.error(`[ERR]   :: CREATE_MATCH  :: ${error}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
