// ============================================================
// tools/calculator.tool.ts — Tool de Calculadora
// ============================================================
// (ver docs/summary.md#tool-calling)
// Ejemplo de tool con validación estricta y manejo de errores.
// El LLM enviará expresiones matemáticas como strings.
// ============================================================

import { z } from "zod";
import type { Tool, ToolDefinition } from "../types.js";

const definition: ToolDefinition = {
  name: "calculator",
  description:
    "Evalúa expresiones matemáticas. Usa este tool para cualquier cálculo " +
    "numérico: aritmética, porcentajes, conversiones, etc. " +
    "Ejemplos: '2 + 2', '15% de 200', 'Math.sqrt(144)', '(3.14 * 10**2)'.",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description:
          "Expresión matemática válida en JavaScript. " +
          "Puede usar Math.*, operadores estándar, paréntesis.",
      },
    },
    required: ["expression"],
  },
};

const ArgsSchema = z.object({
  expression: z.string().min(1),
});

/**
 * Evalúa una expresión matemática de forma segura.
 *
 * NOTA DE SEGURIDAD: En producción, usa una librería como `mathjs`
 * en lugar de Function(). Aquí lo simplificamos para el aprendizaje.
 */
async function execute(args: Record<string, unknown>): Promise<string> {
  const { expression } = ArgsSchema.parse(args);

  // Whitelist de caracteres permitidos (seguridad básica)
  const sanitized = expression.replace(/[^0-9+\-*/().%\s,a-zA-Z]/g, "");

  try {
    // Crear un contexto seguro con funciones Math disponibles
    const mathContext = Object.getOwnPropertyNames(Math)
      .map((name) => `const ${name} = Math.${name};`)
      .join("\n");

    const fn = new Function(`
      "use strict";
      ${mathContext}
      return (${sanitized});
    `);

    const result = fn();

    if (typeof result !== "number" || !isFinite(result)) {
      return JSON.stringify({
        error: "La expresión no produjo un número válido",
        expression,
        result: String(result),
      });
    }

    return JSON.stringify({
      expression,
      result,
      formatted: result.toLocaleString("es-ES"),
    });
  } catch (error) {
    return JSON.stringify({
      error: `Error al evaluar: ${(error as Error).message}`,
      expression,
    });
  }
}

export const calculatorTool: Tool = { definition, execute };
