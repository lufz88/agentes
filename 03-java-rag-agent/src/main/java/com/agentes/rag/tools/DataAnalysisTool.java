// ============================================================
// tools/DataAnalysisTool.java — Tool de análisis de datos
// ============================================================
// (ver docs/summary.md#tool-calling-typescript-vs-java)
// Ejemplo de un tool que el agente puede usar para
// analizar datos extraídos de documentos.
// ============================================================

package com.agentes.rag.tools;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.Arrays;
import java.util.function.Function;

@Configuration
public class DataAnalysisTool {

    @Bean
    @Description("Analiza datos numéricos: calcula estadísticas como media, mediana, " +
                 "máximo, mínimo y desviación estándar de una serie de números.")
    public Function<AnalysisRequest, AnalysisResponse> analyzeData() {
        return request -> {
            double[] values = request.values();
            if (values == null || values.length == 0) {
                return new AnalysisResponse(0, 0, 0, 0, 0, 0, "No se proporcionaron datos");
            }

            double sum = Arrays.stream(values).sum();
            double mean = sum / values.length;
            double min = Arrays.stream(values).min().orElse(0);
            double max = Arrays.stream(values).max().orElse(0);

            double[] sorted = Arrays.stream(values).sorted().toArray();
            double median = sorted.length % 2 == 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[sorted.length / 2];

            double variance = Arrays.stream(values)
                    .map(v -> Math.pow(v - mean, 2))
                    .sum() / values.length;
            double stdDev = Math.sqrt(variance);

            return new AnalysisResponse(mean, median, min, max, stdDev, values.length,
                    String.format("Análisis de %d valores completado", values.length));
        };
    }

    public record AnalysisRequest(
            double[] values,
            String description
    ) {}

    public record AnalysisResponse(
            double mean,
            double median,
            double min,
            double max,
            double standardDeviation,
            int count,
            String summary
    ) {}
}
