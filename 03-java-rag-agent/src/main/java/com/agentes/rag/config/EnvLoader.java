// ============================================================
// config/EnvLoader.java — Carga de variables desde .env
// ============================================================
// Lee el archivo .env del workspace raíz (compartido con los
// proyectos TypeScript 01 y 02) y setea System properties.
//
// Se ejecuta ANTES de que Spring Boot arranque para que las
// variables estén disponibles durante la resolución de
// application.yml (ej: ${OPENAI_API_KEY}).
//
// Orden de búsqueda:
//   1. ../.env  (raíz del workspace)
//   2. ./.env   (directorio del proyecto)
// ============================================================

package com.agentes.rag.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class EnvLoader {

    /**
     * Carga variables del .env como System properties.
     * NO sobrescribe variables de entorno ni properties existentes.
     */
    public static void load() {
        Path envPath = resolveEnvPath();
        if (envPath == null) {
            System.out.println("ℹ️  No se encontró archivo .env — usando variables de entorno del sistema");
            return;
        }

        try {
            List<String> lines = Files.readAllLines(envPath);
            int loaded = 0;

            for (String line : lines) {
                line = line.trim();
                // Ignorar vacíos y comentarios
                if (line.isEmpty() || line.startsWith("#")) continue;

                int eq = line.indexOf('=');
                if (eq <= 0) continue;

                String key = line.substring(0, eq).trim();
                String value = line.substring(eq + 1).trim();

                // Quitar comillas si las tiene
                if (value.length() >= 2 &&
                    ((value.startsWith("\"") && value.endsWith("\"")) ||
                     (value.startsWith("'") && value.endsWith("'")))) {
                    value = value.substring(1, value.length() - 1);
                }

                // Solo setear si no existe ya (env vars del sistema tienen prioridad)
                if (System.getenv(key) == null && System.getProperty(key) == null) {
                    System.setProperty(key, value);
                    loaded++;
                }
            }

            System.out.printf("✅ %d variable(s) cargadas desde %s%n",
                    loaded, envPath.toAbsolutePath().normalize());

        } catch (IOException e) {
            System.err.println("⚠️  Error leyendo " + envPath + ": " + e.getMessage());
        }
    }

    private static Path resolveEnvPath() {
        Path[] candidates = {
                Path.of("../.env"),      // raíz del workspace (cd 03-java-rag-agent && mvn...)
                Path.of(".env"),          // directorio actual
        };
        for (Path p : candidates) {
            if (Files.exists(p)) return p;
        }
        return null;
    }
}
