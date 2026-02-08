---
name: ln-502-agent-reviewer
description: "Worker that runs parallel external agent reviews (Codex + Gemini) on code changes. Reference-based prompts. Returns filtered suggestions with confidence scoring."
---

# Agent Reviewer (Code)

Runs parallel external agent reviews on code implementation, returns filtered suggestions.

## Purpose & Scope
- Worker in ln-500 quality gate pipeline (invoked by ln-501 Step 7)
- Run codex-review + gemini-review in parallel on code changes
- Return filtered, deduplicated suggestions with confidence scoring
- Health check + prompt execution in single invocation (minimal timing gap between availability check and actual API call)

## When to Use
- **Invoked by ln-501-code-quality-checker** Step 7 (Agent Review)
- All implementation tasks in Story status = Done
- Code quality analysis (Steps 1-6) already completed by ln-501

## Inputs (from parent skill)
- `story_ref`: Linear URL (`https://linear.app/team/PROJ-123`) or file path (`docs/tasks/epics/.../story.md`)
- `tasks_ref`: Linear URL, file path, or glob pattern for Done implementation tasks
- `cwd`: Project working directory (agents run in this directory and can read files)

## Workflow
1) **Health check:** `python shared/agents/agent_runner.py --health-check`
   - Filter output by `skill_groups` containing "502"
   - If 0 agents available -> return `{verdict: "SKIPPED", reason: "no agents available"}`
   - Display: `"Agent Health: codex-review OK, gemini-review UNAVAILABLE"` (or similar)
2) **Build prompt:** Read template `shared/agents/prompt_templates/code_review.md`
   - Replace `{story_ref}` and `{tasks_ref}` with actual references from inputs
   - Save expanded prompt to temp file (use `%TEMP%` on Windows, `/tmp` on Unix)
3) **Run agents in parallel** (two Bash calls simultaneously):
   - `python shared/agents/agent_runner.py --agent codex-review --prompt-file {temp} --cwd {cwd}`
   - `python shared/agents/agent_runner.py --agent gemini-review --prompt-file {temp} --cwd {cwd}`
4) **Aggregate:** Collect suggestions from all successful responses. Deduplicate by `(area, issue)` — keep higher confidence.
5) **Filter:** `confidence >= 90` AND `impact_percent > 2`
6) **Return** JSON with suggestions + agent stats to parent skill.

## Output Format

```yaml
verdict: CODE_ACCEPTABLE | SUGGESTIONS | SKIPPED
suggestions:
  - area: "security | performance | architecture | correctness | best_practices"
    issue: "What is wrong"
    suggestion: "Specific fix"
    confidence: 95
    impact_percent: 15
agent_stats:
  - name: "codex-review"
    duration_s: 12.4
    suggestion_count: 3
    status: "success | failed | timeout"
```

## Fallback Rules

| Condition | Action |
|-----------|--------|
| Both agents succeed | Aggregate suggestions from both |
| One agent fails | Use successful agent's suggestions, log failure |
| Both agents fail | Return `{verdict: "SKIPPED", reason: "agents failed"}` |
| Parent skill (ln-501) | Falls back to Self-Review (native Claude) |

## Verdict Escalation
- Findings with `area=security` or `area=correctness` -> parent skill can escalate PASS -> CONCERNS
- This skill returns raw suggestions; escalation decision is made by ln-501

## Critical Rules
- Read-only review — agents must NOT modify files
- Same prompt to all agents (identical input for fair comparison)
- JSON output schema required from agents (via `--json` / `--output-format json`)
- Log all attempts for user visibility (agent name, duration, suggestion count)

## Reference Files
- **Agent delegation pattern:** `shared/references/agent_delegation_pattern.md`
- **Prompt template:** `shared/agents/prompt_templates/code_review.md`
- **Agent registry:** `shared/agents/agent_registry.json`
- **Agent runner:** `shared/agents/agent_runner.py`

---
**Version:** 1.0.0
**Last Updated:** 2026-02-08
