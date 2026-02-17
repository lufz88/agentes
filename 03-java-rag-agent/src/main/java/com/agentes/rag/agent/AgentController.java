// ============================================================
// agent/AgentController.java — REST API
// ============================================================

package com.agentes.rag.agent;

import com.agentes.rag.config.ProviderResolver;
import com.agentes.rag.rag.DocumentIngestionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AgentController {

    private final RagAgent ragAgent;
    private final MultiAgentOrchestrator orchestrator;
    private final DocumentIngestionService ingestionService;

    public AgentController(
            RagAgent ragAgent,
            MultiAgentOrchestrator orchestrator,
            DocumentIngestionService ingestionService) {
        this.ragAgent = ragAgent;
        this.orchestrator = orchestrator;
        this.ingestionService = ingestionService;
    }

    /** Info del proveedor (para el frontend) */
    @GetMapping("/info")
    public ResponseEntity<Map<String, String>> info() {
        return ResponseEntity.ok(ProviderResolver.getInfo());
    }

    /** Chat simple con RAG */
    @PostMapping("/chat")
    public ResponseEntity<RagAgent.AgentResponse> chat(@RequestBody Map<String, String> body) {
        String message = body.get("message");
        if (message == null || message.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(ragAgent.chat(message));
    }

    /** Chat con orquestación multi-agente */
    @PostMapping("/orchestrate")
    public ResponseEntity<MultiAgentOrchestrator.OrchestratorResponse> orchestrate(
            @RequestBody Map<String, String> body) {
        String message = body.get("message");
        if (message == null || message.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(orchestrator.orchestrate(message));
    }

    /** Subir un documento para RAG */
    @PostMapping("/documents/upload")
    public ResponseEntity<Map<String, Object>> uploadDocument(@RequestParam("file") MultipartFile file)
            throws IOException {
        int chunks = ingestionService.ingestDocument(
                file.getResource(),
                file.getOriginalFilename()
        );
        return ResponseEntity.ok(Map.of(
                "filename", file.getOriginalFilename(),
                "chunks", chunks,
                "message", "Documento ingestado correctamente"
        ));
    }

    /** Ingestar todos los documentos del directorio */
    @PostMapping("/documents/ingest-all")
    public ResponseEntity<Map<String, Object>> ingestAll() throws IOException {
        int chunks = ingestionService.ingestAll();
        return ResponseEntity.ok(Map.of(
                "chunks", chunks,
                "message", "Todos los documentos ingestados"
        ));
    }

    /** Reset conversación */
    @PostMapping("/reset")
    public ResponseEntity<Map<String, String>> reset() {
        ragAgent.reset();
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
