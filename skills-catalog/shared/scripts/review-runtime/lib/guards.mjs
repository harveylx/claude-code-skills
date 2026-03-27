export const RESOLVED_AGENT_STATUSES = new Set([
    "result_ready",
    "dead",
    "failed",
    "skipped",
]);

const ALLOWED_TRANSITIONS = new Map([
    ["PHASE_0_CONFIG", new Set(["PHASE_1_DISCOVERY"])],
    ["PHASE_1_DISCOVERY", new Set(["PHASE_2_AGENT_LAUNCH"])],
    ["PHASE_2_AGENT_LAUNCH", new Set(["PHASE_3_RESEARCH"])],
    ["PHASE_3_RESEARCH", new Set(["PHASE_4_AUTOFIX", "PHASE_5_MERGE"])],
    ["PHASE_4_AUTOFIX", new Set(["PHASE_5_MERGE"])],
    ["PHASE_5_MERGE", new Set(["PHASE_6_REFINEMENT"])],
    ["PHASE_6_REFINEMENT", new Set(["PHASE_7_APPROVE", "PHASE_8_SELF_CHECK"])],
    ["PHASE_7_APPROVE", new Set(["PHASE_8_SELF_CHECK"])],
    ["PHASE_8_SELF_CHECK", new Set(["DONE"])],
    ["PAUSED", new Set([])],
    ["DONE", new Set([])],
]);

function hasCheckpoint(checkpoints, phase) {
    return Boolean(checkpoints?.[phase]);
}

function agentsResolved(state) {
    return Object.values(state.agents || {}).every(agent => RESOLVED_AGENT_STATUSES.has(agent.status));
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const allowed = ALLOWED_TRANSITIONS.get(state.phase);
    if (!allowed || !allowed.has(toPhase)) {
        return {
            ok: false,
            error: `Invalid transition: ${state.phase} -> ${toPhase}`,
        };
    }

    if (!hasCheckpoint(checkpoints, state.phase)) {
        return {
            ok: false,
            error: `Checkpoint missing for ${state.phase}`,
        };
    }

    if (toPhase === "PHASE_3_RESEARCH") {
        if (!state.health_check_done) {
            return { ok: false, error: "Phase 2 health check not recorded" };
        }
        if (state.agents_available === 0 && !state.agents_skipped_reason) {
            return { ok: false, error: "Agents skipped without machine-readable reason" };
        }
        if (state.agents_available > 0 && !state.launch_ready) {
            return { ok: false, error: "No agents registered for launch" };
        }
    }

    if (toPhase === "PHASE_5_MERGE") {
        if (manifest.mode === "story" && state.phase !== "PHASE_4_AUTOFIX") {
            return { ok: false, error: "Story mode must pass through Phase 4 before merge" };
        }
        if (state.agents_available > 0 && !agentsResolved(state)) {
            return { ok: false, error: "Not all agents are resolved" };
        }
    }

    if (toPhase === "PHASE_6_REFINEMENT" && !state.merge_summary) {
        return { ok: false, error: "Merge summary missing" };
    }

    if (toPhase === "PHASE_8_SELF_CHECK" && manifest.mode === "story" && state.phase !== "PHASE_7_APPROVE") {
        return { ok: false, error: "Story mode requires approval checkpoint before self-check" };
    }

    if (toPhase === "DONE" && !state.self_check_passed) {
        return { ok: false, error: "Self-check must pass before completion" };
    }

    return { ok: true };
}

export function computeResumeAction(manifest, state, checkpoints) {
    if (state.complete || state.phase === "DONE") {
        return "Run complete";
    }
    if (state.phase === "PAUSED") {
        return `Paused: ${state.paused_reason || "manual intervention required"}`;
    }
    if (!checkpoints?.[state.phase]) {
        return `Complete ${state.phase} and write its checkpoint`;
    }
    if (state.phase === "PHASE_2_AGENT_LAUNCH" && state.agents_available > 0 && !agentsResolved(state)) {
        return "Sync agent metadata until every launched agent is resolved";
    }
    if (state.phase === "PHASE_5_MERGE" && !state.merge_summary) {
        return "Record merge summary checkpoint before advancing";
    }
    if (state.phase === "PHASE_8_SELF_CHECK" && !state.self_check_passed) {
        return "Fix self-check failures, then checkpoint Phase 8 with pass=true";
    }

    const nextPhase = Array.from(ALLOWED_TRANSITIONS.get(state.phase) || []).find(phase => {
        if (phase === "PHASE_4_AUTOFIX" && manifest.mode !== "story") {
            return false;
        }
        if (phase === "PHASE_7_APPROVE" && manifest.mode !== "story") {
            return false;
        }
        return true;
    });

    return nextPhase
        ? `Advance to ${nextPhase}`
        : "No automatic resume action available";
}
