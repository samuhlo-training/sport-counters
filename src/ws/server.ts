/**
 * █ [CORE] :: WEBSOCKET_SERVER
 * =====================================================================
 * DESC:   Manages real-time connections, events, and broadcasting.
 *         Uses Bun's native WebSocket implementation.
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
   * ◼️ SOCKET OPEN
   * ---------------------------------------------------------
   * Triggered when a new client connects.
   * Actions: Log connection, subscribe to global channel, send welcome.
   */
  open(ws: ServerWebSocket<WebSocketData>) {
    console.log(`[WS]    :: CONNECTED     :: ip: ${ws.remoteAddress}`);

    // SUBSCRIBE -> Add to global broadcast channel
    ws.subscribe("global");

    // ACKNOWLEDGE -> Immediate feedback for the client
    sendJson(ws, {
      type: "WELCOME",
      payload: "Conectado a Sport Counters Real-Time API",
    });
  },

  message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    // [DEBUG] -> Log message receipt (content omitted for privacy)
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
// [SINGLETON PATTERN] -> Why?
// Hono routes handle HTTP, but Bun logic handles WS broadcasting.
// We store the Bun Server instance here to access it from anywhere.
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
  const server = getServerRef();
  // .publish() is Bun's optimized C++ broadcasting method
  server.publish(topic, JSON.stringify(payload));
}

// =============================================================================
// █ UTILITIES: BUSINESS LOGIC (HIGH LEVEL)
// =============================================================================

/**
 * ◼️ SEND JSON
 * ---------------------------------------------------------
 * Wrapper to send type-safe JSON payloads to a specific client.
 */
export function sendJson(ws: ServerWebSocket<WebSocketData>, payload: any) {
  ws.send(JSON.stringify(payload));
}

/**
 * ◼️ BROADCAST MATCH CREATED
 * ---------------------------------------------------------
 * Domain-specific event notification.
 * Targets: ALL clients ("global" channel).
 */
export function broadcastMatchCreated(match: any) {
  console.log(
    `[WS]    -> BROADCAST     :: event: MATCH_CREATED | id: ${match.id}`,
  );
  broadcastJson("global", {
    type: "MATCH_CREATED",
    data: match,
  });
}
