// ============================================================
// agent.ts — Agente con Streaming de UI Actions
// ============================================================
// (ver docs/summary.md#reasoning-loop y docs/summary.md#sse-server-sent-events)
// Extiende el agente básico con:
// 1. Streaming via Server-Sent Events (SSE)
// 2. Generación de UIActions que el frontend consume
// 3. Cada paso del reasoning loop emite eventos al frontend
// ============================================================

import OpenAI from "openai";
import type { Response } from "express";
import type { Message, ToolCall, AgentEvent, UIAction } from "./types.js";
import {
  weatherCardTool, executeWeatherCard,
  chartTool, executeChart,
  dataTableTool, executeDataTable,
} from "./tools/ui-tools.js";

const SYSTEM_PROMPT = `Eres un asistente visual inteligente con capacidad de generar componentes UI.

Tus herramientas generan COMPONENTES VISUALES en la interfaz del usuario:
- **show_weather_card**: Tarjeta de clima con pronóstico
- **show_chart**: Gráficos interactivos (barras, líneas, pie, área)  
- **show_data_table**: Tablas de datos interactivas

Reglas:
1. SIEMPRE usa herramientas visuales cuando sea posible (es mejor mostrar que contar)
2. Puedes combinar múltiples componentes en una respuesta
3. Acompaña cada componente con una breve explicación en texto
4. Responde en español
5. Para datos numéricos, prefiere gráficos. Para listas, prefiere tablas.`;

const tools = [weatherCardTool, chartTool, dataTableTool];

type ToolExecutor = (args: Record<string, unknown>) => Promise<{
  toolResult: string;
  uiAction: UIAction;
}>;

const toolExecutors: Record<string, ToolExecutor> = {
  show_weather_card: (args) => executeWeatherCard(args as { city: string }),
  show_chart: (args) =>
    executeChart(args as { title: string; chart_type: string; labels: string[]; values: number[] }),
  show_data_table: (args) =>
    executeDataTable(args as { title: string; columns: string[]; rows: unknown[][] }),
};

export class StreamingAgent {
  private client: OpenAI;
  private model: string;
  private messages: Message[] = [];

  constructor() {
    // Mismos proveedores que 01-cli-agent (ver .env.example en raíz)
    const PROVIDERS: Record<string, { baseURL: string; model: string }> = {
      ollama: { baseURL: "http://localhost:11434/v1", model: "llama3.1" },
      groq:   { baseURL: "https://api.groq.com/openai/v1", model: "llama-3.1-70b-versatile" },
      gemini: { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash" },
      openai: { baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
      github: { baseURL: "https://models.inference.ai.azure.com", model: "gpt-4o-mini" },
    };
    const providerName = (process.env.PROVIDER ?? "ollama").toLowerCase();
    const provider = PROVIDERS[providerName] ?? PROVIDERS.ollama;

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? (providerName === "ollama" ? "ollama" : ""),
      baseURL: process.env.OPENAI_BASE_URL ?? provider.baseURL,
    });
    this.model = process.env.MODEL ?? provider.model;
    this.messages = [{ role: "system", content: SYSTEM_PROMPT }];
  }

  /**
   * Procesa un mensaje y envía eventos SSE al cliente.
   * 
   * CONCEPTO CLAVE: En lugar de retornar una respuesta completa,
   * emitimos eventos progresivos que el frontend renderiza en tiempo real.
   * 
   * El frontend ve:
   * 1. "thinking" → muestra spinner
   * 2. "tool_call" → muestra qué tool se va a ejecutar
   * 3. "ui_action" → MONTA el componente React correspondiente
   * 4. "text" → muestra texto del agente
   * 5. "done" → fin del turno
   */
  async processWithSSE(userMessage: string, res: Response): Promise<void> {
    this.messages.push({ role: "user", content: userMessage });

    // Configurar SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const emit = (event: AgentEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    let iterations = 0;
    const maxIterations = 8;

    while (iterations < maxIterations) {
      iterations++;
      emit({ type: "thinking", data: { iteration: iterations }, timestamp: Date.now() });

      // Llamar al LLM
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: this.messages as OpenAI.Chat.ChatCompletionMessageParam[],
        tools: tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters as Record<string, unknown>,
          },
        })),
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      if (!choice?.message) break;

      const toolCalls = choice.message.tool_calls ?? [];

      if (toolCalls.length > 0) {
        // Guardar mensaje del assistant con tool_calls
        this.messages.push({
          role: "assistant",
          content: choice.message.content,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        });

        // Ejecutar cada tool y emitir UI actions
        for (const tc of toolCalls) {
          emit({
            type: "tool_call",
            data: { name: tc.function.name, args: tc.function.arguments },
            timestamp: Date.now(),
          });

          const executor = toolExecutors[tc.function.name];
          if (executor) {
            try {
              const args = JSON.parse(tc.function.arguments);
              const { toolResult, uiAction } = await executor(args);

              // ⭐ Emitir la UI Action al frontend
              emit({ type: "ui_action", data: uiAction, timestamp: Date.now() });

              // Añadir resultado al historial para el LLM
              this.messages.push({
                role: "tool",
                content: toolResult,
                tool_call_id: tc.id,
                name: tc.function.name,
              });

              emit({
                type: "tool_result",
                data: { name: tc.function.name, result: toolResult },
                timestamp: Date.now(),
              });
            } catch (err) {
              const error = `Error: ${(err as Error).message}`;
              this.messages.push({ role: "tool", content: error, tool_call_id: tc.id });
              emit({ type: "error", data: { error }, timestamp: Date.now() });
            }
          }
        }
        continue; // Siguiente iteración del loop
      }

      // Respuesta final de texto
      const content = choice.message.content ?? "";
      this.messages.push({ role: "assistant", content });
      emit({ type: "text", data: { content }, timestamp: Date.now() });
      break;
    }

    emit({ type: "done", data: null, timestamp: Date.now() });
    res.end();
  }

  reset(): void {
    this.messages = [{ role: "system", content: SYSTEM_PROMPT }];
  }
}
