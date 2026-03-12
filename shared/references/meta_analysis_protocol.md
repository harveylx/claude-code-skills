# Meta-Analysis Protocol

Universal post-completion protocol for all coordinators and orchestrators.
Run as the LAST step after all delegated work completes and results are aggregated.
Output to chat — visible to the user.

## Skill Types

| Type | Key Metrics |
|------|-------------|
| `planning-coordinator` | Plan completeness, scope coverage, task quality |
| `review-coordinator` — with agents | Coverage, findings quality, blind spots, agent effectiveness |
| `review-coordinator` — workers only | Coverage, findings quality, blind spots |
| `execution-orchestrator` | Stage completion, failure points, quality score |
| `optimization-coordinator` | Fixes applied/discarded, impact achieved |

## Universal Dimensions

### 1. Deliverable Quality
- Did output meet the stated goal?
- Scope coverage: were all required areas addressed?
- Any critical gaps or incomplete deliverables?

### 2. Worker / Subskill Effectiveness
| Worker/Subskill | Status | Result |
|----------------|--------|--------|
| {name} | ✓ OK / ⚠ Degraded / ✗ Failed | {brief result} |

### 3. Failure Points
- Errors, timeouts, crashes, retries during this run
- Infra issues (missing files, message delivery, permissions)
- Manual interventions required

### 4. Improvement Candidates
Top 1-3 actionable items for next run (NOT one-off issues).

## Output Format by Skill Type

### planning-coordinator

```
### Meta-Analysis: {Skill Name}
| Deliverable | Status | Coverage |
|------------|--------|----------|
| {plan/tasks/epics} | ✓/⚠/✗ | {N}/{total} items |
- Failure points: {list or "None"}
- Improvement: {1-2 items or "None"}
```

### review-coordinator — with agents

```
### Meta-Analysis: {Skill Name}
| Agent/Worker | Accepted | Total | Rate | Focus |
|-------------|----------|-------|------|-------|
| {name} | {N} | {M} | {%} | {areas found} |
- Overlap: {N} duplicate findings
- Blind spots: {areas with 0 findings}
- Improvement: {1-2 items or "None"}
```

### review-coordinator — workers only

```
### Meta-Analysis: {Skill Name}
| Worker | Findings | Accepted | Rate |
|--------|----------|----------|------|
| {name} | {N} | {M} | {%} |
- Coverage gaps: {areas with 0 findings or "None"}
- Improvement: {1-2 items or "None"}
```

### execution-orchestrator

```
### Meta-Analysis: {Skill Name}
| Stage/Step | Skill | Duration | Status | Result |
|-----------|-------|----------|--------|--------|
| {stage} | {ln-NNN} | {time} | ✓/⚠/✗ | {brief} |
### Problems & Limitations
{infra issues table or "None detected."}
### Improvement Candidates
{numbered list or "None — ran clean."}
```

### optimization-coordinator

```
### Meta-Analysis: {Skill Name}
| Worker | Applied | Discarded | Impact |
|--------|---------|-----------|--------|
| {name} | {N} | {M} | {description} |
- Failure points: {list or "None"}
- Improvement: {1-2 items or "None"}
```

## Issue Suggestion Triggers (patterns across 3+ runs)

| Pattern | Likely Cause | Action |
|---------|-------------|--------|
| Worker consistently ✗ Failed | Wrong config or missing prereq | Check worker setup |
| Acceptance rate < 30% | Prompt quality or model mismatch | Refine delegation prompt |
| Same blind spot repeated | Goal too narrow | Broaden scope in prompt |
| Failure points > 2 per run | Infra or config issue | Fix root cause |
| Same improvement candidate repeated | Not actionable in current design | Create GitHub issue |

If pattern is reproducible:
> Consider creating issue: https://github.com/levnikolaevich/claude-code-skills/issues

---
**Version:** 2.0.0
**Last Updated:** 2026-03-12
