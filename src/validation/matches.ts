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
 * ◼️ MATCH_STATUS_CONSTANTS
 * ---------------------------------------------------------
 * Definimos los estados posibles en código para evitar "magic strings".
 */
export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
} as const;

/**
 * ◼️ SCHEMA: QUERY_PARAMS
 * ---------------------------------------------------------
 * Valida los parámetros de búsqueda en la URL.
 * `coerce` convierte strings numéricos ("50") a números reales (50).
 */
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * ◼️ SCHEMA: ID_PARAM
 * ---------------------------------------------------------
 * Asegura que los IDs en la URL sean siempre números positivos.
 */
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// [HELPER] -> ISO_8601 Date Format validation
const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;

const isoDateString = z
  .string()
  .refine((val) => ISO_8601_REGEX.test(val) && !isNaN(Date.parse(val)), {
    message: "Cadena de fecha ISO 8601 inválida",
  });

/**
 * ◼️ SCHEMA: CREATE_MATCH
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
        message: "endTime debe ser cronológicamente posterior a startTime",
        path: ["endTime"],
      });
    }
  });

/**
 * ◼️ SCHEMA: UPDATE_SCORE
 * ---------------------------------------------------------
 * Permite actualizar solo los puntajes.
 */
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});
