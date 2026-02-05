import { describe, it, expect, beforeAll } from "bun:test";

const BASE_URL = "http://localhost:8000";

describe("POST /commentary/:id", () => {
  let matchId: number;

  beforeAll(async () => {
    // Create a match first to get a valid ID
    const matchPayload = {
      sport: "football",
      homeTeam: "Test Home",
      awayTeam: "Test Away",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 90 mins later
    };

    const response = await fetch(`${BASE_URL}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchPayload),
    });

    const json = (await response.json()) as any;
    if (!response.ok) {
      console.error("Failed to create match:", json);
      throw new Error("Could not create match for testing");
    }
    matchId = json.data.id;
    console.log(`Created test match with ID: ${matchId}`);
  });

  it("should successfully create a commentary", async () => {
    const payload = {
      minute: 15,
      sequence: 1,
      period: "1H",
      eventType: "GOAL",
      actor: "Player 10",
      team: "home",
      message: "Goal by Player 10!",
      metadata: { distance: "20m" },
      tags: ["goal", "highlight"],
    };

    const response = await fetch(`${BASE_URL}/commentary/${matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = (await response.json()) as any;
    console.log("Create Commentary Response:", json);

    expect(response.status).toBe(201);
    expect(json.data).toBeDefined();
    expect(json.data.matchId).toBe(matchId);
    expect(json.data.message).toBe(payload.message);
  });

  it("should fail with invalid match ID validation", async () => {
    const response = await fetch(`${BASE_URL}/commentary/invalid-id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it("should fail with invalid body", async () => {
    const response = await fetch(`${BASE_URL}/commentary/${matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minute: -1, // Invalid
        message: "", // Empty
      }),
    });
    expect(response.status).toBe(400);
  });
});

describe("GET /commentary/:id", () => {
  let matchId: number; // Declare matchId here for this describe block

  beforeAll(async () => {
    // Create a match first to get a valid ID for GET tests
    const matchPayload = {
      sport: "football",
      homeTeam: "GET Test Home",
      awayTeam: "GET Test Away",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 90 mins later
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
    console.log(`Created test match for GET with ID: ${matchId}`);

    // Create initial commentary
    await fetch(`${BASE_URL}/commentary/${matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minute: 15,
        sequence: 1,
        period: "1H",
        eventType: "GOAL",
        actor: "Player 10",
        team: "home",
        message: "Goal by Player 10!",
        metadata: { distance: "20m" },
        tags: ["goal", "highlight"],
      }),
    });

    // Create another commentary to test ordering
    await fetch(`${BASE_URL}/commentary/${matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minute: 20,
        sequence: 2,
        period: "1H",
        eventType: "CARD",
        message: "Yellow card",
      }),
    });
  });

  it("should retrieve commentary for a match", async () => {
    const response = await fetch(`${BASE_URL}/commentary/${matchId}`);
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.data).toBeArray();
    expect(json.data.length).toBeGreaterThanOrEqual(1);
  });

  it("should order commentary by newest first", async () => {
    const response = await fetch(`${BASE_URL}/commentary/${matchId}`);
    const json = (await response.json()) as any;
    const data = json.data;

    if (data.length >= 2) {
      const first = new Date(data[0].createdAt).getTime();
      const second = new Date(data[1].createdAt).getTime();
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });

  it("should respect the limit parameter", async () => {
    const response = await fetch(`${BASE_URL}/commentary/${matchId}?limit=1`);
    const json = (await response.json()) as any;

    expect(json.data.length).toBe(1);
  });
});
