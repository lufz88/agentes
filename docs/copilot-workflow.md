# 🤖 Workflow con GitHub Copilot + Claude para Agentes de IA

## Filosofía: Copilot como tu "Pair Programmer" para Agentes

Copilot con Claude entiende arquitecturas agénticas. No lo uses solo para autocompletar — úsalo como un **debugger de razonamiento** y **arquitecto de sistemas**.

---

## 1. Debugear Reasoning Loops (Chain of Thought)

### Prompt: "Analiza mi reasoning loop"

Cuando tu agente entra en loop infinito o toma decisiones incorrectas, pega el historial de mensajes y pregunta:

```
Aquí está el historial de mi agente (messages array).
El agente debería haber respondido al usuario pero en su lugar
siguió llamando al tool "get_weather" 5 veces seguidas.

[pega el JSON del historial]

¿Por qué el LLM sigue en loop? ¿Qué cambio en el system prompt
o tool descriptions lo arreglaría?
```

**Lo que Claude hace bien aquí:**
- Identifica si la tool description es ambigua
- Detecta si el tool result no da suficiente info al LLM para "salir" del loop
- Sugiere cambios al system prompt para establecer criterios de parada

### Prompt: "Traza la ejecución"

```
Traza paso a paso qué haría mi agente con este input:
"Compara el clima de Madrid y Barcelona y dime cuál es mejor para ir de vacaciones"

Dado este system prompt: [...]
Y estos tools: [...]

Muestra cada iteración del reasoning loop:
1. Qué piensa el LLM
2. Qué tool_calls genera
3. Qué resultados recibe
4. Si decide seguir o responder
```

---

## 2. Diseñar Tool Definitions

### Prompt: "Genera el schema del tool"

```
Necesito un tool para mi agente que consulte la base de datos de PostgreSQL.
El agente debería poder:
- Hacer queries SELECT
- Filtrar por fecha, categoría y rango de precio
- Limitar resultados

Genera:
1. La ToolDefinition con JSON Schema completo
2. El Zod schema para validación
3. La función execute con manejo de errores
4. Tests del tool
```

### Prompt: "Optimiza mis descriptions"

```
Estos son mis tool definitions actuales.
El LLM a veces usa "calculator" cuando debería usar "search_documents"
y viceversa.

[pega las definitions]

Reescribe las descriptions para que el LLM pueda distinguir
claramente cuándo usar cada uno. Incluye ejemplos de uso.
```

---

## 3. Diseñar System Prompts

### Prompt: "System prompt para agente especializado"

```
Diseña un system prompt para un agente que:
- Tiene acceso a: [lista de tools]
- Su dominio es: [ej: análisis financiero]
- Debe seguir estas reglas: [ej: siempre citar fuentes]
- Tono: [ej: profesional pero accesible]

Incluye:
1. Descripción del rol
2. Lista de capacidades
3. Reglas de comportamiento
4. Manejo de errores
5. Formato de respuesta
```

---

## 4. Arquitectura Multi-Agente

### Prompt: "Diseña la orquestación"

```
Necesito un sistema multi-agente para [caso de uso].

Tengo estos agentes especializados:
- Investigador: busca en documentos
- Analista: procesa datos numéricos
- Redactor: genera reportes

Diseña:
1. El Router Agent (prompt + lógica de routing)
2. El protocolo de comunicación entre agentes
3. El formato de "handoff" (cómo un agente pasa contexto a otro)
4. Manejo de fallos y fallbacks
```

---

## 5. Debugging en Vivo con Copilot Chat

### Workflow recomendado:

1. **Selecciona código** del reasoning loop → `Ctrl+Shift+I` (inline chat)
2. Pregunta: "¿Es posible que este loop no termine? ¿Bajo qué condiciones?"
3. Copilot analiza el flujo y señala edge cases

### Para errores de tool calling:

```
Este tool retorna el siguiente error al agente:
{"error": "Cannot read property 'temperature' of undefined"}

El LLM luego intenta llamar al mismo tool con los mismos args.
¿Cómo hago que el agente se recupere de errores de tools?
Muéstrame el patrón de retry con backoff y fallback.
```

---

## 6. Testing de Agentes

### Prompt: "Test del reasoning loop"

```
Escribe tests para mi agente que verifiquen:
1. Que usa el tool correcto para cada tipo de pregunta
2. Que no entra en loops infinitos (max iterations)
3. Que maneja errores de tools gracefully
4. Que el historial se mantiene correctamente
5. Que el agente puede encadenar múltiples tools

Usa vitest/jest. Mock el LLM client para controlar las respuestas.
```

---

## 7. Prompts Avanzados para Copilot

### Generar un tool completo desde un API spec

```
Aquí está el OpenAPI spec de mi backend:
[pega el YAML/JSON]

Genera tools para mi agente que cubran estos endpoints.
Cada tool debe:
- Tener una ToolDefinition con description detallada
- Validar args con Zod
- Manejar errores HTTP
- Retornar datos formateados para el LLM
```

### Optimizar token usage

```
Mi agente consume muchos tokens porque el historial crece rápido.
Los tool results son muy largos (JSON de APIs).

Muéstrame cómo implementar:
1. Summarization del historial (comprimir mensajes antiguos)
2. Truncation inteligente de tool results
3. Sliding window de contexto
4. Estimación de tokens antes de la llamada al LLM
```

### Migrar de OpenAI Functions a Tool Calling genérico

```
Tengo este código que usa openai.chat.completions con functions (legacy).
Migra a la API de tools actual, manteniendo compatibilidad con:
- OpenAI
- Anthropic (Claude)
- Ollama (local)

[pega el código]
```

---

## Cheatsheet de Prompts para el Chat

| Situación | Prompt |
|---|---|
| Loop infinito | "¿Por qué mi agente sigue ejecutando tools sin responder? [historial]" |
| Tool incorrecto | "El LLM elige X cuando debería elegir Y. ¿Cómo mejoro las descriptions?" |
| Respuesta pobre | "El agente usa la tool correcta pero da mala respuesta. ¿El system prompt está mal?" |
| Error de parsing | "El LLM genera JSON malformado en los tool args. ¿Cómo hago retry?" |
| Performance | "Mi reasoning loop es lento. ¿Puedo ejecutar tools en paralelo?" |
| Arquitectura | "¿Debería usar un solo agente con 15 tools o 3 agentes especializados?" |
| State | "¿Cómo persisto el state del agente entre requests HTTP?" |
| Streaming | "¿Cómo hago streaming del reasoning loop al frontend?" |

---

## Tip Final: Usa el Chat de Copilot como "LLM Inspector"

Cuando desarrollas agentes, *tú eres el humano observando cómo otro LLM razona*. 
Copilot/Claude es perfecto para esta meta-tarea:

> "Pon teniéndote como un LLM que recibe este prompt y estos tools.
> ¿Qué tool_calls generarías? ¿Por qué? ¿Hay ambigüedad?"

Esto te da **visibilidad** sobre el razonamiento del LLM sin gastar tokens en OpenAI.
