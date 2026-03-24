---
name: ln-840-benchmark-compare
description: "Runs A/B benchmark: launches two Claude Code sessions (built-in vs hex-line) on identical tasks, compares tool calls, tokens, time. Use after hex-line changes to measure real impact."
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`) are relative to skills repo root. Locate this SKILL.md directory and go up one level for repo root.

# Benchmark Compare

**Type:** L3 Worker
**Category:** 8XX Optimization -> 840 Benchmark

Runs real A/B comparison: launches Claude Code with built-in tools only vs with hex-line MCP on identical composite tasks. Measures turns, tokens, cost, wall time. No simulations.

---

## Input / Output

| Direction | Content |
|-----------|----------|
| **Input** | Target repo path (default: CWD), optional `goals.md` path |
| **Output** | Comparison report in `mcp/hex-line-mcp/benchmark/results/{date}-comparison.md` |

---

## Prerequisites

- `claude --version` succeeds (Claude Code CLI installed)
- `git` available (for worktree isolation)
- `mcp/hex-line-mcp/benchmark/mcp-bench.json` exists (hex-line MCP config for Session B)

## Quick Run

```bash
# From repo root:
bash skills-catalog/ln-840-benchmark-compare/scripts/run-benchmark.sh [goals.md]
```

Script handles worktrees, both sessions, parsing, and report generation. Manual workflow below for customization.

---

## Workflow

### Phase 1: Generate Goals

Analyze the target repo and create 4 composite scenario goals. Save to `benchmark/goals.md` in the target repo.

**Step 1:** Scan repo structure

```bash
# Discover source files and sizes (adapt extensions to repo language)
find . -name '*.mjs' -o -name '*.ts' -o -name '*.py' -o -name '*.go' | \
  xargs wc -l 2>/dev/null | sort -rn | head -30
```

**Step 2:** For each template, find matching targets:

| Template | What to find | Selection criteria | Hex-line advantage tested |
|----------|-------------|-------------------|---------------------------|
| **A: Bug Fix** | File >200L with function containing numeric/string default | Function has >=2 callers | outline, targeted edit, verify |
| **B: Feature Add** | Module <120L with 1-3 exports + consumer | Imports from local module | insert_after, directory_tree, get_file_info, verify |
| **C: Cross-file Refactor** | Symbol used in >=4 files, unique name | Not substring of another identifier | bulk_replace (1 call vs N x Edit) |
| **D: Codebase Exploration** | Directory with >=8 files + entry point | Internal import graph | outline x5, directory_tree, get_file_info, write_file |

**Step 3:** Write goals as self-contained prompts in tool-agnostic language.

**Rules:**
- Use REAL file paths, function names, constants discovered from the repo
- NEVER mention tool names (Read, Grep, outline, bulk_replace, Edit)
- Use developer verbs: "find", "fix", "verify", "show", "create", "rename"
- Scenario A MUST target a file >200 lines (outline advantage)
- Scenario C MUST target a symbol in >=4 files (bulk_replace advantage)
- Each scenario ends with a verification step

**Example goals (adapt to target repo):**

```markdown
## Scenario A: Bug Fix
In function `{fn}` in file `{file}`, the default value `{old}` on line ~{N}
should be `{new}`. Understand what the function does, find all files that call
it, fix the default, verify the file is syntactically correct, and report which
files are affected.

## Scenario B: Feature Addition
Module `{file}` exports {fn_list}. Add a new exported function `{new_fn}({params})`
that {description}. Find a file that imports from `{file}` and add your new
function to its import. Show directory structure. Verify both files are correct.

## Scenario C: Cross-file Refactoring
The symbol `{name}` in `{file}` is used in multiple files. Find ALL references.
Rename to `{new_name}` everywhere. Change value from `{old_val}` to `{new_val}`.
Verify no file still contains the old name. Show diff of every changed file.

## Scenario D: Codebase Exploration
Analyze `{dir}/`. List all source files with sizes. For the 5 largest, list
exported functions with signatures. Build import dependency map. Identify files
imported by nobody. Write summary to `{dir}/MODULES.md`.
```

### Phase 2: Create Isolated Worktrees

Both sessions MUST start from the same commit in separate clean workspaces.

```bash
BENCH_DIR="d:/tmp"  # Windows-safe path, adjust for OS
git worktree add $BENCH_DIR/bench-builtin HEAD
git worktree add $BENCH_DIR/bench-hexline HEAD
```

**Verify:** `git worktree list` shows both on same commit hash.

### Phase 3: Run Session A (Built-in Only)

Launch Claude with built-in tools only. Use `cd` to set working directory (Claude CLI has no `--cwd` flag).

```bash
cd $BENCH_DIR/bench-builtin/mcp/hex-line-mcp && \
claude -p \
  --verbose \
  --strict-mcp-config \
  --settings '{"disableAllHooks":true}' \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --max-turns 50 \
  < $REPO/mcp/hex-line-mcp/benchmark/goals.md \
  > $REPO/mcp/hex-line-mcp/benchmark/results/{date}-builtin.jsonl 2>&1
```

**What these flags do:**
- `--strict-mcp-config` without `--mcp-config` = **zero MCP servers** (only built-in tools)
- `--settings '{"disableAllHooks":true}'` = no hooks (no hex-line redirects)
- `--verbose` + `--output-format stream-json` = per-tool events (both required together)
- `--dangerously-skip-permissions` = no interactive prompts
- `--max-turns 50` = prevent runaway sessions

**DO NOT use:** `--bare` (blocks OAuth/keychain), `--cwd` (does not exist).

### Phase 4: Run Session B (Hex-line)

Launch Claude with hex-line MCP + output style + **PreToolUse hook** that redirects built-in tools to hex-line. System prompt alone is insufficient — agent still prefers built-in tools without hook enforcement.

```bash
# Generate mcp config with absolute server path (worktrees lack node_modules)
MCP_CFG="$RESULTS_DIR/.mcp-bench-resolved.json"
node -e "console.log(JSON.stringify({
  mcpServers: { 'hex-line': { command: 'node', args: [process.argv[1]+'/mcp/hex-line-mcp/server.mjs'] } }
}, null, 2))" "$REPO_ROOT" > "$MCP_CFG"

# Hex-line settings: outputStyle + PreToolUse hook (hook.mjs path from main repo)
HOOK_CMD="node $REPO_ROOT/mcp/hex-line-mcp/hook.mjs"
HEX_SETTINGS=$(node -e "console.log(JSON.stringify({
  outputStyle: 'hex-line',
  hooks: { PreToolUse: [{
    matcher: 'Read|Edit|Write|Grep',
    hooks: [{ type: 'command', command: process.argv[1], timeout: 5 }]
  }] }
}))" "$HOOK_CMD")

cd $BENCH_DIR/bench-hexline/mcp/hex-line-mcp && \
claude -p \
  --verbose \
  --mcp-config "$MCP_CFG" \
  --settings "$HEX_SETTINGS" \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --max-turns 50 \
  < $REPO_ROOT/mcp/hex-line-mcp/benchmark/goals.md \
  > $REPO_ROOT/mcp/hex-line-mcp/benchmark/results/{date}-hexline.jsonl 2>&1
```

**What these flags do:**
- `--mcp-config` with **absolute path** to resolved config = hex-line MCP server starts from main repo (has node_modules)
- `--settings` with `outputStyle` + PreToolUse hook = redirects Read/Edit/Write/Grep to hex-line MCP
- **No `--strict-mcp-config`** for hex-line session (blocks global hooks)
- **Hook is mandatory** -- without it, agent ignores MCP tools even with system prompt

**Critical:** `server.mjs` path in mcp config must point to main repo, not worktree (worktrees have no node_modules).

**Parallelism:** Sessions A and B can run simultaneously (separate worktrees, no shared state). Launch both as background Bash tasks.

### Phase 5: Compare Results

Parse both stream-json outputs. Extract metrics per 5 dimensions.

**5.1 Correctness** — verify each scenario completed correctly:

```markdown
## 1. Correctness

| Scenario | Built-in | Hex-line |
|----------|----------|----------|
| S1: Navigate large file | PASS/FAIL | PASS/FAIL |
| S2: Multi-file rename | PASS/FAIL | PASS/FAIL |
| S3: Sequential edits | PASS/FAIL | PASS/FAIL |
| S4: Codebase exploration | PASS/FAIL | PASS/FAIL |
```

Verify in worktrees: `git diff` in each worktree, check expected file changes.

**5.2 Time** — from result event:

```markdown
## 2. Time

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Wall time | {duration_ms/1000}s | {duration_ms/1000}s | {diff}% |
| API time | {duration_api_ms/1000}s | {duration_api_ms/1000}s | {diff}% |
```

**5.3 Cost** — from result event:

```markdown
## 3. Cost

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Total cost | ${total_cost_usd} | ${total_cost_usd} | {diff}% |
```

**5.4 Tool calls** — count `tool_use` events in stream-json:

```bash
# Count tool calls by name from JSONL
node -e "
  const lines = require('fs').readFileSync('{file}','utf8').trim().split('\n');
  const counts = {};
  for (const l of lines) {
    const e = JSON.parse(l);
    if (e.type === 'tool_use') { counts[e.tool_name] = (counts[e.tool_name]||0)+1; }
  }
  for (const [k,v] of Object.entries(counts).sort((a,b)=>b[1]-a[1])) console.log(v+'\t'+k);
"
```

```markdown
## 4. Tool Calls

| Tool | Built-in | Hex-line |
|------|----------|----------|
| Read / read_file | {N} | {N} |
| Edit / edit_file | {N} | {N} |
| Grep / grep_search | {N} | {N} |
| Bash | {N} | {N} |
| outline | - | {N} |
| verify | - | {N} |
| bulk_replace | - | {N} |
| directory_tree | - | {N} |
| get_file_info | - | {N} |
| **Total** | **{N}** | **{N}** |
```

**5.5 Tokens** — from result event `usage` field:

```markdown
## 5. Tokens

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Output tokens | {N} | {N} | {diff}% |
| Cache creation | {N} | {N} | {diff}% |
| Cache read | {N} | {N} | {diff}% |
| Total context | {N} | {N} | {diff}% |
```

**Delta formula:** `(hex - builtin) / builtin * 100`. Negative = hex-line wins.

Save to `mcp/hex-line-mcp/benchmark/results/{date}-comparison.md`.

### Phase 6: Cleanup

```bash
git worktree remove --force $BENCH_DIR/bench-builtin
git worktree remove --force $BENCH_DIR/bench-hexline
```

Use `--force` because agent sessions modify files in worktrees.

---

## Known Pitfalls

| Pitfall | Solution |
|---------|----------|
| `--bare` blocks OAuth/keychain auth | Use `--settings '{"disableAllHooks":true}'` instead |
| `--cwd` flag does not exist | Use `cd $DIR &&` before `claude -p` |
| `stream-json` without `--verbose` fails | Both flags required: `--output-format stream-json --verbose` |
| Agent creates untracked files in worktree | Use `--force` on `git worktree remove` |
| Simple tasks favor built-in (less overhead) | Include >=1 large file (>400L) + multi-file rename |
| **Worktree lacks node_modules** | MCP server.mjs can't start with relative path. `run-benchmark.sh` generates resolved config with absolute path to main repo's server.mjs |
| **System prompt insufficient for MCP adoption** | Agent ignores MCP tools even with `--append-system-prompt`. PreToolUse hook via `--settings` is required to redirect built-in tools |
| **`--strict-mcp-config` blocks global hooks** | Don't use it for hex-line session. Pass hooks explicitly via `--settings` JSON |

---

## Tool Coverage Matrix

All 10 hex-line tools covered across 4 scenarios:

| Tool | A: Bug Fix | B: Feature Add | C: Refactor | D: Explore |
|------|-----------|----------------|-------------|------------|
| read_file | x | x | x | x |
| outline | x | x | | x |
| grep_search | x | x | x | x |
| edit_file | x | x | x | |
| write_file | | | | x |
| verify | x | x | | |
| directory_tree | | x | | x |
| get_file_info | | x | | |
| bulk_replace | | | x | |
| changes | | | x | x |

---

## Definition of Done

- [ ] Goals generated from real repo targets (Phase 1)
- [ ] Both worktrees created from same commit (Phase 2)
- [ ] Session A completed with `is_error: false` (Phase 3)
- [ ] Session B completed with `is_error: false` (Phase 4)
- [ ] Comparison report saved to `benchmark/results/` (Phase 5)
- [ ] Worktrees cleaned up (Phase 6)

---

**Version:** 1.1.0
**Last Updated:** 2026-03-24
