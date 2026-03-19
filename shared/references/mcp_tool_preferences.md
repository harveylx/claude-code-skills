# Tool Preferences for Code Editing

Hash-verified file operations via `sharpline-mcp` MCP or `hashline.mjs` CLI.

## sharpline-mcp (MCP — preferred)

MCP server at `mcp/sharpline-mcp/`. 6 tools with FNV-1a hash verification:

| Tool | Purpose | When to use |
|------|---------|-------------|
| `outline` | AST structural overview (10 lines vs 500) | Before reading large files |
| `read_file` | Hash-annotated read with range checksums | Examining file contents |
| `edit_file` | Hash-verified edits with diff output | Modifying code files |
| `write_file` | Create new files | New files only |
| `grep_search` | ripgrep with hash-annotated results | Finding code patterns |
| `verify` | Check if held checksums still valid | Before editing after a pause |

**Hash format:** `{tag}.{lineNum}\t{content}` where tag = 2-char FNV-1a.
**Checksums:** `checksum: start-end:8hex` after each read range.

## hashline.mjs (CLI fallback)

CLI at `shared/tools/hashline.mjs`. Same core logic, invoked via Bash:

```bash
node shared/tools/hashline.mjs read <file> [--offset N] [--limit N]
node shared/tools/hashline.mjs edit <file> --edits '<JSON>'
node shared/tools/hashline.mjs grep <pattern> [path] [--glob "*.ts"]
```

## Detection Sequence

1. **sharpline-mcp MCP** — `read_file`/`outline` in tool list → use MCP
2. **hashline.mjs CLI** — `shared/tools/hashline.mjs` exists → use via Bash
3. **Standard tools** — fallback. Built-in Read/Edit/Write/Grep

## When to Use

- **USE for CODE files** (.ts, .js, .py, .go, .rs, .java, etc.)
- **DO NOT use for:** small JSON configs, YAML, markdown
- **Workflow:** outline → read (specific ranges) → edit by anchor → verify

## Setup

```bash
cd mcp/sharpline-mcp && npm install
```

Agent config (ln-004 syncs automatically):
```toml
[mcp_servers.file-edit]
command = "node"
args = ["{skills_root}/mcp/sharpline-mcp/server.mjs"]
```

---
**Version:** 4.0.0
**Last Updated:** 2026-03-19
