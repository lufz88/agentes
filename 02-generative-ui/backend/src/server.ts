// ============================================================
// server.ts — Servidor Express con SSE
// ============================================================

import express from "express";
import cors from "cors";
import { StreamingAgent } from "./agent.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Un agente por sesión (en producción usarías sessions/auth)
const agents = new Map<string, StreamingAgent>();

function getAgent(sessionId: string): StreamingAgent {
  if (!agents.has(sessionId)) {
    agents.set(sessionId, new StreamingAgent());
  }
  return agents.get(sessionId)!;
}

/**
 * POST /api/chat
 * Body: { message: string, sessionId: string }
 * Response: SSE stream con AgentEvents
 */
app.post("/api/chat", (req, res) => {
  const { message, sessionId = "default" } = req.body;

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const agent = getAgent(sessionId);
  agent.processWithSSE(message, res).catch((err) => {
    console.error("Agent error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

/** POST /api/reset — Limpiar historial */
app.post("/api/reset", (req, res) => {
  const { sessionId = "default" } = req.body;
  const agent = getAgent(sessionId);
  agent.reset();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Generative UI Backend corriendo en http://localhost:${PORT}`);
  console.log(`📡 SSE endpoint: POST /api/chat`);
});
