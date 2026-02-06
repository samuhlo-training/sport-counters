import { describe, it, expect, beforeAll } from "bun:test";
import { db } from "../src/db/db";
import { matches, players, matchStats, pointHistory } from "../src/db/schema";
import { processPointScored } from "../src/controllers/match";
import { eq } from "drizzle-orm";

describe("Padel Flow Verification (Gold Master)", () => {
  let matchId: number;
  let p1Id: number;
  let p2Id: number;
  let p3Id: number;
  let p4Id: number;

  beforeAll(async () => {
    // 1. CREATE PLAYERS
    const newPlayers = await db
      .insert(players)
      .values([
        { name: "Tapia" },
        { name: "Coello" },
        { name: "Galán" },
        { name: "Chingotto" },
      ])
      .returning();

    const [p1, p2, p3, p4] = newPlayers;
    if (!p1 || !p2 || !p3 || !p4) {
      throw new Error("❌ FAILURE: Could not create players");
    }

    p1Id = p1.id;
    p2Id = p2.id;
    p3Id = p3.id;
    p4Id = p4.id;

    console.log("Players created IDs:", p1Id, p2Id, p3Id, p4Id);

    // 2. CREATE MATCH (Mimic Route Logic)
    const [match] = await db
      .insert(matches)
      .values({
        pairAName: "Tapia/Coello",
        pairBName: "Galán/Chingotto",
        pairAPlayer1Id: p1Id,
        pairAPlayer2Id: p2Id,
        pairBPlayer1Id: p3Id,
        pairBPlayer2Id: p4Id,
        servingPlayerId: p1Id,
        status: "live",
      })
      .returning();

    if (!match) {
      throw new Error("❌ FAILURE: Could not create match");
    }
    matchId = match.id;

    // Init stats
    await db.insert(matchStats).values([
      { matchId, playerId: p1Id },
      { matchId, playerId: p2Id },
      { matchId, playerId: p3Id },
      { matchId, playerId: p4Id },
    ]);

    console.log("Match created ID:", matchId);
  });

  it("should process points correctly and update match state", async () => {
    // 3. SIMULATE POINTS
    console.log("⚡ Playing some points...");

    // Point 1: Tapia Winners (15-0)
    await processPointScored({
      matchId: matchId.toString(),
      playerId: p1Id.toString(),
      actionType: "winner",
    });

    // Point 2: Coello Smash (30-0)
    await processPointScored({
      matchId: matchId.toString(),
      playerId: p2Id.toString(),
      actionType: "smash",
    });

    // Point 3: Galan Unforced Error (40-0) -> Point for A
    await processPointScored({
      matchId: matchId.toString(),
      playerId: p3Id.toString(), // Galan commits error
      actionType: "unforced_error",
    });

    // Point 4: Tapia Winner (GAME A)
    await processPointScored({
      matchId: matchId.toString(),
      playerId: p1Id.toString(),
      actionType: "winner",
    });

    // 4. VERIFY DB STATE
    // Check Match Snapshot
    const [updatedMatch] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));

    if (!updatedMatch) throw new Error("Match not found");

    expect(updatedMatch.pairAGames).toBe(1);
    expect(updatedMatch.pairBGames).toBe(0);
    expect(updatedMatch.pairAScore).toBe("0");
    expect(updatedMatch.pairBScore).toBe("0");

    console.log("Match Snapshot Verified:", {
      score: `${updatedMatch.pairAScore}-${updatedMatch.pairBScore}`,
      games: `${updatedMatch.pairAGames}-${updatedMatch.pairBGames}`,
    });
  });

  it("should record point history correctly", async () => {
    const history = await db
      .select()
      .from(pointHistory)
      .where(eq(pointHistory.matchId, matchId));

    expect(history.length).toBe(4);

    const lastPoint = history[history.length - 1];
    if (!lastPoint) throw new Error("History is empty");

    expect(lastPoint.scoreAfterPairA).toBe("0");
    expect(lastPoint.isGamePoint).toBe(true);
  });

  it("should update player stats correctly", async () => {
    const statsP1 = await db
      .select()
      .from(matchStats)
      .where(eq(matchStats.playerId, p1Id));

    const p1Stats = statsP1[0];
    if (!p1Stats) throw new Error("Stats not found for P1");

    expect(p1Stats.winners).toBe(2);
    expect(p1Stats.pointsWon).toBe(2);

    console.log("Stats P1 Verified:", p1Stats);
  });
});
