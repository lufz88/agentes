// ============================================================
// tools/SearchDocumentsTool.java — Tool para RAG
// ============================================================
// (ver docs/summary.md#tool-calling-typescript-vs-java)
// CONCEPTO CLAVE: En Spring AI, los tools se definen como
// métodos @Bean con la anotación adecuada.
//
// Cuando el LLM decide buscar información, invoca este tool,
// que ejecuta búsqueda semántica en el vector store.
// ============================================================

package com.agentes.rag.tools;

import com.agentes.rag.rag.RetrievalService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.function.Function;

@Configuration
public class SearchDocumentsTool {

    private final RetrievalService retrievalService;

    public SearchDocumentsTool(RetrievalService retrievalService) {
        this.retrievalService = retrievalService;
    }

    /**
     * Tool: Búsqueda semántica en documentos.
     *
     * Spring AI registra automáticamente los @Bean de tipo Function
     * como tools disponibles para el agente.
     */
    @Bean
    @Description("Busca información relevante en los documentos almacenados. " +
                 "Útil para responder preguntas sobre contenido específico de documentos.")
    public Function<SearchRequest, SearchResponse> searchDocuments() {
        return request -> {
            String context = retrievalService.searchAndFormat(request.query(), request.maxResults());
            return new SearchResponse(context, !context.contains("No se encontraron"));
        };
    }

    /** Request del tool (Spring AI lo convierte a/desde JSON Schema automáticamente) */
    public record SearchRequest(
            String query,
            int maxResults
    ) {
        public SearchRequest {
            if (maxResults <= 0) maxResults = 5;
        }
    }

    /** Response del tool */
    public record SearchResponse(
            String context,
            boolean hasResults
    ) {}
}
