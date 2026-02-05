/**
 * █ [VALIDATION] :: COMMENTARY_SCHEMAS
 * =====================================================================
 * DESC:   Define las reglas de validación para la gestión de comentarios.
 *         Incluye validación de Body (POST) y Query Params (GET).
 * STATUS: STABLE
 * =====================================================================
 */
import { z } from "zod";

/**
 * ◼️ SCHEMA: CREATE_COMMENTARY
 * ---------------------------------------------------------
 * Reglas para validar el payload de un nuevo comentario (POST).
 * matchId se valida por separado via URL param.
 */
export const createCommentarySchema = z.object({
  minute: z.coerce.number().int().min(0),
  sequence: z.coerce.number().int().min(0).default(0),
  period: z.string().min(1),
  eventType: z.string().min(1),
  actor: z.string().optional(),
  team: z.string().optional(),
  message: z.string().min(1),
  // [FLEX] -> Metadata permite guardar extras (coords, stats, etc.)
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * ◼️ SCHEMA: QUERY_PARAMS
 * ---------------------------------------------------------
 * Valida los parámetros de búsqueda para listar comentarios (GET).
 * `limit` protege contra sobrecarga de datos.
 */
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});
