// ============================================================
// rag/RetrievalService.java — Servicio de búsqueda semántica
// ============================================================
// (ver docs/summary.md#vector-store-y-similitud-coseno y docs/summary.md#embeddings)
// Paso 2 del pipeline RAG: dada una consulta, encontrar los
// chunks más relevantes en el vector store.
// ============================================================

package com.agentes.rag.rag;

import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class RetrievalService {

    private final VectorStore vectorStore;

    public RetrievalService(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    /**
     * Busca los chunks más similares a la consulta.
     *
     * Internamente:
     * 1. La consulta se convierte a un embedding (vector)
     * 2. Se busca por similitud coseno en el vector store
     * 3. Se retornan los top-K más similares
     *
     * @param query     La consulta en lenguaje natural
     * @param topK      Número de resultados
     * @param threshold Umbral de similitud (0.0 - 1.0)
     */
    public List<Document> search(String query, int topK, double threshold) {
        var searchRequest = SearchRequest.query(query)
                .withTopK(topK)
                .withSimilarityThreshold(threshold);

        return vectorStore.similaritySearch(searchRequest);
    }

    /**
     * Busca y formatea los resultados como contexto para el prompt.
     * Este string se inyecta en el prompt del LLM (augmentation).
     */
    public String searchAndFormat(String query, int topK) {
        List<Document> results = search(query, topK, 0.7);

        if (results.isEmpty()) {
            return "No se encontraron documentos relevantes.";
        }

        return results.stream()
                .map(doc -> {
                    String source = doc.getMetadata().getOrDefault("source", "desconocido").toString();
                    return String.format("[Fuente: %s]\n%s", source, doc.getContent());
                })
                .collect(Collectors.joining("\n\n---\n\n"));
    }
}
