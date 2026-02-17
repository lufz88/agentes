// ============================================================
// agent/RagAgent.java — Agente principal con RAG
// ============================================================
// (ver docs/summary.md#rag-retrieval-augmented-generation)
// (ver docs/summary.md#tool-calling-typescript-vs-java)
//
// CONCEPTO CLAVE: Spring AI provee ChatClient con soporte
// nativo para tool calling. El agente:
//   1. Recibe la consulta del usuario
//   2. Busca contexto relevante (RAG retrieval)
//   3. Construye un prompt con el contexto
//   4. Envía al LLM con tools disponibles
//   5. El LLM puede usar tools adicionales si necesita
//   6. Retorna la respuesta fundamentada
//
// MULTI-AGENT: Este archivo también muestra cómo orquestar
// múltiples "especialistas" (agentes con diferentes prompts
// y tools) que colaboran para resolver tareas complejas.
// ============================================================

package com.agentes.rag.agent;

import com.agentes.rag.rag.RetrievalService;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class RagAgent {

    private final ChatClient chatClient;
    private final RetrievalService retrievalService;
    private final List<Message> conversationHistory = new ArrayList<>();

    private static final String SYSTEM_PROMPT = """
            Eres un asistente experto que responde preguntas basándose en documentos proporcionados.
            
            Reglas:
            1. SIEMPRE fundamenta tus respuestas en el contexto proporcionado
            2. Si no encuentras la información, dilo honestamente
            3. Cita las fuentes cuando sea posible
            4. Puedes usar las herramientas disponibles para buscar más información o analizar datos
            5. Responde en español
            6. Si la pregunta requiere cálculos, usa la herramienta de análisis de datos
            """;

    public RagAgent(ChatClient.Builder chatClientBuilder, RetrievalService retrievalService) {
        this.chatClient = chatClientBuilder
                .defaultSystem(SYSTEM_PROMPT)
                .defaultFunctions("searchDocuments", "analyzeData") // Registrar tools
                .build();
        this.retrievalService = retrievalService;
    }

    /**
     * Procesa una consulta con RAG.
     *
     * Flujo:
     * 1. Retrieval: buscar contexto relevante en el vector store
     * 2. Augment: incluir el contexto en el prompt
     * 3. Generate: enviar al LLM con tools disponibles
     */
    public AgentResponse chat(String userQuery) {
        // Step 1: RETRIEVE — Buscar contexto relevante
        String context = retrievalService.searchAndFormat(userQuery, 5);

        // Step 2: AUGMENT — Construir prompt con contexto
        String augmentedQuery = String.format("""
                ## Contexto de documentos relevantes:
                %s
                
                ## Pregunta del usuario:
                %s
                
                Responde basándote en el contexto proporcionado. Si necesitas más información,
                usa la herramienta searchDocuments.
                """, context, userQuery);

        // Step 3: GENERATE — Enviar al LLM (Spring AI maneja el tool calling loop)
        String response = chatClient.prompt()
                .user(augmentedQuery)
                .call()
                .content();

        // Actualizar historial
        conversationHistory.add(new UserMessage(userQuery));
        conversationHistory.add(new AssistantMessage(response));

        return new AgentResponse(response, context, conversationHistory.size());
    }

    /** Limpiar historial */
    public void reset() {
        conversationHistory.clear();
    }

    /** Response wrapper */
    public record AgentResponse(
            String answer,
            String context,
            int historySize
    ) {}
}
