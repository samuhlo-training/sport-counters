/**
 * █ [API_ROUTE] :: MATCHES_HANDLER
 * =====================================================================
 * DESC:   Gestiona las operaciones CRUD para los partidos.
 *         Maneja la creación y listado, incluyendo lógica de estado.
 * STATUS: ESTABLE
 * =====================================================================
 */
import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches.ts";
import { db } from "../db/db.ts";
import { matches } from "../db/schema.ts";
import { getMatchStatus } from "../utils/match-status.ts";
import { desc } from "drizzle-orm";

// =============================================================================
// █ CONFIGURACIÓN: ROUTER
// =============================================================================
export const matchRouter = Router();

// [CONSTANTE] -> Límite duro para evitar sobrecarga en la BD
const MAX_LIMIT = 100;

// =============================================================================
// █ ENDPOINT: GET /
// =============================================================================
// DESC: Listar partidos ordenados por fecha de creación (más recientes primero).
matchRouter.get("/", async (req, res) => {
  // 1. VALIDACIÓN -> Aseguramos que los query params sean seguros
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Fallo en la carga de partido",
      details: JSON.stringify(parsed.error),
    });
  }

  // 2. LÓGICA DE NEGOCIO -> Aplicar límites seguros
  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    // 3. CONSULTA ORM -> Select simple con ordenamiento predecible
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);
    res.status(200).json({ data });
  } catch (error) {
    console.error("Error al obtener los partidos:", error);
    res.status(500).json({
      error: "Error al obtener los partidos.",
    });
  }
});

// =============================================================================
// █ ENDPOINT: POST /
// =============================================================================
// DESC: Crear un nuevo partido calculando su estado inicial automáticamente.
matchRouter.post("/", async (req, res) => {
  // 1. VALIDACIÓN -> Zod verifica tipos y reglas de negocio básicas
  const result = createMatchSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Fallo en la carga de partido",
      details: JSON.stringify(result.error),
    });
  }

  const { startTime, endTime, homeScore, awayScore, ...matchData } =
    result.data;

  // 2. REGLA DE NEGOCIO -> El estado se deriva del tiempo, no se confía en el cliente
  const calculatedStatus = getMatchStatus(startTime, endTime);

  // [SAFETY] -> Si las fechas son inválidas, detenemos la operación
  if (!calculatedStatus) {
    return res.status(400).json({
      error: "Fechas inválidas para calcular el estado del partido",
    });
  }

  try {
    // 3. PERSISTENCIA -> Insertamos y retornamos el objeto creado
    const [event] = await db
      .insert(matches)
      .values({
        ...matchData,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: calculatedStatus, // Estado calculado por el servidor
      })
      .returning();
    res.status(201).json({ data: event });
  } catch (error) {
    console.error("Error al crear el partido:", error);
    res.status(500).json({
      error: "Error al crear el partido.",
    });
  }
});
