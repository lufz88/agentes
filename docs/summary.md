# 📖 Summary — Conceptos Clave de Arquitecturas Agénticas

> Archivo de referencia para el workspace **Zero to Hero: Arquitecturas Agénticas**.
> Los comentarios del código fuente referencian secciones de este archivo usando el formato:
> `(ver docs/summary.md#nombre-de-seccion)`

---

## Tabla de contenidos

1. [¿Qué es un Agente?](#que-es-un-agente)
2. [Reasoning Loop](#reasoning-loop)
3. [Tool Calling](#tool-calling)
4. [Zod y validación runtime](#zod-y-validacion-runtime)
5. [Prompt Engineering para agentes](#prompt-engineering-para-agentes)
6. [RAG (Retrieval-Augmented Generation)](#rag-retrieval-augmented-generation)
   - [Embeddings](#embeddings)
   - [Chunking](#chunking)
   - [Vector Store y similitud coseno](#vector-store-y-similitud-coseno)
   - [El pipeline completo](#el-pipeline-completo-rag)
7. [SSE (Server-Sent Events)](#sse-server-sent-events)
8. [Generative UI](#generative-ui)
9. [State Management agéntico (Zustand)](#state-management-agéntico-zustand)
10. [Multi-Agent Orchestration](#multi-agent-orchestration)
11. [Tool Calling: TypeScript vs Java (Spring AI)](#tool-calling-typescript-vs-java)
12. [Patrones de error y recuperación](#patrones-de-error-y-recuperacion)
13. [Multi-Provider: configuración compartida](#multi-provider-configuracion-compartida)
14. [Cómo testear el proyecto 03 (Java RAG)](#como-testear-proyecto-03)
15. [Glosario rápido](#glosario-rapido)

---

## ¿Qué es un Agente? {#que-es-un-agente}

Un **agente** es un programa que usa un LLM (Large Language Model) como "cerebro" para tomar
decisiones en un loop, con la capacidad de ejecutar acciones en el mundo real a través de **tools**.

La diferencia clave entre un agente y un simple chatbot:

| | Chatbot | Agente |
|---|---|---|
| **Flujo** | Input → LLM → Output | Input → LLM → (Tool? → Observe → LLM)* → Output |
| **Decisiones** | Ninguna | Elige qué tools usar, cuándo, y en qué orden |
| **Iteraciones** | 1 (single-shot) | N (loop hasta tener suficiente info) |
| **Estado** | Sin estado (o estado mínimo) | Historial completo + resultados de tools |
| **Capacidades** | Solo texto | Texto + acciones (APIs, archivos, cálculos, UI, etc.) |

### Analogía

Pensá en un agente como un analista que tiene acceso a herramientas:
- Le hacés una pregunta
- El analista **piensa** qué información necesita
- **Usa** sus herramientas (buscar en documentos, hacer cálculos)
- **Observa** los resultados
- Decide si necesita más info o ya puede responder
- Te da una **respuesta fundamentada**

El LLM es el "cerebro" del analista. Los tools son sus herramientas. El reasoning loop
es su proceso de pensamiento.

### En este proyecto

- **`01-cli-agent`**: Agente básico con tools de clima, calculadora y filesystem
- **`02-generative-ui`**: Agente que además controla componentes de UI
- **`03-java-rag-agent`**: Agente con acceso a documentos (RAG) y orquestación multi-agente

---

## Reasoning Loop {#reasoning-loop}

El **reasoning loop** es el corazón de cualquier agente. Es un ciclo que se repite hasta que el
agente tiene suficiente información para responder:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   USER INPUT                                               │
│       │                                                    │
│       ▼                                                    │
│   ┌────────┐    ¿tool_calls?   ┌──────────┐               │
│   │ THINK  │──── SÍ ──────────▶│   ACT    │               │
│   │        │                    │(ejecutar │               │
│   │(llamar │                    │ tools)   │               │
│   │ al LLM)│                    └────┬─────┘               │
│   └───┬────┘                         │                     │
│       │                         ┌────▼─────┐               │
│       │ NO                      │ OBSERVE  │               │
│    (content)                    │(añadir   │               │
│       │                         │resultados│               │
│       ▼                         │al histor.)│              │
│   ┌────────┐                    └────┬─────┘               │
│   │  DONE  │                         │                     │
│   │(respon-│             ┌───────────┘                     │
│   │ der al │             │ (volver al LLM                  │
│   │usuario)│             │  con los resultados)            │
│   └────────┘             └─────────────▶ THINK             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Cómo funciona paso a paso

1. **THINK**: Se envía el historial completo (mensajes del usuario + resultados previos de tools)
   al LLM junto con las definiciones de tools disponibles.

2. **El LLM responde de una de dos formas**:
   - `content`: texto para el usuario → **DONE**
   - `tool_calls`: array de funciones que quiere ejecutar → **ACT**

3. **ACT**: Se ejecuta cada tool call. Los argumentos vienen como JSON string del LLM.

4. **OBSERVE**: Los resultados de los tools se agregan al historial como mensajes con
   `role: "tool"`. Esto es clave: el LLM **ve** estos resultados en la siguiente iteración.

5. **Loop**: Se vuelve al paso 1. Ahora el LLM tiene más contexto y puede decidir:
   - Usar otro tool (necesita más info)
   - Responder al usuario (ya tiene suficiente)

### Protección anti-loop infinito

Es crítico tener un **máximo de iteraciones**. Si el LLM se confunde, podría llamar tools
indefinidamente. En este proyecto:

- `01-cli-agent`: máximo **10** iteraciones (`agent.ts L62`)
- `02-generative-ui`: máximo **8** iteraciones (`agent.ts L101`)

### ¿Por qué el LLM "entiende" los resultados?

Porque los resultados de tools se agregan al historial de mensajes como `role: "tool"`,
con un `tool_call_id` que vincula la respuesta a la llamada original. El LLM fue entrenado
para interpretar este formato y usar la información en sus siguientes decisiones.

### Ejemplo de historial en una iteración típica

```json
[
  { "role": "system", "content": "Eres un asistente..." },
  { "role": "user", "content": "¿Qué clima hace en Madrid?" },
  { "role": "assistant", "tool_calls": [{ "id": "call_1", "function": { "name": "get_weather", "arguments": "{\"city\":\"Madrid\"}" }}] },
  { "role": "tool", "tool_call_id": "call_1", "content": "{\"temperature\":22,\"condition\":\"soleado\"}" },
  { "role": "assistant", "content": "En Madrid hace 22°C y está soleado." }
]
```

Notá que el historial crece con cada iteración. Esto es lo que da al agente "memoria"
dentro de un turno.

---

## Tool Calling {#tool-calling}

**Tool calling** es el mecanismo por el cual un LLM puede "ejecutar funciones" en tu sistema.
El LLM **no ejecuta código**: genera un JSON declarando qué función quiere llamar y con qué
argumentos. Tu código es el responsable de ejecutar la función y devolver el resultado.

### Las 3 partes de un Tool

Cada tool tiene 3 componentes:

#### 1. Definición (JSON Schema) — Lo que el LLM ve

```typescript
const definition: ToolDefinition = {
  name: "get_weather",           // Nombre único
  description: "Obtiene el clima actual de una ciudad...", // CRÍTICO: el LLM usa esto para decidir
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "Nombre de la ciudad" },
      units: { type: "string", enum: ["celsius", "fahrenheit"] }
    },
    required: ["city"]
  }
};
```

La `description` es el factor más importante. Una mala descripción = el LLM no sabe cuándo
usar el tool. Reglas para buenas descripciones:
- Decí **cuándo** usar el tool, no solo qué hace
- Incluí ejemplos de inputs
- Sé específico sobre limitaciones

#### 2. Validación con Zod — Protección runtime

Los argumentos del LLM llegan como JSON string. Pueden estar mal formados.
Zod los valida antes de ejecutar (ver [#zod-y-validacion-runtime]).

#### 3. Función execute — La lógica real

La función que realmente hace el trabajo. Recibe los argumentos validados y retorna un string
(los LLMs trabajan con texto).

### tool_choice: "auto" vs "required" vs "none"

- `"auto"` (default): El LLM decide si usar tools o responder directamente
- `"required"`: El LLM DEBE usar al menos un tool (útil para forzar acciones)
- `"none"`: El LLM NO puede usar tools (útil para forzar texto)

### Tool calls paralelos

El LLM puede generar **múltiples tool_calls** en una sola respuesta. Ejemplo: si le pedís
"¿clima en Madrid y Buenos Aires?", puede generar dos `get_weather` simultáneos.
En `01-cli-agent`, estos se ejecutan secuencialmente en un `for`. En producción, se puede usar
`Promise.all` para paralelizar.

### Capacidades emergentes: encadenamiento de tools

Algo fascinante: el LLM puede descubrir por sí mismo que puede **encadenar** tools.
Si le pedís "¿qué archivos hay en /tmp y leé el más reciente?", el agente:
1. Usa `list_directory` para ver los archivos
2. Ve el resultado
3. Usa `read_file` con el archivo más reciente

Nadie le programó esta secuencia. La deduce del contexto. Esto se llama
**capacidad emergente** y es uno de los aspectos más potentes de los agentes.

---

## Zod y validación runtime {#zod-y-validacion-runtime}

### ¿Qué es Zod?

[Zod](https://zod.dev) es una librería de TypeScript para **validación y parsing de datos en
runtime**. A diferencia de los tipos de TypeScript (que existen solo en compilación y luego
desaparecen), Zod valida datos reales en tiempo de ejecución.

### ¿Por qué se necesita en un agente?

El LLM genera argumentos como **JSON strings**. Estos pueden tener errores:

```
LLM genera:  { "city": "Madrid", "units": "kelvin" }  ← "kelvin" no es válido
Esperabas:   { "city": "Madrid", "units": "celsius" | "fahrenheit" }
```

TypeScript no puede detectar esto en runtime porque sus tipos se borran después de compilar.
Zod sí puede:

```typescript
const ArgsSchema = z.object({
  city: z.string().min(1),
  units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

ArgsSchema.parse(args); // ← Tira ZodError si "kelvin" viene como valor
```

### Dual-layer de validación

En este proyecto se usan **dos capas** de validación:

```
                    ┌─────────────────────────────────┐
                    │  JSON Schema en ToolDefinition   │  ← El LLM LEE esto
                    │  (lo que el LLM ve)              │     para generar args
                    └──────────┬──────────────────────┘
                               │
                    LLM genera JSON string
                               │
                    ┌──────────▼──────────────────────┐
                    │  Zod Schema (.parse())            │  ← Tu código EJECUTA esto
                    │  (validación runtime)             │     antes de usar los args
                    └──────────┬──────────────────────┘
                               │
                    Args validados → execute()
```

- **Capa 1 (JSON Schema)**: Le dice al LLM qué estructura crear. Es "advisory" — el LLM
  puede ignorarlo o equivocarse.
- **Capa 2 (Zod)**: Valida lo que el LLM realmente generó. Es "enforcing" — si falla,
  el error se devuelve al LLM para que corrija.

### Métodos clave de Zod en este proyecto

| Método | Qué hace | Ejemplo |
|--------|----------|---------|
| `z.string()` | Valida que sea string | `z.string().min(1)` |
| `z.number()` | Valida que sea número | `z.number().min(-90).max(90)` |
| `z.enum()` | Valida que sea uno de los valores | `z.enum(["celsius","fahrenheit"])` |
| `z.object()` | Valida un objeto con schema | `z.object({ city: z.string() })` |
| `.default()` | Valor por defecto si falta | `.default("celsius")` |
| `.describe()` | Documentación (no afecta validación) | `.describe("Expresión matemática")` |
| `.parse()` | Valida y retorna tipado — tira error si falla | `schema.parse(input)` |
| `.safeParse()` | Igual pero retorna `{ success, data, error }` | `schema.safeParse(input)` |

### `.describe()` vs `description` en JSON Schema

Son cosas distintas:
- **`z.string().describe("...")`**: Metadata para desarrolladores o generación automática de schemas.
  No llega al LLM directamente.
- **`description` en ToolDefinition**: Texto que el LLM lee para entender el parámetro.

En este proyecto, los JSON Schemas se escriben manualmente (no se auto-generan desde Zod),
así que `.describe()` es solo documentación interna.

---

## Prompt Engineering para agentes {#prompt-engineering-para-agentes}

Diseñar prompts para agentes es diferente a diseñar prompts para chatbots.
Un agente necesita instrucciones claras sobre **cuándo y cómo usar tools**.

### Anatomía de un system prompt agéntico

```
┌──────────────────────────────────────────────┐
│ 1. ROL                                       │
│    "Eres un asistente inteligente con acceso  │
│     a herramientas."                          │
├──────────────────────────────────────────────┤
│ 2. CAPACIDADES (qué tools tiene)             │
│    "- Clima: consultar el clima              │
│     - Calculadora: evaluar expresiones       │
│     - File System: leer/escribir archivos"   │
├──────────────────────────────────────────────┤
│ 3. REGLAS (cuándo y cómo actuar)             │
│    "1. SIEMPRE usa herramientas para datos   │
│     2. Puedes usar MÚLTIPLES tools           │
│     3. Explica tu razonamiento               │
│     4. Si falla, intenta otro enfoque"       │
├──────────────────────────────────────────────┤
│ 4. FORMATO/ESTILO                            │
│    "Responde en español.                     │
│     Piensa paso a paso."                     │
└──────────────────────────────────────────────┘
```

### Diferencias clave entre los 3 proyectos

| Proyecto | Foco del prompt | Instrucción especial |
|----------|-----------------|----------------------|
| `01-cli-agent` | Tools genéricos | "Piensa paso a paso para problemas complejos" |
| `02-generative-ui` | Componentes visuales | "Es mejor mostrar que contar" — prioriza UI |
| `03-java-rag-agent` | Documentos y fuentes | "Fundamenta tus respuestas en el contexto proporcionado" |
| Router Agent (03) | Clasificación | "Responde SOLO con: RAG, DATA, o SUMMARY" |

### Tips concretos

1. **Listar las tools explícitamente** en el system prompt. No alcanza con que estén en
   `tools`: el LLM funciona mejor si su prompt textual las describe.

2. **"Piensa paso a paso"** (chain-of-thought) mejora el razonamiento del agente
   significativamente, especialmente en tareas complejas.

3. **Instrucciones de fallback**: "Si algo falla, intenta un enfoque alternativo"
   le da al agente permiso para recuperarse de errores.

4. **Restricciones de output** son útiles para el Router Agent: forzar que responda
   SOLO con una palabra reduce alucinaciones en tareas de clasificación.

---

## RAG (Retrieval-Augmented Generation) {#rag-retrieval-augmented-generation}

**RAG** es un patrón que le da al LLM acceso a **información que no tiene** en su entrenamiento.
En lugar de fine-tunear el modelo (costoso, lento), le "inyectamos" contexto relevante en el prompt.

### ¿Por qué RAG?

Los LLMs tienen limitaciones:
- **Corte de conocimiento**: Solo saben lo que vieron en el entrenamiento (ej: GPT-4 no
  sabe qué pasó ayer)
- **Sin datos privados**: No conocen los documentos internos de tu empresa
- **Alucinaciones**: Cuando no saben algo, inventan con confianza

RAG resuelve las 3: le das documentos actuales y privados, y el LLM responde basándose
en ellos (no inventa).

### El pipeline completo RAG {#el-pipeline-completo-rag}

```
    FASE OFFLINE (una vez, batch)           FASE ONLINE (por cada consulta)
    ═══════════════════════════             ═══════════════════════════════

    ┌────────────┐                          ┌──────────────┐
    │ Documentos │                          │ Query del    │
    │ (PDF, TXT, │                          │ usuario      │
    │  DOCX...)  │                          └──────┬───────┘
    └──────┬─────┘                                 │
           │                                       │
    ┌──────▼─────┐                          ┌──────▼───────┐
    │  1. PARSE  │                          │  2. EMBED    │
    │  (Tika)    │                          │  query       │
    └──────┬─────┘                          └──────┬───────┘
           │                                       │
    ┌──────▼─────┐                          ┌──────▼───────┐
    │  2. CHUNK  │                          │  3. SEARCH   │
    │(TokenText  │                          │  (similitud  │
    │ Splitter)  │                          │   coseno)    │
    └──────┬─────┘                          └──────┬───────┘
           │                                       │
    ┌──────▼─────┐                          ┌──────▼───────┐
    │  3. EMBED  │                          │  4. AUGMENT  │
    │  (vectores)│                          │  (contexto + │
    └──────┬─────┘                          │   query)     │
           │                                └──────┬───────┘
    ┌──────▼─────┐                                 │
    │  4. STORE  │                          ┌──────▼───────┐
    │  (Vector   │                          │  5. GENERATE │
    │   Store)   │                          │  (LLM con    │
    └────────────┘                          │   contexto)  │
                                            └──────────────┘
```

### Embeddings {#embeddings}

Un **embedding** es una representación numérica (vector) del significado de un texto.

```
"El gato está en el techo"  →  [0.23, -0.87, 0.12, 0.45, ..., -0.33]  (1536 dimensiones)
"El felino está arriba"     →  [0.21, -0.85, 0.14, 0.43, ..., -0.31]  (vectores similares!)
"Receta de pastel"          →  [0.95, 0.12, -0.74, 0.08, ..., 0.67]  (vector muy diferente)
```

Los textos con significado similar producen vectores cercanos en el espacio.
Esto permite **buscar por significado** en lugar de por palabras exactas.

**Modelo usado en `03-java-rag-agent`**: `text-embedding-3-small` de OpenAI — genera
vectores de 1536 dimensiones. Es rápido y barato, ideal para desarrollo.

**¿Cómo se generan?**: Spring AI los genera automáticamente al agregar documentos al
Vector Store y al hacer búsquedas. No necesitás llamar a la API de embeddings manualmente.

### Chunking {#chunking}

Los documentos largos no se pueden meter completos en un prompt (límite de tokens) ni
generar un solo embedding (pierde detalle). La solución: dividirlos en **chunks**.

```
┌──────────────────────────────────────────────────────────┐
│                   Documento original (50 páginas)         │
└──────────────────────────────────────────────────────────┘
                          │
                    chunk_size=800
                    chunk_overlap=200
                          │
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Chunk 1  │ │ Chunk 2  │ │ Chunk 3  │ │ Chunk N  │
    │ 800 tok  │ │ 800 tok  │ │ 800 tok  │ │ ≤800 tok │
    └──────────┘ └──────────┘ └──────────┘ └──────────┘
         ◄──200──►     ◄──200──►     ◄──200──►
            overlap       overlap       overlap
```

**¿Por qué overlap?** Sin overlap, una oración que cruza el límite entre dos chunks
queda cortada y pierde sentido. Con overlap de 200 tokens, los últimos 200 del chunk N
son los primeros 200 del chunk N+1. Así la información de borde se preserva.

**Configuración en `03-java-rag-agent`** (`application.yml`):
- `chunk-size: 800` — tamaño de cada chunk en tokens
- `chunk-overlap: 200` — cuántos tokens se solapan entre chunks consecutivos

**Trade-offs del chunk size**:
- **Muy chico** (100-200): búsqueda precisa pero pierde contexto
- **Muy grande** (2000+): mucho contexto pero mezcla temas, y ocupa más prompt
- **Sweet spot** (500-1000): balance entre precisión y contexto

### Vector Store y similitud coseno {#vector-store-y-similitud-coseno}

Un **Vector Store** es una base de datos optimizada para buscar por similitud entre vectores.

**Cómo funciona la búsqueda**:
1. La consulta del usuario se convierte a un embedding (vector)
2. Se compara ese vector contra todos los vectores almacenados
3. Se retornan los más similares (medido por **similitud coseno**)

**Similitud coseno** mide el ángulo entre dos vectores:
- **1.0** = idénticos (mismo significado)
- **0.0** = sin relación
- El `threshold: 0.7` en el proyecto filtra resultados con poca relevancia

**En `03-java-rag-agent`**: Se usa `SimpleVectorStore` (en memoria), ideal para desarrollo.
En producción se usan bases de datos especializadas: **PgVector** (PostgreSQL), **Pinecone**,
**Qdrant**, **Chroma**, **Weaviate**, etc.

---

## SSE (Server-Sent Events) {#sse-server-sent-events}

**Server-Sent Events** es un protocolo HTTP unidireccional (servidor → cliente) para
enviar eventos en tiempo real. A diferencia de WebSockets, SSE:
- Usa HTTP estándar (no necesita protocolo especial)
- Es unidireccional (solo servidor → cliente)
- Se reconecta automáticamente si se corta
- Funciona con proxies y firewalls sin problemas

### ¿Por qué SSE en un agente?

Un reasoning loop puede tardar segundos por iteración. Sin streaming, el usuario
ve una pantalla vacía hasta que el agente termina. Con SSE, el frontend muestra
progreso en **tiempo real**:

```
Backend                           Frontend
────────                          ────────
Iteración 1                       
  │ emit("thinking")   ──────▶   🔄 Pensando...
  │ emit("tool_call")  ──────▶   🔧 Usando: show_weather_card
  │ emit("ui_action")  ──────▶   📊 [Monta WeatherCard]
  │ emit("tool_result") ─────▶   ✅ Resultado recibido
Iteración 2
  │ emit("thinking")   ──────▶   🔄 Pensando...
  │ emit("text")       ──────▶   💬 "El clima en Madrid es..."
  │ emit("done")       ──────▶   ✅ Fin del turno
```

### Formato de un evento SSE

```
data: {"type":"thinking","data":{"iteration":1},"timestamp":1708099200000}\n\n
```

Cada evento es una línea `data: <JSON>\n\n`. El doble `\n\n` marca el fin del evento.

### ¿Por qué `fetch` + `ReadableStream` y no `EventSource`?

El frontend de `02-generative-ui` **no** usa la API nativa [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
porque `EventSource` solo soporta requests **GET**. El endpoint `/api/chat` es **POST**
(envía el mensaje en el body). Por eso se usa `fetch` + `ReadableStream` + `TextDecoder`
para parsear el stream manualmente.

### Headers SSE requeridos

```typescript
res.writeHead(200, {
  "Content-Type": "text/event-stream",  // Indica formato SSE
  "Cache-Control": "no-cache",          // No cachear eventos
  "Connection": "keep-alive",           // Mantener conexión abierta
});
```

---

## Generative UI {#generative-ui}

**Generative UI** es un patrón donde **el agente decide qué componentes de UI renderizar**,
no el usuario ni el desarrollador. El agente genera tanto texto como instrucciones para
montar/actualizar/desmontar componentes React.

### Diferencia con UI tradicional

```
UI TRADICIONAL:
  Usuario clickea botón → handler → setState → render

GENERATIVE UI:
  Usuario escribe texto → Agente → tool_call → UIAction → render
  (el agente decide QUÉ componente mostrar basándose en el contexto)
```

### El patrón dual-return

Cada tool de UI retorna **dos cosas**:

```typescript
return {
  toolResult: JSON.stringify(data),   // Para el LLM (texto plano)
  uiAction: {                          // Para el frontend (componente React)
    type: "mount",
    componentId: "weather-madrid",
    component: "weather_card",
    props: { city: "Madrid", temperature: 22, ... }
  }
};
```

- **`toolResult`**: String que se envía al LLM en el historial. El LLM lo usa para
  razonar sobre los datos y generar su texto de respuesta.
- **`uiAction`**: Objeto que se envía al frontend via SSE. Describe qué componente
  montar y con qué props.

### UIAction: mount / update / unmount

| Tipo | Qué hace | Cuándo se usa |
|------|----------|---------------|
| `mount` | Crea y muestra un componente nuevo | Primera vez que aparece |
| `update` | Actualiza props de un componente existente | Datos nuevos para un componente existente |
| `unmount` | Quita un componente de la UI | Ya no es relevante |

### Component Registry (Factory Pattern)

El frontend tiene un mapeo de tipo string → componente React:

```typescript
const COMPONENT_REGISTRY = {
  weather_card: WeatherCard,
  chart: Chart,
  data_table: DataTable,
};
```

Cuando llega una UIAction con `component: "weather_card"`, el `DynamicComponent` busca
en el registry y renderiza `<WeatherCard {...props} />`. Este patrón es extensible:
para agregar un componente nuevo, solo hay que agregarlo al registry y crear un tool
que lo produzca.

---

## State Management agéntico (Zustand) {#state-management-agéntico-zustand}

### La inversión del flujo de datos

En una app React tradicional:

```
Usuario interactúa → dispatch/setState → UI se re-renderiza
```

En Generative UI, **el agente controla el state**:

```
Agente decide → SSE event → store.mountComponent() → UI se re-renderiza
```

El usuario solo escribe texto. Todo lo demás (qué componentes se muestran, qué datos
tienen, cuándo se actualizan) lo decide el agente.

### ¿Por qué Zustand?

[Zustand](https://zustand-demo.pmnd.rs/) es un state manager para React, minimalista
y sin boilerplate. Comparado con Redux:

| | Redux | Zustand |
|---|---|---|
| Boilerplate | Actions, reducers, dispatch | Function calls directas |
| Setup | createStore, Provider | `create()` — una función |
| Selectors | useSelector + memoization | Hook nativo con selector |
| Devtools | Extension aparte | Integrado |

Para un agente, Zustand es ideal porque:
- Las acciones del store se invocan directamente desde el hook SSE
- No necesitás middleware para side effects (el SSE ya es el "side effect")
- Los componentes se suscriben solo a lo que necesitan (reactivo y eficiente)

### Shape del store

```typescript
interface AgentState {
  messages: ChatMessage[];           // Historial del chat
  mountedComponents: MountedComponent[]; // Componentes activos
  isThinking: boolean;               // ¿Agente procesando?
  currentTool: string | null;        // Tool en ejecución
  error: string | null;              // Último error
}
```

### Flujo completo: SSE → Store → UI

```
Backend                  Hook (useAgentSSE)         Store (Zustand)          React
───────                  ──────────────────         ───────────────          ─────
emit("thinking")    ──▶  handleEvent()         ──▶  setThinking(true)   ──▶  🔄 spinner
emit("tool_call")   ──▶  handleEvent()         ──▶  setCurrentTool(name)──▶  🔧 badge
emit("ui_action")   ──▶  handleEvent()         ──▶  mountComponent(...)  ──▶  📊 component!
emit("text")        ──▶  handleEvent()         ──▶  addMessage(content)  ──▶  💬 text
emit("done")        ──▶  handleEvent()         ──▶  setThinking(false)   ──▶  ✅ idle
```

La asociación componente-mensaje es importante: cuando se monta un componente, también
se asocia al último mensaje del assistant (via `msg.components`). Así, al scrollear el
chat, cada mensaje muestra sus componentes correspondientes.

---

## Multi-Agent Orchestration {#multi-agent-orchestration}

### ¿Por qué múltiples agentes?

Un solo agente con muchas tools presenta problemas:
- **Confusión del LLM**: Con 20+ tools, el LLM elige mal cuál usar
- **Prompts genéricos**: No se puede optimizar el prompt para tareas específicas
- **Costo**: El context window se llena con definiciones de tools no relevantes

La solución: **múltiples agentes especializados** orquestados por un **Router Agent**.

### Patrón Router → Specialists

```
                    ┌─────────────────┐
  User query ──────▶│  ROUTER AGENT   │
                    │  (clasificador) │
                    └───────┬─────────┘
                            │
                   ¿Qué tipo de tarea?
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────▼─────┐ ┌────▼─────┐ ┌─────▼─────┐
        │    RAG    │ │   DATA   │ │  SUMMARY  │
        │ Specialist│ │Specialist│ │ Specialist│
        │           │ │          │ │           │
        │ - search  │ │ - stats  │ │ - resumir │
        │ - docs    │ │ - analyze│ │ - extract │
        └───────────┘ └──────────┘ └───────────┘
```

### El Router Agent

Es un agente **muy liviano** con un prompt restrictivo:

```
"Responde SOLO con el nombre del especialista: RAG, DATA, o SUMMARY."
```

No tiene tools. Solo clasifica la consulta. Esto es eficiente porque:
- Usa pocos tokens (prompt corto + output de 1 palabra)
- Es muy rápido (single-shot, sin reasoning loop)
- Se puede usar un modelo más barato para este paso

### Ventajas del patrón

1. **Prompts optimizados**: Cada especialista tiene un system prompt diseñado para
   su tarea específica
2. **Menos tools por agente**: 2-3 tools vs. 10-20 → el LLM elige mejor
3. **Modelos diferentes por agente**: Router con modelo barato, especialistas con modelo potente
4. **Escalabilidad**: Agregar un nuevo especialista no afecta a los existentes
5. **Debugging más fácil**: Si falla, sabés exactamente qué especialista y por qué

### Estado actual en `03-java-rag-agent`

El Router Agent funciona y clasifica correctamente, pero los 3 especialistas delegan
al mismo `RagAgent`. En producción, cada `case` del `switch` tendría su propio agente
con prompt y tools diferenciados.

---

## Tool Calling: TypeScript vs Java {#tool-calling-typescript-vs-java}

La misma funcionalidad de tool calling se implementa de forma muy diferente en TS
(manual) vs Java (Spring AI):

### TypeScript (Proyectos 01 y 02) — Manual

```typescript
// 1. Definir schema JSON manualmente
const definition: ToolDefinition = {
  name: "get_weather",
  description: "...",
  parameters: { type: "object", properties: {...}, required: [...] }
};

// 2. Validar con Zod
const ArgsSchema = z.object({ city: z.string() });

// 3. Implementar execute
async function execute(args) {
  const parsed = ArgsSchema.parse(args);
  return JSON.stringify(resultado);
}

// 4. Reasoning loop manual (while loop)
while (iterations < max) {
  const response = await llm.chat(messages, tools);
  if (response.hasToolCalls) {
    // ejecutar tools, agregar resultados, continuar
  } else {
    // respuesta final, salir
  }
}
```

**Responsabilidades del desarrollador**: JSON Schema, validación, ejecución, loop, manejo de
errores, historial de mensajes.

### Java / Spring AI (Proyecto 03) — Declarativo

```java
// 1. Definir como @Bean + Java Record (schema se auto-genera)
@Bean
@Description("Busca documentos relevantes en la base de conocimiento")
public Function<SearchRequest, SearchResponse> searchDocuments() {
    return request -> {
        String context = retrievalService.searchAndFormat(request.query(), request.maxResults());
        return new SearchResponse(context, !context.contains("No se encontraron"));
    };
}

// 2. Registrar por nombre
chatClient = builder.defaultFunctions("searchDocuments", "analyzeData").build();

// 3. Usar (Spring AI maneja el loop internamente)
String response = chatClient.prompt().user(query).call().content();
```

**Spring AI se encarga de**: JSON Schema (auto-generado desde Java records), reasoning loop,
parseo de tool calls, re-invocación del LLM, historial de mensajes.

### Comparativa

| Aspecto | TypeScript (manual) | Java / Spring AI |
|---------|--------------------|--------------------|
| **JSON Schema** | Manual | Auto-generado desde Records |
| **Validación** | Zod | Java type system + Bean Validation |
| **Reasoning Loop** | `while` loop explícito | Interno (abstractido) |
| **Registro de tools** | Array + `findTool()` | `@Bean` + `defaultFunctions()` |
| **Control** | Total — ves cada paso | Menos — Spring AI decide internamente |
| **Debugging** | Fácil — logs en cada paso | Más opaco — hay que activar logging de Spring AI |
| **Flexibilidad** | Máxima | Limitada al API de Spring AI |
| **Boilerplate** | Más código | Menos código |
| **Mejor para** | Aprender cómo funciona | Producción enterprise |

**Recomendación**: Empezá con TypeScript (01-cli-agent) para entender el mecanismo completo.
Después pasá a Spring AI (03) donde todo es más fácil pero más opaco.

---

## Patrones de error y recuperación {#patrones-de-error-y-recuperacion}

### Principio fundamental: errores devueltos, no lanzados

Cuando un tool falla, el error **no se lanza** como excepción. Se **devuelve como string**
al LLM:

```typescript
// ❌ Mal — el agente crashea
throw new Error("API no disponible");

// ✅ Bien — el LLM puede recuperarse
return JSON.stringify({ error: "API no disponible. Intenta otra ciudad." });
```

¿Por qué? Porque el LLM puede **decidir qué hacer** con el error:
- Intentar con otros argumentos
- Usar un tool alternativo
- Informar al usuario del problema

### Implementación por proyecto

- **`01-cli-agent`** (`agent.ts`): `try/catch` en `executeTool()`, devuelve
  `JSON.stringify({ error })` al LLM
- **`02-generative-ui`** (`agent.ts`): Mismo patrón + emite un evento SSE de tipo
  `"error"` para que el frontend muestre feedback visual
- **`03-java-rag-agent`**: Spring AI maneja errores internamente

### Protección anti-loop

Además de errores de tools, existe el riesgo de un **loop infinito** donde el LLM
llama tools repetidamente sin converger a una respuesta. La solución: `maxIterations`.

Si se alcanza el límite, el agente retorna un mensaje de error al usuario sugiriendo
reformular la pregunta. Esto es preferible a un timeout silencioso.

---

## Multi-Provider: configuración compartida {#multi-provider-configuracion-compartida}

Los 3 proyectos comparten el mismo archivo `.env` en la raíz del workspace y soportan
los mismos 5 proveedores de LLM. Esto permite cambiar de proveedor sin tocar código.

### Proveedores soportados

| Provider | Base URL | Chat Model | Embeddings | Gratis |
|----------|----------|-----------|------------|--------|
| **ollama** | `localhost:11434` | llama3.1 | nomic-embed-text | Sí (local) |
| **groq** | `api.groq.com` | llama-3.1-70b | ⚠️ via Ollama | Sí (cloud) |
| **gemini** | `generativelanguage.googleapis.com` | gemini-2.0-flash | ⚠️ via Ollama | Sí (cloud) |
| **openai** | `api.openai.com` | gpt-4o-mini | text-embedding-3-small | No |
| **github** | `models.inference.ai.azure.com` | gpt-4o-mini | text-embedding-3-small | Sí (con cuenta) |

### El truco: API compatible con OpenAI

Todos estos proveedores exponen una API compatible con el formato de OpenAI (`/v1/chat/completions`).
Eso permite usar el **mismo SDK** cambiando solo `baseURL` y `apiKey`:

```
// TypeScript (proyectos 01 y 02)
new OpenAI({ apiKey: "...", baseURL: "https://api.groq.com/openai/v1" })

// Java (proyecto 03, via application.yml)
spring.ai.openai.base-url=${OPENAI_BASE_URL}
spring.ai.openai.api-key=${OPENAI_API_KEY}
```

### Embeddings: el caso especial de Groq y Gemini

No todos los proveedores soportan el endpoint `/v1/embeddings`. Para los que no
(Groq y Gemini), el proyecto Java usa un **endpoint de embedding separado**
apuntando a Ollama local:

```
Chat:       Groq  (api.groq.com)       ─── rápido, cloud
Embeddings: Ollama (localhost:11434)   ─── local, sin costo
```

Esto se configura en `RagConfig.java` con un `EmbeddingModel` bean `@Primary` que
recibe su propia `base-url` y `api-key` independientes del chat.

### Flujo de carga de configuración (proyecto Java)

```
1. main() → EnvLoader.load()
   Lee ../.env, setea System properties

2. main() → ProviderResolver.resolve()
   Lee PROVIDER, mapea a URLs/modelos
   Setea: OPENAI_BASE_URL, MODEL, EMBEDDING_BASE_URL, etc.

3. SpringApplication.run()
   application.yml lee ${OPENAI_BASE_URL}, ${MODEL}, etc.
   RagConfig crea EmbeddingModel con endpoint independiente
```

---

## Cómo testear el proyecto 03 (Java RAG) {#como-testear-proyecto-03}

### Requisitos previos

1. **Java 21** — `java --version`
2. **Ollama** (recomendado) — `curl -fsSL https://ollama.com/install.sh | sh`
3. Modelos descargados: `ollama pull llama3.1 && ollama pull nomic-embed-text`

### Arrancar el proyecto

```bash
# Desde la raíz del workspace
cd 03-java-rag-agent

# Opción A: con Ollama (default, sin .env necesario)
./mvnw spring-boot:run

# Opción B: con otro provider
PROVIDER=groq OPENAI_API_KEY=gsk_... ./mvnw spring-boot:run

# Opción C: con .env configurado
# (configurar ../.env y luego)
./mvnw spring-boot:run
```

### Frontend visual

Al arrancar, abrir **http://localhost:8080** en el navegador.
Spring Boot sirve automáticamente el `index.html` desde `src/main/resources/static/`.

El frontend incluye:
- **Chat** con el agente RAG
- Toggle entre **RAG Chat** y **Multi-Agent**
- **Upload de documentos** para el pipeline RAG
- **Ingestar directorio** completo
- Visualización de **fuentes/contexto** usado en cada respuesta
- Badge con el **proveedor** y **modelo** activo

### Testear con curl

```bash
# Info del proveedor activo
curl http://localhost:8080/api/info | jq

# Chat simple
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Qué es RAG?"}'

# Multi-agent orchestration
curl -X POST http://localhost:8080/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"message": "Resume los documentos"}'

# Subir un documento
curl -X POST http://localhost:8080/api/documents/upload \
  -F "file=@mi-documento.pdf"

# Ingestar todos los documentos del directorio ./documents
curl -X POST http://localhost:8080/api/documents/ingest-all

# Reset conversación
curl -X POST http://localhost:8080/api/reset
```

### Flujo de test recomendado

1. **Arrancar** el servidor
2. **Crear** un archivo de prueba: `echo "Spring AI es un framework..." > documents/test.txt`
3. **Ingestar**: click en "Ingestar directorio" (o `curl -X POST .../ingest-all`)
4. **Preguntar**: "¿Qué es Spring AI?" → debería responder usando el documento
5. **Verificar fuentes**: expandir "Ver fuentes/contexto" en la respuesta
6. **Probar Multi-Agent**: cambiar modo y hacer otra pregunta

---

## Glosario rápido {#glosario-rapido}

| Término | Definición |
|---------|-----------|
| **LLM** | Large Language Model — modelo de lenguaje (GPT-4, Llama, Gemini) |
| **Tool** | Función que el LLM puede invocar (no ejecuta — solo genera el JSON) |
| **Tool Call** | JSON que el LLM genera declarando qué función quiere ejecutar |
| **Reasoning Loop** | Ciclo think→act→observe que el agente repite hasta responder |
| **RAG** | Retrieval-Augmented Generation — inyectar documentos en el prompt |
| **Embedding** | Vector numérico que representa el significado de un texto |
| **Vector Store** | Base de datos de embeddings con búsqueda por similitud |
| **Chunk** | Fragmento de un documento (típ. 500-1000 tokens) |
| **Similitud coseno** | Métrica de distancia entre vectores (1.0 = idénticos) |
| **SSE** | Server-Sent Events — protocolo de eventos servidor→cliente |
| **Generative UI** | Patrón donde el agente decide qué componentes UI renderizar |
| **UIAction** | Instrucción del agente al frontend: mount/update/unmount |
| **Router Agent** | Agente liviano que clasifica consultas y delega a especialistas |
| **System Prompt** | Instrucciones iniciales que definen el comportamiento del agente |
| **tool_choice** | Parámetro que controla si el LLM puede/debe usar tools |
| **Zod** | Librería de validación runtime para TypeScript |
| **Zustand** | State manager minimalista para React |
| **Spring AI** | Framework de Spring para integración con LLMs |
| **Apache Tika** | Librería de parsing de documentos (PDF, DOCX, etc.) |
| **Chain-of-thought** | Técnica de prompting: "piensa paso a paso" |
| **Few-shot** | Técnica de prompting: dar ejemplos en el prompt |
| **Context window** | Máximo de tokens que un LLM puede procesar en un request |
| **Temperature** | Parámetro que controla la creatividad del LLM (0=determinista, 1=creativo) |
