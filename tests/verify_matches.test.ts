import { describe, it, expect } from "bun:test";

const BASE_URL = "http://localhost:8000";

describe("POST /matches", () => {
  it("should successfully create a match", async () => {
    const payload = {
      sport: "football",
      homeTeam: "Test Home FC",
      awayTeam: "Test Away FC",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 90 mins later
    };

    const response = await fetch(`${BASE_URL}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = (await response.json()) as any;
    console.log("Create Match Response:", json);

    expect(response.status).toBe(201);
    expect(json.data).toBeDefined();
    expect(json.data.id).toBeDefined();
    expect(json.data.sport).toBe(payload.sport);
    expect(json.data.status).toBeDefined();
  });

  it("should fail validation when endTime is before startTime", async () => {
    const payload = {
      sport: "football",
      homeTeam: "Bad Time FC",
      awayTeam: "Bad Time United",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // In the past relative to start
    };

    const response = await fetch(`${BASE_URL}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Expecting 400 Bad Request
    expect(response.status).toBe(400);

    const json = (await response.json()) as any;
    console.log("Invalid Time Response:", json);
    expect(json.error).toBe("Validation failed");
  });

  it("should fail with missing required fields", async () => {
    const response = await fetch(`${BASE_URL}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: "football",
        // Missing teams and times
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe("GET /matches", () => {
  it("should retrieve a list of matches", async () => {
    const response = await fetch(`${BASE_URL}/matches`);
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.data).toBeArray();
    // Assuming we just created a match in the previous test, length should be >= 1
    expect(json.data.length).toBeGreaterThanOrEqual(1);
  });

  it("should respect the limit parameter", async () => {
    // Attempt to fetch just 1 match
    const response = await fetch(`${BASE_URL}/matches?limit=1`);
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.data).toBeArray();
    expect(json.data.length).toBeLessThanOrEqual(1);
  });

  it("should validate limit parameter type", async () => {
    const response = await fetch(`${BASE_URL}/matches?limit=invalid`);

    // Expecting 400 because validation schema expects a number
    expect(response.status).toBe(400);
  });
});
