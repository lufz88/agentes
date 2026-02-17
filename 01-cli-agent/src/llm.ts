// ============================================================
// llm.ts — Cliente LLM (OpenAI-compatible)
// ============================================================
// Abstracción sobre la API de OpenAI. Compatible con:
// - OpenAI directamente
// - Azure OpenAI
// - Ollama (local)
// - Cualquier API compatible con el formato OpenAI
// ============================================================

import OpenAI from "openai";
import type { LLMConfig, LLMResponse, Message, ToolDefinition } from "./types.js";

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
  }

  /**
   * Envía mensajes al LLM y recibe una respuesta.
   * (ver docs/summary.md#reasoning-loop)
   * 
   * CONCEPTO CLAVE: El LLM puede responder de dos formas:
   * 1. Con "content" → respuesta de texto al usuario
   * 2. Con "tool_calls" → quiere ejecutar funciones antes de responder
   * 
   * El agente debe manejar ambos casos en su reasoning loop.
   */
  async chat(
    messages: Message[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    // Construir el request para la API
    const request: OpenAI.Chat.ChatCompletionCreateParams = {
      model: this.model,
      messages: messages.map((m) => this.toOpenAIMessage(m)),
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };

    // Solo añadir tools si hay alguno definido
    if (tools && tools.length > 0) {
      request.tools = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as unknown as Record<string, unknown>,
        },
      }));
      // "auto" = el LLM decide si usar tools o responder directamente
      request.tool_choice = "auto";
    }

    const response = await this.client.chat.completions.create(request);
    const choice = response.choices[0];

    if (!choice?.message) {
      throw new Error("No response from LLM");
    }

    const toolCalls = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      content: choice.message.content,
      toolCalls,
      hasToolCalls: toolCalls.length > 0,
    };
  }

  /**
   * Convierte nuestro formato de mensaje al formato de OpenAI.
   */
  private toOpenAIMessage(
    msg: Message
  ): OpenAI.Chat.ChatCompletionMessageParam {
    if (msg.role === "tool") {
      return {
        role: "tool",
        content: msg.content ?? "",
        tool_call_id: msg.tool_call_id ?? "",
      };
    }

    if (msg.role === "assistant" && msg.tool_calls) {
      return {
        role: "assistant",
        content: msg.content,
        tool_calls: msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };
    }

    return {
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content ?? "",
    };
  }
}
