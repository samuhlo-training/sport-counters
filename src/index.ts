/**
 * █ [SERVICIO] :: PUNTO_ENTRADA_EXPRESS
 * =====================================================================
 * DESC:   Punto de entrada principal para el backend de sport-counters.
 * STATUS: ESTABLE
 * =====================================================================
 */
import express, { type Request, type Response } from "express";
import { matchRouter } from "./routes/matches";

// =============================================================================
// █ NÚCLEO: CONFIGURACIÓN Y MIDDLEWARE
// =============================================================================
const app = express();
const PORT = 8000;

app.use(express.json());

// =============================================================================
// █ RUTAS: ENDPOINTS DE LA API
// =============================================================================
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "¡Servidor Express con TypeScript funcionando!" });
});

app.use("/matches", matchRouter);

// =============================================================================
// █ CICLO DE VIDA: ARRANQUE
// =============================================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
