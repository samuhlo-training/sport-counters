/**
 * █ [UTILS] :: ESTADO_PARTIDO
 * =====================================================================
 * DESC:   Lógica pura para determinar el estado de un partido basado
 *         en el tiempo. Centraliza esta regla de negocio crítica.
 * STATUS: ESTABLE
 * =====================================================================
 */
import { MATCH_STATUS } from "../validation/matches.ts";
import type { Match, MatchStatus } from "../types/matches.ts";

/**
 * ◼️ CALCULAR ESTADO
 * ---------------------------------------------------------
 * Compara fecha actual vs start/end para devolver el estado.
 * ES PURA: No tiene efectos secundarios, solo calcula.
 */
export function getMatchStatus(
  startTime: Date | string,
  endTime: Date | string,
  now = new Date(),
): MatchStatus | null {
  const start = new Date(startTime);
  const end = new Date(endTime);

  // [SAFETY] -> Validación preventiva de fechas inválidas
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  // REGLA: Si no empezó -> SCHEDULED
  if (now < start) {
    return MATCH_STATUS.SCHEDULED;
  }

  // REGLA: Si ya terminó -> FINISHED
  if (now >= end) {
    return MATCH_STATUS.FINISHED;
  }

  // REGLA: En cualquier otro caso -> LIVE
  return MATCH_STATUS.LIVE;
}

/**
 * ◼️ SINCRONIZAR ESTADO (MUTABLE / ASYNC)
 * ---------------------------------------------------------
 * Actualiza el estado de un objeto Match si ha cambiado.
 * Útil para workers o crons que revisan partidos en vivo.
 */
export async function syncMatchStatus(
  match: Match,
  updateStatus: (status: MatchStatus) => Promise<void>,
): Promise<MatchStatus> {
  // [SAFETY] -> Validación explícita antes de calcular
  if (!match.startTime || !match.endTime) {
    return match.status as MatchStatus;
  }

  const nextStatus = getMatchStatus(match.startTime, match.endTime);

  if (!nextStatus) {
    // Si falla el cálculo, mantenemos el estado actual por seguridad
    return match.status as MatchStatus;
  }

  // [OPTIMIZACIÓN] -> Solo actualizamos si hubo cambio real
  if (match.status !== nextStatus) {
    await updateStatus(nextStatus);

    // [MUTACIÓN] -> Actualizamos la referencia en memoria para consistencia inmediata
    (match as any).status = nextStatus;
  }
  return match.status as MatchStatus;
}
