import { db } from "../src/db/db";
import { matches, players, matchStats } from "../src/db/schema";
import { processPointScored } from "../src/controllers/match";
import { eq } from "drizzle-orm";

async function verifyPadelFlow() {
  console.log("▶️ STARTING PADEL FLOW VERIFICATION");

  // 1. SETUP: Create Players
  console.log("   [SETUP] Creating Players...");
  const [p1] = await db.insert(players).values({ name: "Galán" }).returning();
  const [p2] = await db
    .insert(players)
    .values({ name: "Chingotto" })
    .returning();
  const [p3] = await db.insert(players).values({ name: "Tapia" }).returning();
  const [p4] = await db.insert(players).values({ name: "Coello" }).returning();

  console.log(
    `   [SETUP] Players Created: ${p1.name}, ${p2.name} vs ${p3.name}, ${p4.name}`,
  );

  // 2. SETUP: Create Match
  console.log("   [SETUP] Creating Match...");
  const [match] = await db
    .insert(matches)
    .values({
      sport: "padel",
      homeTeamName: "Galán/Chingotto",
      awayTeamName: "Tapia/Coello",
      player1Id: p1.id,
      player2Id: p2.id,
      player3Id: p3.id,
      player4Id: p4.id,
      matchState: {
        sets: [],
        currentSet: { a: 0, b: 0 },
        currentGame: { a: "0", b: "0" },
        isTieBreak: false,
      },
      status: "live",
      currentServerId: p1.id,
      startTime: new Date(),
    })
    .returning();

  // Initialize Stats
  const baseStats = {
    matchId: match.id,
    pointsWon: 0,
    winners: 0,
    unforcedErrors: 0,
  };
  await db.insert(matchStats).values([
    { ...baseStats, playerId: p1.id },
    { ...baseStats, playerId: p2.id },
    { ...baseStats, playerId: p3.id },
    { ...baseStats, playerId: p4.id },
  ]);

  console.log(`   [SETUP] Match Created: ID ${match.id}`);

  // 3. GAME UPDATE: P1 Scores Winner (0-0 -> 15-0)
  console.log("   [ACTION] P1 Hit Winner -> Score 15-0...");
  await processPointScored({
    matchId: String(match.id),
    playerId: String(p1.id),
    actionType: "winner",
  });

  // Verify State
  let updatedMatch = await db.query.matches.findFirst({
    where: eq(matches.id, match.id),
  });
  let state = updatedMatch?.matchState as any;
  console.log(`   [CHECK] Current Score: ${JSON.stringify(state.currentGame)}`);

  if (state.currentGame.a === "15" && state.currentGame.b === "0") {
    console.log("   ✅ Score updated correctly to 15-0");
  } else {
    console.error("   ❌ Score UPDATE FAILED");
  }

  // Verify Stats P1
  let p1Stats = await db.query.matchStats.findFirst({
    where: (stats, { and, eq }) =>
      and(eq(stats.matchId, match.id), eq(stats.playerId, p1.id)),
  });
  if (p1Stats?.winners === 1 && p1Stats?.pointsWon === 1) {
    console.log("   ✅ P1 Stats updated correctly (Winner +1, Points +1)");
  } else {
    console.error(
      `   ❌ P1 Stats FAILED: Winners=${p1Stats?.winners}, Points=${p1Stats?.pointsWon}`,
    );
  }

  // 4. GAME UPDATE: P3 Unforced Error (15-0 -> 30-0)
  // Error de P3 (Side B) -> Punto para Side A
  console.log("   [ACTION] P3 Unforced Error -> Score 30-0...");
  await processPointScored({
    matchId: String(match.id),
    playerId: String(p3.id),
    actionType: "unforced_error",
  });

  updatedMatch = await db.query.matches.findFirst({
    where: eq(matches.id, match.id),
  });
  state = updatedMatch?.matchState as any;
  console.log(`   [CHECK] Current Score: ${JSON.stringify(state.currentGame)}`);

  if (state.currentGame.a === "30" && state.currentGame.b === "0") {
    console.log("   ✅ Logic Correct: P3 Error gave point to Side A (30-0)");
  } else {
    console.error(
      `   ❌ Logic FAILED. Expected 30-0, got ${JSON.stringify(state.currentGame)}`,
    );
  }

  // Verify Stats P3
  let p3Stats = await db.query.matchStats.findFirst({
    where: (stats, { and, eq }) =>
      and(eq(stats.matchId, match.id), eq(stats.playerId, p3.id)),
  });
  if (p3Stats?.unforcedErrors === 1) {
    console.log("   ✅ P3 Stats updated correctly (Unforced Error +1)");
  } else {
    console.error(`   ❌ P3 Stats FAILED: UE=${p3Stats?.unforcedErrors}`);
  }

  console.log("🎉 VERIFICATION COMPLETE");
  process.exit(0);
}

verifyPadelFlow().catch(console.error);
