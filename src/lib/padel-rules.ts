/**
 * █ [DOMAIN] :: PADEL_RULES
 * =====================================================================
 * DESC:   Motor de reglas para Padel (State Machine).
 *         Adaptado para "Gold Master Status" (Relacional + Snapshots).
 * STATUS: GOLD MASTER
 * =====================================================================
 */
import type {
  MatchSnapshot,
  PointOutcome,
  PointMethod,
} from "../types/padel.ts";

/** Map de puntos estándar para el siguiente valor */
const NEXT_POINT: Record<string, string> = {
  "0": "15",
  "15": "30",
  "30": "40",
};

/**
 * Procesa un punto marcado y devuelve el resultado completo (Snapshot + Historia + Eventos).
 * Función PURA.
 */
export const handlePointScored = (
  current: MatchSnapshot,
  scorerSide: "pair_a" | "pair_b",
  method: PointMethod,
): PointOutcome => {
  // 1. Clonar estado (Deep Copy) para inmutabilidad superficial
  const next: MatchSnapshot = { ...current };

  // Validar si el partido ya terminó
  if (next.winnerSide) {
    throw new Error("Match is already finished");
  }

  // 2. Calcular Próximo Punto
  // 2. Calcular Flags (Antes de procesar el punto)
  let isGamePoint = false;
  let isSetPoint = false;
  let isMatchPoint = false;

  const scoreA = current.pairAScore;
  const scoreB = current.pairBScore;

  if (current.isTieBreak) {
    const pointsA = parseInt(scoreA) || 0;
    const pointsB = parseInt(scoreB) || 0;
    // En Tie-break (a 7), game point si tiene 6+ y diferencia >= 1 (la siguiente gana)
    const gpA = pointsA >= 6 && pointsA - pointsB >= 1;
    const gpB = pointsB >= 6 && pointsB - pointsA >= 1;
    isGamePoint = gpA || gpB;
    isSetPoint = isGamePoint; // En tie-break, ganar el juego es ganar el set
  } else {
    // Normal Check
    const gpA =
      (scoreA === "40" && scoreB !== "40" && scoreB !== "AD") ||
      scoreA === "AD";
    const gpB =
      (scoreB === "40" && scoreA !== "40" && scoreA !== "AD") ||
      scoreB === "AD";
    isGamePoint = gpA || gpB;

    // Set Point Check (Simplificado)
    // Si es GamePoint Y ganar este juego significa ganar el set.
    // Ej: 5-0, 5-1, 5-2, 5-3, 5-4. O 6-5.
    if (isGamePoint) {
      if (gpA) {
        if (
          (current.pairAGames === 5 && current.pairBGames <= 4) ||
          (current.pairAGames === 6 && current.pairBGames === 5)
        ) {
          isSetPoint = true;
        }
      }
      if (gpB) {
        if (
          (current.pairBGames === 5 && current.pairAGames <= 4) ||
          (current.pairBGames === 6 && current.pairAGames === 5)
        ) {
          isSetPoint = true;
        }
      }
    }
  }

  const otherSide = scorerSide === "pair_a" ? "pair_b" : "pair_a";

  // -- A. LÓGICA TIE-BREAK --
  if (next.isTieBreak) {
    handleTieBreakPoint(next, scorerSide, otherSide);
  }
  // -- B. LÓGICA JUEGO NORMAL --
  else {
    handleStandardPoint(next, scorerSide, otherSide);
  }

  // 3. Verificar Set Ganado
  let setCompleted = undefined;
  if (hasWonSet(next, scorerSide)) {
    // Capturar evento de Set Completado
    setCompleted = {
      setNumber: next.currentSetIdx,
      pairAGames: next.pairAGames,
      pairBGames: next.pairBGames,
      // Si fue tie-break, guardar puntos
      tieBreakPairAPoints: next.isTieBreak
        ? parseInt(next.pairAScore)
        : undefined,
      tieBreakPairBPoints: next.isTieBreak
        ? parseInt(next.pairBScore)
        : undefined,
    };

    // Resetear marcador para el siguiente set (si no acabó el partido)
    if (!checkMatchWin(next, scorerSide)) {
      next.currentSetIdx++;
      next.pairAGames = 0;
      next.pairBGames = 0;
      next.pairAScore = "0";
      next.pairBScore = "0";
      next.isTieBreak = false;
    }
  }

  // 4. Construir Resultado
  return {
    nextSnapshot: next,
    history: {
      setNumber: current.currentSetIdx,
      gameNumber: current.pairAGames + current.pairBGames + 1,
      pointNumber: 0, // Se debe calcular en DB o Controller (MAX + 1)
      winnerSide: scorerSide,
      method,
      scoreAfterPairA: next.pairAScore,
      scoreAfterPairB: next.pairBScore,
      isGamePoint, // Aproximación
      isSetPoint,
      isMatchPoint,
    },
    setCompleted,
  };
};

// =============================================================================
// █ INTERNAL HELPERS
// =============================================================================

function handleStandardPoint(
  state: MatchSnapshot,
  scorer: "pair_a" | "pair_b",
  receiver: "pair_a" | "pair_b",
) {
  const scoreScorer = scorer === "pair_a" ? state.pairAScore : state.pairBScore;
  const scoreReceiver =
    receiver === "pair_a" ? state.pairAScore : state.pairBScore;

  // 1. DEUCE / VENTAJA
  if (scoreScorer === "40" && scoreReceiver === "40") {
    setScore(state, scorer, "AD");
    return;
  }
  if (scoreScorer === "AD") {
    // Ganar Juego
    winGame(state, scorer);
    return;
  }
  if (scoreReceiver === "AD") {
    // Volver a Deuce
    setScore(state, receiver, "40");
    return;
  }

  // 2. PUNTO NORMAL
  if (scoreScorer === "40") {
    // Ganar Juego
    winGame(state, scorer);
    return;
  }

  // AVANZAR (0->15->30->40)
  setScore(state, scorer, NEXT_POINT[scoreScorer] || "40");
}

function handleTieBreakPoint(
  state: MatchSnapshot,
  scorer: "pair_a" | "pair_b",
  receiver: "pair_a" | "pair_b",
) {
  // En Tie-break los puntos son numéricos (strings "0", "1"...)
  const currentPoints =
    parseInt(scorer === "pair_a" ? state.pairAScore : state.pairBScore) || 0;
  const newPoints = currentPoints + 1;
  setScore(state, scorer, newPoints.toString());
}

function winGame(state: MatchSnapshot, side: "pair_a" | "pair_b") {
  // Resetear puntos
  state.pairAScore = "0";
  state.pairBScore = "0";

  // Sumar juego
  if (side === "pair_a") state.pairAGames++;
  else state.pairBGames++;

  // Verificar Tie-Break (6-6)
  if (state.pairAGames === 6 && state.pairBGames === 6) {
    state.isTieBreak = true;
  }
}

function setScore(
  state: MatchSnapshot,
  side: "pair_a" | "pair_b",
  score: string,
) {
  if (side === "pair_a") state.pairAScore = score;
  else state.pairBScore = score;
}

function hasWonSet(state: MatchSnapshot, side: "pair_a" | "pair_b"): boolean {
  const gamesA = state.pairAGames;
  const gamesB = state.pairBGames;

  // Lógica Tie-Break: gana si llega a 7 (diferencia 2)
  if (state.isTieBreak) {
    const pointsA = parseInt(state.pairAScore);
    const pointsB = parseInt(state.pairBScore);
    const diff = Math.abs(pointsA - pointsB);

    if (side === "pair_a" && pointsA >= 7 && diff >= 2) return true;
    if (side === "pair_b" && pointsB >= 7 && diff >= 2) return true;
    return false;
  }

  // Lógica Normal: 6-x (diff>=2) o 7-5
  const myGames = side === "pair_a" ? gamesA : gamesB;
  const otherGames = side === "pair_a" ? gamesB : gamesA;

  if (myGames === 6 && otherGames <= 4) return true;
  if (myGames === 7 && otherGames === 5) return true;

  return false;
}

function checkMatchWin(
  state: MatchSnapshot,
  side: "pair_a" | "pair_b",
): boolean {
  // Esta función es compleja porque `matches` tabla en snapshot SOLO tiene el set actual.
  // En la implementación real, deberíamos contar cuántos sets ha ganado ya consultando `match_sets`.
  // PERO, para simplificar aquí, asumiremos que si es el 3er set, gana.
  // TODO: Mejorar lógica de Match Point con historial.

  // Por ahora, solo marcamos el winnerSide si lo detectamos externamente o lógica simple del set.
  // Si CurrentSetIdx es 3, o es 2 y ya ganó uno...
  // Simplemente marcamos el Snapshot como terminado?
  // Dejaremos que el Controller decida el fin del partido basándose en `match_sets` DB count.
  return false;
}
