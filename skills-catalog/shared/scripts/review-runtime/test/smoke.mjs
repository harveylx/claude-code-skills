#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "review-runtime-smoke-"));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

try {
    mkdirSync(join(projectRoot, ".hex-skills", "agent-review"), { recursive: true });

    const manifestPath = join(projectRoot, "manifest.json");
    const metadataPath = join(projectRoot, "codex.meta.json");
    const resultPath = join(projectRoot, "codex_result.md");

    writeFileSync(manifestPath, JSON.stringify({
        storage_mode: "file",
        expected_agents: ["codex"],
        phase_policy: { phase4: "required", phase7: "required" },
    }, null, 2));

    const started = run([
        "start",
        "--project-root", projectRoot,
        "--skill", "ln-310",
        "--mode", "story",
        "--identifier", "PROJ-123",
        "--manifest-file", manifestPath,
    ]);

    if (!started.ok) {
        throw new Error("Failed to start review runtime");
    }

    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-310", "--phase", "PHASE_0_CONFIG"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-310", "--to", "PHASE_1_DISCOVERY"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-310", "--phase", "PHASE_1_DISCOVERY"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-310", "--to", "PHASE_2_AGENT_LAUNCH"]);
    run([
        "register-agent",
        "--project-root", projectRoot,
        "--skill", "ln-310",
        "--agent", "codex",
        "--metadata-file", "codex.meta.json",
        "--result-file", "codex_result.md",
    ]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-310",
        "--phase", "PHASE_2_AGENT_LAUNCH",
        "--payload",
        JSON.stringify({
            health_check_done: true,
            agents_available: 1,
            agents_required: ["codex"],
        }),
    ]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-310", "--to", "PHASE_3_RESEARCH"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-310", "--phase", "PHASE_3_RESEARCH"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-310", "--to", "PHASE_4_AUTOFIX"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-310", "--phase", "PHASE_4_AUTOFIX"]);

    writeFileSync(metadataPath, JSON.stringify({
        pid: process.pid,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        status: "result_ready",
        success: true,
        exit_code: 0,
    }, null, 2));
    writeFileSync(resultPath, "<!-- AGENT_REVIEW_RESULT -->ok<!-- END_AGENT_REVIEW_RESULT -->");

    const synced = run(["sync-agent", "--project-root", projectRoot, "--skill", "ln-310", "--agent", "codex"]);
    if (synced.agents.codex.status !== "result_ready") {
        throw new Error("Agent did not resolve to result_ready");
    }

    run(["advance", "--project-root", projectRoot, "--skill", "ln-310", "--to", "PHASE_5_MERGE"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-310",
        "--phase", "PHASE_5_MERGE",
        "--payload",
        JSON.stringify({ merge_summary: { accepted: 2, rejected: 1 } }),
    ]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-310", "--to", "PHASE_6_REFINEMENT"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-310",
        "--phase", "PHASE_6_REFINEMENT",
        "--payload",
        JSON.stringify({ iterations: 1, exit_reason: "APPROVED" }),
    ]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-310", "--to", "PHASE_7_APPROVE"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-310",
        "--phase", "PHASE_7_APPROVE",
        "--payload",
        JSON.stringify({ verdict: "GO" }),
    ]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-310", "--to", "PHASE_8_SELF_CHECK"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-310",
        "--phase", "PHASE_8_SELF_CHECK",
        "--payload",
        JSON.stringify({ pass: true, final_verdict: "GO" }),
    ]);
    const completed = run(["complete", "--project-root", projectRoot, "--skill", "ln-310"]);

    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Runtime did not complete successfully");
    }

    process.stdout.write("review-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
