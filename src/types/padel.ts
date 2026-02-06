/**
 * █ [DOMAIN] :: PADEL_TYPES
 * =====================================================================
 * DESC:   Tipos de dominio para la lógica de Padel (Score, State, Entities).
 * STATUS: STABLE
 * =====================================================================
 */

// 1. SCORING TYPES
// ---------------------------------------------------------------------
export type PadelPoint = "0" | "15" | "30" | "40" | "AD";
export type TieBreakPoint = number; // 0, 1, 2, 3...

export interface GameScore {
  // En un juego normal: "0", "15", "30", "40", "AD"
  // En tie-break: "0", "1", "2"... (como strings para consistencia o numbers)
  // Vamos a usar strings para persistencia fácil en JSONB, pero lógica interna numérica en TB.
  a: string;
  b: string;
}

export interface SetScore {
  a: number; // Juegos ganados por Pareja A
  b: number; // Juegos ganados por Pareja B
}

// 2. STATE MACHINE
// ---------------------------------------------------------------------
export interface MatchState {
  sets: SetScore[]; // Sets terminados (ej: [{a:6, b:4}])
  currentSet: SetScore; // Set actual (ej: {a:2, b:3})
  currentGame: GameScore; // Juego actual (ej: {a:"15", b:"30"})
  isTieBreak: boolean; // Flag para saber si estamos en desempate

  // Helpers para saber quién ganó
  winnerSide?: "a" | "b"; // Presente solo si el partido terminó
}

// 3. ENTITIES
// ---------------------------------------------------------------------
export interface Player {
  id: number;
  name: string;
}

export interface Pair {
  player1: Player;
  player2: Player;
}

export interface MatchConfig {
  player1Id: number;
  player2Id: number;
  player3Id: number;
  player4Id: number;
  sport: "padel";
}
