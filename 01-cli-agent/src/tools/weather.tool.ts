// ============================================================
// tools/weather.tool.ts — Tool de ejemplo: Clima
// ============================================================
// (ver docs/summary.md#tool-calling)
// PATRÓN: Cada tool tiene 3 partes:
//   1. ToolDefinition (schema JSON para el LLM)
//   2. Validación con Zod (protección contra args malformados)
//   3. Función execute (la lógica real)
// ============================================================

import { z } from "zod";
import type { Tool, ToolDefinition } from "../types.js";

// 1️⃣ SCHEMA JSON — Lo que el LLM ve para decidir si usar este tool
const definition: ToolDefinition = {
  name: "get_weather",
  description:
    "Obtiene el clima actual de una ciudad. Usa este tool cuando el usuario " +
    "pregunte por el clima, temperatura o pronóstico de cualquier ubicación.",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "Nombre de la ciudad (ej: 'Madrid', 'Buenos Aires')",
      },
      units: {
        type: "string",
        description: "Sistema de unidades para la temperatura",
        enum: ["celsius", "fahrenheit"],
      },
    },
    required: ["city"],
  },
};

// 2️⃣ ZOD SCHEMA — Validación runtime de los argumentos
// (ver docs/summary.md#zod-y-validacion-runtime)
const ArgsSchema = z.object({
  city: z.string().min(1),
  units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

// 3️⃣ EXECUTE — La lógica real del tool
async function execute(args: Record<string, unknown>): Promise<string> {
  // Validar argumentos con Zod
  const parsed = ArgsSchema.parse(args);

  // En producción aquí irías a una API real (OpenWeatherMap, etc.)
  // Para aprendizaje, usamos datos simulados
  const mockWeather = {
    city: parsed.city,
    temperature: Math.round(Math.random() * 35 + 5),
    units: parsed.units,
    condition: ["soleado", "nublado", "lluvioso", "parcialmente nublado"][
      Math.floor(Math.random() * 4)
    ],
    humidity: Math.round(Math.random() * 60 + 30),
    wind_speed: Math.round(Math.random() * 30 + 5),
  };

  // IMPORTANTE: Retornamos un string.
  // El LLM recibe este string como resultado del tool call
  // y lo usa para formular su respuesta al usuario.
  return JSON.stringify(mockWeather, null, 2);
}

/** Tool completo listo para registrar en el agente */
export const weatherTool: Tool = { definition, execute };
