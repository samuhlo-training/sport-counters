/**
 * █ [TEST HELPER] :: TEST_SERVER
 * =====================================================================
 * DESC:   Utilidad para levantar servidor de tests con WebSocket
 * =====================================================================
 */
// @ts-nocheck
import { app } from "../../src/index";
import { websocketHandler } from "../../src/ws/server";
import { setServerRef } from "../../src/ws/server";
import type { Server } from "bun";

let testServer: Server | null = null;
const TEST_PORT = 8000;

/**
 * Inicia servidor de test
 */
export async function startTestServer(): Promise<Server> {
  if (testServer) {
    return testServer;
  }

  testServer = Bun.serve({
    port: TEST_PORT,
    fetch: app.fetch,
    websocket: websocketHandler,
  });

  // Registrar server en el módulo WS
  setServerRef(testServer);

  console.log(`✅ Test server started on http://localhost:${TEST_PORT}`);

  // Dar tiempo para que el servidor se inicialice
  await new Promise((resolve) => setTimeout(resolve, 500));

  return testServer;
}

/**
 * Detiene servidor de test
 */
export async function stopTestServer(): Promise<void> {
  if (testServer) {
    testServer.stop();
    testServer = null;
    console.log(`🛑 Test server stopped`);
  }
}

/**
 * Obtiene puerto del servidor de test
 */
export function getTestServerPort(): number {
  return TEST_PORT;
}

/**
 * Obtiene URL base del servidor de test
 */
export function getTestServerUrl(): string {
  return `http://localhost:${TEST_PORT}`;
}

/**
 * Obtiene URL de WebSocket del servidor de test
 */
export function getTestServerWsUrl(): string {
  return `ws://localhost:${TEST_PORT}/ws`;
}
