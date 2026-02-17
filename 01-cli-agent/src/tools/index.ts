// ============================================================
// tools/index.ts — Registry de Tools
// ============================================================
// Punto central de registro. El agente importa todos los tools
// desde aquí. Para añadir un nuevo tool, solo importa y añade.
// ============================================================

import { weatherTool } from "./weather.tool.js";
import { calculatorTool } from "./calculator.tool.js";
import {
  readFileTool,
  writeFileTool,
  listDirectoryTool,
} from "./filesystem.tool.js";
import type { Tool } from "../types.js";

/** Todos los tools disponibles para el agente */
export const allTools: Tool[] = [
  weatherTool,
  calculatorTool,
  readFileTool,
  writeFileTool,
  listDirectoryTool,
];

/** Buscar un tool por nombre (útil en el reasoning loop) */
export function findTool(name: string): Tool | undefined {
  return allTools.find((t) => t.definition.name === name);
}

/** Obtener solo las definiciones (para enviar al LLM) */
export function getToolDefinitions() {
  return allTools.map((t) => t.definition);
}
