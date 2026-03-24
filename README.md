# Voxel Tools Docs MCP

Lokaler Mirror und MCP-Server fuer die Voxel-Tools-Dokumentation.

## Inhalt

- `vendor/godot_voxel`: lokale Quelle der offiziellen Doku aus `Zylann/godot_voxel`
- `scripts/update-voxel-docs.ps1`: aktualisiert den Mirror unter Windows
- `scripts/update-voxel-docs.sh`: aktualisiert den Mirror unter Linux/macOS
- `scripts/search-voxel-docs.ps1`: direkte Shell-Suche unter Windows
- `scripts/search-voxel-docs.sh`: direkte Shell-Suche unter Linux/macOS
- `src/index.ts`: MCP-Server fuer Codex

## Setup

### Windows

```powershell
cd E:\Repos\voxel-tools-docs-mcp
npm install
npm run setup
npm run build
```

### Linux / macOS

```bash
cd /path/to/voxel-tools-docs-mcp
npm install
npm run setup
npm run build
```

`npm run setup` lädt den lokalen Mirror automatisch. Die Plattform-Skripte bleiben für manuelle Refreshes verfügbar.

## Codex-MCP-Eintrag

### Windows

```toml
[mcp_servers.voxel_tools_docs]
command = "node"
args = ["E:\\Repos\\voxel-tools-docs-mcp\\build\\index.js"]

[mcp_servers.voxel_tools_docs.env]
VOXEL_DOCS_REPO = "E:\\Repos\\voxel-tools-docs-mcp\\vendor\\godot_voxel"
```

### Linux / macOS

```toml
[mcp_servers.voxel_tools_docs]
command = "node"
args = ["/path/to/voxel-tools-docs-mcp/build/index.js"]

[mcp_servers.voxel_tools_docs.env]
VOXEL_DOCS_REPO = "/path/to/voxel-tools-docs-mcp/vendor/godot_voxel"
```

Danach Codex neu starten, damit der neue MCP-Server geladen wird.
