# MCP Tool Preferences

When MCP servers provide enhanced versions of standard tools, prefer them for code files.

## hashline-edit (hash-based file editing)

**Detection:** `ToolSearch("+hashline-edit")` at start of execution. If unavailable, use standard tools — no error.

**When available, prefer for CODE files** (.ts, .py, .js, .go, .rs, .java, etc.):

| Standard Tool | hashline-edit Replacement | Why |
|---------------|--------------------------|-----|
| `Read` | `mcp__hashline-edit__read_file` | Hash-prefixed lines enable verified edits |
| `Edit` | `mcp__hashline-edit__edit_file` | Atomic validation prevents corruption on large files |
| `Write` | `mcp__hashline-edit__write_file` | Consistent interface with hash verification |
| `Grep` | `mcp__hashline-edit__grep` | Results include LINE:HASH refs for direct editing |

**DO NOT use hashline-edit for:** JSON configs, small YAML, markdown docs, .md files (overkill — standard tools are fine).

**Fallback:** If hashline-edit MCP becomes unavailable mid-session (e.g., after context compaction), re-run `ToolSearch("+hashline-edit")` to reload. If still unavailable, use standard tools.

---
**Version:** 1.0.0
**Last Updated:** 2026-03-19
