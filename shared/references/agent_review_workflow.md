# Agent Review Workflow (Shared)

Common workflow for all agent reviewer skills (ln-005, ln-311, ln-513). Each skill provides parameters and unique logic; this reference defines the shared execution mechanics.

## Parameters (provided by each skill)

| Parameter | Description | Examples |
|-----------|-------------|---------|
| `review_type` | File naming suffix | `contextreview`, `storyreview`, `codereview` |
| `skill_group` | Health check filter | `005`, `311`, `513` |
| `identifier` | Unique label for file naming | `PROJ-123`, `review_20260227_143000` |
| `verdict_acceptable` | Verdict for "no issues" | `CONTEXT_ACCEPTABLE`, `STORY_ACCEPTABLE`, `CODE_ACCEPTABLE` |
| `prompt_file` | Built prompt path | `.agent-review/{identifier}_{review_type}_prompt.md` |

## Step: Health Check

```
python shared/agents/agent_runner.py --health-check
```

- Filter output by `skill_groups` containing `{skill_group}`
- If 0 agents available -> return `{verdict: "SKIPPED", reason: "no agents available"}`
- Display: `"Agent Health: codex-review OK, gemini-review OK"` (or similar)

## Step: Ensure .agent-review/

- If `.agent-review/` exists -> reuse as-is, do NOT recreate `.gitignore`
- If `.agent-review/` does NOT exist -> create it + `.agent-review/.gitignore` (content: `*` + `!.gitignore`)
- Create `.agent-review/{agent}/` subdirs only if they don't exist
- Do NOT add `.agent-review/` to project root `.gitignore`

## Step: Run Agents (background, process-as-arrive)

a) Launch BOTH agents as background Bash tasks (`run_in_background=true`):

```
python shared/agents/agent_runner.py --agent codex-review \
  --prompt-file {prompt_file} \
  --output-file .agent-review/codex/{identifier}_{review_type}_result.md \
  --cwd {cwd}

python shared/agents/agent_runner.py --agent gemini-review \
  --prompt-file {prompt_file} \
  --output-file .agent-review/gemini/{identifier}_{review_type}_result.md \
  --cwd {cwd}
```

b) When first agent completes (background task notification):
   - Result file is already written by agent_runner.py -- do NOT write or rewrite it
   - Read `.agent-review/{agent}/{identifier}_{review_type}_result.md`
   - Parse JSON between `<!-- AGENT_REVIEW_RESULT -->` / `<!-- END_AGENT_REVIEW_RESULT -->` markers
   - Parse `session_id` from `<!-- session_id: ... -->` metadata line in result file
   - Write `.agent-review/{agent}/{identifier}_session.json`: `{"agent": "...", "session_id": "...", "review_type": "...", "created_at": "..."}`
   - Proceed to Critical Verification for this agent's suggestions

c) When second agent completes:
   - Read its result file, parse suggestions
   - Run Critical Verification for second batch
   - Merge verified suggestions from both agents

d) If an agent fails: log failure, continue with available results

## Step: Critical Verification + Debate

Per Debate Protocol in `shared/references/agent_delegation_pattern.md`.

For EACH suggestion from agent results:

a) **Claude Evaluation:** Independently assess -- is the issue real? Actionable? Conflicts with project patterns?

b) **AGREE** -> accept as-is. **DISAGREE/UNCERTAIN** -> initiate challenge.

c) **Challenge + Follow-Up (with session resume):** Follow Debate Protocol (Challenge Round 1 -> Follow-Up Round if not resolved). Resume agent's review session for full context continuity:
   - Read `session_id` from `.agent-review/{agent}/{identifier}_session.json`
   - Run with `--resume-session {session_id}` -- agent continues in same session, preserving file analysis and reasoning
   - If `session_resumed: false` in result -> log warning, result still valid (stateless fallback)
   - Challenge files: `.agent-review/{agent}/{identifier}_{review_type}_challenge_{N}_prompt.md` / `_result.md`
   - Follow-up files: `.agent-review/{agent}/{identifier}_{review_type}_followup_{N}_prompt.md` / `_result.md`

d) **Persist:** all challenge and follow-up prompts/results in `.agent-review/{agent}/`

## Step: Aggregate + Return

- Collect ACCEPTED suggestions only (after verification + debate)
- Deduplicate by `(area, issue)` -- keep higher confidence
- **Filter:** `confidence >= 90` AND `impact_percent > 10`
- **Return** JSON with suggestions + agent_stats + debate_log. **NO cleanup/deletion.**

## Fallback Rules

| Condition | Action |
|-----------|--------|
| Both agents succeed | Aggregate verified suggestions from both |
| One agent fails | Use successful agent's verified suggestions, log failure |
| Both agents fail | Return `{verdict: "SKIPPED", reason: "agents failed"}` |
| Agent crashes immediately (< 5s, non-zero exit) | Likely MCP init failure (expired auth); log error, use other agent. If both crash -> SKIPPED + note to check agent MCP config |

## Critical Rules

- Read-only review -- agents must NOT modify project files (enforced by prompt CRITICAL CONSTRAINTS)
- Same prompt to all agents (identical input for fair comparison)
- JSON output schema required from agents (via `--json` / `--output-format json`)
- Log all attempts for user visibility (agent name, duration, suggestion count)
- **Persist** shared prompt in `.agent-review/`, results and challenge artifacts in `.agent-review/{agent}/` -- do NOT delete
- Ensure `.agent-review/.gitignore` exists before creating files (only create if `.agent-review/` is new)
- **NO TIMEOUT KILL -- WAIT FOR RESPONSE:** Do NOT kill agent background tasks. WAIT until agent completes and delivers its response -- do NOT proceed without it, do NOT use TaskStop. Only a hard crash (non-zero exit code, connection error) is treated as failure. TaskStop is FORBIDDEN for agent tasks.
- **CRITICAL VERIFICATION:** Do NOT trust agent suggestions blindly. Claude MUST independently verify each suggestion and debate if disagreeing. Accept only after verification.

## Definition of Done

- All available agents launched as background tasks (or gracefully failed with logged reason)
- Shared prompt persisted in `.agent-review/` (single file, read by all agents)
- Raw results persisted in `.agent-review/{agent}/` (no cleanup)
- Each suggestion critically verified by Claude; challenges executed for disagreements
- Follow-up rounds executed for suggestions rejected after Round 1 (DEFEND+weak / MODIFY+disagree)
- Challenge and follow-up prompts/results persisted alongside review artifacts
- Accepted suggestions filtered by confidence >= 90 AND impact_percent > 10
- Deduplicated verified suggestions returned with verdict, agent_stats, and debate_log
- `.agent-review/.gitignore` exists (created only if `.agent-review/` was new)
- Session files persisted in `.agent-review/{agent}/{identifier}_session.json` for debate resume

## Output Schema (common structure)

```yaml
verdict: "{verdict_acceptable} | SUGGESTIONS | SKIPPED"
suggestions:
  - area: "..."
    issue: "What is wrong"
    suggestion: "Specific fix"
    confidence: 95
    impact_percent: 15
    source: "codex-review"
    resolution: "accepted | accepted_after_debate | accepted_after_followup | rejected"
agent_stats:
  - name: "codex-review"
    duration_s: 12.4
    suggestion_count: 3
    accepted_count: 2
    challenged_count: 1
    followup_count: 1
    status: "success | failed | timeout"
debate_log:
  - suggestion_summary: "..."
    agent: "codex-review"
    rounds:
      - round: 1
        claude_position: "..."
        agent_decision: "DEFEND | WITHDRAW | MODIFY"
        resolution: "accepted | rejected | follow_up"
    final_resolution: "accepted | accepted_after_debate | accepted_after_followup | rejected"
```

## Shared Reference Files

- **Agent delegation pattern:** `shared/references/agent_delegation_pattern.md`
- **Prompt template (challenge):** `shared/agents/prompt_templates/challenge_review.md`
- **Challenge schema:** `shared/agents/schemas/challenge_review_schema.json`
- **Agent registry:** `shared/agents/agent_registry.json`
- **Agent runner:** `shared/agents/agent_runner.py`
