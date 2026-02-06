import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../src/db/db";
import { matches, players, matchStats } from "../src/db/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";

describe("WebSocket Bi-Directional Flow", () => {
  let matchId: number;
  let p1Id: number;
  let ws: WebSocket;

  beforeAll(async () => {
    // 1. Create Players
    const newPlayers = await db
      .insert(players)
      .values([{ name: "BiDir P1" }, { name: "BiDir P2" }])
      .returning();
    const [p1, p2] = newPlayers;
    p1Id = p1.id;

    // 2. Create Match
    const [match] = await db
      .insert(matches)
      .values({
        pairAName: "BiDir Pair A",
        pairBName: "BiDir Pair B",
        pairAPlayer1Id: p1.id,
        pairAPlayer2Id: p2.id,
        pairBPlayer1Id: p1.id, // Reuse for simplicity
        pairBPlayer2Id: p2.id, // Reuse for simplicity
        status: "live",
        startTime: new Date(),
      })
      .returning();
    matchId = match.id;

    // 3. Create Stats for P1
    await db.insert(matchStats).values({
      matchId,
      playerId: p1Id,
      pointsWon: 10,
      winners: 5,
      unforcedErrors: 2,
      smashWinners: 3,
    });

    console.log(`Created Match ${matchId} for BiDir test`);
  });

  afterAll(() => {
    if (ws) ws.close();
  });

  it("should handle REQUEST_STATS for MATCH_SUMMARY and PLAYER", (done) => {
    ws = new WebSocket(WS_URL);

    let step = 0;

    ws.onopen = () => {
      console.log("WS Connected. Step 0: Request MATCH_SUMMARY");
      ws.send(
        JSON.stringify({
          type: "REQUEST_STATS",
          matchId: matchId.toString(),
          subtype: "MATCH_SUMMARY",
        }),
      );
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      console.log("WS Message Received:", msg.type);

      if (msg.type === "STATS_RESPONSE") {
        try {
          if (step === 0) {
            // Verify MATCH_SUMMARY
            console.log("Verifying MATCH_SUMMARY...");
            expect(msg.subtype).toBe("MATCH_SUMMARY");
            expect(msg.matchId).toBe(String(matchId));
            expect(msg.data.status).toBe("live");
            expect(msg.data.currentScore).toBeDefined();

            // Next Step: Request PLAYER Stats
            step = 1;
            console.log("Step 1: Request PLAYER Stats");
            ws.send(
              JSON.stringify({
                type: "REQUEST_STATS",
                matchId: matchId.toString(),
                subtype: "PLAYER",
                playerId: p1Id.toString(),
              }),
            );
          } else if (step === 1) {
            // Verify PLAYER Stats
            console.log("Verifying PLAYER Stats...");
            expect(msg.subtype).toBe("PLAYER");
            expect(msg.data.pointsWon).toBe(10);
            expect(msg.data.winners).toBe(5);
            expect(msg.data.smashWinners).toBe(3);

            console.log("All steps passed!");
            done();
          }
        } catch (e) {
          done(e);
        }
      } else if (msg.type === "WELCOME") {
        // Ignore welcome
      } else {
        // Unexpected message
        console.warn("Unexpected message:", msg);
      }
    };
  });
});
