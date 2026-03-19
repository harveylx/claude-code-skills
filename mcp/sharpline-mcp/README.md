# sharpline-mcp

Sharp, hash-verified file editing MCP server with AST outline for AI coding agents.

Every line carries an FNV-1a content hash. Every edit must present those hashes back — proving the agent is editing what it thinks it's editing. No stale context, no silent corruption.

## Tools

| Tool | Purpose | Token savings |
|------|---------|---------------|
| `outline` | AST structural overview (functions, classes, line ranges) | 95% — 10 lines instead of 500 |
| `read_file` | Hash-annotated read with range checksums | Partial reads via ranges |
| `edit_file` | Hash-verified edits + fuzzy text replace + diff | Compact anchors, no old-text echo |
| `write_file` | Create new files with parent dirs | — |
| `grep_search` | ripgrep with hash-annotated results | Edit-ready matches |
| `verify` | Check if held checksums still valid | 1-line response vs full re-read |

## Install

```bash
# Use without installing
npx sharpline-mcp

# Or install globally
npm i -g sharpline-mcp
```

## Configure

**Claude Code:**
```bash
claude mcp add sharpline -- npx -y sharpline-mcp
```

**Codex CLI** (`~/.codex/config.toml`):
```toml
[mcp_servers.sharpline]
command = "npx"
args = ["-y", "sharpline-mcp"]
```

**Gemini CLI** (`~/.gemini/settings.json`):
```json
{
  "mcpServers": {
    "sharpline": {
      "command": "npx",
      "args": ["-y", "sharpline-mcp"]
    }
  }
}
```

## How it works

### Hash format
```
ab.42    const x = calculateTotal(items);
```
- `ab` — 2-char FNV-1a tag (whitespace-normalized)
- `42` — line number
- Tab separator, then content

### Range checksums
```
checksum: 1-50:f7e2a1b0
```
FNV-1a accumulator over all line hashes in the range. Catches changes to ANY line, even ones not being edited.

### Workflow
1. `outline` → see file structure (10 lines)
2. `read_file` with ranges → read only what you need
3. `edit_file` with anchors → precise edits with diff
4. `verify` → confirm nothing changed before next edit

## Security

- Path validation: files must resolve within allowed directories
- Symlink escape prevention via `realpath`
- Binary file detection (null bytes)
- 10MB size limit
- `ALLOWED_DIRS` env var for additional directories

## Languages (outline)

TypeScript, JavaScript (JSX/TSX), Python, Go, Rust, Java, C, C++, C#, Ruby, PHP, Kotlin, Swift, Bash — 15+ via tree-sitter WASM.

## Part of [claude-code-skills](https://github.com/LevNikolaevich/claude-code-skills)

125+ skills for Claude Code with config-driven Agile task management.

## License

MIT
