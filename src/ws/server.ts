/**
 * █ [CORE] :: WEBSOCKET_SERVER
 * =====================================================================
 * DESC:   Gestiona conexiones en tiempo real, eventos y broadcasting.
 *         Utiliza la implementación nativa de WebSockets de Bun.
 * STATUS: STABLE
 * =====================================================================
 */
import type { ServerWebSocket, Server } from "bun";
import { processPointScored, getMatchSnapshot } from "../controllers/match.ts";

export type WebSocketData = {
  createdAt?: number;
  channelId?: string;
};

// =============================================================================
// █ HANDLERS: SOCKET EVENTS
// =============================================================================
export const websocketHandler = {
  /**
   * ◼️ OPEN SOCKET
   * ---------------------------------------------------------
   * Se activa cuando un nuevo cliente se conecta.
   * Acciones: Log connection, subscribe to global channel, send welcome.
   */
  open(ws: ServerWebSocket<WebSocketData>) {
    console.log(`[WS]    :: CONNECTED     :: ip: ${ws.remoteAddress}`);

    // SUBSCRIBE -> Añadir al canal de broadcast global
    ws.subscribe("global");

    // ACKNOWLEDGE -> Feedback inmediato para el cliente
    sendJson(ws, {
      type: "WELCOME",
      payload: "Conectado a Sport Counters Real-Time API",
    });
  },

  message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    // [DEBUG] -> Log message receipt (contenido omitido por privacidad)
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
// [SINGLETON PATTERN] -> ¿Por qué?
// Las rutas de Hono manejan HTTP, pero la lógica de Bun gestiona el WS Broadcasting.
// Almacenamos la instancia del servidor Bun aquí para acceso global.
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

function broadcastToMatch(matchId: string, payload: any) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;
  const message = JSON.stringify(payload);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

/**
 * ◼️ HANDLER: MATCH MESSAGES
 * ---------------------------------------------------------
 * Procesa mensajes específicos de un partido (suscripciones).
 * PROTOCOLO:
 * - SUBSCRIBE: Cliente quiere recibir eventos de un partido.
 */
function handleMatchMessage(
  socket: ServerWebSocket<WebSocketData>,
  data: string | Buffer,
) {
  let message: any;
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

  // 1. SUSCRIPCIONES (SUBSCRIBE)
  const matchId = String(message.matchId);
  subscribeToMatch(matchId, socket);
  socket.subscribe(matchId); // Bun pub/sub

  // [INITIAL STATE] -> Send current snapshot immediately
  getMatchSnapshot(Number(matchId))
    .then((snapshot) => {
      sendJson(socket, {
        type: "MATCH_UPDATE",
        matchId,
        timestamp: Date.now(),
        snapshot,
        lastPoint: null, // Initial state has no last point delta
      });
    })
    .catch((err) => {
      sendJson(socket, {
        type: "ERROR",
        payload: "Failed to fetch match state",
      });
      console.error(`[WS]    :: STATE_FETCH_ERR ::`, err);
    });

  sendJson(socket, {
    type: "SUBSCRIBED",
    payload: `Subscribed to match ${matchId}`,
  });
  return;

  // 2. DESUSCRIPCIONES (UNSUBSCRIBE)
  if (message?.type === "UNSUBSCRIBE" && message?.matchId) {
    const matchId = String(message.matchId);
    unsubscribeFromMatch(matchId, socket);
    socket.unsubscribe(matchId); // Bun pub/sub
    sendJson(socket, {
      type: "UNSUBSCRIBED",
      payload: `Unsubscribed from match ${matchId}`,
    });
    return;
  }

  // 3. EVENTO DE JUEGO (POINT_SCORED)
  if (message?.type === "POINT_SCORED") {
    // Validar payload mínimo
    if (!message.matchId || !message.playerId || !message.actionType) {
      sendJson(socket, {
        type: "ERROR",
        payload: "Missing matchId, playerId or actionType",
      });
      return;
    }

    // Delegar a MatchController
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
    // .publish() es el método de broadcasting de Bun optimizado en C++
    server.publish(topic, JSON.stringify(payload));
  } catch (err) {
    console.error(`[WS]    :: BROADCAST_ERR :: topic: ${topic}`, err);
  }
}

// =============================================================================
// █ UTILITIES: BUSINESS LOGIC (HIGH LEVEL)
// =============================================================================

/**
 * ◼️ SEND JSON
 * ---------------------------------------------------------
 * Wrapper para enviar JSON payloads de forma segura a un cliente específico.
 */
export function sendJson(ws: ServerWebSocket<WebSocketData>, payload: any) {
  try {
    const data = JSON.stringify(payload);
    return ws.send(data);
  } catch (error) {
    console.error(`[ERR]   :: JSON_SEND_ERR :: Serialization failed`, {
      payloadType: typeof payload,
      error,
    });
    return 0;
  }
}

/**
 * ◼️ BROADCAST MATCH CREATED
 * ---------------------------------------------------------
 * Notificación de evento específica del dominio.
 * Targets: TODOS los clientes (canal "global").
 */
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

/**
 * ◼️ BROADCAST: COMMENTARY EVENT
 * ---------------------------------------------------------
 * Envia actualizaciones en tiempo real (goles, faltas, etc.).
 * TARGET: Solo suscriptores del partido (Room/Channel específico).
 */
export function broadcastCommentary(matchId: string, comment: any) {
  broadcastToMatch(matchId, {
    type: "COMMENTARY",
    data: comment,
  });
}
