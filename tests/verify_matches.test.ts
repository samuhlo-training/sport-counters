import { describe, it, expect, beforeAll } from "bun:test";
import { db } from "../src/db/db";
import { matches, players } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Match CRUD Verification", () => {
  let p1Id: number;
  let p2Id: number;
  let p3Id: number;
  let p4Id: number;

  beforeAll(async () => {
    // 1. Create Players
    const newPlayers = await db
      .insert(players)
      .values([
        { name: "Sanyo" },
        { name: "Momo" },
        { name: "Bela" },
        { name: "Tello" },
      ])
      .returning();

    const [p1, p2, p3, p4] = newPlayers;
    if (!p1 || !p2 || !p3 || !p4) throw new Error("Could not create players");

    p1Id = p1.id;
    p2Id = p2.id;
    p3Id = p3.id;
    p4Id = p4.id;
  });

  it("should create a new match with correct initial state", async () => {
    const [newMatch] = await db
      .insert(matches)
      .values({
        pairAName: "Sanyo/Momo",
        pairBName: "Bela/Tello",
        pairAPlayer1Id: p1Id,
        pairAPlayer2Id: p2Id,
        pairBPlayer1Id: p3Id,
        pairBPlayer2Id: p4Id,
        servingPlayerId: p1Id,
        status: "scheduled",
      })
      .returning();

    expect(newMatch).toBeDefined();
    expect(newMatch.status).toBe("scheduled");
    expect(newMatch.pairAGames).toBe(0);
    expect(newMatch.pairBGames).toBe(0);
    expect(newMatch.pairAScore).toBe("0");
    expect(newMatch.pairBScore).toBe("0");
    expect(newMatch.pairAName).toBe("Sanyo/Momo");
  });

  it("should retrieve a match by ID", async () => {
    // Insert another match
    const [created] = await db
      .insert(matches)
      .values({
        pairAName: "Test A",
        pairBName: "Test B",
        pairAPlayer1Id: p1Id,
        pairAPlayer2Id: p2Id,
        pairBPlayer1Id: p3Id,
        pairBPlayer2Id: p4Id,
        servingPlayerId: p1Id,
        status: "live",
      })
      .returning();

    if (!created) throw new Error("Setup failed");

    const [fetched] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, created.id));

    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(created.id);
    expect(fetched.status).toBe("live");
  });

  it("should update match status", async () => {
    // Insert match
    const [match] = await db
      .insert(matches)
      .values({
        pairAName: "To Finish",
        pairBName: "To Finish",
        pairAPlayer1Id: p1Id,
        pairAPlayer2Id: p2Id,
        pairBPlayer1Id: p3Id,
        pairBPlayer2Id: p4Id,
        servingPlayerId: p1Id,
        status: "live",
      })
      .returning();

    if (!match) throw new Error("Setup failed");

    // Update
    const [updated] = await db
      .update(matches)
      .set({ status: "finished", winnerSide: "pair_a" })
      .where(eq(matches.id, match.id))
      .returning();

    expect(updated).toBeDefined();
    expect(updated.status).toBe("finished");
    expect(updated.winnerSide).toBe("pair_a");
  });
});
