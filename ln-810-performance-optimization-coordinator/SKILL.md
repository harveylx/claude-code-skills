---
name: ln-810-performance-optimization-coordinator
description: "Coordinates performance optimization: algorithm, query, and runtime workers in parallel"
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root.

# ln-810-performance-optimization-coordinator

**Type:** L2 Domain Coordinator
**Category:** 8XX Optimization

Coordinates performance optimization by delegating to L3 workers: ln-811 (algorithm), ln-812 (query), ln-813 (runtime). Workers run in parallel when inputs are independent.

---

## Overview

| Aspect | Details |
|--------|---------|
| **Input** | Target file/module OR audit report (ln-650 output) |
| **Output** | Optimized code with verification proof |
| **Workers** | ln-811 (algorithm), ln-812 (query), ln-813 (runtime) |

---

## Workflow

**Phases:** Pre-flight → Analyze Input → Delegate → Collect → Verify → Report

---

## Phase 0: Pre-flight Checks

| Check | Required | Action if Missing |
|-------|----------|-------------------|
| Target file OR audit report | Yes | Block optimization |
| Git clean state | Yes | Block (need clean baseline for revert) |
| Test infrastructure | Yes | Block (workers need tests for keep/discard) |

**MANDATORY READ:** Load `shared/references/ci_tool_detection.md` for test/build detection.

---

## Phase 1: Analyze Input

### Input Sources

| Source | Detection | Workers Activated |
|--------|-----------|-------------------|
| `docs/project/persistence_audit.md` | ln-650 output exists | ln-812 (query) + ln-813 (runtime) |
| Target file + function | User-specified | ln-811 (algorithm) |
| Full audit report | All ln-65X sections present | All three workers |

### Worker Selection

| Condition | ln-811 | ln-812 | ln-813 |
|-----------|--------|--------|--------|
| Target function specified | Yes | No | No |
| ln-651 findings present | No | Yes | No |
| ln-653 findings present | No | No | Yes |
| All audit findings | Conditional* | Yes | Yes |

*ln-811 activated only if specific algorithmic inefficiency identified in audit.

---

## Phase 2: Delegate to Workers

> **CRITICAL:** All delegations use Task tool with `subagent_type: "general-purpose"` for context isolation.

### Delegation Protocol

```
FOR each selected worker:
  Task(description: "Optimize via ln-81X",
       prompt: "Execute ln-81X-{worker}. Read skill from ln-81X-{worker}/SKILL.md. Context: {delegationContext}",
       subagent_type: "general-purpose")
```

### Delegation Context

| Field | Type | Description |
|-------|------|-------------|
| projectPath | string | Absolute path to project |
| auditReport | string | Path to persistence_audit.md (if applicable) |
| targetFile | string | Target file path (if applicable) |
| targetFunction | string | Target function name (if applicable) |
| options.runTests | bool | Run tests after optimization |
| options.runLint | bool | Run lint after optimization |

### Parallelism

| Workers | Can Parallel | Reason |
|---------|-------------|--------|
| ln-812 + ln-813 | Yes | Different files, different fix types |
| ln-811 + ln-812 | Depends | Only if targeting different files |
| ln-811 + ln-813 | Depends | Only if targeting different files |

**Rule:** If workers target the SAME file, run sequentially (ln-811 first, then ln-812/813).

---

## Phase 3: Collect Results

### Result Schema

| Field | Type | Description |
|-------|------|-------------|
| worker | string | ln-811, ln-812, or ln-813 |
| status | enum | success, partial, failed |
| fixes_applied | int | Number of kept optimizations |
| fixes_discarded | int | Number of discarded attempts |
| details | object | Worker-specific report |

---

## Phase 4: Verify Build

After all workers complete, run full verification:

| Step | Command Source |
|------|---------------|
| Tests | ci_tool_detection.md → Test Frameworks |
| Build | ci_tool_detection.md → Build |
| Lint | ci_tool_detection.md → Linters |

### On Failure

1. Identify which worker's changes broke the build
2. Revert that worker's changes: `git checkout -- {affected_files}`
3. Re-run verification
4. Log reverted worker as "failed" in report

---

## Phase 5: Report Summary

### Report Schema

| Field | Description |
|-------|-------------|
| input_source | Audit report or target file |
| workers_activated | Which workers ran |
| total_fixes_applied | Sum across all workers |
| total_fixes_discarded | Sum across all workers |
| build_verified | PASSED or FAILED |
| per_worker[] | Individual worker reports |
| algorithm_improvement | Benchmark improvement % (ln-811 only) |

---

## Configuration

```yaml
Options:
  # Input
  audit_report: "docs/project/persistence_audit.md"
  target_file: ""
  target_function: ""

  # Workers
  enable_algorithm: true
  enable_query: true
  enable_runtime: true

  # Verification
  run_tests: true
  run_build: true
  run_lint: true

  # Safety
  revert_on_build_failure: true
```

---

## Error Handling

### Recoverable Errors

| Error | Recovery |
|-------|----------|
| Worker timeout | Log timeout, continue with other workers |
| Single worker failure | Revert worker changes, report partial success |
| Build failure | Revert last worker, re-verify |

### Fatal Errors

| Error | Action |
|-------|--------|
| No workers activated | Report "no optimization targets found" |
| All workers failed | Report failures, suggest manual review |
| Dirty git state | Block with "commit or stash changes first" |

---

## References

- `../ln-811-algorithm-optimizer/SKILL.md`
- `../ln-812-query-optimizer/SKILL.md`
- `../ln-813-runtime-optimizer/SKILL.md`
- `shared/references/ci_tool_detection.md`

---

## Definition of Done

- Input analyzed (audit report or target file/function)
- Appropriate workers selected based on input type
- Workers delegated via Task tool with context isolation
- Worker results collected with fix counts
- Full build verification after all workers complete
- Summary report with per-worker details and total fix counts

---

**Version:** 1.0.0
**Last Updated:** 2026-03-08
