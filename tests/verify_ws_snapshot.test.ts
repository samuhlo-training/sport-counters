import { describe, it, expect, beforeAll } from "bun:test";
import { db } from "../src/db/db";
import { players } from "../src/db/schema";

const BASE_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";

describe("WebSocket Snapshot Verification", () => {
  let matchId: number;
  let ws: WebSocket;

  beforeAll(async () => {
    // 1. Create Players
    const newPlayers = await db
      .insert(players)
      .values([
        { name: "WS P1" },
        { name: "WS P2" },
        { name: "WS P3" },
        { name: "WS P4" },
      ])
      .returning();

    const [p1, p2, p3, p4] = newPlayers;
    if (!p1 || !p2 || !p3 || !p4) {
      throw new Error("Failed to create test players");
    }

    // 2. Create Match
    const matchPayload = {
      matchType: "competitive",
      pairAName: "WS Pair A",
      pairBName: "WS Pair B",
      pairAPlayer1Id: p1.id,
      pairAPlayer2Id: p2.id,
      pairBPlayer1Id: p3.id,
      pairBPlayer2Id: p4.id,
      startTime: new Date().toISOString(),
    };

    const response = await fetch(`${BASE_URL}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchPayload),
    });

    const json = (await response.json()) as any;
    if (!response.ok) throw new Error("Match creation failed");
    matchId = json.data.id;
    console.log(`Created Match ${matchId} for WS test`);
  });

  it("should receive MATCH_UPDATE snapshot on SUBSCRIBE", (done) => {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("WS Connected, sending SUBSCRIBE...");
      ws.send(JSON.stringify({ type: "SUBSCRIBE", matchId }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      console.log("WS Message:", msg.type);

      if (msg.type === "MATCH_UPDATE") {
        try {
          expect(msg.matchId).toBe(String(matchId));
          expect(msg.snapshot).toBeDefined();
          expect(msg.snapshot.pairAScore).toBe("0");
          ws.close();
          done();
        } catch (e) {
          done(e);
        }
      }
    };
  });
});
