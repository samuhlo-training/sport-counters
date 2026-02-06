/**
 * █ [TEST HELPERS] :: WS_CLIENT
 * =====================================================================
 * DESC:   Cliente WebSocket wrapper para tests con APIs promise-based
 * =====================================================================
 */
// @ts-nocheck
import { TEST_CONSTANTS } from "./test-setup";

// =============================================================================
// █ TYPES
// =============================================================================

interface WSMessage {
  type: string;
  [key: string]: any;
}

// =============================================================================
// █ TEST WEBSOCKET CLIENT
// =============================================================================

export class TestWSClient {
  private ws: WebSocket | null = null;
  private messageQueue: WSMessage[] = [];
  private messageListeners: Map<string, ((msg: WSMessage) => void)[]> =
    new Map();
  private connected = false;

  constructor(private url: string = TEST_CONSTANTS.WS_URL) {}

  /**
   * Conecta al WebSocket y espera confirmación
   */
  async connect(
    timeout: number = TEST_CONSTANTS.WS_CONNECT_TIMEOUT,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      const timeoutId = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
      }, timeout);

      this.ws.onopen = () => {
        clearTimeout(timeoutId);
        this.connected = true;
        resolve();
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`WebSocket error: ${error}`));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WSMessage;
          this.messageQueue.push(msg);
          this.notifyListeners(msg);
        } catch (e) {
          console.error("Failed to parse WS message:", e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
      };
    });
  }

  /**
   * Envía un mensaje al servidor
   */
  send(message: any): void {
    if (!this.ws || !this.connected) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Espera por un mensaje de un tipo específico
   */
  async waitForMessage(
    type: string,
    timeout: number = TEST_CONSTANTS.WS_MESSAGE_TIMEOUT,
    filter?: (msg: WSMessage) => boolean,
  ): Promise<WSMessage> {
    // Primero revisar si ya está en la cola
    const existingIndex = this.messageQueue.findIndex(
      (msg) => msg.type === type && (!filter || filter(msg)),
    );
    if (existingIndex !== -1) {
      const msg = this.messageQueue[existingIndex];
      this.messageQueue.splice(existingIndex, 1);
      return msg;
    }

    // Si no, esperar por el mensaje
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeListener(type, listener);
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeout);

      const listener = (msg: WSMessage) => {
        if (!filter || filter(msg)) {
          clearTimeout(timeoutId);
          this.removeListener(type, listener);
          resolve(msg);
        }
      };

      this.addListener(type, listener);
    });
  }

  /**
   * Suscribe a un match
   */
  async subscribe(matchId: number): Promise<void> {
    this.send({ type: "SUBSCRIBE", matchId });
  }

  /**
   * Desuscribe de un match
   */
  async unsubscribe(matchId: number): Promise<void> {
    this.send({ type: "UNSUBSCRIBE", matchId });
  }

  /**
   * Solicita stats
   */
  async requestStats(
    matchId: number,
    subtype: "MATCH_SUMMARY" | "PLAYER",
    playerId?: number,
  ): Promise<WSMessage> {
    const message: any = {
      type: "REQUEST_STATS",
      matchId: matchId.toString(),
      subtype,
    };

    if (subtype === "PLAYER" && playerId !== undefined) {
      message.playerId = playerId.toString();
    }

    this.send(message);
    return this.waitForMessage(
      "STATS_RESPONSE",
      TEST_CONSTANTS.WS_MESSAGE_TIMEOUT,
      (msg) => {
        // Verificar subtype para evitar cruces
        if (msg.subtype !== subtype) return false;

        // Si pedimos stats de jugador, verificar que sea el correcto
        if (subtype === "PLAYER" && playerId !== undefined) {
          return msg.data?.playerId == playerId;
        }
        // Si pedimos match summary, verificar matchId (si viene en el root)
        if (subtype === "MATCH_SUMMARY") {
          return msg.matchId == matchId.toString();
        }
        return true;
      },
    );
  }

  /**
   * Cierra la conexión
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Verifica si está conectado
   */
  isConnected(): boolean {
    return this.connected;
  }

  // =============================================================================
  // █ PRIVATE HELPERS
  // =============================================================================

  private addListener(type: string, listener: (msg: WSMessage) => void): void {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, []);
    }
    this.messageListeners.get(type)!.push(listener);
  }

  private removeListener(
    type: string,
    listener: (msg: WSMessage) => void,
  ): void {
    const listeners = this.messageListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(msg: WSMessage): void {
    const listeners = this.messageListeners.get(msg.type);
    if (listeners) {
      listeners.forEach((listener) => listener(msg));
    }
  }
}
