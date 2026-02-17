// ============================================================
// agent.ts — El Reasoning Loop (Corazón del Agente)
// ============================================================
// (ver docs/summary.md#reasoning-loop)
//
//  ESTE ES EL ARCHIVO MÁS IMPORTANTE DEL PROYECTO.
//
//  El reasoning loop implementa el patrón:
//
//     THINK → ACT → OBSERVE → (repeat or respond)
//
//  Flujo detallado:
//  1. Recibir input del usuario
//  2. Enviar historial + tools al LLM (THINK)
//  3. Si el LLM responde con tool_calls → ejecutarlas (ACT)
//  4. Añadir resultados al historial (OBSERVE)
//  5. Volver al paso 2 (el LLM decide si necesita más info)
//  6. Si el LLM responde con content → retornar al usuario (DONE)
//
//  El truco: el LLM ve los resultados de tools anteriores como
//  parte del historial y decide si ya tiene suficiente info
//  para responder o necesita usar más tools.
//
// ============================================================

import chalk from "chalk";
import { LLMClient } from "./llm.js";
import { findTool, getToolDefinitions, allTools } from "./tools/index.js";
import type { AgentState, Message, ToolCall, LLMConfig } from "./types.js";

// ---- System Prompt ----
// (ver docs/summary.md#prompt-engineering-para-agentes)
// Define la personalidad y capacidades del agente.
// TIPS:
// - Sé explícito sobre qué tools tiene disponibles
// - Indica cuándo usar cada tool
// - Define el formato de respuesta esperado

const SYSTEM_PROMPT = `Eres un asistente inteligente con acceso a herramientas.

Tus capacidades:
- **Clima**: Puedes consultar el clima de cualquier ciudad
- **Calculadora**: Puedes evaluar expresiones matemáticas
- **File System**: Puedes leer archivos, escribir archivos y listar directorios

Reglas:
1. SIEMPRE usa las herramientas cuando necesites datos reales (no inventes)
2. Puedes usar MÚLTIPLES herramientas en secuencia si es necesario
3. Explica tu razonamiento antes de usar una herramienta
4. Si algo falla, intenta un enfoque alternativo
5. Responde SIEMPRE en español

Piensa paso a paso para problemas complejos.`;

export class Agent {
  private llm: LLMClient;
  private state: AgentState;

  constructor(config: LLMConfig) {
    this.llm = new LLMClient(config);
    this.state = {
      status: "idle",
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
      tools: allTools,
      iterations: 0,
      maxIterations: 10, // Seguridad: máximo 10 ciclos de tool calling
    };
  }

  /**
   * Procesa un mensaje del usuario y retorna la respuesta.
   * Este método implementa el REASONING LOOP completo.
   */
  async run(userInput: string): Promise<string> {
    // Añadir el mensaje del usuario al historial
    this.state.messages.push({ role: "user", content: userInput });
    this.state.iterations = 0;
    this.state.status = "thinking";

    this.log("think", `Procesando: "${userInput.slice(0, 60)}..."`);

    // ════════════════════════════════════════════
    //  REASONING LOOP — El bucle principal
    // ════════════════════════════════════════════
    while (this.state.iterations < this.state.maxIterations) {
      this.state.iterations++;
      this.log("loop", `Iteración ${this.state.iterations}/${this.state.maxIterations}`);

      // ── STEP 1: THINK ──
      // Enviar todo el historial + tool definitions al LLM
      const response = await this.llm.chat(
        this.state.messages,
        getToolDefinitions()
      );

      // ── STEP 2: ¿Tool calls o respuesta final? ──
      if (response.hasToolCalls) {
        // El LLM quiere usar tools → entrar en fase ACT
        this.state.status = "tool_calling";

        // Guardar el mensaje del assistant con sus tool_calls
        this.state.messages.push({
          role: "assistant",
          content: response.content,
          tool_calls: response.toolCalls,
        });

        // ── STEP 3: ACT — Ejecutar cada tool ──
        for (const toolCall of response.toolCalls) {
          const result = await this.executeTool(toolCall);

          // ── STEP 4: OBSERVE — Añadir resultado al historial ──
          this.state.messages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          });
        }

        // Volver al inicio del loop: el LLM verá los resultados
        // y decidirá si necesita más tools o ya puede responder
        continue;
      }

      // ── STEP 5: DONE — El LLM dio una respuesta final ──
      this.state.status = "done";
      const finalResponse = response.content ?? "No tengo una respuesta.";

      this.state.messages.push({
        role: "assistant",
        content: finalResponse,
      });

      this.log("done", `Respondido en ${this.state.iterations} iteración(es)`);
      return finalResponse;
    }

    // Seguridad: si llegamos aquí, el agente entró en loop infinito
    this.state.status = "error";
    const errorMsg =
      "⚠️ Se alcanzó el máximo de iteraciones. " +
      "Esto puede indicar que el agente entró en un loop. " +
      "Intenta reformular tu pregunta.";
    this.state.messages.push({ role: "assistant", content: errorMsg });
    return errorMsg;
  }

  /**
   * Ejecuta un tool call individual.
   * Maneja errores de forma graceful para que el LLM pueda recuperarse.
   * (ver docs/summary.md#patrones-de-error-y-recuperacion)
   */
  private async executeTool(toolCall: ToolCall): Promise<string> {
    const { name, arguments: argsString } = toolCall.function;

    this.log("tool", `Ejecutando: ${name}(${argsString.slice(0, 80)})`);

    // Buscar el tool en el registry
    const tool = findTool(name);
    if (!tool) {
      const error = `Tool "${name}" no encontrado. Tools disponibles: ${allTools.map((t) => t.definition.name).join(", ")}`;
      this.log("error", error);
      return JSON.stringify({ error });
    }

    try {
      // Parsear los argumentos JSON que generó el LLM
      const args = JSON.parse(argsString);

      // Ejecutar el tool
      const result = await tool.execute(args);

      this.log("result", `${name} → ${result.slice(0, 100)}...`);
      return result;
    } catch (error) {
      // IMPORTANTE: No lanzar la excepción. Retornar el error como string
      // para que el LLM pueda verlo y decidir qué hacer.
      const errorMsg = `Error ejecutando ${name}: ${(error as Error).message}`;
      this.log("error", errorMsg);
      return JSON.stringify({ error: errorMsg });
    }
  }

  /** Obtener el historial completo (útil para debugging) */
  getHistory(): Message[] {
    return [...this.state.messages];
  }

  /** Limpiar el historial (nuevo chat, mantiene system prompt) */
  reset(): void {
    this.state.messages = [{ role: "system", content: SYSTEM_PROMPT }];
    this.state.iterations = 0;
    this.state.status = "idle";
    this.log("info", "Historial limpiado");
  }

  /** Logger con formato bonito para la CLI */
  private log(type: string, message: string): void {
    const prefix = {
      think: chalk.blue("🧠 [THINK]"),
      loop: chalk.gray("🔄 [LOOP] "),
      tool: chalk.yellow("🔧 [TOOL] "),
      result: chalk.green("📊 [RESULT]"),
      done: chalk.green("✅ [DONE] "),
      error: chalk.red("❌ [ERROR]"),
      info: chalk.cyan("ℹ️  [INFO] "),
    }[type] ?? chalk.white(`[${type}]`);

    console.log(`${prefix} ${message}`);
  }
}
