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
  // Padel specific (Optional override, but usually auto-fetched)
  setNumber: z.coerce.number().int().min(1).optional(),
  gameNumber: z.coerce.number().int().min(1).optional(),

  // Message & Tags
  message: z.string().min(1),
  tags: z.array(z.string()).optional(),

  // Extras
  metadata: z.record(z.string(), z.unknown()).optional(),
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
