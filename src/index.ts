#!/usr/bin/env node

import { fileURLToPath } from "url";
import { basename, dirname, extname, join, relative, resolve, sep } from "path";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from "@modelcontextprotocol/sdk/types.js";

type Section = "all" | "guides" | "api" | "specs" | "classes" | "readme";

interface DocEntry {
  absolutePath: string;
  relativePath: string;
  section: Exclude<Section, "all">;
  slug: string;
  title: string;
}

interface SearchHit {
  relativePath: string;
  section: Exclude<Section, "all">;
  line: number;
  text: string;
  onlineUrl: string | null;
}

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);
const workspaceRoot: string = resolve(__dirname, "..");
const repoRoot: string = process.env.VOXEL_DOCS_REPO ?? resolve(workspaceRoot, "vendor", "godot_voxel");
const docSourceRoot: string = join(repoRoot, "doc", "source");
const docClassesRoot: string = join(repoRoot, "doc", "classes");
const graphNodesPath: string = join(repoRoot, "doc", "graph_nodes.xml");
const readmePath: string = join(repoRoot, "README.md");
const docsBaseUrl: string = "https://voxel-tools.readthedocs.io/en/latest";

function assertRepoReady(): void {
  if (!existsSync(repoRoot)) {
    throw new McpError(
      ErrorCode.InternalError,
      `Voxel-Tools-Repo nicht gefunden: ${repoRoot}. Führe npm run setup aus oder nutze scripts/update-voxel-docs.ps1 beziehungsweise scripts/update-voxel-docs.sh.`
    );
  }
}

function walkFiles(rootPath: string, allowedExtensions: string[]): string[] {
  const results: string[] = [];
  if (!existsSync(rootPath)) {
    return results;
  }

  const entries = readdirSync(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(absolutePath, allowedExtensions));
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (allowedExtensions.includes(extension)) {
      results.push(absolutePath);
    }
  }

  return results;
}

function relativeForDisplay(pathValue: string): string {
  return relative(repoRoot, pathValue).split(sep).join("/");
}

function titleFromPath(pathValue: string): string {
  const rawName = basename(pathValue, extname(pathValue));
  if (rawName === "index") {
    return "index";
  }
  return rawName;
}

function classifyEntry(pathValue: string): DocEntry | null {
  const relativePathValue = relativeForDisplay(pathValue);

  if (relativePathValue === "README.md") {
    return {
      absolutePath: pathValue,
      relativePath: relativePathValue,
      section: "readme",
      slug: "readme",
      title: "README"
    };
  }

  if (relativePathValue === "doc/graph_nodes.xml") {
    return {
      absolutePath: pathValue,
      relativePath: relativePathValue,
      section: "classes",
      slug: "graph_nodes",
      title: "graph_nodes"
    };
  }

  if (relativePathValue.startsWith("doc/source/api/")) {
    const title = titleFromPath(pathValue);
    return {
      absolutePath: pathValue,
      relativePath: relativePathValue,
      section: "api",
      slug: title.toLowerCase(),
      title
    };
  }

  if (relativePathValue.startsWith("doc/source/specs/")) {
    const title = titleFromPath(pathValue);
    return {
      absolutePath: pathValue,
      relativePath: relativePathValue,
      section: "specs",
      slug: title.toLowerCase(),
      title
    };
  }

  if (relativePathValue.startsWith("doc/source/")) {
    const title = titleFromPath(pathValue);
    return {
      absolutePath: pathValue,
      relativePath: relativePathValue,
      section: "guides",
      slug: title.toLowerCase(),
      title
    };
  }

  if (relativePathValue.startsWith("doc/classes/")) {
    const title = titleFromPath(pathValue);
    return {
      absolutePath: pathValue,
      relativePath: relativePathValue,
      section: "classes",
      slug: title.toLowerCase(),
      title
    };
  }

  return null;
}

function loadEntries(): DocEntry[] {
  assertRepoReady();

  const markdownFiles = walkFiles(docSourceRoot, [".md"]);
  const classFiles = walkFiles(docClassesRoot, [".xml"]);
  const allFiles = [...markdownFiles, ...classFiles];

  if (existsSync(readmePath)) {
    allFiles.push(readmePath);
  }
  if (existsSync(graphNodesPath)) {
    allFiles.push(graphNodesPath);
  }

  const entries: DocEntry[] = [];
  for (const pathValue of allFiles) {
    const entry = classifyEntry(pathValue);
    if (entry !== null) {
      entries.push(entry);
    }
  }

  entries.sort((a: DocEntry, b: DocEntry) => a.relativePath.localeCompare(b.relativePath));
  return entries;
}

function entryMatchesSection(entry: DocEntry, section: Section): boolean {
  return section === "all" ? true : entry.section === section;
}

function toOnlineUrl(entry: DocEntry): string | null {
  if (entry.section === "readme") {
    return "https://github.com/Zylann/godot_voxel";
  }

  if (entry.relativePath === "doc/source/index.md") {
    return `${docsBaseUrl}/`;
  }

  if (entry.relativePath.startsWith("doc/source/")) {
    const relativeDocPath = entry.relativePath
      .replace(/^doc\/source\//, "")
      .replace(/\.md$/i, "");

    return `${docsBaseUrl}/${relativeDocPath}/`;
  }

  return null;
}

function listTopics(): string {
  const entries = loadEntries();
  const sections: Array<Exclude<Section, "all">> = ["guides", "api", "specs", "classes", "readme"];
  const lines: string[] = [];

  for (const section of sections) {
    const scopedEntries = entries.filter((entry: DocEntry) => entry.section === section);
    lines.push(`${section} (${scopedEntries.length})`);
    for (const entry of scopedEntries) {
      lines.push(`- ${entry.title}: ${entry.relativePath}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function sanitizeQuery(value: unknown): string {
  if (typeof value !== "string") {
    throw new McpError(ErrorCode.InvalidParams, "query muss ein String sein.");
  }
  const query = value.trim();
  if (query.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, "query darf nicht leer sein.");
  }
  return query;
}

function sanitizeSection(value: unknown): Section {
  if (value === undefined) {
    return "all";
  }
  const allowed: Section[] = ["all", "guides", "api", "specs", "classes", "readme"];
  if (typeof value !== "string" || !allowed.includes(value as Section)) {
    throw new McpError(ErrorCode.InvalidParams, `section muss einer von ${allowed.join(", ")} sein.`);
  }
  return value as Section;
}

function sanitizePositiveInteger(value: unknown, fallback: number, minimum: number, maximum: number, fieldName: string): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} muss eine Ganzzahl sein.`);
  }
  if (value < minimum || value > maximum) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} muss zwischen ${minimum} und ${maximum} liegen.`);
  }
  return value;
}

function searchDocs(query: string, section: Section, maxResults: number): SearchHit[] {
  const entries = loadEntries().filter((entry: DocEntry) => entryMatchesSection(entry, section));
  const needle = query.toLowerCase();
  const hits: SearchHit[] = [];

  for (const entry of entries) {
    const content = readFileSync(entry.absolutePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const lineText = lines[index];
      if (!lineText.toLowerCase().includes(needle)) {
        continue;
      }

      hits.push({
        relativePath: entry.relativePath,
        section: entry.section,
        line: index + 1,
        text: lineText.trim(),
        onlineUrl: toOnlineUrl(entry)
      });

      if (hits.length >= maxResults) {
        return hits;
      }
    }
  }

  return hits;
}

function resolveTarget(target: string): DocEntry {
  const normalizedTarget = target.trim().replace(/\\/g, "/").toLowerCase();
  if (normalizedTarget.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, "target darf nicht leer sein.");
  }

  const entries = loadEntries();

  const directMatch = entries.find((entry: DocEntry) => entry.relativePath.toLowerCase() === normalizedTarget);
  if (directMatch) {
    return directMatch;
  }

  const preferredSectionOrder: Array<Exclude<Section, "all">> = ["api", "guides", "specs", "classes", "readme"];
  const candidateMatches = entries
    .filter((entry: DocEntry) => entry.slug === normalizedTarget || entry.title.toLowerCase() === normalizedTarget)
    .sort((left: DocEntry, right: DocEntry) => {
      return preferredSectionOrder.indexOf(left.section) - preferredSectionOrder.indexOf(right.section);
    });

  if (candidateMatches.length > 0) {
    return candidateMatches[0];
  }

  throw new McpError(
    ErrorCode.InvalidParams,
    `Kein Doku-Ziel gefunden für "${target}". Nutze list_topics oder einen relativen Pfad wie doc/source/quick_start.md.`
  );
}

function readDoc(target: string, startLine: number, maxLines: number): string {
  const entry = resolveTarget(target);
  const content = readFileSync(entry.absolutePath, "utf8");
  const lines = content.split(/\r?\n/);
  const maxExistingLine = Math.max(1, lines.length);
  const firstLine = Math.min(Math.max(1, startLine), maxExistingLine);
  const lastLine = Math.min(lines.length, firstLine + maxLines - 1);
  const selected = lines.slice(firstLine - 1, lastLine);
  const header = [
    `Titel: ${entry.title}`,
    `Bereich: ${entry.section}`,
    `Pfad: ${entry.relativePath}`,
    `Online: ${toOnlineUrl(entry) ?? "-"}`,
    `Zeilen: ${firstLine}-${lastLine} von ${lines.length}`,
    ""
  ];

  const numberedLines = selected.map((lineText: string, index: number) => `${firstLine + index}: ${lineText}`);
  return [...header, ...numberedLines].join("\n");
}

function repoStatus(): string {
  assertRepoReady();
  const entries = loadEntries();
  const sourceStats = statSync(docSourceRoot);
  return [
    `Repo: ${repoRoot}`,
    `Quelle: ${docSourceRoot}`,
    `Dokumente: ${entries.length}`,
    `Letzte Änderung Quelle: ${sourceStats.mtime.toISOString()}`
  ].join("\n");
}

class VoxelToolsDocsServer {
  private readonly server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "voxel-tools-docs-mcp",
        version: "0.1.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.server.onerror = (error: unknown) => {
      console.error("[voxel-tools-docs-mcp]", error);
    };

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "voxel_docs_search",
            description: "Durchsucht die lokale Voxel-Tools-Dokumentation nach einfachem Volltext.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Suchbegriff als einfacher Text."
                },
                section: {
                  type: "string",
                  enum: ["all", "guides", "api", "specs", "classes", "readme"],
                  description: "Optionaler Doku-Bereich."
                },
                max_results: {
                  type: "integer",
                  description: "Maximale Anzahl Treffer.",
                  minimum: 1,
                  maximum: 50
                }
              },
              required: ["query"]
            }
          },
          {
            name: "voxel_docs_read",
            description: "Liest einen konkreten Doku-Eintrag anhand von Pfad oder Seitennamen.",
            inputSchema: {
              type: "object",
              properties: {
                target: {
                  type: "string",
                  description: "Relativer Pfad oder Name wie VoxelTool oder quick_start."
                },
                start_line: {
                  type: "integer",
                  minimum: 1,
                  maximum: 100000
                },
                max_lines: {
                  type: "integer",
                  minimum: 1,
                  maximum: 400
                }
              },
              required: ["target"]
            }
          },
          {
            name: "voxel_docs_list_topics",
            description: "Listet verfügbare Guides, API-Seiten, Specs und Klassenquellen auf.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "voxel_docs_status",
            description: "Zeigt Pfad und lokalen Status des Voxel-Tools-Doku-Mirrors.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments ?? {};

      if (toolName === "voxel_docs_search") {
        const query = sanitizeQuery(args.query);
        const section = sanitizeSection(args.section);
        const maxResults = sanitizePositiveInteger(args.max_results, 10, 1, 50, "max_results");
        const hits = searchDocs(query, section, maxResults);
        const text = hits.length === 0
          ? `Keine Treffer für "${query}" in ${section}.`
          : hits
              .map((hit: SearchHit) => {
                const urlLine = hit.onlineUrl ? ` | ${hit.onlineUrl}` : "";
                return `${hit.relativePath}:${hit.line} [${hit.section}] ${hit.text}${urlLine}`;
              })
              .join("\n");

        return {
          content: [
            {
              type: "text",
              text
            }
          ],
          structuredContent: {
            query,
            section,
            hits
          }
        };
      }

      if (toolName === "voxel_docs_read") {
        const target = sanitizeQuery(args.target);
        const startLine = sanitizePositiveInteger(args.start_line, 1, 1, 100000, "start_line");
        const maxLines = sanitizePositiveInteger(args.max_lines, 120, 1, 400, "max_lines");
        const text = readDoc(target, startLine, maxLines);

        return {
          content: [
            {
              type: "text",
              text
            }
          ]
        };
      }

      if (toolName === "voxel_docs_list_topics") {
        const text = listTopics();
        return {
          content: [
            {
              type: "text",
              text
            }
          ]
        };
      }

      if (toolName === "voxel_docs_status") {
        const text = repoStatus();
        return {
          content: [
            {
              type: "text",
              text
            }
          ]
        };
      }

      throw new McpError(ErrorCode.MethodNotFound, `Unbekanntes Tool: ${toolName}`);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new VoxelToolsDocsServer();
server.start().catch((error: unknown) => {
  console.error("[voxel-tools-docs-mcp] Start fehlgeschlagen", error);
  process.exit(1);
});
