/**
 * █ [API_ROUTE] :: COMMENTARY_HANDLER
 * =====================================================================
 * DESC:   Gestiona el minuto a minuto (Live Events) de los partidos.
 *         Permite crear eventos y listarlos en tiempo real.
 * STATUS: STABLE
 * =====================================================================
 */
import { Hono } from "hono";
import { db } from "../db/db.ts";
import { commentary } from "../db/schema.ts";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.ts";
import { matchIdParamSchema } from "../validation/matches.ts";
import { desc, eq } from "drizzle-orm";

// =============================================================================
// █ CONFIG: ROUTER SETUP
// =============================================================================
export const commentaryApp = new Hono();

/**
 * ◼️ ENDPOINT: CHECK_STATUS
 * ---------------------------------------------------------
 * DESC: Verifica que el router de comentarios esté montado correctamente.
 * PATH: GET /commentary/
 */
commentaryApp.get("/", (c) => {
  return c.json({
    message: "Commentary API is operational 🚀",
  });
});

// =============================================================================
// █ ENDPOINT: GET /:id
// =============================================================================
// DESC: Obtiene el feed de comentarios de un partido específico.
commentaryApp.get("/:id", async (c) => {
  // 1. VALIDATION: PARAMS (URL)
  const paramsResult = matchIdParamSchema.safeParse(c.req.param());
  if (!paramsResult.success) {
    return c.json(
      { error: "Invalid Match ID", details: paramsResult.error },
      400,
    );
  }
  const matchId = paramsResult.data.id;

  // 2. VALIDATION: QUERY (FILTERS)
  const queryResult = listCommentaryQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    return c.json(
      { error: "Invalid Query Parameters", details: queryResult.error },
      400,
    );
  }

  // [LIMIT] -> Protección contra 'heavy queries'. Default 100.
  const limit = Math.min(queryResult.data.limit ?? 100, 100);

  try {
    // 3. DB QUERY
    // Buscamos comentarios por matchId, ordenados por fecha (más nuevos primero).
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return c.json({ data });
  } catch (error) {
    console.error(`[ERR]   :: GET_COMMENTARY_ERR :: ${error}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// =============================================================================
// █ ENDPOINT: POST /:id
// =============================================================================
// DESC: Agrega un nuevo evento (gol, tarjeta, etc.) al feed del partido.
commentaryApp.post("/:id", async (c) => {
  // 1. VALIDATION: PARAMS
  const paramsResult = matchIdParamSchema.safeParse(c.req.param());
  if (!paramsResult.success) {
    return c.json(
      { error: "Invalid Match ID", details: paramsResult.error },
      400,
    );
  }
  const matchId = paramsResult.data.id;

  // 2. VALIDATION: BODY
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const bodyResult = createCommentarySchema.safeParse(body);
  if (!bodyResult.success) {
    return c.json(
      { error: "Validation failed", details: bodyResult.error },
      400,
    );
  }

  const commentaryData = bodyResult.data;

  try {
    // 3. PERSISTENCE
    console.log(`[DB]    >> INSERTING COMMENTARY :: matchId: ${matchId}`);

    const [newCommentary] = await db
      .insert(commentary)
      .values({
        matchId,
        ...commentaryData,
      })
      .returning();

    if (!newCommentary) {
      return c.json({ error: "Failed to create commentary" }, 500);
    }

    // [SUCCESS] -> Log de confirmación
    console.log(`[DB]    ++ SAVED COMMENTARY     :: id: ${newCommentary.id}`);

    return c.json({ data: newCommentary }, 201);
  } catch (error) {
    console.error(`[ERR]   :: CREATE_COMMENTARY_ERR :: ${error}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
