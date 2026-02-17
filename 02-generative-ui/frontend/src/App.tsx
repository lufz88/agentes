// ============================================================
// App.tsx — Aplicación principal de Generative UI
// ============================================================

import { useState, useRef, useEffect } from "react";
import { useAgentStore } from "./store/agent-store.js";
import { useAgentSSE } from "./hooks/useAgentSSE.js";
import { DynamicComponent } from "./components/DynamicComponent.js";

export function App() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage } = useAgentSSE();
  const { messages, mountedComponents, isThinking, currentTool, error } = useAgentStore();

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mountedComponents]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>🤖 Generative UI Agent</h1>
        <p style={styles.headerSubtitle}>
          El agente genera componentes visuales dinámicamente
        </p>
      </header>

      {/* Área de mensajes y componentes */}
      <main style={styles.main}>
        {messages.map((msg) => (
          <div key={msg.id} style={msg.role === "user" ? styles.userMsg : styles.assistantMsg}>
            <div style={styles.msgRole}>
              {msg.role === "user" ? "👤 Tú" : "🤖 Agente"}
            </div>
            {msg.content && <div style={styles.msgContent}>{msg.content}</div>}
            {/* Renderizar componentes asociados al mensaje */}
            {msg.components?.map((comp) => (
              <DynamicComponent key={comp.id} mounted={comp} />
            ))}
          </div>
        ))}

        {/* Componentes montados globalmente (sin mensaje asociado) */}
        {mountedComponents
          .filter((c) => !messages.some((m) => m.components?.some((mc) => mc.id === c.id)))
          .map((comp) => (
            <DynamicComponent key={comp.id} mounted={comp} />
          ))}

        {/* Indicadores de estado */}
        {isThinking && (
          <div style={styles.thinking}>
            {currentTool
              ? `🔧 Ejecutando: ${currentTool}...`
              : "🧠 Pensando..."}
          </div>
        )}
        {error && <div style={styles.error}>❌ {error}</div>}

        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pide algo visual: clima, gráficos, tablas..."
          style={styles.input}
          disabled={isThinking}
        />
        <button type="submit" style={styles.button} disabled={isThinking}>
          Enviar
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { maxWidth: 800, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { padding: "16px 24px", borderBottom: "1px solid #e2e8f0" },
  headerTitle: { margin: 0, fontSize: 24 },
  headerSubtitle: { margin: "4px 0 0", color: "#718096", fontSize: 14 },
  main: { flex: 1, overflow: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  userMsg: { alignSelf: "flex-end", maxWidth: "70%", background: "#667eea", color: "#fff", padding: "12px 16px", borderRadius: "16px 16px 4px 16px" },
  assistantMsg: { alignSelf: "flex-start", maxWidth: "85%", background: "#f7fafc", padding: "12px 16px", borderRadius: "16px 16px 16px 4px", border: "1px solid #e2e8f0" },
  msgRole: { fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 4 },
  msgContent: { fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" },
  thinking: { padding: "12px 16px", background: "#ebf8ff", borderRadius: 12, color: "#2b6cb0", fontSize: 14, animation: "pulse 1.5s infinite" },
  error: { padding: "12px 16px", background: "#fed7d7", borderRadius: 12, color: "#c53030", fontSize: 14 },
  form: { display: "flex", gap: 8, padding: "16px 24px", borderTop: "1px solid #e2e8f0" },
  input: { flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 15, outline: "none" },
  button: { padding: "12px 24px", borderRadius: 12, border: "none", background: "#667eea", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" },
};
