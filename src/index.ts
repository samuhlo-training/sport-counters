/**
 * █ [CORE] :: HTTP_ENTRY_POINT
 * =====================================================================
 * DESC:   Main entry point for Sport Counters Backend.
 *         Orchestrates Hono (Router), Bun (Server), and Upstash (Redis).
 * STATUS: STABLE
 * =====================================================================
 */
import { Hono } from "hono";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { matchesApp } from "./routes/matches.ts";
import {
  websocketHandler,
  type WebSocketData,
  setServerRef,
} from "./ws/server.ts";

// =============================================================================
// █ CONFIG: ENVIRONMENT
// =============================================================================
const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";

// =============================================================================
// █ INFRA: UPSTASH REDIS (RATE LIMITING)
// =============================================================================
// 1. CONNECTION CLIENT
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 2. LIMITER STRATEGY (SLIDING WINDOW)
// POLICY: 5 requests per 10 seconds per IP.
// WHY:    Prevent abuse of WebSocket connections.
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "10 s"),
});

// =============================================================================
// █ APP: HONO ROUTER
// =============================================================================
const app = new Hono();

// [MIDDLEWARE] -> Global Request Logger
app.use("*", async (c, next) => {
  console.log(
    `[HTTP]  :: REQ_IN        :: method: ${c.req.method} | path: ${c.req.url}`,
  );
  await next();
});

/**
 * ◼️ MIDDLEWARE: RATE LIMITER PROTECTOR
 * ---------------------------------------------------------
 * Intercepts /ws requests to enforce rate limits before upgrade.
 * Strategy: Check IP against Redis.
 */
app.use("/ws", async (c, next) => {
  // A. IDENTIFY -> Get Client IP
  // Fallback to 127.0.0.1 if localhost/headers missing
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("x-forwarded-for") ||
    "127.0.0.1";

  // B. VERIFY -> Ask Redis for permission
  const { success, remaining } = await ratelimit.limit(ip);

  // C. BLOCK -> Limit Exceeded
  if (!success) {
    console.log(`[SEC]   :: RATE_LIMIT    :: ip: ${ip} | ACTION: BLOCKED`);
    return c.text("ERROR: Rate limit exceeded. Chill out.", 429);
  }

  // D. ALLOW -> Proceed
  // [DEBUG] -> Log allowed access (Optional: comment out for production)
  // console.log(`[SEC]   :: ACCESS_OK     :: ip: ${ip} | remaining: ${remaining}`);

  await next();
});

// [ROUTES] -> Mount Sub-Apps
app.route("/matches", matchesApp);

// [HEALTH_CHECK]
app.get("/", (c) => {
  return c.json({
    status: "online",
    system: "Hono + Bun + TypeScript",
    message: "Sport Counters API is operational 🚀",
  });
});

/**
 * ◼️ ENDPOINT: WEBSOCKET HANDSHAKE
 * ---------------------------------------------------------
 * This is the final destination for /ws requests.
 * 1. Middleware has already run (Rate Limit checked).
 * 2. We now upgrade the HTTP connection to a WebSocket.
 */
app.get("/ws", (c) => {
  // Bun.serve passes the 'server' instance as 'env' to Hono.
  const server = c.env as unknown as import("bun").Server<WebSocketData>;

  if (server.upgrade(c.req.raw, { data: { createdAt: Date.now() } })) {
    // Return empty response. Bun handles the socket upgrade natively.
    return new Response(null);
  }

  return c.text("WebSocket upgrade failed", 500);
});

// =============================================================================
// █ CORE: BUN SERVER
// =============================================================================
// Bun.serve manages the raw TCP/HTTP handling.
const server = Bun.serve<WebSocketData>({
  port: PORT,
  hostname: HOST,

  // [ADAPTER] -> Hono Fetch Compatibility
  // We allow Hono to handle EVERYTHING, including the rate-limited /ws route.
  fetch: app.fetch,

  websocket: websocketHandler,
});

/**
 * █ [CRITICAL] :: GLOBAL_REF_SETTER
 * ---------------------------------------------------------
 * Stores the Bun Server instance for external broadcasting.
 */
setServerRef(server);

const baseUrl =
  HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

console.log(`[SYS]   :: BOOT_HTTP     :: ${baseUrl}`);
console.log(`[SYS]   :: BOOT_WS       :: ${baseUrl.replace("http", "ws")}/ws`);
