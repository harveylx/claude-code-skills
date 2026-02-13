# Worker Health Contract

Worker lifecycle, health monitoring, and crash recovery for pipeline story workers.

## Worker Lifecycle

```
SPAWNED ──→ EXECUTING ──→ REPORTING ──→ IDLE ──→ EXECUTING (next stage)
                │                         │
                │                         └──→ SHUTDOWN (graceful, lead request)
                │
                └──→ CRASHED (no completion message, idle without report)
```

| State | Description | Duration |
|-------|------------|----------|
| SPAWNED | Task() called, worker initializing | Seconds |
| EXECUTING | Worker running ln-300/310/400/500 via Skill tool | Minutes to hours (ln-400 can be long) |
| REPORTING | Worker sends "Stage N COMPLETE/ERROR" to lead | Seconds |
| IDLE | TeammateIdle notification, waiting for lead command | Until lead sends next command |
| SHUTDOWN | Worker received shutdown_request, approved, exiting | Seconds |
| CRASHED | Worker stopped without sending completion message | Detected by lead |

## Health Signal Matrix

| Signal | Meaning | Lead Action |
|--------|---------|-------------|
| Worker sends "Stage N COMPLETE" | Healthy, stage done | Process result, advance per pipeline_states.md |
| Worker sends "Stage N ERROR" | Healthy, stage failed | Process error, decide retry/pause |
| TeammateIdle WITH prior COMPLETE/ERROR in same turn | Normal: reporting then idle | Assign next stage or shutdown |
| TeammateIdle WITHOUT prior COMPLETE/ERROR | Suspicious: possible crash | Enter Crash Detection Protocol |
| No notification at all | Worker still executing | WAIT — do NOT interrupt. ln-400/ln-500 can run 30+ min |

**Critical rule:** TeammateIdle is NORMAL between turns. Do NOT treat idle as error. Only suspicious when idle arrives without completion message for current stage.

## Crash Detection Protocol

3-step protocol. Goal: distinguish normal idle from actual crash with minimal false positives.

```
# Step 1: Flag suspicious
ON TeammateIdle for worker_map[id] WITHOUT "Stage N COMPLETE/ERROR":
  suspicious_idle[id] = true
  last_known_stage[id] = story_state[id]

# Step 2: Probe
SendMessage(recipient: worker_map[id],
            content: "Status check: are you still working on Stage {N} for {id}?",
            summary: "{id} health check")

# Step 3: Evaluate response
ON worker responds with parseable status:
  suspicious_idle[id] = false              # False alarm, worker alive
  # Continue normal operation

ON TeammateIdle again WITHOUT response:
  # Confirmed crash
  crash_count[id]++
  IF crash_count[id] <= 1:
    Respawn (see Respawn Rules below)
  ELSE:
    story_state[id] = "PAUSED"
    active_workers--
    ESCALATE: "Story {id} worker crashed twice at Stage {N}. Manual intervention required."
```

## Respawn Rules

When crash confirmed (Step 3):

1. **Shutdown old worker** (best effort — may already be dead):
   ```
   SendMessage(type: "shutdown_request", recipient: worker_map[id])
   ```

2. **Decrement counter:**
   ```
   active_workers--
   ```

3. **Spawn replacement:**
   ```
   new_worker = "story-{id}-retry"
   Task(name: new_worker, team_name: "pipeline-{date}",
        model: "sonnet", subagent_type: "general-purpose",
        prompt: worker_prompt(story, story_state[id].stage, business_answers))
   worker_map[id] = new_worker
   active_workers++
   ```

4. **Resume from last stage:**
   ```
   SendMessage(recipient: new_worker,
               content: "Execute Stage {last_known_stage} for {id}",
               summary: "{id} Stage {N} respawn")
   ```

## Respawn Limits

| Counter | Initial | Limit | On Limit |
|---------|---------|-------|----------|
| `crash_count[id]` | 0 | 1 | 2nd crash → PAUSED + escalate |

**Rationale:** Single respawn handles transient failures (context overflow, network glitch). Double crash = systematic issue requiring human input.

## Graceful Shutdown Protocol

Lead-initiated shutdown sequence:

```
# 1. Lead sends request
SendMessage(type: "shutdown_request", recipient: worker_map[id],
            content: "Pipeline complete for {id}. Shutting down.")

# 2. Worker responds
#    - approve: true  → worker exits cleanly
#    - approve: false → worker still working, lead waits

# 3. If worker doesn't respond (already crashed)
#    → No action needed, worker already gone
#    → Lead proceeds to next story or cleanup
```

**Rule:** Always attempt graceful shutdown before cleanup. Never force-kill via TaskStop.

---
**Version:** 1.0.0
**Last Updated:** 2026-02-13
