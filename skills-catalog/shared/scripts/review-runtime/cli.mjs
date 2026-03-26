#!/usr/bin/env node

import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import {
    checkpointPhase,
    completeRun,
    fileExists,
    loadActiveRun,
    loadRun,
    pauseRun,
    readJsonFile,
    registerAgent,
    resolveRunId,
    resolveTrackedPath,
    runtimePaths,
    saveState,
    startRun,
} from "./lib/store.mjs";
import {
    RESOLVED_AGENT_STATUSES,
    computeResumeAction,
    validateTransition,
} from "./lib/guards.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        skill: { type: "string" },
        "run-id": { type: "string" },
        mode: { type: "string" },
        identifier: { type: "string" },
        "project-root": { type: "string", default: process.cwd() },
        "manifest-file": { type: "string" },
        phase: { type: "string" },
        to: { type: "string" },
        payload: { type: "string" },
        "payload-file": { type: "string" },
        agent: { type: "string" },
        "prompt-file": { type: "string" },
        "result-file": { type: "string" },
        "log-file": { type: "string" },
        "metadata-file": { type: "string" },
        reason: { type: "string" },
    },
});

function output(data) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function fail(message, code = 2) {
    process.stderr.write(JSON.stringify({ error: message }) + "\n");
    process.exit(code);
}

function readPayload() {
    if (values["payload-file"]) {
        const filePayload = readJsonFile(values["payload-file"]);
        if (filePayload == null) {
            fail(`Unable to read payload file: ${values["payload-file"]}`);
        }
        return filePayload;
    }
    if (!values.payload) {
        return {};
    }
    try {
        return JSON.parse(values.payload);
    } catch (error) {
        fail(`Invalid JSON payload: ${error.message}`);
    }
}

function resolveRun(projectRoot) {
    const runId = resolveRunId(projectRoot, values.skill, values["run-id"]);
    if (!runId) {
        fail("No active run found. Pass --run-id or --skill.");
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        fail(`Run not found: ${runId}`);
    }
    return { runId, run };
}

function applyCheckpointToState(state, phase, payload) {
    const nextState = { ...state };

    if (phase === "PHASE_2_AGENT_LAUNCH") {
        nextState.health_check_done = payload.health_check_done === true;
        nextState.agents_available = Number(payload.agents_available || 0);
        nextState.agents_required = Array.isArray(payload.agents_required) ? payload.agents_required : [];
        nextState.agents_skipped_reason = payload.agents_skipped_reason || null;
    }

    if (phase === "PHASE_5_MERGE") {
        nextState.merge_summary = payload.merge_summary || payload.summary || payload;
    }

    if (phase === "PHASE_6_REFINEMENT") {
        nextState.refinement_iterations = Number(payload.iterations || 0);
    }

    if (phase === "PHASE_7_APPROVE" && payload.verdict) {
        nextState.final_verdict = payload.verdict;
    }

    if (phase === "PHASE_8_SELF_CHECK") {
        nextState.self_check_passed = payload.pass === true;
        if (payload.final_verdict) {
            nextState.final_verdict = payload.final_verdict;
        }
    }

    return nextState;
}

function isProcessAlive(pid) {
    if (!pid) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function syncOneAgent(projectRoot, agentState) {
    const nextAgent = { ...agentState };
    const metadataPath = resolveTrackedPath(projectRoot, nextAgent.metadata_file);
    const resultPath = resolveTrackedPath(projectRoot, nextAgent.result_file);

    const metadata = metadataPath && existsSync(metadataPath) ? readJsonFile(metadataPath) : null;
    if (metadata) {
        nextAgent.pid = metadata.pid ?? nextAgent.pid ?? null;
        nextAgent.session_id = metadata.session_id ?? nextAgent.session_id ?? null;
        nextAgent.started_at = metadata.started_at ?? nextAgent.started_at ?? null;
        nextAgent.finished_at = metadata.finished_at ?? nextAgent.finished_at ?? null;
        nextAgent.exit_code = metadata.exit_code ?? nextAgent.exit_code ?? null;
        nextAgent.error = metadata.error ?? nextAgent.error ?? null;
        if (typeof metadata.status === "string") {
            nextAgent.status = metadata.status;
        }
    }

    if (resultPath && fileExists(resultPath)) {
        nextAgent.status = "result_ready";
    } else if (metadata && (metadata.success === false || metadata.status === "failed")) {
        nextAgent.status = "failed";
    } else if (nextAgent.pid && !isProcessAlive(nextAgent.pid)) {
        nextAgent.status = "dead";
    } else if (!RESOLVED_AGENT_STATUSES.has(nextAgent.status)) {
        nextAgent.status = "launched";
    }

    return nextAgent;
}

async function main() {
    const command = positionals[0];
    const projectRoot = values["project-root"];

    if (command === "start") {
        if (!values.skill || !values.mode || !values.identifier || !values["manifest-file"]) {
            fail("start requires --skill, --mode, --identifier, and --manifest-file");
        }
        const manifest = readJsonFile(values["manifest-file"]);
        if (!manifest) {
            fail(`Manifest file not found or invalid: ${values["manifest-file"]}`);
        }
        const result = startRun(projectRoot, {
            ...manifest,
            skill: values.skill,
            mode: values.mode,
            identifier: values.identifier,
        });
        output(result);
        process.exit(result.ok ? 0 : 1);
    }

    if (command === "status") {
        const run = values["run-id"]
            ? loadRun(projectRoot, values["run-id"])
            : (values.skill ? loadActiveRun(projectRoot, values.skill) : null);
        if (!run) {
            output({ ok: true, active: false });
            return;
        }
        output({
            ok: true,
            active: !run.state.complete,
            manifest: run.manifest,
            state: run.state,
            checkpoints: run.checkpoints,
            paths: runtimePaths(projectRoot, run.state.run_id, run.manifest.skill),
            resume_action: computeResumeAction(run.manifest, run.state, run.checkpoints),
        });
        return;
    }

    if (command === "advance") {
        if (!values.to) {
            fail("advance requires --to");
        }
        const { runId, run } = resolveRun(projectRoot);
        const guard = validateTransition(run.manifest, run.state, run.checkpoints, values.to);
        if (!guard.ok) {
            output({ ok: false, ...guard });
            process.exit(1);
        }
        const nextState = saveState(projectRoot, runId, {
            ...run.state,
            phase: values.to,
            complete: values.to === "DONE" ? true : run.state.complete,
            paused_reason: null,
        });
        output({ ok: true, state: nextState });
        return;
    }

    if (command === "checkpoint") {
        if (!values.phase) {
            fail("checkpoint requires --phase");
        }
        const payload = readPayload();
        const { runId, run } = resolveRun(projectRoot);
        const result = checkpointPhase(projectRoot, runId, values.phase, payload);
        if (!result.ok) {
            fail(result.error);
        }
        const nextState = saveState(projectRoot, runId, applyCheckpointToState(run.state, values.phase, payload));
        output({ ok: true, state: nextState, checkpoint: result.checkpoints[values.phase] });
        return;
    }

    if (command === "register-agent") {
        if (!values.agent) {
            fail("register-agent requires --agent");
        }
        const { runId } = resolveRun(projectRoot);
        const result = registerAgent(projectRoot, runId, {
            name: values.agent,
            prompt_file: values["prompt-file"] || null,
            result_file: values["result-file"] || null,
            log_file: values["log-file"] || null,
            metadata_file: values["metadata-file"] || null,
            status: "launched",
        });
        if (!result.ok) {
            fail(result.error);
        }
        output(result);
        return;
    }

    if (command === "sync-agent") {
        const { runId, run } = resolveRun(projectRoot);
        const agentNames = values.agent ? [values.agent] : Object.keys(run.state.agents || {});
        if (agentNames.length === 0) {
            output({ ok: true, agents: {}, resolved: true });
            return;
        }
        const nextAgents = { ...run.state.agents };
        for (const agentName of agentNames) {
            if (!nextAgents[agentName]) {
                fail(`Agent not registered: ${agentName}`);
            }
            nextAgents[agentName] = syncOneAgent(projectRoot, nextAgents[agentName]);
        }
        const nextState = saveState(projectRoot, runId, { ...run.state, agents: nextAgents });
        output({
            ok: true,
            agents: agentNames.reduce((acc, name) => {
                acc[name] = nextState.agents[name];
                return acc;
            }, {}),
            resolved: Object.values(nextState.agents).every(agent => RESOLVED_AGENT_STATUSES.has(agent.status)),
        });
        return;
    }

    if (command === "pause") {
        const { runId } = resolveRun(projectRoot);
        const result = pauseRun(projectRoot, runId, values.reason || "Paused");
        if (!result.ok) {
            fail(result.error);
        }
        output(result);
        return;
    }

    if (command === "complete") {
        const { runId, run } = resolveRun(projectRoot);
        const guard = validateTransition(run.manifest, run.state, run.checkpoints, "DONE");
        if (!guard.ok) {
            output({ ok: false, ...guard });
            process.exit(1);
        }
        const result = completeRun(projectRoot, runId);
        if (!result.ok) {
            fail(result.error);
        }
        output(result);
        return;
    }

    fail("Unknown command. Use: start, status, advance, checkpoint, register-agent, sync-agent, pause, complete");
}

main().catch(error => fail(error.message));
