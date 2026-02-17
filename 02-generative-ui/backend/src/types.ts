// ============================================================
// types.ts — Tipos para Generative UI
// ============================================================
// (ver docs/summary.md#generative-ui)
// CONCEPTO CLAVE: "Generative UI" = el agente no solo genera texto,
// sino que decide QUÉ COMPONENTES REACT renderizar.
// 
// El backend envía "UI Actions" al frontend que describen
// componentes a montar/desmontar/actualizar en la interfaz.
// ============================================================

/** Tipos de componente UI que el agente puede generar */
export type UIComponentType =
  | "weather_card"
  | "chart"
  | "data_table"
  | "code_block"
  | "image_gallery"
  | "progress_bar"
  | "markdown"
  | "alert"
  | "form";

/** Una acción de UI generada por el agente */
export interface UIAction {
  /** Tipo de acción */
  type: "mount" | "update" | "unmount";
  /** ID único del componente (para updates/unmounts) */
  componentId: string;
  /** Tipo de componente React a renderizar */
  component: UIComponentType;
  /** Props del componente (el agente genera estos datos) */
  props: Record<string, unknown>;
}

/** Evento enviado por SSE al frontend */
export interface AgentEvent {
  type: "thinking" | "tool_call" | "tool_result" | "ui_action" | "text" | "done" | "error";
  data: unknown;
  timestamp: number;
}

/** Definición de tool igual que en proyecto 01, extendida para UI */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
  /** Si el tool genera UI, definir qué componente produce */
  uiComponent?: UIComponentType;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
