// ============================================================
// rag/DocumentIngestionService.java — Ingestión de documentos
// ============================================================
// (ver docs/summary.md#el-pipeline-completo-rag y docs/summary.md#chunking)
// Paso 1 del pipeline RAG: leer documentos, dividirlos en
// chunks, generar embeddings y almacenarlos en el vector store.
// ============================================================

package com.agentes.rag.rag;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;

@Service
public class DocumentIngestionService {

    private static final Logger log = LoggerFactory.getLogger(DocumentIngestionService.class);

    private final VectorStore vectorStore;
    private final int chunkSize;
    private final int chunkOverlap;
    private final String documentsPath;

    public DocumentIngestionService(
            VectorStore vectorStore,
            @Value("${rag.chunk-size:800}") int chunkSize,
            @Value("${rag.chunk-overlap:200}") int chunkOverlap,
            @Value("${rag.documents-path:./documents}") String documentsPath) {
        this.vectorStore = vectorStore;
        this.chunkSize = chunkSize;
        this.chunkOverlap = chunkOverlap;
        this.documentsPath = documentsPath;
    }

    /**
     * Ingesta todos los documentos del directorio configurado.
     *
     * Proceso:
     * 1. Escanear el directorio
     * 2. Parsear cada archivo (PDF, TXT, DOCX, etc.) con Tika
     * 3. Dividir en chunks (TokenTextSplitter)
     * 4. Almacenar en el Vector Store (genera embeddings automáticamente)
     */
    public int ingestAll() throws IOException {
        Path docsDir = Paths.get(documentsPath);
        if (!Files.exists(docsDir)) {
            Files.createDirectories(docsDir);
            log.warn("Directorio de documentos creado: {}. Añade documentos y re-ejecuta.", docsDir);
            return 0;
        }

        List<Document> allChunks = new ArrayList<>();
        var splitter = new TokenTextSplitter(chunkSize, chunkOverlap, 5, 10000, true);

        try (var stream = Files.walk(docsDir).filter(Files::isRegularFile)) {
            stream.forEach(path -> {
                try {
                    log.info("Procesando: {}", path.getFileName());
                    Resource resource = new FileSystemResource(path);
                    var reader = new TikaDocumentReader(resource);
                    List<Document> documents = reader.get();
                    List<Document> chunks = splitter.apply(documents);

                    // Añadir metadata a cada chunk
                    chunks.forEach(chunk -> {
                        chunk.getMetadata().put("source", path.getFileName().toString());
                        chunk.getMetadata().put("path", path.toString());
                    });

                    allChunks.addAll(chunks);
                    log.info("  → {} chunks generados", chunks.size());
                } catch (Exception e) {
                    log.error("Error procesando {}: {}", path, e.getMessage());
                }
            });
        }

        if (!allChunks.isEmpty()) {
            vectorStore.add(allChunks);
            log.info("✅ {} chunks totales almacenados en el vector store", allChunks.size());
        }

        return allChunks.size();
    }

    /**
     * Ingesta un solo documento.
     */
    public int ingestDocument(Resource resource, String filename) {
        var reader = new TikaDocumentReader(resource);
        var splitter = new TokenTextSplitter(chunkSize, chunkOverlap, 5, 10000, true);

        List<Document> documents = reader.get();
        List<Document> chunks = splitter.apply(documents);

        chunks.forEach(chunk -> chunk.getMetadata().put("source", filename));

        vectorStore.add(chunks);
        log.info("✅ Documento '{}' ingestado: {} chunks", filename, chunks.size());
        return chunks.size();
    }
}
