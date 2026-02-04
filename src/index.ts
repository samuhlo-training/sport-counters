import express, { type Request, type Response } from "express";

const app = express();
const PORT = 8000;

// Middleware JSON
app.use(express.json());

// Ruta raíz GET
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "¡Servidor Express con TypeScript funcionando!" });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
