/**
 * █ [UTILS] :: PADEL_SCORING_ENGINE
 * =====================================================================
 * DESC:   Lógica PURA de puntuación de Pádel.
 *         Entrada: Estado Actual + Acción -> Salida: Siguiente Estado.
 *         Sigue reglas oficiales (World Padel Tour / Premier Padel).
 * STATUS: GOLD MASTER
 * =====================================================================
 */
import type {
  MatchSnapshot,
  PointOutcome,
  PointMethod,
} from "../types/padel.ts";

export class PadelEngine {
  /**
   * [CONST] -> Mapa de progresión de puntos estándar
   */
  private static readonly NEXT_POINT: Record<string, string> = {
    "0": "15",
    "15": "30",
    "30": "40",
  };

  /**
   * ◼️ FUNCTION: PROCESS_POINT
   * ---------------------------------------------------------
   * Función Pura Principal. Calcula el futuro del partido.
   * NO muta la entrada directamente (crea copia superficial).
   */
  public static processPoint(
    current: MatchSnapshot,
    winnerSide: "pair_a" | "pair_b",
    method: PointMethod,
    // [METADATA] -> Pasamanos para el historial
    stroke?: import("../types/padel.ts").PadelStroke,
    isNetPoint?: boolean,
  ): PointOutcome {
    // 1. INMUTABILIDAD -> Deep Copy (o al menos shallow suficiente)
    const next: MatchSnapshot = { ...current };

    // [GUARD] -> No se puede anotar si ya terminó
    if (next.winnerSide) {
      throw new Error("Match is already finished");
    }

    // 2. ANALISIS PREVIO -> Calcular flags estadísticos
    // (Ej: ¿Era bola de break antes de este punto?)
    const flags = this.calculateFlags(current);

    const otherSide = winnerSide === "pair_a" ? "pair_b" : "pair_a";

    // 3. LOGICA CORE
    if (next.isTieBreak) {
      this.applyTieBreakLogic(next, winnerSide, otherSide);
    } else {
      this.applyStandardGameLogic(next, winnerSide, otherSide);
    }

    // 4. CHECK EVENTOS MAYORES (Set / Match Win)
    let setCompleted = undefined;
    if (this.hasWonSet(next, winnerSide)) {
      setCompleted = {
        setNumber: next.currentSetIdx,
        pairAGames: next.pairAGames,
        pairBGames: next.pairBGames,
        tieBreakPairAPoints: next.isTieBreak
          ? parseInt(next.pairAScore)
          : undefined,
        tieBreakPairBPoints: next.isTieBreak
          ? parseInt(next.pairBScore)
          : undefined,
      };

      // Finalizar Set -> Verificar si ganamos el partido
      if (this.checkMatchWin(next, winnerSide)) {
        next.winnerSide = winnerSide;
        next.status = "finished";
      } else {
        // [RESET] -> Preparar siguiente set
        next.currentSetIdx++;
        next.pairAGames = 0;
        next.pairBGames = 0;
        next.pairAScore = "0";
        next.pairBScore = "0";
        next.isTieBreak = false;
      }
    }

    // 5. CONSTRUCCION RESULTADO
    return {
      nextSnapshot: next,
      history: {
        setNumber: current.currentSetIdx,
        gameNumber: current.pairAGames + current.pairBGames + 1,
        pointNumber: 0, // Asignado por DB usualmente
        winnerSide,
        method,
        stroke,
        isNetPoint,
        scoreAfterPairA: next.pairAScore,
        scoreAfterPairB: next.pairBScore,
        isGamePoint: flags.isGamePoint,
        isSetPoint: flags.isSetPoint,
        isMatchPoint: flags.isMatchPoint,
      },
      setCompleted,
    };
  }

  // =========================================================================
  // █ INTERNAL LOGIC
  // =========================================================================

  private static applyStandardGameLogic(
    state: MatchSnapshot,
    scorer: "pair_a" | "pair_b",
    receiver: "pair_a" | "pair_b",
  ) {
    const scoreScorer =
      scorer === "pair_a" ? state.pairAScore : state.pairBScore;
    const scoreReceiver =
      receiver === "pair_a" ? state.pairAScore : state.pairBScore;

    // [GOLDEN POINT] -> Punto de Oro (Sin Ventajas)
    // Si estamos en 40-40, el siguiente punto gana el juego.
    const isDeuce = scoreScorer === "40" && scoreReceiver === "40";

    if (state.hasGoldPoint && isDeuce) {
      this.winGame(state, scorer);
      return;
    }

    // [DEUCE STANDAR] -> Ventaja
    if (!state.hasGoldPoint) {
      if (isDeuce) {
        this.setScore(state, scorer, "AD");
        return;
      }
      if (scoreScorer === "AD") {
        this.winGame(state, scorer);
        return;
      }
      if (scoreReceiver === "AD") {
        // [RECUPERACION] -> El rival tenía ventaja, volvemos a 40 iguales
        this.setScore(state, receiver, "40");
        return;
      }
    }

    // [NORMAL POINT] -> 0, 15, 30, 40
    if (scoreScorer === "40") {
      this.winGame(state, scorer);
      return;
    }

    this.setScore(state, scorer, this.NEXT_POINT[scoreScorer] || "40");
  }

  private static applyTieBreakLogic(
    state: MatchSnapshot,
    scorer: "pair_a" | "pair_b",
    receiver: "pair_a" | "pair_b",
  ) {
    // En Tie-break los puntos son enteros simples
    const currentPoints =
      parseInt(scorer === "pair_a" ? state.pairAScore : state.pairBScore) || 0;
    this.setScore(state, scorer, (currentPoints + 1).toString());
  }

  private static winGame(state: MatchSnapshot, side: "pair_a" | "pair_b") {
    state.pairAScore = "0";
    state.pairBScore = "0";

    if (side === "pair_a") state.pairAGames++;
    else state.pairBGames++;

    // [TRIGGER] -> Tie-Break al 6-6
    if (state.pairAGames === 6 && state.pairBGames === 6) {
      state.isTieBreak = true;
    }
  }

  private static setScore(
    state: MatchSnapshot,
    side: "pair_a" | "pair_b",
    val: string,
  ) {
    if (side === "pair_a") state.pairAScore = val;
    else state.pairBScore = val;
  }

  private static hasWonSet(
    state: MatchSnapshot,
    side: "pair_a" | "pair_b",
  ): boolean {
    const gamesA = state.pairAGames;
    const gamesB = state.pairBGames;

    if (state.isTieBreak) {
      const pA = parseInt(state.pairAScore);
      const pB = parseInt(state.pairBScore);
      const diff = Math.abs(pA - pB);
      // Tie break a 7, diferencia de 2
      if (side === "pair_a" && pA >= 7 && diff >= 2) return true;
      if (side === "pair_b" && pB >= 7 && diff >= 2) return true;
      return false;
    }

    // Set Estándar
    const myGames = side === "pair_a" ? gamesA : gamesB;
    const otherGames = side === "pair_a" ? gamesB : gamesA;

    // 6-0, 6-1, ... 6-4
    if (myGames === 6 && otherGames <= 4) return true;
    // 7-5 (Evita tie-break)
    if (myGames === 7 && otherGames === 5) return true;

    return false;
  }

  private static checkMatchWin(
    state: MatchSnapshot,
    side: "pair_a" | "pair_b",
  ): boolean {
    // [LIMITATION] -> Motor Stateless.
    // Solo podemos asegurar la victoria si es el 3er set.
    // Para victorias 2-0, el Controller consulta la DB (match_sets)
    // y decide si el partido acabó. Aquí devolvemos false (conservador).
    if (state.currentSetIdx === 3) return true;
    return false;
  }

  private static calculateFlags(current: MatchSnapshot) {
    // [ANALYSIS] -> Calcula isGamePoint, isSetPoint, etc.
    let isGamePoint = false;
    const sa = current.pairAScore;
    const sb = current.pairBScore;

    if (current.isTieBreak) {
      const pa = parseInt(sa) || 0;
      const pb = parseInt(sb) || 0;
      const gpA = pa >= 6 && pa - pb >= 1;
      const gpB = pb >= 6 && pb - pa >= 1;
      isGamePoint = gpA || gpB;
    } else {
      const isDeuce = sa === "40" && sb === "40";

      if (current.hasGoldPoint && isDeuce) {
        isGamePoint = true; // Siguiente punto gana
      } else {
        const gpA = (sa === "40" && sb !== "40" && sb !== "AD") || sa === "AD";
        const gpB = (sb === "40" && sa !== "40" && sa !== "AD") || sb === "AD";
        isGamePoint = gpA || gpB;
      }
    }

    let isSetPoint = false;
    let isMatchPoint = false;

    if (isGamePoint) {
      const gamesA = current.pairAGames;
      const gamesB = current.pairBGames; // Fixed: was using gamesA logic for B check implicity?

      // Aproximación simple: Si alguien tiene 5 juegos, huele a Set Point.
      if (gamesA >= 5 || gamesB >= 5) isSetPoint = true;

      // Si es Set Point y estamos en el 2do o 3er set... Huele a Match Point.
      if (isSetPoint && current.currentSetIdx >= 2) isMatchPoint = true;
    }

    return { isGamePoint, isSetPoint, isMatchPoint };
  }
}
