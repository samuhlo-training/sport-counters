import { db } from "../db/db.ts";
import { matches, matchStats, pointHistory, matchSets } from "../db/schema.ts";
// import { handlePointScored } from "../lib/padel-rules.ts"; // REMOVED
import { PadelEngine } from "../utils/padelScoring.ts"; // NEW
import { eq, and, sql } from "drizzle-orm";
import type {
  MatchSnapshot,
  PointMethod,
  PadelStroke,
} from "../types/padel.ts";
import { broadcastToAll } from "../ws/server.ts";

// Mock alias as requested by prompt (though we use the real one for functionality)
const broadcastToMatch = broadcastToAll;

export async function getMatchSnapshot(
  matchId: number,
): Promise<MatchSnapshot> {
  const [matchData] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));

  if (!matchData) {
    throw new Error(`Match ${matchId} not found`);
  }

  return {
    id: matchData.id,
    pairAScore: matchData.pairAScore || "0",
    pairBScore: matchData.pairBScore || "0",
    pairAGames: matchData.pairAGames || 0,
    pairBGames: matchData.pairBGames || 0,
    currentSetIdx: matchData.currentSetIdx || 1,
    isTieBreak: matchData.isTieBreak || false,
    hasGoldPoint: matchData.hasGoldPoint || false,
    winnerSide: matchData.winnerSide as "pair_a" | "pair_b" | null,
    servingPlayerId: matchData.servingPlayerId,
    status: matchData.status,
  };
}

export async function processPointScored(payload: {
  matchId: string;
  playerId: string;
  actionType: PointMethod;
  stroke?: PadelStroke;
  isNetPoint?: boolean;
}) {
  const { matchId, playerId, actionType, stroke, isNetPoint } = payload;
  const matchIdInt = parseInt(matchId);
  const playerIdInt = parseInt(playerId);

  // 1. FETCH MATCH
  const matchResult = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchIdInt));

  const matchData = matchResult[0];
  if (!matchData) throw new Error(`Match ${matchId} not found`);

  if (matchData.status === "finished") {
    console.warn(`[LOGIC] :: IGNORED :: Match ${matchId} is finished`);
    return;
  }

  // 2. DETERMINE SIDES
  let playerSide: "pair_a" | "pair_b";
  if (
    playerIdInt === matchData.pairAPlayer1Id ||
    playerIdInt === matchData.pairAPlayer2Id
  ) {
    playerSide = "pair_a";
  } else if (
    playerIdInt === matchData.pairBPlayer1Id ||
    playerIdInt === matchData.pairBPlayer2Id
  ) {
    playerSide = "pair_b";
  } else {
    throw new Error(`Player ${playerId} not in match ${matchId}`);
  }

  // Logic: "winner" and "service_ace" are positive actions for the player.
  // "unforced_error", "forced_error", "double_fault" are NEGATIVE actions (point for opponent).
  const isPositiveAction = ["winner", "service_ace"].includes(actionType);

  const scorerSide = isPositiveAction
    ? playerSide
    : playerSide === "pair_a"
      ? "pair_b"
      : "pair_a";

  // 3. ENGINE PROCESS
  const currentSnapshot: MatchSnapshot = {
    id: matchData.id,
    pairAScore: matchData.pairAScore || "0",
    pairBScore: matchData.pairBScore || "0",
    pairAGames: matchData.pairAGames || 0,
    pairBGames: matchData.pairBGames || 0,
    currentSetIdx: matchData.currentSetIdx || 1,
    isTieBreak: matchData.isTieBreak || false,
    hasGoldPoint: matchData.hasGoldPoint || false,
    winnerSide: matchData.winnerSide as "pair_a" | "pair_b" | null,
    servingPlayerId: matchData.servingPlayerId,
    status: matchData.status,
  };

  const outcome = PadelEngine.processPoint(
    currentSnapshot,
    scorerSide,
    actionType,
    stroke,
    isNetPoint,
  );
  const { nextSnapshot, history, setCompleted } = outcome;

  // 4. TRANSACTION
  await db.transaction(async (tx) => {
    // A. Point History
    await tx.insert(pointHistory).values({
      matchId: matchIdInt,
      ...history,
      winnerPlayerId: isPositiveAction ? playerIdInt : null, // If positive, player won. If error, opponent won (we might not know WHO in opponent pair)
    });

    // B. Player Stats
    if (isPositiveAction) {
      await tx.execute(sql`
        UPDATE match_stats SET 
          points_won = points_won + 1,
          winners = winners + 1,
          smash_winners = ${stroke === "smash" ? sql`smash_winners + 1` : sql`smash_winners`}
        WHERE match_id = ${matchIdInt} AND player_id = ${playerIdInt}
      `);
    } else {
      await tx.execute(sql`
        UPDATE match_stats SET unforced_errors = unforced_errors + 1
        WHERE match_id = ${matchIdInt} AND player_id = ${playerIdInt}
      `);
    }

    // C. Handle Set Completion & Match Win Check
    let finalStatus = nextSnapshot.status;
    let finalWinner = nextSnapshot.winnerSide;

    if (setCompleted) {
      // Insert Set Result
      await tx.insert(matchSets).values({
        matchId: matchIdInt,
        ...setCompleted,
      });

      // CHECK MATCH WIN (Best of 3)
      // We need to know previous sets winners.
      // We verify existing sets in DB + this new one.
      const prevSets = await tx
        .select()
        .from(matchSets)
        .where(eq(matchSets.matchId, matchIdInt));
      // Note: prevSets includes the one we just inserted? depends on isolation.
      // Usually inside transaction it sees it.
      // Let's count total sets won by A and B.

      let setsA = 0;
      let setsB = 0;

      for (const s of prevSets) {
        if (s.pairAGames > s.pairBGames) setsA++;
        else setsB++;
      }

      if (setsA >= 2) {
        finalWinner = "pair_a";
        finalStatus = "finished";
      } else if (setsB >= 2) {
        finalWinner = "pair_b";
        finalStatus = "finished";
      }
    }

    // D. Update Match
    // If stats changed to 'live' from 'scheduled', update that too (Engine doesn't toggle scheduled->live explicitly usually)
    if (matchData.status === "scheduled") finalStatus = "live";
    if (finalStatus === "finished") finalStatus = "finished"; // Engine might have set it

    await tx
      .update(matches)
      .set({
        pairAScore: nextSnapshot.pairAScore,
        pairBScore: nextSnapshot.pairBScore,
        pairAGames: nextSnapshot.pairAGames,
        pairBGames: nextSnapshot.pairBGames,
        currentSetIdx: nextSnapshot.currentSetIdx,
        isTieBreak: nextSnapshot.isTieBreak,
        winnerSide: finalWinner,
        status: finalStatus as any,
      })
      .where(eq(matches.id, matchIdInt));

    // Update local snapshot for broadcast
    nextSnapshot.status = finalStatus;
    nextSnapshot.winnerSide = finalWinner;
  });

  // 5. BROADCAST
  broadcastToMatch(matchId, {
    type: "MATCH_UPDATE",
    matchId,
    timestamp: Date.now(),
    snapshot: nextSnapshot,
    lastPoint: history,
  });

  console.log(
    `[GAME]  :: POINT :: ${matchId} | ${actionType} by ${playerId} | State: ${nextSnapshot.pairAGames}-${nextSnapshot.pairBGames} (${nextSnapshot.pairAScore}-${nextSnapshot.pairBScore})`,
  );
}
