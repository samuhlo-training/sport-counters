import { z } from "zod";

export const PadelStrokeSchema = z.enum([
  "forehand", // Drive
  "backhand", // Revés
  "smash", // Remate
  "bandeja", // Bandeja (Esencial en pádel)
  "vibora", // Víbora
  "volley_forehand",
  "volley_backhand",
  "lob", // Globo
  "drop_shot", // Dejada
  "wall_boast", // Contrapared
]);

export const pointActionSchema = z.object({
  playerId: z.coerce.number().int().positive(),

  // El resultado final del golpe
  actionType: z.enum([
    "winner",
    "unforced_error",
    "forced_error",
    "service_ace",
    "double_fault",
  ]),

  // Qué golpe se ejecutó (Opcional, no todos los errores son un golpe claro)
  stroke: PadelStrokeSchema.optional(),

  // Contexto adicional para métricas avanzadas
  isNetPoint: z.boolean().default(false), // ¿Ganó el punto en la red?
});
