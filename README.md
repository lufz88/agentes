# 🧠 Zero to Hero: Arquitecturas Agénticas

> **Stack**: TypeScript + Node.js (Backend/CLI) · React (Frontend) · Java/Spring AI (Enterprise)
> **Sin Python** — Todo en tu stack nativo.

---

## Tabla de contenidos

- [Requisitos previos](#requisitos-previos)
- [Configuración del entorno](#configuración-del-entorno)
- [Proveedores LLM soportados](#proveedores-llm-soportados)
- [Proyecto 01 — CLI Agent](#proyecto-01--cli-agent)
- [Proyecto 02 — Generative UI](#proyecto-02--generative-ui)
- [Proyecto 03 — Java RAG Agent](#proyecto-03--java-rag-agent)
- [Roadmap técnico](#roadmap-técnico)
- [Anatomía de un agente](#anatomía-de-un-agente)
- [Estructura del workspace](#estructura-del-workspace)
- [Troubleshooting](#troubleshooting)

---

## Requisitos previos

| Herramienta | Versión mínima | Para qué proyecto | Instalación |
|---|---|---|---|
| **Node.js** | 20+ | 01, 02 | [nodejs.org](https://nodejs.org/) |
| **npm** | 9+ | 01, 02 | Viene con Node.js |
| **Java JDK** | 21 | 03 | `sudo apt install openjdk-21-jdk` ó [SDKMAN](https://sdkman.io/) |
| **Maven** | 3.9+ | 03 | `sudo apt install maven` ó viene con SDKMAN |
| **Ollama** (opcional) | latest | 01, 02, 03 | `curl -fsSL https://ollama.com/install.sh \| sh` |

> **Ollama** es necesario si usás un proveedor cloud que no soporta embeddings (Groq, Gemini, GitHub Models) en el proyecto 03, o si querés un LLM 100% local.

---

## Configuración del entorno

### 1. Archivo `.env` (compartido)

Los tres proyectos leen de un **único archivo `.env` en la raíz del workspace**:

```bash
# agentes/.env
PROVIDER=github          # ollama | groq | gemini | openai | github
OPENAI_API_KEY=tu-key    # API key del proveedor elegido
```

Opcional — para override manual (generalmente no hace falta):

```bash
# MODEL=gpt-4o-mini                  # Fuerza un modelo específico
# OPENAI_BASE_URL=https://...        # Fuerza una URL base
```

> Los proyectos TypeScript usan `--env-file=../.env` de Node.js.
> El proyecto Java usa `EnvLoader.java` que busca `../.env` automáticamente.

### 2. Crear el archivo

```bash
cd agentes/
cp .env.example .env   # si existe, o crear manualmente:
cat > .env << 'EOF'
PROVIDER=ollama
OPENAI_API_KEY=ollama
EOF
```

### 3. Instalar Ollama (opción local, sin API key)

```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Descargar modelos
ollama pull llama3.1           # Chat (~4.7 GB)
ollama pull nomic-embed-text   # Embeddings (~274 MB) — necesario para proyecto 03
```

---

## Proveedores LLM soportados

Los tres proyectos comparten la misma configuración de proveedores. Todos son OpenAI-compatible:

| Provider | `PROVIDER=` | `OPENAI_API_KEY=` | Modelo de chat | Costo | Obtener key |
|---|---|---|---|---|---|
| **Ollama** | `ollama` | (no necesita) | `llama3.1` | Gratis (local) | — |
| **Groq** | `groq` | `gsk_...` | `llama-3.1-70b-versatile` | Gratis (free tier) | [console.groq.com](https://console.groq.com) |
| **Gemini** | `gemini` | `AI...` | `gemini-2.0-flash` | Gratis (free tier) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **OpenAI** | `openai` | `sk-...` | `gpt-4o-mini` | Pago | [platform.openai.com](https://platform.openai.com) |
| **GitHub Models** | `github` | `ghp_...` | `gpt-4o-mini` | Gratis (con GitHub) | [github.com/marketplace/models](https://github.com/marketplace/models) |

### Embeddings por proveedor (proyecto 03)

El proyecto Java usa embeddings para RAG. No todos los proveedores ofrecen un endpoint de embeddings:

| Provider | Embeddings | Modelo embeddings | Requiere Ollama local |
|---|---|---|---|
| Ollama | Propio | `nomic-embed-text` | No (ya ES Ollama) |
| Groq | **No soporta** | `nomic-embed-text` via Ollama | Sí |
| Gemini | **No soporta** | `nomic-embed-text` via Ollama | Sí |
| OpenAI | Propio | `text-embedding-3-small` | No |
| GitHub Models | **No soporta** | `nomic-embed-text` via Ollama | Sí |

> Si usás Groq, Gemini o GitHub Models para el proyecto 03, necesitás tener Ollama corriendo localmente para los embeddings: `ollama pull nomic-embed-text`

---

## Proyecto 01 — CLI Agent

Agente conversacional en terminal con tool calling y reasoning loop.

### Conceptos que enseña

- LLM como función (chat completions API)
- Tool calling con JSON Schema
- Reasoning loop: think → act → observe → repeat
- Validación con Zod

### Setup y ejecución

```bash
cd 01-cli-agent
npm install
```

**Opción A — Con Ollama (local, sin key):**
```bash
# Asegurate de tener ollama corriendo: ollama serve
npm run dev
```

**Opción B — Con proveedor cloud:**
```bash
# Ya con .env configurado en la raíz:
npm run dev

# O inline:
PROVIDER=github OPENAI_API_KEY=ghp_xxx npm run dev
```

### Uso

Se abre un REPL interactivo. Probá:

```
tú> ¿Qué clima hace en Buenos Aires?
tú> Calculá 145 * 87 + 33
tú> Listá los archivos en el directorio actual
tú> Salir
```

### Tools disponibles

| Tool | Qué hace |
|---|---|
| `get_weather` | Simula consulta de clima |
| `calculate` | Evalúa expresiones matemáticas |
| `read_file` / `list_directory` | Lee archivos y directorios locales |

### Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Ejecuta con tsx (hot reload, lee `.env`) |
| `npm run build` | Compila a JavaScript |
| `npm start` | Ejecuta versión compilada |

---

## Proyecto 02 — Generative UI

Agente que genera componentes React dinámicamente, con streaming via SSE.

### Conceptos que enseña

- Server-Sent Events (SSE) para streaming
- Generative UI — el LLM decide qué componentes mostrar
- State management agéntico con Zustand
- Tool calling visual (tools que retornan componentes)

### Setup y ejecución

```bash
# Terminal 1 — Backend (Express + SSE)
cd 02-generative-ui/backend
npm install
npm run dev    # → http://localhost:3001

# Terminal 2 — Frontend (React + Vite)
cd 02-generative-ui/frontend
npm install
npm run dev    # → http://localhost:5173
```

Abrí **http://localhost:5173** en el navegador.

> El frontend tiene un proxy configurado en `vite.config.ts` que redirige `/api/*` al backend en `:3001`, así que sólo necesitás abrir `:5173`.

### Uso

Escribí mensajes que generen componentes visuales:

```
tú> Mostrame el clima en Madrid
tú> Hacé un gráfico de barras con las ventas por mes: Ene 100, Feb 150, Mar 200
tú> Armá una tabla con los países más poblados de Sudamérica
```

### Tools visuales

| Tool | Componente React | Ejemplo |
|---|---|---|
| `show_weather_card` | `<WeatherCard>` | Tarjeta de clima |
| `show_chart` | `<Chart>` | Gráficos (barras, líneas, pie, área) |
| `show_data_table` | `<DataTable>` | Tablas de datos interactivas |

### Scripts

| Comando | Ubicación | Descripción |
|---|---|---|
| `npm run dev` | `backend/` | Inicia servidor Express con hot reload |
| `npm run dev` | `frontend/` | Inicia Vite dev server |
| `npm run build` | `frontend/` | Build de producción |

---

## Proyecto 03 — Java RAG Agent

Agente empresarial con RAG (Retrieval Augmented Generation), multi-agent orchestration, y frontend web integrado.

### Conceptos que enseña

- Pipeline RAG: ingest → chunk → embed → retrieve → augment → generate
- Spring AI con OpenAI-compatible backends
- Multi-agent orchestration
- Tool calling en Java
- Embeddings y vector store

### Requisitos específicos

- Java 21+
- Maven 3.9+
- Ollama corriendo si usás un provider cloud (para embeddings)

### Setup y ejecución

```bash
cd 03-java-rag-agent

# Compilar
mvn package -DskipTests

# Ejecutar (lee .env del directorio padre automáticamente)
mvn spring-boot:run
```

Abrí **http://localhost:8080** en el navegador (el frontend está embebido en el JAR).

### Configuración multi-provider

El proyecto lee automáticamente `PROVIDER` y `OPENAI_API_KEY` de `../.env`. La resolución funciona así:

```
main() → EnvLoader.load()       → lee ../.env como System properties
       → ProviderResolver.resolve() → mapea PROVIDER a URLs/modelos concretos
       → SpringApplication.run()    → Spring AI usa las properties resueltas
```

Para cambiar de proveedor, solo editá `../.env` y reiniciá:

```bash
# .env
PROVIDER=github
OPENAI_API_KEY=ghp_xxxxx
```

Si usás Groq, Gemini o GitHub Models, asegurate de tener Ollama corriendo:

```bash
ollama serve                    # Si no está ya corriendo
ollama pull nomic-embed-text    # Solo la primera vez
```

### Endpoints de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/` | Frontend web (HTML embebido) |
| `GET` | `/api/info` | Info del proveedor activo (modelo, URL, etc.) |
| `POST` | `/api/chat` | Chat con RAG `{"message": "..."}` |
| `POST` | `/api/orchestrate` | Chat multi-agente `{"message": "..."}` |
| `POST` | `/api/documents/upload` | Subir documento (multipart/form-data) |
| `POST` | `/api/documents/ingest-all` | Ingestar todos los docs de `./documents/` |
| `POST` | `/api/reset` | Limpiar historial de conversación |

### Testing con curl

```bash
# Info del proveedor
curl http://localhost:8080/api/info | python3 -m json.tool

# Chat simple
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Qué es un agente de IA?"}' | python3 -m json.tool

# Subir un documento para RAG
curl -X POST http://localhost:8080/api/documents/upload \
  -F "file=@mi-documento.pdf"

# Ingestar todos los docs del directorio ./documents/
curl -X POST http://localhost:8080/api/documents/ingest-all

# Chat multi-agente
curl -X POST http://localhost:8080/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"message": "Analizá los documentos y dame un resumen"}' | python3 -m json.tool

# Reset conversación
curl -X POST http://localhost:8080/api/reset
```

### Uso del frontend web

1. Abrí http://localhost:8080
2. El badge superior muestra el proveedor activo y modelo
3. Escribí un mensaje para chatear (modo RAG por defecto)
4. Usá el toggle para cambiar entre modo **RAG** y **Multi-Agent**
5. Subí documentos con el botón de upload (PDF, TXT, MD, DOCX)
6. También podés ingestar todo el directorio `./documents/` de una vez

### Agregar documentos para RAG

Podés agregar documentos de dos formas:

**Opción A — Via frontend:**
Hacé click en el ícono de upload y seleccioná un archivo.

**Opción B — Via directorio:**
```bash
# Copiar archivos al directorio de documentos
cp mi-archivo.pdf 03-java-rag-agent/documents/

# Ingestar todos los documentos del directorio
curl -X POST http://localhost:8080/api/documents/ingest-all
```

Formatos soportados: PDF, TXT, Markdown, DOCX, HTML (via Apache Tika).

---

## Roadmap técnico

### Fase 1 — Fundamentos (Semana 1-2)
| Concepto | Qué aprenderás | Proyecto |
|---|---|---|
| LLM como función | Llamar a un LLM, parsear respuestas estructuradas | `01-cli-agent` |
| Tool Calling | Definir schemas JSON, ejecutar funciones locales | `01-cli-agent` |
| Reasoning Loop | Ciclo `think → act → observe → repeat` | `01-cli-agent` |
| Prompt Engineering para agentes | System prompts, few-shot, chain-of-thought | `01-cli-agent` |

### Fase 2 — Agentes con UI (Semana 3-4)
| Concepto | Qué aprenderás | Proyecto |
|---|---|---|
| Streaming de respuestas | Server-Sent Events + React state | `02-generative-ui` |
| Generative UI | El agente decide qué componentes renderizar | `02-generative-ui` |
| State Management agéntico | Zustand/useReducer controlado por el agente | `02-generative-ui` |
| Tool Calling visual | Tools que retornan componentes React | `02-generative-ui` |

### Fase 3 — Enterprise & RAG (Semana 5-6)
| Concepto | Qué aprenderás | Proyecto |
|---|---|---|
| RAG Pipeline | Embeddings, vector store, retrieval | `03-java-rag-agent` |
| Spring AI | Framework de agentes en Java | `03-java-rag-agent` |
| Multi-Agent Orchestration | Agentes especializados que colaboran | `03-java-rag-agent` |
| Memory & State persistente | Conversaciones con contexto a largo plazo | `03-java-rag-agent` |

---

## Anatomía de un agente

```
┌─────────────────────────────────────────────┐
│                   AGENTE                     │
│                                              │
│   ┌─────────┐    ┌──────────┐    ┌───────┐  │
│   │  PLAN   │───▶│   ACT    │───▶│OBSERVE│  │
│   │ (Think) │    │(Tool Call)│    │(Parse) │  │
│   └────▲────┘    └──────────┘    └───┬───┘  │
│        │                             │       │
│        └─────────────────────────────┘       │
│              Reasoning Loop                  │
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │            STATE / MEMORY            │   │
│   └──────────────────────────────────────┘   │
│                                              │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│   │  Tool 1  │ │  Tool 2  │ │  Tool N  │    │
│   │(API Call)│ │(DB Query)│ │(File I/O)│    │
│   └──────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────┘
```

---

## Estructura del workspace

```
agentes/
├── .env                         ← Variables compartidas (PROVIDER, OPENAI_API_KEY)
├── README.md                    ← Estás aquí
├── docs/
│   ├── summary.md               ← Explicaciones detalladas de conceptos
│   ├── tool-calling-reference.md
│   └── copilot-workflow.md
├── 01-cli-agent/                ← Proyecto 1: CLI Agent (TypeScript)
│   ├── src/
│   │   ├── index.ts             ← Entry point + selección de provider
│   │   ├── agent.ts             ← Reasoning loop principal
│   │   ├── llm.ts               ← Cliente LLM (OpenAI compatible)
│   │   ├── tools/               ← Definiciones de tools (weather, calc, fs)
│   │   └── types.ts             ← Interfaces y schemas Zod
│   ├── package.json
│   └── tsconfig.json
├── 02-generative-ui/            ← Proyecto 2: Generative UI (React + Express)
│   ├── backend/
│   │   ├── src/
│   │   │   ├── server.ts        ← Express + SSE endpoints
│   │   │   ├── agent.ts         ← Agente streaming con UI actions
│   │   │   └── tools/           ← Tools que generan componentes
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── App.tsx           ← Layout principal
│       │   ├── components/       ← WeatherCard, Chart, DataTable, DynamicComponent
│       │   ├── hooks/            ← useAgentSSE (consumir SSE)
│       │   └── store/            ← Zustand store (agent-store.ts)
│       ├── vite.config.ts        ← Proxy /api → :3001
│       └── package.json
└── 03-java-rag-agent/           ← Proyecto 3: Java RAG (Spring Boot + Spring AI)
    ├── src/main/
    │   ├── java/com/agentes/rag/
    │   │   ├── RagAgentApplication.java  ← Main (carga .env + resuelve provider)
    │   │   ├── agent/
    │   │   │   ├── RagAgent.java         ← Agente RAG principal
    │   │   │   ├── MultiAgentOrchestrator.java
    │   │   │   └── AgentController.java  ← REST API
    │   │   ├── config/
    │   │   │   ├── EnvLoader.java        ← Carga ../.env como System props
    │   │   │   ├── ProviderResolver.java ← Mapea PROVIDER → URLs/modelos
    │   │   │   └── RagConfig.java        ← Beans de embeddings + vector store
    │   │   ├── rag/
    │   │   │   ├── DocumentIngestionService.java  ← Ingest pipeline
    │   │   │   └── RetrievalService.java          ← RAG retrieval
    │   │   └── tools/
    │   │       ├── SearchDocumentsTool.java
    │   │       └── DataAnalysisTool.java
    │   └── resources/
    │       ├── application.yml           ← Config Spring AI
    │       └── static/index.html         ← Frontend web embebido
    ├── documents/                        ← Directorio para documentos RAG
    └── pom.xml
```

---

## Troubleshooting

### General

| Problema | Causa | Solución |
|---|---|---|
| `❌ Falta API key` | No hay `OPENAI_API_KEY` configurada | Creá `agentes/.env` con `PROVIDER=ollama` o tu key |
| Timeout / conexión rechazada | Ollama no está corriendo | `ollama serve` en otra terminal |
| Modelo no encontrado | No descargaste el modelo | `ollama pull llama3.1` |

### Proyecto 02

| Problema | Causa | Solución |
|---|---|---|
| CORS error en el navegador | Frontend no usa el proxy de Vite | Abrí `localhost:5173`, no `localhost:3001` |
| Componentes no renderizan | Backend no está corriendo | Verificá que el backend esté en `:3001` |

### Proyecto 03

| Problema | Causa | Solución |
|---|---|---|
| 404 Resource not found (chat) | GitHub Models usa path sin `/v1` | Ya resuelto en `RagConfig.java` — asegurate de tener la versión actual |
| 404 en embeddings | Provider no soporta `/v1/embeddings` | Asegurate de que Ollama esté corriendo: `ollama serve` |
| Bean conflict (`embeddingModel`) | Conflicto con `TransformersEmbeddingModel` auto-config | Ya resuelto con `allow-bean-definition-overriding: true` |
| 405 Method Not Allowed (upload) | Accediendo desde URL incorrecta | Usá `http://localhost:8080` (no el dev server del frontend) |
| `mvn package` falla | Java 21 no instalado | `java -version` debe decir 21+ |
| Embeddings lentos la primera vez | Ollama descargando modelo | Esperá a que termine `ollama pull nomic-embed-text` |

### Verificar que todo funciona

```bash
# 01 — CLI Agent
cd 01-cli-agent && npm install && npm run dev
# Escribí "hola" → deberías ver respuesta del LLM

# 02 — Generative UI (dos terminales)
cd 02-generative-ui/backend && npm install && npm run dev
cd 02-generative-ui/frontend && npm install && npm run dev
# Abrí http://localhost:5173 → escribí "clima en Madrid"

# 03 — Java RAG
cd 03-java-rag-agent && mvn package -DskipTests && mvn spring-boot:run
# Abrí http://localhost:8080 → escribí "hola"
# O con curl:
curl -s http://localhost:8080/api/info | python3 -m json.tool
curl -s -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hola"}' | python3 -m json.tool
```

---

## Documentación adicional

- [docs/summary.md](docs/summary.md) — Explicaciones detalladas de todos los conceptos (RAG, Agentes, Zod, SSE, Embeddings, etc.)
- [docs/tool-calling-reference.md](docs/tool-calling-reference.md) — Referencia de tool calling
- [docs/copilot-workflow.md](docs/copilot-workflow.md) — Workflow con Copilot
