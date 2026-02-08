---
name: ln-311-agent-reviewer
description: "Worker that runs parallel external agent reviews (Codex + Gemini) on Story/Tasks. Reference-based prompts. Returns filtered suggestions for Story validation."
---

# Agent Reviewer (Story)

Runs parallel external agent reviews on validated Story and Tasks, returns editorial suggestions.

## Purpose & Scope
- Worker in ln-310 validation pipeline (invoked in Phase 5)
- Run codex-review + gemini-review in parallel on Story/Tasks text
- Return filtered, deduplicated suggestions for Story/Tasks improvement
- Health check + prompt execution in single invocation (minimal timing gap between availability check and actual API call)

## When to Use
- **Invoked by ln-310-story-validator** Phase 5 (Agent Review)
- After Phase 4 auto-fixes applied, Penalty Points = 0
- Story and Tasks are in their final form before approval

## Inputs (from parent skill)
- `story_ref`: Linear URL (`https://linear.app/team/PROJ-123`) or file path (`docs/tasks/epics/.../story.md`)
- `tasks_ref`: Linear URL, file path, or glob pattern for child Tasks
- `cwd`: Project working directory (agents run in this directory and can read files)

## Workflow
1) **Health check:** `python shared/agents/agent_runner.py --health-check`
   - Filter output by `skill_groups` containing "311"
   - If 0 agents available -> return `{verdict: "SKIPPED", reason: "no agents available"}`
   - Display: `"Agent Health: codex-review OK, gemini-review OK"` (or similar)
2) **Build prompt:** Read template `shared/agents/prompt_templates/story_review.md`
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
verdict: STORY_ACCEPTABLE | SUGGESTIONS | SKIPPED
suggestions:
  - area: "security | performance | architecture | feasibility | best_practices"
    issue: "What is wrong or could be improved"
    suggestion: "Specific change to Story or Tasks"
    confidence: 95
    impact_percent: 15
agent_stats:
  - name: "codex-review"
    duration_s: 8.2
    suggestion_count: 2
    status: "success | failed | timeout"
```

## Fallback Rules

| Condition | Action |
|-----------|--------|
| Both agents succeed | Aggregate suggestions from both |
| One agent fails | Use successful agent's suggestions, log failure |
| Both agents fail | Return `{verdict: "SKIPPED", reason: "agents failed"}` |
| Parent skill (ln-310) | Falls back to Self-Review (native Claude) |

## Verdict Escalation
- **No escalation.** Suggestions are editorial only — they modify Story/Tasks text.
- Parent skill (ln-310) Gate verdict remains unchanged by agent suggestions.

## Critical Rules
- Read-only review — agents must NOT modify files
- Same prompt to all agents (identical input for fair comparison)
- JSON output schema required from agents (via `--json` / `--output-format json`)
- Log all attempts for user visibility (agent name, duration, suggestion count)

## Reference Files
- **Agent delegation pattern:** `shared/references/agent_delegation_pattern.md`
- **Prompt template:** `shared/agents/prompt_templates/story_review.md`
- **Agent registry:** `shared/agents/agent_registry.json`
- **Agent runner:** `shared/agents/agent_runner.py`

---
**Version:** 1.0.0
**Last Updated:** 2026-02-08
