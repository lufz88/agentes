package com.agentes.rag;

import com.agentes.rag.config.EnvLoader;
import com.agentes.rag.config.ProviderResolver;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RagAgentApplication {
    public static void main(String[] args) {
        // 1. Cargar variables del .env (raíz del workspace, compartido con proyectos TS)
        EnvLoader.load();
        // 2. Resolver PROVIDER → URLs y modelos concretos
        ProviderResolver.resolve();
        // 3. Arrancar Spring Boot (usa las System properties seteadas arriba)
        SpringApplication.run(RagAgentApplication.class, args);
    }
}
