import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const workspaceRoot = process.cwd();
const repoRoot = path.join(workspaceRoot, "vendor", "godot_voxel");
const docSourceRoot = path.join(repoRoot, "doc", "source");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function withClient(run) {
  return withClientEnv({}, run);
}

async function withClientEnv(extraEnv, run) {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["build/index.js"],
    cwd: workspaceRoot,
    env: {
      ...process.env,
      VOXEL_DOCS_REPO: repoRoot,
      ...extraEnv
    }
  });

  const client = new Client(
    {
      name: "voxel-tools-docs-test",
      version: "0.0.1"
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);

  try {
    await run(client);
  } finally {
    await client.close();
  }
}

function firstTextContent(result) {
  const entry = result.content?.find((item) => item.type === "text");
  return entry?.text ?? "";
}

test("listTools exposes all expected MCP tools", async () => {
  await withClient(async (client) => {
    const result = await client.listTools();
    const toolNames = result.tools.map((tool) => tool.name).sort();

    assert.deepEqual(toolNames, [
      "voxel_docs_list_topics",
      "voxel_docs_read",
      "voxel_docs_search",
      "voxel_docs_status"
    ]);
  });
});

test("status reports local mirror path and document count", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({ name: "voxel_docs_status", arguments: {} });
    const text = firstTextContent(result);

    assert.match(text, new RegExp(`Repo: ${escapeRegExp(repoRoot)}`));
    assert.match(text, new RegExp(`Quelle: ${escapeRegExp(docSourceRoot)}`));
    assert.match(text, /Dokumente: \d+/);
    assert.match(text, /Letzte Änderung Quelle:/);
  });
});

test("topics enumerate major documentation sections", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({ name: "voxel_docs_list_topics", arguments: {} });
    const text = firstTextContent(result);

    assert.match(text, /guides \(\d+\)/);
    assert.match(text, /api \(\d+\)/);
    assert.match(text, /specs \(\d+\)/);
    assert.match(text, /classes \(\d+\)/);
    assert.match(text, /readme \(\d+\)/);
    assert.match(text, /doc\/source\/quick_start\.md/);
    assert.match(text, /doc\/source\/api\/VoxelTool\.md/);
  });
});

test("search finds API results with line numbers and online URLs", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "voxel_docs_search",
      arguments: {
        query: "VoxelGeneratorGraph",
        section: "api",
        max_results: 5
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /doc\/source\/api\/VoxelGeneratorGraph\.md:1 \[api\] # VoxelGeneratorGraph/);
    assert.match(text, /https:\/\/voxel-tools\.readthedocs\.io\/en\/latest\/api\/VoxelGeneratorGraph\//);

    assert.equal(result.structuredContent.query, "VoxelGeneratorGraph");
    assert.equal(result.structuredContent.section, "api");
    assert.ok(Array.isArray(result.structuredContent.hits));
    assert.ok(result.structuredContent.hits.length > 0);
  });
});

test("search across guides returns expected quick start content", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "voxel_docs_search",
      arguments: {
        query: "Quick start",
        section: "guides",
        max_results: 10
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /doc\/source\/quick_start\.md:/);
  });
});

test("search respects max_results truncation", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "voxel_docs_search",
      arguments: {
        query: "Voxel",
        section: "api",
        max_results: 2
      }
    });

    assert.equal(result.structuredContent.hits.length, 2);
    const text = firstTextContent(result).trim().split("\n");
    assert.equal(text.length, 2);
  });
});

test("search with no matches returns a clear empty result", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "voxel_docs_search",
      arguments: {
        query: "___THIS_SHOULD_NOT_EXIST___",
        section: "all",
        max_results: 3
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /Keine Treffer/);
    assert.equal(result.structuredContent.hits.length, 0);
  });
});

test("read by class name prefers API markdown over XML classes", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "voxel_docs_read",
      arguments: {
        target: "VoxelGeneratorGraph",
        start_line: 1,
        max_lines: 12
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /Bereich: api/);
    assert.match(text, /Pfad: doc\/source\/api\/VoxelGeneratorGraph\.md/);
    assert.match(text, /1: # VoxelGeneratorGraph/);
  });
});

test("read by explicit relative path works for specs", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "voxel_docs_read",
      arguments: {
        target: "doc/source/specs/region_format_v3.md",
        start_line: 1,
        max_lines: 8
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /Bereich: specs/);
    assert.match(text, /Pfad: doc\/source\/specs\/region_format_v3\.md/);
    assert.match(text, /Zeilen: 1-8/);
  });
});

test("read supports README and exposes GitHub online link", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "voxel_docs_read",
      arguments: {
        target: "README.md",
        start_line: 1,
        max_lines: 8
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /Bereich: readme/);
    assert.match(text, /Online: https:\/\/github\.com\/Zylann\/godot_voxel/);
  });
});

test("read with large start_line clamps to file length", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "voxel_docs_read",
      arguments: {
        target: "quick_start",
        start_line: 99999,
        max_lines: 5
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /Bereich: guides/);
    assert.doesNotMatch(text, /Zeilen: 99999-/);
  });
});

test("classes search exposes class sources without online readthedocs URL", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "voxel_docs_search",
      arguments: {
        query: "Graph-based voxel generator.",
        section: "classes",
        max_results: 5
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /doc\/classes\/VoxelGeneratorGraph\.xml/);
    assert.doesNotMatch(text, /https:\/\/voxel-tools\.readthedocs\.io/);
  });
});

test("invalid search params return MCP invalid-params errors", async () => {
  await withClient(async (client) => {
    await assert.rejects(
      async () => client.callTool({
        name: "voxel_docs_search",
        arguments: {
          query: "",
          section: "api"
        }
      }),
      /query darf nicht leer sein/
    );

    await assert.rejects(
      async () => client.callTool({
        name: "voxel_docs_search",
        arguments: {
          query: "VoxelTool",
          section: "nope"
        }
      }),
      /section muss einer von/
    );

    await assert.rejects(
      async () => client.callTool({
        name: "voxel_docs_search",
        arguments: {
          query: "VoxelTool",
          max_results: 99
        }
      }),
      /max_results muss zwischen 1 und 50 liegen/
    );
  });
});

test("missing local repo path produces a clear internal error", async () => {
  await withClientEnv({ VOXEL_DOCS_REPO: path.join(workspaceRoot, "vendor", "missing_repo") }, async (client) => {
    await assert.rejects(
      async () => client.callTool({
        name: "voxel_docs_status",
        arguments: {}
      }),
      /Voxel-Tools-Repo nicht gefunden/
    );
  });
});

test("invalid read params return MCP invalid-params errors", async () => {
  await withClient(async (client) => {
    await assert.rejects(
      async () => client.callTool({
        name: "voxel_docs_read",
        arguments: {
          target: "does-not-exist"
        }
      }),
      /Kein Doku-Ziel gefunden/
    );

    await assert.rejects(
      async () => client.callTool({
        name: "voxel_docs_read",
        arguments: {
          target: "VoxelTool",
          start_line: 0
        }
      }),
      /start_line muss zwischen 1 und 100000 liegen/
    );

    await assert.rejects(
      async () => client.callTool({
        name: "voxel_docs_read",
        arguments: {
          target: "VoxelTool",
          max_lines: 401
        }
      }),
      /max_lines muss zwischen 1 und 400 liegen/
    );
  });
});
