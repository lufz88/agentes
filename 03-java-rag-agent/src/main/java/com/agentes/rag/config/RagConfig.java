// ============================================================
// config/RagConfig.java — Configuración del pipeline RAG
// ============================================================
// (ver docs/summary.md#rag-retrieval-augmented-generation)
//
// RAG = Retrieval Augmented Generation
// Pipeline:
//   1. INGEST: Documentos → Chunks → Embeddings → Vector Store
//   2. RETRIEVE: Query → Embedding → Similar chunks
//   3. AUGMENT: Chunks + Query → Prompt aumentado
//   4. GENERATE: Prompt → LLM → Respuesta fundamentada
//
// MULTI-PROVIDER: El EmbeddingModel se crea con endpoint
// independiente del chat, permitiendo usar un proveedor para
// chat (ej: Groq) y otro para embeddings (ej: Ollama local).
// ============================================================

package com.agentes.rag.config;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.document.MetadataMode;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.model.function.FunctionCallback;
import org.springframework.ai.model.function.FunctionCallbackContext;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.OpenAiEmbeddingOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.web.client.ResponseErrorHandler;
import org.springframework.web.client.RestClient;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;

@Configuration
public class RagConfig {

    /**
     * ChatModel con completionsPath CONFIGURABLE.
     *
     * Spring AI hardcodea "/v1/chat/completions" como ruta,
     * pero GitHub Models usa "/chat/completions" (sin /v1).
     * Este bean crea un OpenAiApi con la ruta correcta según
     * el proveedor configurado en ProviderResolver.
     *
     * @Primary asegura que reemplace al auto-configurado.
     */
    @Bean
    @Primary
    public ChatModel chatModel(
            @Value("${spring.ai.openai.base-url}") String baseUrl,
            @Value("${spring.ai.openai.api-key}") String apiKey,
            @Value("${spring.ai.openai.chat.options.model}") String model,
            @Value("${spring.ai.openai.chat.options.temperature:0.7}") double temperature,
            FunctionCallbackContext functionCallbackContext,
            List<FunctionCallback> toolCallbacks,
            RetryTemplate retryTemplate,
            ResponseErrorHandler responseErrorHandler) {

        // Path correcto según proveedor (GitHub: /chat/completions, resto: /v1/chat/completions)
        String completionsPath = System.getProperty("CHAT_COMPLETIONS_PATH", "/v1/chat/completions");

        var openAiApi = new OpenAiApi(
                baseUrl, apiKey, completionsPath, "/v1/embeddings",
                RestClient.builder(), WebClient.builder(), responseErrorHandler);

        var options = OpenAiChatOptions.builder()
                .withModel(model)
                .withTemperature(temperature)
                .build();

        return new OpenAiChatModel(openAiApi, options, functionCallbackContext, toolCallbacks, retryTemplate);
    }

    /**
     * Modelo de embeddings con endpoint CONFIGURABLE e INDEPENDIENTE del chat.
     * Esto permite usar un proveedor para chat (Groq, Gemini)
     * y otro para embeddings (Ollama local, OpenAI).
     *
     * @Primary asegura que este bean tenga prioridad sobre
     * el auto-configurado por spring-ai-openai-spring-boot-starter.
     */
    @Bean
    @Primary
    public EmbeddingModel embeddingModel(
            @Value("${app.embedding.base-url}") String baseUrl,
            @Value("${app.embedding.api-key}") String apiKey,
            @Value("${app.embedding.model}") String model) {

        var openAiApi = new OpenAiApi(baseUrl, apiKey);

        return new OpenAiEmbeddingModel(
                openAiApi,
                MetadataMode.EMBED,
                OpenAiEmbeddingOptions.builder()
                        .withModel(model)
                        .build()
        );
    }

    /**
     * Vector Store en memoria para desarrollo.
     * En producción: PgVector, Pinecone, Qdrant, Chroma, etc.
     * (ver docs/summary.md#vector-store-y-similitud-coseno)
     */
    @Bean
    public VectorStore vectorStore(EmbeddingModel embeddingModel) {
        return new SimpleVectorStore(embeddingModel);
    }
}
