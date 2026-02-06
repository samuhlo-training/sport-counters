import { describe, it, expect, beforeAll } from "bun:test";
import { db } from "../src/db/db";
import { matches, players } from "../src/db/schema";
import { desc, eq } from "drizzle-orm";

const BASE_URL = "http://localhost:8000";

describe("POST /commentary/:id", () => {
  let matchId: number;

  beforeAll(async () => {
    // 0. ENSURE AT LEAST ONE LIVE MATCH EXISTS
    const liveMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.status, "live"));

    if (liveMatches.length > 0) {
      console.log(
        `[TEST] ℹ️ Found ${liveMatches.length} existing LIVE matches.`,
      );
      // We'll set matchId to the first one for the single-target validation tests later
      matchId = liveMatches[0]!.id;
    } else {
      console.log("[TEST] ⚠️ No live matches found. Creating a new one...");
      // 1. Create Players directly in DB
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

      // 2. Create Match via API
      const matchPayload = {
        matchType: "competitive",
        pairAName: "Tapia/Coello",
        pairBName: "Galán/Chingotto",
        pairAPlayer1Id: p1!.id,
        pairAPlayer2Id: p2!.id,
        pairBPlayer1Id: p3!.id,
        pairBPlayer2Id: p4!.id,
        servingPlayerId: p1!.id,
        status: "live", // Ensure created match is live
        startTime: new Date().toISOString(),
      };

      const response = await fetch(`${BASE_URL}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchPayload),
      });

      const json = (await response.json()) as any;
      if (!response.ok) {
        throw new Error("Could not create match for testing");
      }
      matchId = json.data.id;
      console.log(`[TEST] ✅ Created Fresh Padel Match ID: ${matchId}`);
    }
  });

  it("should broadcast commentary to ALL live matches", async () => {
    // Get fresh list of all live matches
    const allLiveMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.status, "live"));

    console.log(
      `[TEST] 📡 Broadcasting comments to ${allLiveMatches.length} matches...`,
    );

    const payload = {
      setNumber: 1,
      gameNumber: 4,
      message: `¡Comentario de prueba automático! [${new Date().toLocaleTimeString()}]`,
      tags: ["broadcast", "test"],
    };

    // Iterate and send comment to EACH match
    for (const match of allLiveMatches) {
      const response = await fetch(
        `${BASE_URL}/matches/${match.id}/commentary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const json = (await response.json()) as any;
      expect(response.status).toBe(201);
      expect(json.data.matchId).toBe(match.id);

      console.log(`   -> ✉️ Sent comment to Match ${match.id}`);
    }

    expect(allLiveMatches.length).toBeGreaterThan(0);
  });

  it("should fail with invalid match ID validation", async () => {
    const response = await fetch(`${BASE_URL}/matches/invalid-id/commentary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it("should fail with invalid body", async () => {
    const response = await fetch(`${BASE_URL}/matches/${matchId}/commentary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "", // Empty message
      }),
    });
    expect(response.status).toBe(400);
  });
});

describe("GET /commentary/:id", () => {
  let matchId: number;

  beforeAll(async () => {
    // 1. Create Players (Reuse logic or create new ones)
    const newPlayers = await db
      .insert(players)
      .values([
        { name: "Lebrón" },
        { name: "Paquito" },
        { name: "Stupa" },
        { name: "Di Nenno" },
      ])
      .returning();
    const [p1, p2, p3, p4] = newPlayers;

    // 2. Create Match
    const matchPayload = {
      sport: "padel",
      pairAName: "Lebrón/Paquito",
      pairBName: "Superpibes",
      pairAPlayer1Id: p1!.id,
      pairAPlayer2Id: p2!.id,
      pairBPlayer1Id: p3!.id,
      pairBPlayer2Id: p4!.id,
      startTime: new Date().toISOString(),
    };

    const response = await fetch(`${BASE_URL}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchPayload),
    });

    const json = (await response.json()) as any;
    if (!response.ok) {
      console.error("Failed to create match for GET tests:", json);
      throw new Error("Could not create match for GET testing");
    }
    matchId = json.data.id;

    // 3. Create Initial Commentaries (Padel Context)
    await fetch(`${BASE_URL}/matches/${matchId}/commentary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setNumber: 1,
        gameNumber: 1,
        message: "Arranca el partido en la pista central de Roland Garros.",
        tags: ["start", "intro"],
      }),
    });

    // Add a slight delay to ensure timestamp diff
    await new Promise((r) => setTimeout(r, 100));

    await fetch(`${BASE_URL}/matches/${matchId}/commentary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setNumber: 1,
        gameNumber: 2,
        message: "¡Volea ganadora de Lebrón al rincón! Break temprano.",
        tags: ["break", "winner"],
      }),
    });
  });

  it("should retrieve commentary for a match", async () => {
    const response = await fetch(`${BASE_URL}/matches/${matchId}/commentary`);
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.data).toBeArray();
    expect(json.data.length).toBeGreaterThanOrEqual(2);
  });

  it("should order commentary by newest first", async () => {
    const response = await fetch(`${BASE_URL}/matches/${matchId}/commentary`);
    const json = (await response.json()) as any;
    const data = json.data;

    if (data.length >= 2) {
      const first = new Date(data[0].createdAt).getTime();
      const second = new Date(data[1].createdAt).getTime();
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });

  it("should respect the limit parameter", async () => {
    const response = await fetch(
      `${BASE_URL}/matches/${matchId}/commentary?limit=1`,
    );
    const json = (await response.json()) as any;

    expect(json.data.length).toBe(1);
  });
});
