// ============================================================
// index.ts — Entry Point: CLI interactiva
// ============================================================
// Un REPL (Read-Eval-Print Loop) que te permite chatear
// con el agente desde la terminal.
//
// Uso: npm run dev
// ============================================================

import { createInterface } from "node:readline";
import chalk from "chalk";
import { Agent } from "./agent.js";
import type { LLMConfig } from "./types.js";

// ---- Proveedores gratuitos (todos compatibles con API OpenAI) ----
const PROVIDERS: Record<string, { baseURL: string; model: string; label: string }> = {
  ollama:   { baseURL: "http://localhost:11434/v1",                                  model: "llama3.1",                  label: "Ollama (local)" },
  groq:     { baseURL: "https://api.groq.com/openai/v1",                             model: "llama-3.1-70b-versatile",   label: "Groq Cloud (gratis)" },
  gemini:   { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",    model: "gemini-2.0-flash",          label: "Google Gemini (gratis)" },
  openai:   { baseURL: "https://api.openai.com/v1",                                  model: "gpt-4o-mini",               label: "OpenAI (pago)" },
  github:   { baseURL: "https://models.inference.ai.azure.com",                      model: "gpt-4o-mini",               label: "GitHub Models (gratis con GitHub)" },
};

// Detectar proveedor: env PROVIDER=groq o auto-detectar
const providerName = (process.env.PROVIDER ?? "ollama").toLowerCase();
const provider = PROVIDERS[providerName] ?? PROVIDERS.ollama;

const config: LLMConfig = {
  apiKey: process.env.OPENAI_API_KEY ?? (providerName === "ollama" ? "ollama" : ""),
  model: process.env.MODEL ?? provider.model,
  baseURL: process.env.OPENAI_BASE_URL ?? provider.baseURL,
  temperature: 0.7,
  maxTokens: 4096,
};

if (!config.apiKey) {
  console.error(
    chalk.red("❌ Falta API key.\n") +
    chalk.white("\n  Opciones GRATUITAS:\n") +
    chalk.green(
      "  ┌──────────────────────────────────────────────────────────────┐\n" +
      "  │ 1. OLLAMA (local, sin key, sin internet)                    │\n" +
      "  │    curl -fsSL https://ollama.com/install.sh | sh            │\n" +
      "  │    ollama pull llama3.1                                     │\n" +
      "  │    npm run dev                  # ya está configurado       │\n" +
      "  ├──────────────────────────────────────────────────────────────┤\n" +
      "  │ 2. GROQ (cloud, muy rápido, free tier)                     │\n" +
      "  │    → https://console.groq.com  (crea cuenta, genera key)   │\n" +
      "  │    PROVIDER=groq OPENAI_API_KEY=gsk_... npm run dev        │\n" +
      "  ├──────────────────────────────────────────────────────────────┤\n" +
      "  │ 3. GOOGLE GEMINI (cloud, free tier generoso)               │\n" +
      "  │    → https://aistudio.google.com/apikey                    │\n" +
      "  │    PROVIDER=gemini OPENAI_API_KEY=... npm run dev          │\n" +
      "  ├──────────────────────────────────────────────────────────────┤\n" +
      "  │ 4. GITHUB MODELS (gratis con cuenta GitHub)                │\n" +
      "  │    → https://github.com/marketplace/models                 │\n" +
      "  │    PROVIDER=github OPENAI_API_KEY=ghp_... npm run dev      │\n" +
      "  └──────────────────────────────────────────────────────────────┘\n"
    )
  );
  process.exit(1);
}

console.log(chalk.gray(`⚙️  Proveedor: ${provider.label} | Modelo: ${config.model}`));

// ---- Crear el agente ----
const agent = new Agent(config);

// ---- REPL ----
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(
  chalk.bold.cyan(`
╔═══════════════════════════════════════════════╗
║       🤖 CLI Agent — Zero to Hero            ║
║                                               ║
║  Tools: clima, calculadora, filesystem        ║
║  Comandos especiales:                         ║
║    /history  — Ver historial de mensajes      ║
║    /reset    — Limpiar conversación           ║
║    /tools    — Ver tools disponibles          ║
║    /exit     — Salir                          ║
╚═══════════════════════════════════════════════╝
`)
);

function prompt(): void {
  rl.question(chalk.bold.green("\n👤 Tú: "), async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      prompt();
      return;
    }

    // Comandos especiales
    if (trimmed.startsWith("/")) {
      handleCommand(trimmed);
      prompt();
      return;
    }

    try {
      console.log(chalk.gray("\n─── Agente procesando... ───\n"));
      const response = await agent.run(trimmed);
      console.log(chalk.bold.cyan(`\n🤖 Agente: `) + response);
    } catch (error) {
      console.error(
        chalk.red(`\n❌ Error: ${(error as Error).message}`)
      );
    }

    prompt();
  });
}

function handleCommand(cmd: string): void {
  switch (cmd.toLowerCase()) {
    case "/history": {
      const history = agent.getHistory();
      console.log(chalk.cyan("\n📜 Historial de mensajes:\n"));
      for (const msg of history) {
        const roleColor = {
          system: chalk.gray,
          user: chalk.green,
          assistant: chalk.cyan,
          tool: chalk.yellow,
        }[msg.role] ?? chalk.white;

        const preview =
          (msg.content ?? "[tool_calls]").slice(0, 120) +
          ((msg.content?.length ?? 0) > 120 ? "..." : "");
        console.log(roleColor(`  [${msg.role}] ${preview}`));
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            console.log(chalk.yellow(`    ↳ ${tc.function.name}(${tc.function.arguments.slice(0, 60)})`));
          }
        }
      }
      break;
    }
    case "/reset":
      agent.reset();
      console.log(chalk.cyan("🔄 Conversación reiniciada."));
      break;
    case "/tools":
      console.log(chalk.cyan("\n🔧 Tools disponibles:\n"));
      // Re-import to show definitions
      import("./tools/index.js").then(({ allTools }) => {
        for (const tool of allTools) {
          console.log(
            chalk.yellow(`  • ${tool.definition.name}`) +
              chalk.gray(` — ${tool.definition.description.slice(0, 70)}...`)
          );
        }
      });
      break;
    case "/exit":
      console.log(chalk.cyan("👋 ¡Hasta luego!"));
      process.exit(0);
    default:
      console.log(chalk.gray(`Comando no reconocido: ${cmd}`));
      console.log(chalk.gray("Comandos: /history, /reset, /tools, /exit"));
  }
}

// Arrancar el REPL
prompt();
