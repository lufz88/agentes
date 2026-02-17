# 🔧 Tool Calling en TypeScript — Referencia Completa

## Qué es Tool Calling

Tool Calling (también llamado Function Calling) es el mecanismo por el cual un LLM **solicita** la ejecución de funciones externas. El LLM **no ejecuta código** — solo genera un JSON estructurado indicando qué función quiere llamar y con qué argumentos.

```
Usuario: "¿Cuánto es 15% de 340?"
    ↓
LLM (piensa): "Necesito la calculadora"
    ↓
LLM (genera): { tool: "calculator", args: { expression: "340 * 0.15" } }
    ↓
TU CÓDIGO: ejecuta la función → resultado: 51
    ↓
LLM (recibe resultado y responde): "El 15% de 340 es 51"
```

---

## Anatomía de un Tool

### 1. Tool Definition (JSON Schema)

Esto es lo que el LLM recibe para entender el tool:

```typescript
interface ToolDefinition {
  name: string;           // ID único — el LLM lo usa para invocar
  description: string;    // CRUCIAL: el LLM decide cuándo usar el tool basándose en esto
  parameters: {
    type: "object";
    properties: Record<string, {
      type: "string" | "number" | "boolean" | "array" | "object";
      description: string;   // Cada param necesita descripción clara
      enum?: string[];        // Valores permitidos (opcional)
      items?: {...};          // Para arrays
    }>;
    required: string[];      // Params obligatorios
  };
}
```

### 2. Tool Implementation

```typescript
interface Tool {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>) => Promise<string>;
  //                                          ^^^^^^^^^^^^^^^^
  //       Siempre retorna string — el LLM solo entiende texto
}
```

### 3. Validación con Zod

```typescript
import { z } from "zod";

const ArgsSchema = z.object({
  city: z.string().min(1).describe("Nombre de la ciudad"),
  units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

async function execute(args: Record<string, unknown>) {
  const parsed = ArgsSchema.parse(args); // Lanza error si invalido
  // ... lógica del tool
}
```

---

## Cómo enviar Tools al LLM (OpenAI API)

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "Eres un asistente..." },
    { role: "user", content: "¿Qué clima hace en Madrid?" }
  ],
  // 👇 Aquí defines los tools disponibles
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Obtiene el clima actual de una ciudad",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "Nombre de la ciudad" }
          },
          required: ["city"]
        }
      }
    }
  ],
  tool_choice: "auto"  // "auto" | "none" | { type: "function", function: { name: "..." } }
});
```

---

## Procesando la Respuesta

```typescript
const choice = response.choices[0];

if (choice.message.tool_calls) {
  // El LLM quiere ejecutar tools
  for (const toolCall of choice.message.tool_calls) {
    const { name, arguments: argsJson } = toolCall.function;
    const args = JSON.parse(argsJson);
    
    // Ejecutar el tool
    const result = await myTools[name].execute(args);
    
    // IMPORTANTE: enviar el resultado de vuelta al LLM
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: choice.message.tool_calls  // Incluir las tool_calls originales
    });
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,     // DEBE coincidir con el ID del tool_call
      content: result                 // El resultado como string
    });
  }
  
  // Volver a llamar al LLM con los resultados
  const finalResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
    tools: tools,
  });
  // Ahora el LLM genera la respuesta final usando los resultados
}
```

---

## Patrones Avanzados

### Parallel Tool Calls

El LLM puede solicitar múltiples tools en una sola respuesta:

```typescript
// El LLM genera:
// tool_calls: [
//   { id: "call_1", function: { name: "get_weather", args: '{"city":"Madrid"}' } },
//   { id: "call_2", function: { name: "get_weather", args: '{"city":"Barcelona"}' } }
// ]

// Ejecutar en paralelo:
const results = await Promise.all(
  toolCalls.map(tc => executeTool(tc))
);
```

### Forced Tool Use

```typescript
// Forzar que el LLM use un tool específico:
tool_choice: { type: "function", function: { name: "get_weather" } }

// Prohibir el uso de tools:
tool_choice: "none"
```

### Tool que retorna datos estructurados

```typescript
async function execute(args) {
  const data = await fetchFromAPI(args);
  
  // Retorna JSON para que el LLM pueda parsear los datos
  return JSON.stringify({
    success: true,
    data: data,
    metadata: {
      source: "mi-api",
      timestamp: new Date().toISOString()
    }
  });
}
```

---

## Tips de Descripción (lo que más impacta)

| ❌ Mal | ✅ Bien |
|---|---|
| `"Obtiene clima"` | `"Obtiene el clima actual de una ciudad específica. Usa cuando el usuario pregunte por temperatura, pronóstico o condiciones climáticas"` |
| `"Calcula"` | `"Evalúa expresiones matemáticas. Usa para aritmética, porcentajes, conversiones. Ejemplos: '15% de 200', 'Math.sqrt(144)'"` |
| `"Busca archivos"` | `"Lista archivos y carpetas en un directorio del sistema. Retorna nombre, tipo y tamaño. Default: directorio actual."` |

**Regla de oro**: La description es el "manual de instrucciones" para el LLM.
Cuanto más clara y con más ejemplos, mejor decidirá cuándo usar cada tool.

---

## Debugging Tool Calls

```typescript
// Añade logging a cada paso del reasoning loop:
function log(step: string, data: unknown) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    step,
    data,
    tokenEstimate: JSON.stringify(data).length / 4, // Estimado rough
  }, null, 2));
}

// En el loop:
log("llm_request", { messageCount: messages.length, toolCount: tools.length });
log("llm_response", { hasToolCalls: response.hasToolCalls, content: response.content?.slice(0, 100) });
log("tool_execution", { name, args, result: result.slice(0, 200) });
```
