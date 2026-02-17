// ============================================================
// hooks/useAgentSSE.ts — Hook para consumir SSE del agente
// ============================================================
// (ver docs/summary.md#sse-server-sent-events)
// CONCEPTO CLAVE: Este hook es el PUENTE entre el backend
// (reasoning loop) y el frontend (store de React).
//
// Cada evento SSE se traduce a una acción del store:
//   "thinking"    → setThinking(true)
//   "tool_call"   → setCurrentTool(name)
//   "ui_action"   → mountComponent(...)  ← MAGIA: el agente monta UI
//   "text"        → addMessage(content)
//   "done"        → setThinking(false)
// ============================================================

import { useCallback } from "react";
import { useAgentStore } from "../store/agent-store.js";

interface AgentEvent {
  type: "thinking" | "tool_call" | "tool_result" | "ui_action" | "text" | "done" | "error";
  data: Record<string, unknown>;
  timestamp: number;
}

export function useAgentSSE() {
  const store = useAgentStore();

  const sendMessage = useCallback(
    async (message: string) => {
      // Añadir mensaje del usuario
      store.addMessage({ role: "user", content: message });
      store.setThinking(true);
      store.setError(null);

      try {
        // Hacer el request al backend
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, sessionId: "default" }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("No response body");

        // Leer el stream SSE
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Crear un placeholder para el mensaje del assistant
        store.addMessage({ role: "assistant", content: "" });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parsear eventos SSE (formato: "data: {...}\n\n")
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? ""; // El último puede estar incompleto

          for (const line of lines) {
            const dataLine = line.trim();
            if (!dataLine.startsWith("data: ")) continue;

            try {
              const event: AgentEvent = JSON.parse(dataLine.slice(6));
              handleEvent(event, store);
            } catch {
              // Ignorar líneas mal formadas
            }
          }
        }
      } catch (err) {
        store.setError((err as Error).message);
      } finally {
        store.setThinking(false);
        store.setCurrentTool(null);
      }
    },
    [store]
  );

  return { sendMessage };
}

/** Procesa un evento SSE y actualiza el store */
function handleEvent(
  event: AgentEvent,
  store: ReturnType<typeof useAgentStore.getState>
) {
  switch (event.type) {
    case "thinking":
      store.setThinking(true);
      break;

    case "tool_call":
      store.setCurrentTool(event.data.name as string);
      break;

    case "ui_action": {
      // ⭐ GENERATIVE UI: El agente monta un componente
      const action = event.data as {
        type: string;
        componentId: string;
        component: string;
        props: Record<string, unknown>;
      };

      if (action.type === "mount") {
        store.mountComponent({
          id: action.componentId,
          component: action.component as any,
          props: action.props,
          mountedAt: Date.now(),
        });
      } else if (action.type === "update") {
        store.updateComponent(action.componentId, action.props);
      } else if (action.type === "unmount") {
        store.unmountComponent(action.componentId);
      }
      break;
    }

    case "text": {
      // Actualizar el último mensaje del assistant
      const content = event.data.content as string;
      const messages = useAgentStore.getState().messages;
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        useAgentStore.setState({
          messages: messages.map((m, i) =>
            i === lastIdx ? { ...m, content } : m
          ),
        });
      }
      break;
    }

    case "error":
      store.setError(event.data.error as string);
      break;

    case "done":
      store.setThinking(false);
      store.setCurrentTool(null);
      break;
  }
}
