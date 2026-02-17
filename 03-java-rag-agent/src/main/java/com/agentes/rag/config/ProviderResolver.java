// ============================================================
// config/ProviderResolver.java — Multi-provider LLM
// ============================================================
// Equivalente al objeto PROVIDERS de los proyectos TypeScript.
// Mapea la variable PROVIDER a configuración concreta de URLs,
// modelos de chat y modelos de embeddings.
//
// Se ejecuta ANTES de que Spring Boot arranque.
//
// Proveedores soportados (mismos que 01-cli-agent y 02-generative-ui):
//   - ollama  → local, sin API key, requiere ollama corriendo
//   - groq    → cloud, gratis, rápido (embeddings via Ollama)
//   - gemini  → cloud, free tier (embeddings via Ollama)
//   - openai  → cloud, pago
//   - github  → cloud, gratis con cuenta GitHub
// ============================================================

package com.agentes.rag.config;

import java.util.Map;

public class ProviderResolver {

    // ---- Configuración por proveedor ----

    record ProviderConfig(
            String baseUrl,
            String chatModel,
            String embeddingModel,
            String embeddingBaseUrl,   // null = misma que baseUrl
            String embeddingApiKey,    // null = misma que OPENAI_API_KEY
            String defaultApiKey,      // null = requiere key del usuario
            String label,
            boolean embeddingNeedsOllama,
            String completionsPath     // path del endpoint chat completions
    ) {}

    private static final Map<String, ProviderConfig> PROVIDERS = Map.of(
            "ollama", new ProviderConfig(
                    "http://localhost:11434/v1", "llama3.1",
                    "nomic-embed-text", null, null, "ollama",
                    "Ollama (local)", false, "/v1/chat/completions"),
            "groq", new ProviderConfig(
                    "https://api.groq.com/openai/v1", "llama-3.1-70b-versatile",
                    "nomic-embed-text", "http://localhost:11434/v1", "ollama", null,
                    "Groq Cloud", true, "/v1/chat/completions"),
            "gemini", new ProviderConfig(
                    "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.0-flash",
                    "nomic-embed-text", "http://localhost:11434/v1", "ollama", null,
                    "Google Gemini", true, "/v1/chat/completions"),
            "openai", new ProviderConfig(
                    "https://api.openai.com/v1", "gpt-4o-mini",
                    "text-embedding-3-small", null, null, null,
                    "OpenAI", false, "/v1/chat/completions"),
            "github", new ProviderConfig(
                    "https://models.inference.ai.azure.com", "gpt-4o-mini",
                    "nomic-embed-text", "http://localhost:11434/v1", "ollama", null,
                    "GitHub Models", true, "/chat/completions")
    );

    /**
     * Resuelve PROVIDER → System properties para Spring AI.
     * Debe ejecutarse ANTES de SpringApplication.run().
     */
    public static void resolve() {
        String providerName = getProperty("PROVIDER", "ollama").toLowerCase();
        ProviderConfig config = PROVIDERS.getOrDefault(providerName, PROVIDERS.get("ollama"));

        // ---- Chat configuration ----
        setIfAbsent("OPENAI_BASE_URL", config.baseUrl);
        setIfAbsent("MODEL", config.chatModel);

        // ---- Embedding configuration (puede ser un endpoint diferente) ----
        String embBaseUrl = config.embeddingBaseUrl != null ? config.embeddingBaseUrl : config.baseUrl;
        String embApiKey = config.embeddingApiKey != null
                ? config.embeddingApiKey
                : getProperty("OPENAI_API_KEY", config.defaultApiKey != null ? config.defaultApiKey : "");

        setIfAbsent("EMBEDDING_BASE_URL", embBaseUrl);
        setIfAbsent("EMBEDDING_API_KEY", embApiKey);
        setIfAbsent("EMBEDDING_MODEL", config.embeddingModel);

        // Chat completions path — GitHub Models usa /chat/completions (sin /v1)
        setIfAbsent("CHAT_COMPLETIONS_PATH", config.completionsPath);

        // Default API key (Ollama no necesita key real)
        if (config.defaultApiKey != null) {
            setIfAbsent("OPENAI_API_KEY", config.defaultApiKey);
        }

        // Metadata para display en el frontend
        System.setProperty("app.provider.name", providerName);
        System.setProperty("app.provider.label", config.label);

        // ---- Banner ----
        printBanner(config);
    }

    /**
     * Retorna info del proveedor para el endpoint /api/info.
     */
    public static Map<String, String> getInfo() {
        return Map.of(
                "provider", getProperty("app.provider.name", "unknown"),
                "label", getProperty("app.provider.label", "unknown"),
                "chatModel", getProperty("MODEL", "unknown"),
                "embeddingModel", getProperty("EMBEDDING_MODEL", "unknown"),
                "baseUrl", getProperty("OPENAI_BASE_URL", "unknown")
        );
    }

    // ---- Helpers ----

    private static void printBanner(ProviderConfig config) {
        System.out.println();
        System.out.println("╔════════════════════════════════════════════════════════╗");
        System.out.println("║  🤖 RAG Agent — Configuración de proveedor            ║");
        System.out.println("╠════════════════════════════════════════════════════════╣");
        System.out.printf("║  Provider:    %-40s║%n", config.label);
        System.out.printf("║  Chat Model:  %-40s║%n", getProperty("MODEL", "?"));
        System.out.printf("║  Embed Model: %-40s║%n", getProperty("EMBEDDING_MODEL", "?"));
        System.out.printf("║  Chat URL:    %-40s║%n", truncate(getProperty("OPENAI_BASE_URL", "?"), 40));
        if (config.embeddingBaseUrl != null) {
            System.out.printf("║  Embed URL:   %-40s║%n",
                    truncate(getProperty("EMBEDDING_BASE_URL", "?"), 40));
        }
        System.out.println("╚════════════════════════════════════════════════════════╝");

        if (config.embeddingNeedsOllama) {
            System.out.println();
            System.out.println("⚠️  " + config.label + " no soporta embeddings directamente.");
            System.out.println("   Los embeddings usarán Ollama local (http://localhost:11434).");
            System.out.println("   Asegurate de tener Ollama corriendo:");
            System.out.println("   → ollama pull nomic-embed-text");
        }
        System.out.println();
    }

    private static String getProperty(String key, String defaultValue) {
        String val = System.getProperty(key);
        if (val != null && !val.isBlank()) return val;
        val = System.getenv(key);
        if (val != null && !val.isBlank()) return val;
        return defaultValue;
    }

    private static void setIfAbsent(String key, String value) {
        if (value != null && System.getProperty(key) == null && System.getenv(key) == null) {
            System.setProperty(key, value);
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return "?";
        return s.length() > max ? s.substring(0, max - 3) + "..." : s;
    }
}
