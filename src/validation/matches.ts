/**
 * █ [VALIDATION] :: SCHEMAS_ZOD
 * =====================================================================
 * DESC:   Define las reglas de validación para entradas de datos.
 *         Actúa como barrera de defensa antes de tocar la BD.
 * STATUS: ESTABLE
 * =====================================================================
 */
import { z } from "zod";

/**
 * ◼️ CONSTANTES DE ESTADO
 * ---------------------------------------------------------
 * Definimos los estados posibles en código para evitar "magic strings".
 */
export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
} as const;

/**
 * ◼️ SCHEMA: QUERY PARAMS (LISTADO)
 * ---------------------------------------------------------
 * Valida los parámetros de búsqueda en la URL.
 * `coerce` convierte strings numéricos ("50") a números reales (50).
 */
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * ◼️ SCHEMA: ID PARAM
 * ---------------------------------------------------------
 * Asegura que los IDs en la URL sean siempre números positivos.
 */
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// [HELPER] -> Validación estricta de formato fecha ISO
const isoDateString = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: "Invalid ISO date string",
});

/**
 * ◼️ SCHEMA: CREAR PARTIDO (CREATE)
 * ---------------------------------------------------------
 * Reglas estrictas para crear un partido.
 * INCLUYE: Validación cruzada (superRefine) para lógica temporal.
 */
export const createMatchSchema = z
  .object({
    sport: z.string().min(1),
    homeTeam: z.string().min(1),
    awayTeam: z.string().min(1),
    startTime: isoDateString,
    endTime: isoDateString,
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startTime).getTime();
    const end = new Date(data.endTime).getTime();

    // REGLA: Un partido no puede terminar antes de empezar
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endTime must be chronologically after startTime",
        path: ["endTime"],
      });
    }
  });

/**
 * ◼️ SCHEMA: ACTUALIZAR MARCADOR (UPDATE)
 * ---------------------------------------------------------
 * Permite actualizar solo los puntajes.
 */
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});
