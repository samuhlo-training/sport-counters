/**
 * █ [CORE] :: WEBSOCKET_SERVER
 * =====================================================================
 * DESC:   Gestiona conexiones en tiempo real, eventos y broadcasting.
 *         Utiliza la implementación nativa de WebSockets de Bun.
 * STATUS: STABLE
 * =====================================================================
 */
import type { ServerWebSocket, Server } from "bun";

export type WebSocketData = {
  createdAt: number;
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
  },

  close(ws: ServerWebSocket<WebSocketData>) {
    console.log(`[WS]    :: DISCONNECTED  :: ip: ${ws.remoteAddress}`);
    ws.unsubscribe("global");
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

// =============================================================================
// █ UTILITIES: BROADCAST (LOW LEVEL)
// =============================================================================
export function broadcastJson(topic: string, payload: any) {
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
  broadcastJson("global", {
    type: "MATCH_CREATED",
    data: match,
  });
}
