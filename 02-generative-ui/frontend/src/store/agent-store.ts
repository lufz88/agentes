// ============================================================
// store/agent-store.ts — Zustand Store para el Agente
// ============================================================
// (ver docs/summary.md#state-management-agéntico-zustand)
// CONCEPTO CLAVE: El agente controla el estado del frontend.
//
// En una app tradicional, el state cambia por interacción del usuario.
// En Generative UI, el STATE CAMBIA POR DECISIONES DEL AGENTE:
//   - El agente decide montar un componente → store.mountComponent()
//   - El agente envía texto → store.addMessage()
//   - El agente piensa → store.setThinking(true)
//
// El frontend REACCIONA al state (React es perfecto para esto).
// ============================================================

import { create } from "zustand";

/** Tipos de componentes que el agente puede generar */
export type UIComponentType =
  | "weather_card"
  | "chart"
  | "data_table"
  | "code_block"
  | "markdown"
  | "alert";

/** Un componente montado dinámicamente por el agente */
export interface MountedComponent {
  id: string;
  component: UIComponentType;
  props: Record<string, unknown>;
  mountedAt: number;
}

/** Un mensaje en el chat */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** Componentes UI asociados a este mensaje */
  components?: MountedComponent[];
}

/** Estado del agente desde el punto de vista del frontend */
export interface AgentState {
  /** Mensajes del chat */
  messages: ChatMessage[];
  /** Componentes UI montados actualmente */
  mountedComponents: MountedComponent[];
  /** ¿El agente está procesando? */
  isThinking: boolean;
  /** ¿Qué tool está ejecutando? */
  currentTool: string | null;
  /** Errores */
  error: string | null;
}

export interface AgentActions {
  /** Añadir mensaje al chat */
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  /** El agente monta un componente UI */
  mountComponent: (component: MountedComponent) => void;
  /** El agente actualiza un componente existente */
  updateComponent: (id: string, props: Record<string, unknown>) => void;
  /** El agente desmonta un componente */
  unmountComponent: (id: string) => void;
  /** Setear estado de "pensando" */
  setThinking: (thinking: boolean) => void;
  /** Setear tool activo */
  setCurrentTool: (tool: string | null) => void;
  /** Setear error */
  setError: (error: string | null) => void;
  /** Limpiar todo */
  reset: () => void;
}

const initialState: AgentState = {
  messages: [],
  mountedComponents: [],
  isThinking: false,
  currentTool: null,
  error: null,
};

/**
 * Store central del agente.
 * El hook useAgentSSE actualiza este store con los eventos SSE del backend.
 * Los componentes React se suscriben a partes específicas del store.
 */
export const useAgentStore = create<AgentState & AgentActions>((set) => ({
  ...initialState,

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
        },
      ],
    })),

  mountComponent: (component) =>
    set((state) => ({
      mountedComponents: [...state.mountedComponents, component],
      // También asociar al último mensaje del assistant
      messages: state.messages.map((msg, i) =>
        i === state.messages.length - 1 && msg.role === "assistant"
          ? { ...msg, components: [...(msg.components ?? []), component] }
          : msg
      ),
    })),

  updateComponent: (id, props) =>
    set((state) => ({
      mountedComponents: state.mountedComponents.map((c) =>
        c.id === id ? { ...c, props: { ...c.props, ...props } } : c
      ),
    })),

  unmountComponent: (id) =>
    set((state) => ({
      mountedComponents: state.mountedComponents.filter((c) => c.id !== id),
    })),

  setThinking: (isThinking) => set({ isThinking }),
  setCurrentTool: (currentTool) => set({ currentTool }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
