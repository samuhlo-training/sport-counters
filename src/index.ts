/**
 * █ [CORE] :: HTTP_ENTRY_POINT
 * =====================================================================
 * DESC:   Punto de entrada principal para el Backend de Sport Counters.
 *         Orquesta Hono (Router), Bun (Server) y Upstash (Redis).
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
// █ CONFIG: ENTORNO
// =============================================================================
const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";

// =============================================================================
// █ INFRA: UPSTASH REDIS (RATE LIMITING)
// =============================================================================
// 1. CLIENTE DE CONEXIÓN
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error("Missing Upstash Redis credentials");
}

const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

// 2. LIMITER STRATEGY (SLIDING WINDOW)
// POLICY: 5 requests every 10 seconds per IP.
// MOTIVO: Prevenir el abuso de conexiones WebSocket.
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
    `[HTTP]  :: INCOMING_REQ  :: method: ${c.req.method} | path: ${c.req.url}`,
  );
  await next();
});

/**
 * ◼️ MIDDLEWARE: RATE LIMITER PROTECTOR
 * ---------------------------------------------------------
 * Intercepta peticiones /ws para aplicar límites antes del handshake.
 * Estrategia: Verificar IP contra Redis.
 */
app.use("/ws", async (c, next) => {
  // A. IDENTIFICAR -> Obtener IP del cliente
  // Fallback a 127.0.0.1 si falta la IP o los headers
  const ip =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1";

  // B. VERIFICAR -> Pedir permiso a Redis
  const { success, remaining } = await ratelimit.limit(ip);

  if (!success) {
    console.log(`[SEC]   :: RATE_LIMITED  :: ip: ${ip} | ACTION: BLOCKED`);
    return c.text("ERROR: Rate limit exceeded. Relax.", 429);
  }

  // D. PERMITIR -> Continuar
  // [DEBUG] -> Log allowed access (Optional: comment in production)
  // console.log(`[SEC]   :: ACCESS_OK     :: ip: ${ip} | remaining: ${remaining}`);

  await next();
});

// [RUTAS] -> Montar Sub-Aplicaciones
app.route("/matches", matchesApp);

// [VITALIDAD] (HEALTH CHECK)
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
 * Destino final para las peticiones /ws.
 * 1. El Middleware ya validó el Rate Limit.
 * 2. Se procede al upgrade de HTTP a WebSocket.
 */
app.get("/ws", (c) => {
  // Bun.serve pasa la instancia 'server' como 'env' a Hono.
  const server = c.env as unknown as import("bun").Server<WebSocketData>;

  if (server.upgrade(c.req.raw, { data: { createdAt: Date.now() } })) {
    // Return empty Response. Bun handles the native socket upgrade.
    return new Response(null);
  }

  return c.text("WebSocket upgrade failed", 500);
});

// =============================================================================
// █ CORE: BUN SERVER
// =============================================================================
// Bun.serve maneja el tráfico bruto TCP/HTTP.
const server = Bun.serve<WebSocketData>({
  port: PORT,
  hostname: HOST,

  // [FETCH_ADAPTER] -> Hono Compatibility
  // Permitimos que Hono gestione TODO, incluyendo la ruta /ws protegida.
  fetch: app.fetch,

  // WebSocket Handlers (definidos en ./ws/server.ts)
  websocket: websocketHandler,
});

/**
 * █ [CRITICAL] :: GLOBAL_SERVER_REFERENCE
 * ---------------------------------------------------------
 * Almacena la instancia del servidor para broadcasting externo.
 */
setServerRef(server);

const baseUrl =
  HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

console.log(`[SYS]   :: BOOT_HTTP     :: ${baseUrl}`);
console.log(`[SYS]   :: BOOT_WS       :: ${baseUrl.replace("http", "ws")}/ws`);
