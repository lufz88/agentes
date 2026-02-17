// ============================================================
// agent/MultiAgentOrchestrator.java — Orquestación multi-agente
// ============================================================
// (ver docs/summary.md#multi-agent-orchestration)
//
// CONCEPTO AVANZADO: Multi-Agent Architecture
//
// En lugar de un solo agente con muchos tools, se usan
// AGENTES ESPECIALIZADOS que colaboran:
//
//   ┌──────────────┐
//   │  ROUTER      │  ← Decide qué especialista usar
//   │  Agent       │
//   └──────┬───────┘
//          │
//    ┌─────┼─────────┐
//    ▼     ▼         ▼
//  ┌────┐ ┌────┐ ┌────────┐
//  │RAG │ │DATA│ │SUMMARY │
//  │    │ │    │ │        │
//  └────┘ └────┘ └────────┘
//
// Este patrón escala mejor porque:
// - Cada agente tiene un prompt optimizado para su tarea
// - Menos tools por agente = menos confusión para el LLM
// - Se pueden usar diferentes modelos por agente
// ============================================================

package com.agentes.rag.agent;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class MultiAgentOrchestrator {

    private final ChatClient routerClient;
    private final RagAgent ragAgent;

    private static final String ROUTER_PROMPT = """
            Eres un agente router. Tu trabajo es analizar la consulta del usuario
            y determinar qué especialista debe manejarla.
            
            Especialistas disponibles:
            - RAG: Para preguntas sobre documentos, búsqueda de información
            - DATA: Para análisis de datos, estadísticas, cálculos
            - SUMMARY: Para resúmenes de documentos largos
            
            Responde SOLO con el nombre del especialista: RAG, DATA, o SUMMARY.
            """;

    public MultiAgentOrchestrator(
            ChatClient.Builder chatClientBuilder,
            RagAgent ragAgent) {
        this.routerClient = chatClientBuilder
                .defaultSystem(ROUTER_PROMPT)
                .build();
        this.ragAgent = ragAgent;
    }

    /**
     * Orquesta la consulta entre múltiples agentes.
     *
     * 1. El Router Agent analiza la consulta
     * 2. Delega al especialista apropiado
     * 3. Retorna la respuesta del especialista
     */
    public OrchestratorResponse orchestrate(String userQuery) {
        // Step 1: Router decide
        String specialist = routerClient.prompt()
                .user(userQuery)
                .call()
                .content()
                .trim()
                .toUpperCase();

        // Step 2: Delegar al especialista
        String response;
        switch (specialist) {
            case "RAG", "DATA", "SUMMARY" -> {
                // Por ahora todos van al RAG agent
                // En producción, cada case tendría su propio agente
                var ragResponse = ragAgent.chat(userQuery);
                response = ragResponse.answer();
            }
            default -> {
                // Fallback al RAG agent
                specialist = "RAG";
                var ragResponse = ragAgent.chat(userQuery);
                response = ragResponse.answer();
            }
        }

        return new OrchestratorResponse(response, specialist);
    }

    public record OrchestratorResponse(
            String answer,
            String selectedSpecialist
    ) {}
}
