/**
 * █ [CONTROLLER] :: MATCH_LOGIC
 * =====================================================================
 * DESC:   Controlador para manejar la lógica de estado de los partidos.
 *         Procesa eventos como "POINT_SCORED", actualiza DB y notifica.
 * STATUS: BETA
 * =====================================================================
 */
import { db } from "../db/db.ts";
import { matches, matchStats } from "../db/schema.ts";
import { handlePointScored } from "../lib/padel-rules.ts";
import { eq, and, sql } from "drizzle-orm";
import type { MatchState } from "../types/padel.ts";
import { broadcastToAll } from "../ws/server.ts";

export async function processPointScored(payload: {
  matchId: string;
  playerId: string;
  actionType: "winner" | "unforced_error" | "forced_error" | "standard";
}) {
  const { matchId, playerId, actionType } = payload;
  const matchIdInt = parseInt(matchId);

  // 1. FETCH MATCH & PLAYERS
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchIdInt));

  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  if (match.status === "finished") {
    console.warn(
      `[LOGIC] :: IGNORED :: Point scored on finished match ${matchId}`,
    );
    return;
  }

  // 2. DETERMINE SIDES
  const p1 = match.player1Id;
  const p2 = match.player2Id;
  const p3 = match.player3Id;
  const p4 = match.player4Id;
  const playerIdInt = parseInt(playerId);

  let playerSide: "a" | "b";
  if (playerIdInt === p1 || playerIdInt === p2) {
    playerSide = "a";
  } else if (playerIdInt === p3 || playerIdInt === p4) {
    playerSide = "b";
  } else {
    throw new Error(`Player ${playerId} not in match ${matchId}`);
  }

  // 3. DETERMINE WHO SCORED (SCORER SIDE)
  let scorerSide: "a" | "b";

  if (actionType === "unforced_error") {
    // Si es error no forzado, el punto es para el RIVAL
    scorerSide = playerSide === "a" ? "b" : "a";
  } else {
    // Winner, Forced Error (provocado), Standard -> El punto es para MI equipo
    scorerSide = playerSide;
  }

  // 4. CALCULATE NEW STATE (Pure Function)
  // Casting parcial porque DB JSONB puede no coincidir exacto con TS interface runtime
  const currentState = match.matchState as unknown as MatchState;
  const nextState = handlePointScored(currentState, scorerSide);

  // 5. UPDATE DB (TRANSACTION)
  await db.transaction(async (tx) => {
    // A. Update Match State & Status
    let newStatus = match.status;
    if (nextState.winnerSide) {
      newStatus = "finished";
    } else if (match.status === "scheduled") {
      newStatus = "live";
    }

    await tx
      .update(matches)
      .set({
        matchState: nextState,
        status: newStatus,
        // updatedAt removed as it doesn't exist in matches table
      })
      .where(eq(matches.id, matchIdInt));

    // B. Update Player Stats (Granular)
    // Solo actualizamos stats si fue winner o unforced_error
    if (actionType === "winner") {
      await tx
        .update(matchStats)
        .set({
          winners: sql`${matchStats.winners} + 1`,
          pointsWon: sql`${matchStats.pointsWon} + 1`,
        })
        .where(
          and(
            eq(matchStats.matchId, matchIdInt),
            eq(matchStats.playerId, playerIdInt),
          ),
        );
    } else if (actionType === "unforced_error") {
      await tx
        .update(matchStats)
        .set({
          unforcedErrors: sql`${matchStats.unforcedErrors} + 1`,
        })
        .where(
          and(
            eq(matchStats.matchId, matchIdInt),
            eq(matchStats.playerId, playerIdInt),
          ),
        );
    }
    // TODO: Track "Points Won" for the team/indiv generally?
    // Por ahora solo winners e I.E. explícitos.
  });

  // 6. BROADCAST UPDATE
  // Enviamos el estado completo para que los clientes se sincronicen
  const updatePayload = {
    type: "MATCH_UPDATE",
    matchId,
    timestamp: Date.now(),
    state: nextState,
    lastAction: {
      playerId,
      actionType,
      scorerSide,
    },
  };

  // Usamos el canal global o específico?
  // server.ts helpers: broadcastToMatch(matchId, payload)
  // Pero processPointScored está en otro archivo.
  // Necesito importar `broadcastToAll` o `serverRef`.
  // Mejor usamos `broadcastToAll("match:" + matchId)` si usamos canales específicos.
  // En server.ts: `socket.subscribe(matchId)`.
  // Así que publicamos al topic `matchId`.

  broadcastToAll(matchId, updatePayload);

  // También enviamos al global para dashboards? Quizás reducido.
  // Por ahora solo al match room.

  console.log(
    `[GAME]  :: POINT_PROCESSED :: Match ${matchId} | Action ${actionType} by ${playerId} | Score ${JSON.stringify(nextState.currentGame)}`,
  );
}
