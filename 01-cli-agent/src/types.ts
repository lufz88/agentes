// ============================================================
// types.ts — Sistema de tipos para el Agente
// ============================================================
// Este archivo define la ARQUITECTURA DE TIPOS completa.
// Cada tipo mapea a un concepto de arquitectura agéntica.
// ============================================================

import { z } from "zod";

// ------------------------------------------------------------
// 1. TOOL DEFINITION — El contrato entre el LLM y tu código
// (ver docs/summary.md#tool-calling)
// ------------------------------------------------------------
// Un "Tool" es una función que el LLM puede invocar.
// El LLM NO ejecuta código: solo genera un JSON con el nombre
// del tool y los parámetros. TÚ ejecutas la función.

/**
 * Schema de un parámetro de tool en formato JSON Schema.
 * El LLM usa esto para saber qué argumentos generar.
 */
export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

/**
 * Definición completa de un Tool.
 * Esto es lo que se envía al LLM en el campo `tools` del request.
 */
export interface ToolDefinition {
  /** Nombre único del tool (el LLM lo usa para invocarlo) */
  name: string;
  /** Descripción en lenguaje natural — CRÍTICO para que el LLM sepa cuándo usarlo */
  description: string;
  /** Schema JSON de los parámetros que acepta */
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

/**
 * Un Tool registrado en el agente: definición + implementación.
 */
export interface Tool {
  definition: ToolDefinition;
  /** La función real que se ejecuta cuando el LLM invoca el tool */
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// ------------------------------------------------------------
// 2. MENSAJES — El protocolo de comunicación
// ------------------------------------------------------------

/** Roles en la conversación */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/** Un mensaje en el historial de conversación */
export interface Message {
  role: MessageRole;
  content: string | null;
  /** Presente cuando el assistant quiere invocar tools */
  tool_calls?: ToolCall[];
  /** ID de la llamada a tool (para respuestas de tipo "tool") */
  tool_call_id?: string;
  /** Nombre del tool (para respuestas de tipo "tool") */
  name?: string;
}

/** Una invocación de tool generada por el LLM */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string — hay que parsearlo
  };
}

// ------------------------------------------------------------
// 3. AGENT STATE — El estado del reasoning loop
// (ver docs/summary.md#reasoning-loop)
// ------------------------------------------------------------

/** Posibles estados del agente en el loop */
export type AgentStatus =
  | "idle"         // Esperando input
  | "thinking"     // Enviando al LLM
  | "tool_calling" // Ejecutando tools
  | "responding"   // Generando respuesta final
  | "error"        // Error recuperable
  | "done";        // Terminó de responder

/** Estado completo del agente */
export interface AgentState {
  status: AgentStatus;
  /** Historial completo de la conversación */
  messages: Message[];
  /** Tools disponibles para este agente */
  tools: Tool[];
  /** Número de iteraciones del reasoning loop en el turno actual */
  iterations: number;
  /** Máximo de iteraciones permitidas (seguridad anti-loop infinito) */
  maxIterations: number;
}

// ------------------------------------------------------------
// 4. LLM CLIENT — Interfaz del cliente LLM
// ------------------------------------------------------------

/** Opciones de configuración del LLM */
export interface LLMConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Respuesta parseada del LLM */
export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[];
  /** true si el LLM quiere ejecutar tools antes de dar respuesta final */
  hasToolCalls: boolean;
}

// ------------------------------------------------------------
// 5. ZOD SCHEMAS — Validación runtime de tool arguments
// (ver docs/summary.md#zod-y-validacion-runtime)
// ------------------------------------------------------------
// Usamos Zod para validar los argumentos que genera el LLM.
// El LLM puede equivocarse en el formato; Zod nos protege.

/** Schema reutilizable para coordenadas geográficas */
export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** Schema para operaciones matemáticas */
export const CalculatorArgsSchema = z.object({
  expression: z.string().describe("Expresión matemática a evaluar"),
});

/** Schema para operaciones de filesystem */
export const FileReadArgsSchema = z.object({
  path: z.string().describe("Ruta del archivo a leer"),
});

export const FileWriteArgsSchema = z.object({
  path: z.string().describe("Ruta del archivo a escribir"),
  content: z.string().describe("Contenido a escribir"),
});

export const FileListArgsSchema = z.object({
  directory: z.string().describe("Directorio a listar").default("."),
});
