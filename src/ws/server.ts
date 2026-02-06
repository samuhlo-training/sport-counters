/**
 * █ [CORE] :: WEBSOCKET_SERVER
 * =====================================================================
 * DESC:   Gestiona conexiones en tiempo real, eventos y broadcasting.
 *         Soporta flujo Bi-Direccional (Push & Request/Response).
 * STATUS: STABLE
 * =====================================================================
 */
import type { ServerWebSocket, Server } from "bun";
import { processPointScored, getMatchSnapshot } from "../controllers/match.ts";
import { db } from "../db/db.ts";
import { matches, matchStats, players } from "../db/schema.ts";
import { eq, and } from "drizzle-orm";

export type WebSocketData = {
  createdAt?: number;
  channelId?: string;
};

// =============================================================================
// █ TYPES: MESSAGING PROTOCOL
// =============================================================================

// [CLIENT -> SERVER]
// Tipos de mensajes que aceptamos del frontend.
export type ClientMessage =
  | { type: "SUBSCRIBE"; matchId: string }
  | { type: "UNSUBSCRIBE"; matchId: string }
  | {
      type: "POINT_SCORED";
      matchId: string;
      playerId: string;
      actionType: any;
    } // [LEGACY] -> Mantener por compatibilidad, pero preferir API REST
  | {
      type: "REQUEST_STATS";
      matchId: string;
      subtype: "PLAYER" | "MATCH_SUMMARY";
      playerId?: string; // Requerido solo si subtype es PLAYER
    };

// [SERVER -> CLIENT]
// Respuestas y eventos que emitimos.
export type ServerMessage =
  | { type: "WELCOME"; payload: string }
  | { type: "ERROR"; payload: string }
  | { type: "SUBSCRIBED"; payload: string }
  | { type: "UNSUBSCRIBED"; payload: string }
  | {
      type: "MATCH_UPDATE";
      matchId: string;
      timestamp: number;
      snapshot: any;
      lastPoint: any;
    }
  | { type: "COMMENTARY"; data: any }
  | { type: "MATCH_CREATED"; data: any }
  | {
      type: "STATS_RESPONSE";
      subtype: "PLAYER" | "MATCH_SUMMARY";
      matchId: string;
      data: any;
    };

// =============================================================================
// █ HANDLERS: SOCKET EVENTS
// =============================================================================
export const websocketHandler = {
  /**
   * ◼️ EVENT: OPEN
   * ---------------------------------------------------------
   * Se dispara al establecer conexión TCP/WS.
   */
  open(ws: ServerWebSocket<WebSocketData>) {
    console.log(`[WS]    :: CONNECTED     :: ip: ${ws.remoteAddress}`);

    // [GLOBAL CHANNEL] -> Todos escuchan eventos globales (ej: nuevo partido crado)
    ws.subscribe("global");

    // [ACK] -> Saludo inicial para confirmar conexión
    sendJson(ws, {
      type: "WELCOME",
      payload: "Conectado a Padel Counters Real-Time API",
    });
  },

  message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    // [LOG] -> Preview del mensaje para debug
    const msgPreview =
      typeof message === "string"
        ? `${message.slice(0, 50)}${message.length > 50 ? "..." : ""}`
        : `<Buffer ${message.byteLength} bytes>`;
    console.log(`[WS]    :: MSG_REC       :: preview: ${msgPreview}`);
    handleMatchMessage(ws, message);
  },

  close(ws: ServerWebSocket<WebSocketData>) {
    console.log(`[WS]    :: DISCONNECTED  :: ip: ${ws.remoteAddress}`);
    ws.unsubscribe("global");
    cleanUpMatchSubscriptions(ws);
  },
};

// =============================================================================
// █ GLOBAL STATE: SERVER REFERENCE
// =============================================================================
// [SINGLETON] -> Guardamos referencia al servidor Bun para poder hacer broadcast
// desde fuera de los handlers del socket (ej: desde un Controller REST).
let serverRef: Server<WebSocketData> | null = null;

export function setServerRef(server: Server<WebSocketData>) {
  console.log(`[SYS]   :: REF_SET       :: WebSocket Server linked`);
  serverRef = server;
}

export function getServerRef() {
  if (!serverRef) {
    throw new Error("[ERR]   :: REF_MISSING   :: Server not initialized");
  }
  return serverRef;
}

// Mapa local de suscriptores para gestión fina (además de los topics de Bun)
const matchSubscribers = new Map<string, Set<ServerWebSocket<WebSocketData>>>();

function subscribeToMatch(
  matchId: string,
  socket: ServerWebSocket<WebSocketData>,
) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId)!.add(socket);
}

function unsubscribeFromMatch(
  matchId: string,
  socket: ServerWebSocket<WebSocketData>,
) {
  const subscribers = matchSubscribers.get(matchId);
  if (subscribers) {
    subscribers.delete(socket);
    if (subscribers.size === 0) {
      matchSubscribers.delete(matchId);
    }
  }
}

function cleanUpMatchSubscriptions(socket: ServerWebSocket<WebSocketData>) {
  for (const [matchId, sockets] of matchSubscribers.entries()) {
    if (sockets.has(socket)) {
      unsubscribeFromMatch(matchId, socket);
    }
  }
}

function broadcastToMatch(matchId: string, payload: ServerMessage) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;
  const message = JSON.stringify(payload);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// =============================================================================
// █ HANDLER: MATCH MESSAGES & LOGIC
// =============================================================================

/**
 * ◼️ FUNCTION: PROCESS_STATS_REQUEST
 * ---------------------------------------------------------
 * Maneja peticiones bajo demanda (Request/Response pattern over WS).
 * Consulta la DB y responde solo al socket solicitante.
 */
async function processStatsRequest(
  socket: ServerWebSocket<WebSocketData>,
  payload: ClientMessage & { type: "REQUEST_STATS" },
) {
  const { matchId, subtype, playerId } = payload;
  const matchIdInt = parseInt(matchId);

  try {
    if (subtype === "PLAYER") {
      if (!playerId) throw new Error("Missing playerId for PLAYER stats");
      const playerIdInt = parseInt(playerId);

      const [stats] = await db
        .select()
        .from(matchStats)
        .where(
          and(
            eq(matchStats.matchId, matchIdInt),
            eq(matchStats.playerId, playerIdInt),
          ),
        );

      sendJson(socket, {
        type: "STATS_RESPONSE",
        subtype: "PLAYER",
        matchId,
        data: stats || {
          pointsWon: 0,
          winners: 0,
          unforcedErrors: 0,
          smashWinners: 0,
        },
      });
    } else if (subtype === "MATCH_SUMMARY") {
      const [matchData] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchIdInt));

      if (!matchData) throw new Error("Match not found");

      // Calcular duración aproximada
      let durationSeconds = 0;
      if (matchData.startTime) {
        const end = matchData.endTime || new Date();
        durationSeconds = Math.floor(
          (end.getTime() - matchData.startTime.getTime()) / 1000,
        );
      }

      sendJson(socket, {
        type: "STATS_RESPONSE",
        subtype: "MATCH_SUMMARY",
        matchId,
        data: {
          currentScore: {
            sets: `${matchData.pairAGames}-${matchData.pairBGames} (Set ${matchData.currentSetIdx})`,
            points: `${matchData.pairAScore}-${matchData.pairBScore}`,
          },
          durationSeconds,
          status: matchData.status,
          servingPlayerId: matchData.servingPlayerId,
        },
      });
    }
  } catch (error: any) {
    console.error(`[WS]    :: STATS_ERR     ::`, error);
    sendJson(socket, {
      type: "ERROR",
      payload: `Stats Request Failed: ${error.message}`,
    });
  }
}

/**
 * ◼️ ROUTER: HANDLE_MATCH_MESSAGE
 * ---------------------------------------------------------
 * Enruta los mensajes entrantes según su 'type'.
 */
function handleMatchMessage(
  socket: ServerWebSocket<WebSocketData>,
  data: string | Buffer,
) {
  let message: ClientMessage;
  try {
    const text = typeof data === "string" ? data : data.toString();
    message = JSON.parse(text);
  } catch (err) {
    console.error(`[WS]    :: JSON_PARSE_ERR ::`, err);
    sendJson(socket, {
      type: "ERROR",
      payload: "Invalid JSON",
    });
    return;
  }

  // 1. STATS REQUEST (REQUEST_STATS)
  if (message.type === "REQUEST_STATS") {
    processStatsRequest(socket, message);
    return;
  }

  // 2. SUBSCRIBE
  if (message.type === "SUBSCRIBE") {
    const matchId = String(message.matchId);
    subscribeToMatch(matchId, socket);
    socket.subscribe(matchId); // Bun pub/sub nativo

    // [INIT] -> Enviar snapshot inicial al suscribirse (Warmup)
    getMatchSnapshot(Number(matchId))
      .then((snapshot) => {
        sendJson(socket, {
          type: "MATCH_UPDATE",
          matchId,
          timestamp: Date.now(),
          snapshot,
          lastPoint: null,
        });
      })
      .catch((err) => {
        console.error(`[WS]    :: STATE_FETCH_ERR ::`, err);
        sendJson(socket, {
          type: "ERROR",
          payload: "Failed to fetch match state",
        });
      });

    sendJson(socket, {
      type: "SUBSCRIBED",
      payload: `Subscribed to match ${matchId}`,
    });
    return;
  }

  // 3. UNSUBSCRIBE
  if (message.type === "UNSUBSCRIBE") {
    const matchId = String(message.matchId);
    unsubscribeFromMatch(matchId, socket);
    socket.unsubscribe(matchId);
    sendJson(socket, {
      type: "UNSUBSCRIBED",
      payload: `Unsubscribed from match ${matchId}`,
    });
    return;
  }

  // 4. POINT_SCORED (Legacy/Dev)
  if (message.type === "POINT_SCORED") {
    if (!message.matchId || !message.playerId || !message.actionType) {
      sendJson(socket, {
        type: "ERROR",
        payload: "Missing matchId, playerId or actionType",
      });
      return;
    }

    processPointScored({
      matchId: String(message.matchId),
      playerId: String(message.playerId),
      actionType: message.actionType,
    }).catch((err: any) => {
      console.error(`[WS]    :: POINT_ERR      ::`, err);
      sendJson(socket, {
        type: "ERROR",
        payload: err?.message || "Unknown Error",
      });
    });
    return;
  }
}

// =============================================================================
// █ UTILITIES: BROADCAST (LOW LEVEL)
// =============================================================================
export function broadcastToAll(topic: string, payload: any) {
  try {
    const server = getServerRef();
    server.publish(topic, JSON.stringify(payload));
  } catch (err) {
    console.error(`[WS]    :: BROADCAST_ERR :: topic: ${topic}`, err);
  }
}

// =============================================================================
// █ UTILITIES: BUSINESS LOGIC (HIGH LEVEL)
// =============================================================================

export function sendJson(
  ws: ServerWebSocket<WebSocketData>,
  payload: ServerMessage,
) {
  try {
    const data = JSON.stringify(payload);
    return ws.send(data);
  } catch (error) {
    console.error(`[ERR]   :: JSON_SEND_ERR :: Serialization failed`, {
      payloadType: typeof payload,
      error,
    });
    return 0; // 0 types sent
  }
}

export function broadcastMatchCreated(match: any) {
  if (!match?.id) {
    throw new Error("[ERR]   :: MATCH_MISSING :: Match not initialized");
  }
  console.log(
    `[WS]    -> BROADCAST     :: event: MATCH_CREATED | id: ${match.id}`,
  );
  broadcastToAll("global", {
    type: "MATCH_CREATED",
    data: match,
  });
}

export function broadcastCommentary(matchId: string, comment: any) {
  broadcastToMatch(matchId, {
    type: "COMMENTARY",
    data: comment,
  });
}
