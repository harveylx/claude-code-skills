---
name: ln-830-code-modernization-coordinator
description: "Coordinates code modernization: OSS replacement and bundle optimization workers"
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root.

# ln-830-code-modernization-coordinator

**Type:** L2 Domain Coordinator
**Category:** 8XX Optimization

Coordinates code modernization by delegating to L3 workers: ln-831 (OSS replacer) and ln-832 (bundle optimizer). Executes migration plans from 6XX audit findings.

---

## Overview

| Aspect | Details |
|--------|---------|
| **Input** | Audit report (ln-645 migration plan) OR target module |
| **Output** | Modernized codebase with verification proof |
| **Workers** | ln-831 (OSS replacer), ln-832 (bundle optimizer) |

---

## Workflow

**Phases:** Pre-flight → Analyze Input → Delegate → Collect → Verify → Report

---

## Phase 0: Pre-flight Checks

| Check | Required | Action if Missing |
|-------|----------|-------------------|
| Audit report OR target module | Yes | Block modernization |
| Git clean state | Yes | Block (need clean baseline for revert) |
| Test infrastructure | Yes | Block (workers need tests for keep/discard) |

**MANDATORY READ:** Load `shared/references/ci_tool_detection.md` for test/build detection.

---

## Phase 1: Analyze Input

### Worker Selection

| Condition | ln-831 | ln-832 |
|-----------|--------|--------|
| ln-645 findings present (OSS candidates) | Yes | No |
| JS/TS project with package.json | No | Yes |
| Both conditions | Yes | Yes |
| Target module specified | Yes | No |

### Stack Detection

| Indicator | Stack | ln-832 Eligible |
|-----------|-------|----------------|
| package.json + JS/TS files | JS/TS | Yes |
| *.csproj | .NET | No |
| requirements.txt / pyproject.toml | Python | No |
| go.mod | Go | No |

---

## Phase 2: Delegate to Workers

> **CRITICAL:** All delegations use Task tool with `subagent_type: "general-purpose"` for context isolation.

### Delegation Protocol

```
FOR each selected worker:
  Task(description: "Modernize via ln-83X",
       prompt: "Execute ln-83X-{worker}. Read skill from ln-83X-{worker}/SKILL.md. Context: {delegationContext}",
       subagent_type: "general-purpose")
```

### Delegation Context

| Field | Type | Description |
|-------|------|-------------|
| projectPath | string | Absolute path to project |
| auditReport | string | Path to codebase_audit.md (if applicable) |
| targetModule | string | Target module path (if applicable) |
| options.runTests | bool | Run tests after modernization |

### Execution Order

| Order | Worker | Reason |
|-------|--------|--------|
| 1 | ln-831 (OSS replacer) | May add/remove packages, affecting bundle |
| 2 | ln-832 (bundle optimizer) | Runs AFTER package changes are settled |

**Rule:** Workers run sequentially — ln-831 package changes affect ln-832 baseline.

---

## Phase 3: Collect Results

### Result Schema

| Field | Type | Description |
|-------|------|-------------|
| worker | string | ln-831 or ln-832 |
| status | enum | success, partial, failed |
| changes_applied | int | Number of kept changes |
| changes_discarded | int | Number of discarded attempts |
| details | object | Worker-specific report |

---

## Phase 4: Verify Build

After all workers complete, run full verification:

| Step | Command Source |
|------|---------------|
| Tests | ci_tool_detection.md → Test Frameworks |
| Build | ci_tool_detection.md → Build |

### On Failure

1. Identify which worker's changes broke the build
2. Revert that worker's changes
3. Re-run verification
4. Log reverted worker as "failed"

---

## Phase 5: Report Summary

### Report Schema

| Field | Description |
|-------|-------------|
| input_source | Audit report or target module |
| workers_activated | Which workers ran |
| modules_replaced | OSS replacements applied (ln-831) |
| loc_removed | Custom code lines removed (ln-831) |
| bundle_reduction | Bundle size reduction in bytes/% (ln-832) |
| build_verified | PASSED or FAILED |
| per_worker[] | Individual worker reports |

---

## Configuration

```yaml
Options:
  # Input
  audit_report: "docs/project/codebase_audit.md"
  target_module: ""

  # Workers
  enable_oss_replacer: true
  enable_bundle_optimizer: true

  # Verification
  run_tests: true
  run_build: true

  # Safety
  revert_on_build_failure: true
```

---

## Error Handling

### Recoverable Errors

| Error | Recovery |
|-------|----------|
| ln-831 failure | Continue with ln-832 |
| ln-832 failure | Report partial success (ln-831 results valid) |
| Build failure | Revert last worker, re-verify |

### Fatal Errors

| Error | Action |
|-------|--------|
| No workers activated | Report "no modernization targets found" |
| All workers failed | Report failures, suggest manual review |
| Dirty git state | Block with "commit or stash changes first" |

---

## References

- `../ln-831-oss-replacer/SKILL.md`
- `../ln-832-bundle-optimizer/SKILL.md`
- `../ln-645-open-source-replacer/SKILL.md` (audit companion)
- `shared/references/ci_tool_detection.md`

---

## Definition of Done

- Input analyzed (audit report or target module)
- Appropriate workers selected based on input and stack
- Workers delegated sequentially via Task tool (ln-831 before ln-832)
- Worker results collected with change counts
- Full build verification after all workers complete
- Summary report with modules replaced, LOC removed, bundle reduction

---

**Version:** 1.0.0
**Last Updated:** 2026-03-08
