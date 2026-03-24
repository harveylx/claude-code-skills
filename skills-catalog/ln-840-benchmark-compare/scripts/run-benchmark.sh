#!/usr/bin/env bash
# Run A/B benchmark: built-in vs hex-line
# Usage: bash scripts/run-benchmark.sh [goals-file]
set -euo pipefail

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
MCP_DIR="$REPO_ROOT/mcp/hex-line-mcp"
RESULTS_DIR="$MCP_DIR/benchmark/results"
GOALS="${1:-$MCP_DIR/benchmark/goals.md}"
DATE=$(date +%Y-%m-%d)
BENCH_DIR="${BENCH_DIR:-d:/tmp}"

mkdir -p "$RESULTS_DIR"

# Generate mcp config with ABSOLUTE server path (worktrees lack node_modules)
MCP_CFG="$RESULTS_DIR/.mcp-bench-resolved.json"
node -e "console.log(JSON.stringify({
  mcpServers: {
    'hex-line': {
      command: 'node',
      args: [process.argv[1] + '/mcp/hex-line-mcp/server.mjs']
    }
  }
}, null, 2))" "$REPO_ROOT" > "$MCP_CFG"

# Build hex-line settings: outputStyle + PreToolUse hook
HOOK_CMD="node $REPO_ROOT/mcp/hex-line-mcp/hook.mjs"
HEX_SETTINGS=$(node -e "console.log(JSON.stringify({
  outputStyle: 'hex-line',
  hooks: {
    PreToolUse: [{
      matcher: 'Read|Edit|Write|Grep',
      hooks: [{ type: 'command', command: process.argv[1], timeout: 5 }]
    }]
  }
}))" "$HOOK_CMD")

# Validate prerequisites
echo "=== Prerequisites ==="
claude --version || { echo "ERROR: claude not found"; exit 1; }
git --version > /dev/null || { echo "ERROR: git not found"; exit 1; }
test -f "$GOALS" || { echo "ERROR: Goals file not found: $GOALS"; exit 1; }
echo "Goals: $GOALS"
echo "MCP config: $MCP_CFG"
echo "Results: $RESULTS_DIR"

# Phase 2: Create worktrees
echo ""
echo "=== Phase 2: Creating worktrees ==="
git -C "$REPO_ROOT" worktree add "$BENCH_DIR/bench-builtin" HEAD 2>&1 || true
git -C "$REPO_ROOT" worktree add "$BENCH_DIR/bench-hexline" HEAD 2>&1 || true
git -C "$REPO_ROOT" worktree list

# Phase 3: Session A (built-in only)
echo ""
echo "=== Phase 3: Session A (built-in only) ==="
(
  cd "$BENCH_DIR/bench-builtin/mcp/hex-line-mcp"
  claude -p \
    --verbose \
    --strict-mcp-config \
    --settings '{"disableAllHooks":true}' \
    --dangerously-skip-permissions \
    --output-format stream-json \
    --max-turns 50 \
    < "$GOALS" \
    > "$RESULTS_DIR/${DATE}-builtin.jsonl" 2>&1
) &
PID_A=$!
echo "PID: $PID_A"

# Phase 4: Session B (hex-line)
echo ""
echo "=== Phase 4: Session B (hex-line) ==="
(
  cd "$BENCH_DIR/bench-hexline/mcp/hex-line-mcp"
  claude -p \
    --verbose \
    --mcp-config "$MCP_CFG" \
    --settings "$HEX_SETTINGS" \
    --dangerously-skip-permissions \
    --output-format stream-json \
    --max-turns 50 \
    < "$GOALS" \
    > "$RESULTS_DIR/${DATE}-hexline.jsonl" 2>&1
) &
PID_B=$!
echo "PID: $PID_B"

# Wait for both
echo ""
echo "=== Waiting for both sessions ==="
wait $PID_A; STATUS_A=$?; echo "Session A finished (exit: $STATUS_A)"
wait $PID_B; STATUS_B=$?; echo "Session B finished (exit: $STATUS_B)"

# Phase 5: Parse results
echo ""
echo "=== Phase 5: Parsing results ==="
node "$SCRIPT_DIR/parse-results.mjs" \
  "$RESULTS_DIR/${DATE}-builtin.jsonl" \
  "$RESULTS_DIR/${DATE}-hexline.jsonl" \
  "$RESULTS_DIR/${DATE}-comparison.md"

echo ""
echo "=== Done ==="
echo "Report: $RESULTS_DIR/${DATE}-comparison.md"
echo ""
echo "Worktrees left for inspection. Remove with:"
echo "  git -C $REPO_ROOT worktree remove --force $BENCH_DIR/bench-builtin"
echo "  git -C $REPO_ROOT worktree remove --force $BENCH_DIR/bench-hexline"
