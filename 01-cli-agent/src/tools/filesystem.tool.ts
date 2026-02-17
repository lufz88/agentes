// ============================================================
// tools/filesystem.tool.ts — Tools de File System
// ============================================================
// Ejemplo de MÚLTIPLES TOOLS en un mismo archivo.
// Demuestra un patrón común: agrupar tools relacionados.
//
// (ver docs/summary.md#tool-calling — "Capacidades emergentes: encadenamiento de tools")
// CONCEPTO CLAVE: Un agente puede decidir encadenar tools
// (leer un directorio → luego leer un archivo específico).
// Esto se llama "multi-step tool use" y es una emergent ability.
// ============================================================

import { z } from "zod";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { Tool, ToolDefinition } from "../types.js";

// ---- TOOL 1: Leer archivo ----

const readDefinition: ToolDefinition = {
  name: "read_file",
  description:
    "Lee el contenido de un archivo. Retorna el texto del archivo. " +
    "Útil para inspeccionar configuraciones, código fuente, logs, etc.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Ruta relativa o absoluta al archivo",
      },
    },
    required: ["path"],
  },
};

const ReadArgsSchema = z.object({ path: z.string().min(1) });

async function executeRead(args: Record<string, unknown>): Promise<string> {
  const { path } = ReadArgsSchema.parse(args);
  try {
    const absolutePath = resolve(path);
    const content = await readFile(absolutePath, "utf-8");
    // Limitar el tamaño para no sobrecargar el contexto del LLM
    const truncated =
      content.length > 5000
        ? content.slice(0, 5000) + "\n\n... [truncado, archivo muy largo]"
        : content;
    return JSON.stringify({ path: absolutePath, content: truncated, size: content.length });
  } catch (error) {
    return JSON.stringify({ error: `No se pudo leer: ${(error as Error).message}`, path });
  }
}

// ---- TOOL 2: Escribir archivo ----

const writeDefinition: ToolDefinition = {
  name: "write_file",
  description:
    "Escribe contenido en un archivo. Crea el archivo si no existe. " +
    "PRECAUCIÓN: Sobrescribe el contenido existente.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Ruta donde escribir el archivo",
      },
      content: {
        type: "string",
        description: "Contenido a escribir en el archivo",
      },
    },
    required: ["path", "content"],
  },
};

const WriteArgsSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

async function executeWrite(args: Record<string, unknown>): Promise<string> {
  const { path, content } = WriteArgsSchema.parse(args);
  try {
    const absolutePath = resolve(path);
    await writeFile(absolutePath, content, "utf-8");
    return JSON.stringify({
      success: true,
      path: absolutePath,
      bytesWritten: Buffer.byteLength(content),
    });
  } catch (error) {
    return JSON.stringify({ error: `No se pudo escribir: ${(error as Error).message}`, path });
  }
}

// ---- TOOL 3: Listar directorio ----

const listDefinition: ToolDefinition = {
  name: "list_directory",
  description:
    "Lista los archivos y carpetas en un directorio. " +
    "Retorna una lista con nombre, tipo (archivo/directorio) y tamaño.",
  parameters: {
    type: "object",
    properties: {
      directory: {
        type: "string",
        description: "Ruta del directorio a listar. Default: directorio actual.",
      },
    },
    required: [],
  },
};

const ListArgsSchema = z.object({
  directory: z.string().default("."),
});

async function executeList(args: Record<string, unknown>): Promise<string> {
  const { directory } = ListArgsSchema.parse(args);
  try {
    const absolutePath = resolve(directory);
    const entries = await readdir(absolutePath);

    const details = await Promise.all(
      entries.slice(0, 50).map(async (entry) => {
        try {
          const entryPath = join(absolutePath, entry);
          const stats = await stat(entryPath);
          return {
            name: entry,
            type: stats.isDirectory() ? "directory" : "file",
            size: stats.isDirectory() ? null : stats.size,
          };
        } catch {
          return { name: entry, type: "unknown", size: null };
        }
      })
    );

    return JSON.stringify({
      directory: absolutePath,
      entries: details,
      total: entries.length,
      showing: Math.min(entries.length, 50),
    });
  } catch (error) {
    return JSON.stringify({
      error: `No se pudo listar: ${(error as Error).message}`,
      directory,
    });
  }
}

// ---- Exportar todos los tools ----

export const readFileTool: Tool = { definition: readDefinition, execute: executeRead };
export const writeFileTool: Tool = { definition: writeDefinition, execute: executeWrite };
export const listDirectoryTool: Tool = { definition: listDefinition, execute: executeList };
