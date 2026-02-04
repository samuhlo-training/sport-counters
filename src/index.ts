/**
 * █ [SERVICIO] :: PUNTO_ENTRADA_HONO
 * =====================================================================
 * DESC:   Punto de entrada principal para el backend de sport-counters.
 *         Ahora potenciado por Hono 🔥 para máxima velocidad y DX.
 * STATUS: ESTABLE
 * =====================================================================
 */
import { Hono } from "hono";
import { matchesApp } from "./routes/matches.ts";
import {
  websocketHandler,
  type WebSocketData,
  setServerRef,
} from "./ws/server.ts";

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";

// =============================================================================
// █ CONFIGURACIÓN: APP (HONO)
// =============================================================================
// Hono es nuestro "Enrutador Inteligente". Define QUÉ hacer con las peticiones.
const app = new Hono();

// [MIDDLEWARE] -> Logging simple para ver qué pasa
app.use("*", async (c, next) => {
  console.log(`📡 [${c.req.method}] ${c.req.url}`);
  await next();
});

// [RUTAS] -> Montamos nuestras mini-apps
app.route("/matches", matchesApp);

// [HEALTH CHECK]
app.get("/", (c) => {
  return c.json({
    message: "¡Servidor Hono + Bun + TypeScript funcionando a tope! 🚀",
  });
});

// =============================================================================
// █ CONFIGURACIÓN: SERVIDOR (BUN)
// =============================================================================
// Bun.serve es el "Motor". Ejecuta el código y maneja los sockets a bajo nivel.
const server = Bun.serve<WebSocketData>({
  port: PORT,

  // Hono tiene un método .fetch que es compatible 100% con Bun.
  // Le pasamos el control de las peticiones HTTP a Hono.
  fetch: (req, server) => {
    // 1. Interceptamos upgrade a WebSocket
    if (
      server.upgrade(req, {
        data: { createdAt: Date.now() },
      })
    ) {
      return undefined; // Bun maneja el resto
    }

    // 2. Si no es WS, Hono se encarga
    return app.fetch(req, server);
  },

  // Manejadores WebSocket (definidos en otro archivo para limpieza)
  websocket: websocketHandler,
});

// [CRÍTICO] -> Guardamos la referencia para poder hacer broadcast desde las rutas
setServerRef(server);

const baseUrl =
  HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
console.log(`🔥 Servidor Hono corriendo en ${baseUrl}`);
console.log(
  `🔥 Servidor WebSocket corriendo en ${baseUrl.replace("http", "ws")}/ws`,
);
