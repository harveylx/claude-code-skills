import { randomUUID } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const RUNTIME_ROOT_PARTS = [".hex-skills", "agent-review", "runtime"];

function runtimeRoot(projectRoot) {
    return join(resolve(projectRoot || process.cwd()), ...RUNTIME_ROOT_PARTS);
}

function runsDir(projectRoot) {
    return join(runtimeRoot(projectRoot), "runs");
}

function runDir(projectRoot, runId) {
    return join(runsDir(projectRoot), runId);
}

function manifestPath(projectRoot, runId) {
    return join(runDir(projectRoot, runId), "manifest.json");
}

function statePath(projectRoot, runId) {
    return join(runDir(projectRoot, runId), "state.json");
}

function checkpointsPath(projectRoot, runId) {
    return join(runDir(projectRoot, runId), "checkpoints.json");
}

function activePath(projectRoot, skill) {
    return join(runtimeRoot(projectRoot), `active-${skill}.json`);
}

function safeReadJson(filePath) {
    try {
        return JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
        return null;
    }
}

function atomicWrite(filePath, data) {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp-${process.pid}`;
    try {
        writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf8");
        renameSync(tmpPath, filePath);
    } catch (error) {
        try {
            unlinkSync(tmpPath);
        } catch {
            // Best-effort cleanup only.
        }
        throw error;
    }
}

function buildRunId(skill, identifier) {
    const safeSkill = String(skill || "review").replace(/[^a-zA-Z0-9_-]+/g, "-");
    const safeIdentifier = String(identifier || "run").replace(/[^a-zA-Z0-9_-]+/g, "-");
    return `${safeSkill}-${safeIdentifier}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function defaultState(manifest, runId) {
    return {
        run_id: runId,
        skill: manifest.skill,
        mode: manifest.mode,
        identifier: manifest.identifier,
        phase: "PHASE_0_CONFIG",
        complete: false,
        paused_reason: null,
        health_check_done: false,
        agents_required: [],
        agents_available: 0,
        agents_skipped_reason: null,
        launch_ready: false,
        merge_summary: null,
        refinement_iterations: 0,
        self_check_passed: false,
        final_verdict: null,
        agents: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

function saveActive(projectRoot, skill, runId) {
    atomicWrite(activePath(projectRoot, skill), {
        skill,
        run_id: runId,
        updated_at: new Date().toISOString(),
    });
}

export function loadRun(projectRoot, runId) {
    const manifest = safeReadJson(manifestPath(projectRoot, runId));
    const state = safeReadJson(statePath(projectRoot, runId));
    const checkpoints = safeReadJson(checkpointsPath(projectRoot, runId)) || {};
    if (!manifest || !state) {
        return null;
    }
    return { manifest, state, checkpoints };
}

export function loadActiveRun(projectRoot, skill) {
    const active = safeReadJson(activePath(projectRoot, skill));
    if (!active?.run_id) {
        return null;
    }
    return loadRun(projectRoot, active.run_id);
}

export function startRun(projectRoot, manifestInput) {
    const manifest = {
        skill: manifestInput.skill,
        mode: manifestInput.mode,
        identifier: manifestInput.identifier,
        storage_mode: manifestInput.storage_mode || "unknown",
        project_root: resolve(projectRoot || process.cwd()),
        story_ref: manifestInput.story_ref || null,
        plan_ref: manifestInput.plan_ref || null,
        context_ref: manifestInput.context_ref || null,
        expected_agents: manifestInput.expected_agents || [],
        artifact_paths: manifestInput.artifact_paths || {},
        phase_policy: manifestInput.phase_policy || {},
        created_at: new Date().toISOString(),
    };

    const activeRun = loadActiveRun(projectRoot, manifest.skill);
    if (activeRun && !activeRun.state.complete) {
        return { ok: false, recovery: true, run: activeRun };
    }

    const runId = buildRunId(manifest.skill, manifest.identifier);
    const state = defaultState(manifest, runId);

    atomicWrite(manifestPath(projectRoot, runId), manifest);
    atomicWrite(statePath(projectRoot, runId), state);
    atomicWrite(checkpointsPath(projectRoot, runId), {});
    saveActive(projectRoot, manifest.skill, runId);

    return { ok: true, run_id: runId, manifest, state, checkpoints: {} };
}

export function saveState(projectRoot, runId, state) {
    const nextState = {
        ...state,
        updated_at: new Date().toISOString(),
    };
    atomicWrite(statePath(projectRoot, runId), nextState);
    saveActive(projectRoot, nextState.skill, runId);
    return nextState;
}

export function checkpointPhase(projectRoot, runId, phase, payload) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const checkpoints = {
        ...run.checkpoints,
        [phase]: {
            phase,
            created_at: new Date().toISOString(),
            payload: payload || {},
        },
    };
    atomicWrite(checkpointsPath(projectRoot, runId), checkpoints);
    return { ok: true, checkpoints };
}

export function registerAgent(projectRoot, runId, agentRecord) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const nextState = {
        ...run.state,
        launch_ready: true,
        agents: {
            ...run.state.agents,
            [agentRecord.name]: {
                name: agentRecord.name,
                status: agentRecord.status || "launched",
                prompt_file: agentRecord.prompt_file || null,
                result_file: agentRecord.result_file || null,
                log_file: agentRecord.log_file || null,
                metadata_file: agentRecord.metadata_file || null,
                pid: agentRecord.pid || null,
                session_id: agentRecord.session_id || null,
                started_at: agentRecord.started_at || null,
                finished_at: agentRecord.finished_at || null,
                exit_code: agentRecord.exit_code ?? null,
                error: agentRecord.error || null,
            },
        },
    };
    saveState(projectRoot, runId, nextState);
    return { ok: true, state: nextState };
}

export function pauseRun(projectRoot, runId, reason) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const nextState = saveState(projectRoot, runId, {
        ...run.state,
        phase: "PAUSED",
        paused_reason: reason || "Paused",
    });
    return { ok: true, state: nextState };
}

export function completeRun(projectRoot, runId) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const nextState = saveState(projectRoot, runId, {
        ...run.state,
        phase: "DONE",
        complete: true,
        paused_reason: null,
    });
    return { ok: true, state: nextState };
}

export function resolveRunId(projectRoot, skill, runId) {
    if (runId) {
        return runId;
    }
    const active = safeReadJson(activePath(projectRoot, skill));
    return active?.run_id || null;
}

export function runtimePaths(projectRoot, runId, skill) {
    const resolvedRunId = resolveRunId(projectRoot, skill, runId);
    if (!resolvedRunId) {
        return null;
    }
    return {
        root: runtimeRoot(projectRoot),
        run_dir: runDir(projectRoot, resolvedRunId),
        manifest: manifestPath(projectRoot, resolvedRunId),
        state: statePath(projectRoot, resolvedRunId),
        checkpoints: checkpointsPath(projectRoot, resolvedRunId),
        active: activePath(projectRoot, skill),
    };
}

export function readJsonFile(filePath) {
    return safeReadJson(filePath);
}

export function resolveTrackedPath(projectRoot, filePath) {
    if (!filePath) {
        return null;
    }
    return resolve(projectRoot || process.cwd(), filePath);
}

export function fileExists(filePath) {
    return existsSync(filePath);
}
