# Task Tool Delegation Pattern

Standard pattern for L2 coordinators delegating to L3 workers with context isolation.

## Prompt Template

```javascript
Task(
  description: "[Action] [item] via [skill-name]",
  prompt: "Execute [skill-name]. Read skill from [skill-name]/SKILL.md. [Context]",
  subagent_type: "general-purpose"
)
```

## Context Isolation Rules

1. **Worker loads context independently** — never pass full context from coordinator
2. **Pass only IDs** — worker fetches details via `get_issue()`, `Read`, etc.
3. **Fresh eyes review** — worker analyzes without coordinator bias
4. **No bulk delegations** — invoke one task at a time, wait for completion

## Worker Output Contract

Two delivery modes depending on coordinator scale:

### File-Based Output (All Audit Coordinators)

Workers write full report to `docs/project/.audit/{coordinator-id}/{YYYY-MM-DD}/{worker_id}.md` and return minimal summary in-context.

**Template:** `shared/templates/audit_worker_report_template.md`

**Worker return (in-context, ~50 tokens):**
```
Report written: docs/project/.audit/{coordinator-id}/{YYYY-MM-DD}/{worker-id}-security.md
Score: 7.5/10 | Issues: 5 (C:0 H:2 M:2 L:1)
```

Extended workers (pattern analyzer, API contract auditor) include diagnostic sub-scores:
```
Report written: docs/project/.audit/{coordinator-id}/{YYYY-MM-DD}/{worker-id}-pattern-job-processing.md
Score: 6.0/10 (C:72 K:85 Q:68 I:90) | Issues: 3 (H:1 M:2 L:0)
```

**Coordinator receives:** path + score + counts (enough for aggregation). Reads files only during report assembly or cross-domain aggregation.

No deletion of previous date folders — history preserved for comparison.

## Audit Coordinator → Worker Contract

### Coordinator Input to Worker (contextStore)

```json
{
  "tech_stack": {
    "language": "TypeScript",
    "frameworks": ["Express", "Prisma"],
    "database": "PostgreSQL"
  },
  "best_practices": {
    "express": "Use middleware for error handling...",
    "prisma": "Always use transactions for multi-table..."
  },
  "principles": "docs/principles.md content...",
  "codebase_root": ".",
  "domain_mode": "domain-aware|global",
  "current_domain": {
    "name": "users",
    "path": "src/users"
  }
}
```

### Worker Output (back to Coordinator)

See `audit_output_schema.md` for full schema. Workers MUST return:
- `category`: matches worker specialty
- `score`: 0-10 per `audit_scoring.md`
- `checks[]`: each rule checked
- `findings[]`: issues with locations

### Data Flow Diagrams

**File-based (codebase auditor, pattern evolution auditor):**
```
┌─────────────────────┐
│ L2 Coordinator      │
│ (file-based output) │
└─────────┬───────────┘
          │ contextStore + output_dir
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│ L3 Worker (Task)    │     │ L3 Worker (Task)    │
└──┬──────────────┬───┘     └──┬──────────────┬───┘
   │ Write file   │ Return     │ Write file   │ Return
   ▼              │ ~50 tok    ▼              │ ~50 tok
 .audit/          └─────┬──────.audit/        └────┬──
 6XX-slug.md            │      6XX-slug.md         │
                        ▼                          ▼
              ┌─────────────────────┐
              │ Aggregation         │
              │ Read return values  │
              │ Read files for      │
              │ report/cross-domain │
              └─────────────────────┘
```

**In-context JSON (persistence auditor, test auditor):**
```
┌─────────────────────┐
│ L2 Coordinator      │
│ (JSON output)       │
└─────────┬───────────┘
          │ contextStore
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│ L3 Worker (Task)    │     │ L3 Worker (Task)    │
└─────────┬───────────┘     └─────────┬───────────┘
          │ JSON output               │ JSON output
          └───────────┬───────────────┘
                      ▼
            ┌─────────────────────┐
            │ Aggregation         │
            │ overall_score,      │
            │ all findings        │
            └─────────────────────┘
```

## Anti-Patterns

| ❌ DON'T | ✅ DO |
|----------|------|
| Direct Skill tool without Task wrapper | Use Task with subagent_type |
| Pass full context to worker | Pass IDs, worker fetches details |
| Batch multiple delegations | Sequential: delegate → wait → next |
| Skip worker result analysis | Always analyze worker output |
| Parse worker text output | Require JSON, validate structure |

## Parallelism Strategy

**When to parallelize:**
- Independent workers (no data dependencies)
- Different audit categories
- Multiple files without overlap

**When to serialize:**
- Workers depend on previous results
- Same resource being modified
- Order matters (e.g., validation before execution)

## Error Handling

```
IF worker returns error:
  1. Log error details
  2. Continue with other workers (graceful degradation)
  3. Include partial results in final output
  4. Mark failed checks as "skipped" with error reason
```

## Usage

Reference this pattern in skill files:

```markdown
## Worker Invocation

See `shared/references/task_delegation_pattern.md` for prompt template and context isolation rules.

Workers for this skill:
- ln-XXX-worker-1: [purpose]
- ln-XXX-worker-2: [purpose]
```

## Execution Workers (Non-Audit)

For execution workers (task executor, task rework, test executor):

**Input:** Task ID only (worker loads full context independently)

```javascript
Task(
  description: "Execute task via task executor",
  prompt: "Execute task executor for task PROJ-123. Read skill from task executor SKILL.md.",
  subagent_type: "general-purpose"
)
```

**Output:** Status update + summary
```json
{
  "task_id": "PROJ-123",
  "status": "To Review",
  "summary": "Implemented UserService with 3 methods",
  "files_changed": ["src/services/UserService.ts"],
  "next_action": "Review via task reviewer"
}
```

---
**Version:** 2.0.0
**Last Updated:** 2026-02-15
