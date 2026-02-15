#!/bin/bash
# Stop hook for pipeline lead — prevents Claude from stopping while pipeline is active.
# Exit code 2 = "don't stop" (Claude Code hooks protocol).
# This hook IS the heartbeat driver: each exit 2 creates a new agentic loop iteration
# where queued worker messages get delivered and processed by ON handlers in Phase 4.
# Lead writes .pipeline/state.json with complete=false during pipeline execution.
# Phase 5 sets complete=true before cleanup, allowing graceful stop.
# Lead writes .pipeline/lead-session.id at pipeline start — only that session gets heartbeat.

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')

PIPELINE_STATE=$(cat .pipeline/state.json 2>/dev/null || echo '{"complete": true}')
COMPLETE=$(echo "$PIPELINE_STATE" | jq -r '.complete')

if [ "$COMPLETE" = "false" ]; then
  LEAD_SESSION=$(cat .pipeline/lead-session.id 2>/dev/null || echo "")
  if [ "$SESSION_ID" = "$LEAD_SESSION" ] || [ -z "$LEAD_SESSION" ]; then
    WORKERS=$(echo "$PIPELINE_STATE" | jq -r '.active_workers // 0')
    REMAINING=$(echo "$PIPELINE_STATE" | jq -r '.stories_remaining // 0')
    LAST=$(echo "$PIPELINE_STATE" | jq -r '.last_check // "unknown"')
    STORY_STATE=$(echo "$PIPELINE_STATE" | jq -c '.story_state // {}')
    WORKER_MAP=$(echo "$PIPELINE_STATE" | jq -c '.worker_map // {}')
    SKILL_REPO=$(echo "$PIPELINE_STATE" | jq -r '.skill_repo_path // ""')

    cat >&2 <<RECOVERY_EOF
HEARTBEAT: ${WORKERS} active workers, ${REMAINING} stories remaining. Last check: ${LAST}.
---PIPELINE RECOVERY CONTEXT---
You are pipeline lead (ln-1000-pipeline-orchestrator).
STATE: story_state=${STORY_STATE} worker_map=${WORKER_MAP}
FULL STATE: Read .pipeline/state.json
PROTOCOL: Read ${SKILL_REPO}/ln-1000-pipeline-orchestrator/SKILL.md Phase 4 + references/phases/phase4_handlers.md + references/phases/phase4_heartbeat.md
ACTIONS: 1) Process queued worker messages (ON handlers) 2) Verify done-flags (Step 2.5) 3) Write .pipeline/state.json 4) Output status table, end turn
RECOVERY_EOF
    sleep 60
    exit 2
  fi
fi

exit 0
