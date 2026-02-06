/**
 * █ [DOMAIN] :: PADEL_RULES
 * =====================================================================
 * DESC:   Motor de reglas para Padel (State Machine).
 * STATUS: STABLE
 * =====================================================================
 */
import type { MatchState, SetScore, GameScore } from "../types/padel.ts";

/** Map de puntos estándar para el siguiente valor */
const NEXT_POINT: Record<string, string> = {
  "0": "15",
  "15": "30",
  "30": "40",
};

/**
 * Procesa un punto marcado por uno de los lados y devuelve el nuevo estado.
 * Es una función PURA (no muta el estado original).
 *
 * @param currentState Estado actual del partido
 * @param scorerSide Lado que marcó el punto ("a" o "b")
 * @returns Nuevo estado del partido
 */
export const handlePointScored = (
  currentState: MatchState,
  scorerSide: "a" | "b",
): MatchState => {
  // 1. Clonar estado (Deep Copy) para inmutabilidad
  const nextState: MatchState = JSON.parse(JSON.stringify(currentState));

  // 2. Si el partido ya terminó, no hacer nada
  if (nextState.winnerSide) return nextState;

  // 3. Delegar lógica según el tipo de juego (Tie-Break vs Normal)
  if (nextState.isTieBreak) {
    applyTieBreakPoint(nextState, scorerSide);
  } else {
    applyStandardPoint(nextState, scorerSide);
  }

  return nextState;
};

// =============================================================================
// █ INTERNAL LOGIC (Helpers)
// =============================================================================

function applyStandardPoint(state: MatchState, side: "a" | "b") {
  const otherSide = side === "a" ? "b" : "a";
  const myScore = state.currentGame[side];
  const otherScore = state.currentGame[otherSide];

  // LOGICA: DEUCE (40-40) y VENTAJA (AD)
  if (myScore === "40" && otherScore === "40") {
    // 40-40 -> AD
    state.currentGame[side] = "AD";
    return;
  }

  if (myScore === "AD") {
    // AD -> GAME
    winGame(state, side);
    return;
  }

  if (otherScore === "AD") {
    // El rival tenía AD, volvemos a DEUCE (40-40)
    state.currentGame[otherSide] = "40";
    return;
  }

  // LOGICA: PUNTOS STANDARD (0, 15, 30, 40)
  if (myScore === "40") {
    // Tengo 40 y el rival no tiene 40 ni AD -> GAME
    winGame(state, side);
    return;
  }

  // Avance normal: 0->15, 15->30, 30->40
  state.currentGame[side] = NEXT_POINT[myScore] || myScore;
}

function applyTieBreakPoint(state: MatchState, side: "a" | "b") {
  const otherSide = side === "a" ? "b" : "a";

  // Parsear score actual (en Tie-Break usamos números strings "0", "1", "2"...)
  const myPoints = parseInt(state.currentGame[side], 10) || 0;
  const otherPoints = parseInt(state.currentGame[otherSide], 10) || 0;

  const newPoints = myPoints + 1;
  state.currentGame[side] = newPoints.toString();

  // CONDICION VICTORIA TIE-BREAK:
  // Al menos 7 puntos Y diferencia de 2
  if (newPoints >= 7 && newPoints - otherPoints >= 2) {
    winSet(state, side);
  }
}

// -----------------------------------------------------------------------------
// TRANSICIONES DE ESTADO (GAME -> SET -> MATCH)
// -----------------------------------------------------------------------------

function winGame(state: MatchState, side: "a" | "b") {
  // 1. Resetear marcador del juego
  state.currentGame = { a: "0", b: "0" };

  // 2. Sumar Juego al Set
  state.currentSet[side]++;

  // 3. Verificar si gana el Set
  checkSetWin(state, side);
}

function checkSetWin(state: MatchState, side: "a" | "b") {
  const otherSide = side === "a" ? "b" : "a";
  const myGames = state.currentSet[side];
  const otherGames = state.currentSet[otherSide];

  // REGLA: Set normal a 6 juegos (diferencia de 2)
  // 6-0, 6-1, 6-2, 6-3, 6-4 => Gana Set
  if (myGames === 6 && otherGames <= 4) {
    winSet(state, side);
    return;
  }

  // REGLA: 7-5 => Gana Set
  if (myGames === 7 && otherGames === 5) {
    winSet(state, side);
    return;
  }

  // REGLA: 6-6 => Tie Break
  if (myGames === 6 && otherGames === 6) {
    state.isTieBreak = true;
    // El marcador dentro del Tie Break empieza 0-0
    state.currentGame = { a: "0", b: "0" };
    return;
  }

  // Si es 5-5, 6-5 -> Sigue jugando el set
}

function winSet(state: MatchState, side: "a" | "b") {
  // 1. Guardar el set completado en historial
  state.sets.push({ ...state.currentSet });

  // 2. Verificar Ganador del Partido (Mejor de 3)
  const setsWonA = state.sets.filter((s) => s.a > s.b).length;
  const setsWonB = state.sets.filter((s) => s.b > s.a).length;

  if (setsWonA === 2) {
    state.winnerSide = "a";
    return; // Partido terminado
  }
  if (setsWonB === 2) {
    state.winnerSide = "b";
    return; // Partido terminado
  }

  // 3. Iniciar Nuevo Set
  state.currentSet = { a: 0, b: 0 };
  state.currentGame = { a: "0", b: "0" };
  state.isTieBreak = false;
}
