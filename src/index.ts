/**
 * █ [SERVICE] :: EXPRESS_ENTRY
 * =====================================================================
 * DESC:   Main entry point for the sports counters backend.
 * STATUS: STABLE
 * =====================================================================
 */
import express, { type Request, type Response } from "express";

// =============================================================================
// █ CORE: CONFIG & MIDDLEWARE
// =============================================================================
const app = express();
const PORT = 8000;

app.use(express.json());

// =============================================================================
// █ ROUTES: API ENDPOINTS
// =============================================================================
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "¡Servidor Express con TypeScript funcionando!" });
});

// =============================================================================
// █ LIFECYCLE: STARTUP
// =============================================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
