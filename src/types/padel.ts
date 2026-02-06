/**
 * █ [DOMAIN] :: PADEL_TYPES
 * =====================================================================
 * DESC:   Tipos de dominio para la lógica de Padel (Score, State, Entities).
 * STATUS: GOLD MASTER
 * =====================================================================
 */

// 1. SCORING TYPES
// ---------------------------------------------------------------------
export type PadelPoint = "0" | "15" | "30" | "40" | "AD";
export type TieBreakPoint = number;

export type PointMethod =
  | "winner"
  | "unforced_error"
  | "forced_error"
  | "smash"
  | "volley"
  | "service_ace"
  | "double_fault"
  | "penalty";

// 2. STATE SNAPSHOT (Matches what comes from DB)
// ---------------------------------------------------------------------
export interface MatchSnapshot {
  id: number;
  // Score
  pairAScore: string; // "0", "15", "40", "AD", or "7" (in tiebreak)
  pairBScore: string;
  pairAGames: number;
  pairBGames: number;
  currentSetIdx: number; // 1, 2, 3
  isTieBreak: boolean;
  hasGoldPoint: boolean; // Future proofing
  winnerSide?: "pair_a" | "pair_b" | null; // null if live

  // Serving
  servingPlayerId?: number | null;
}

// 3. RULE ENGINE OUTPUT (Result of processing a point)
// ---------------------------------------------------------------------
export interface PointOutcome {
  // New State to persist to 'matches'
  nextSnapshot: MatchSnapshot;

  // Data for 'point_history'
  history: {
    setNumber: number;
    gameNumber: number;
    pointNumber: number; // Calculated by DB count + 1 normally, logic needs to handle this
    winnerSide: "pair_a" | "pair_b";
    method: PointMethod;
    scoreAfterPairA: string;
    scoreAfterPairB: string;
    isGamePoint: boolean;
    isSetPoint: boolean;
    isMatchPoint: boolean;
  };

  // Data for 'match_sets' (Only if set finished)
  setCompleted?: {
    setNumber: number;
    pairAGames: number;
    pairBGames: number;
    tieBreakPairAPoints?: number;
    tieBreakPairBPoints?: number;
  };
}

// 4. ENTITIES
// ---------------------------------------------------------------------
export interface Player {
  id: number;
  name: string;
}
