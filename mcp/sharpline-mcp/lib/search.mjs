/**
 * File search via ripgrep with hash-annotated results.
 * Uses spawn with arg arrays (no shell string interpolation).
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fnv1a, lineTag } from "./hash.mjs";

const DEFAULT_LIMIT = 100;
const MAX_OUTPUT = 10 * 1024 * 1024; // 10 MB
const TIMEOUT = 30000; // 30s

/**
 * Search files using ripgrep.
 *
 * @param {string} pattern - regex pattern
 * @param {object} opts - { path, glob, type, caseInsensitive, context, limit }
 * @returns {Promise<string>} formatted results
 */
export function grepSearch(pattern, opts = {}) {
    return new Promise((resolve_, reject) => {
        const target = opts.path ? resolve(opts.path) : process.cwd();
        const args = ["-n", "--no-heading", "--with-filename"];

        if (opts.caseInsensitive) args.push("-i");
        if (opts.context && opts.context > 0) args.push("-C", String(opts.context));
        if (opts.glob) args.push("--glob", opts.glob);
        if (opts.type) args.push("--type", opts.type);

        const limit = (opts.limit && opts.limit > 0) ? opts.limit : DEFAULT_LIMIT;
        args.push("-m", String(limit));
        args.push("--", pattern, target);

        let stdout = "";
        let totalBytes = 0;

        const child = spawn("rg", args, { timeout: TIMEOUT });

        child.stdout.on("data", (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_OUTPUT) {
                child.kill();
                return;
            }
            stdout += chunk.toString("utf-8");
        });

        child.stderr.on("data", () => {}); // ignore stderr

        child.on("error", (err) => {
            if (err.code === "ENOENT") {
                reject(new Error("ripgrep (rg) not found. Install: https://github.com/BurntSushi/ripgrep#installation"));
            } else {
                reject(new Error(`rg spawn error: ${err.message}`));
            }
        });

        child.on("close", (code) => {
            if (code === 1) {
                resolve_("No matches found.");
                return;
            }
            if (code !== 0 && code !== null) {
                reject(new Error(`rg exited with code ${code}`));
                return;
            }

            // Format results with hash tags
            const resultLines = stdout.trimEnd().split("\n");
            const formatted = [];

            // Match line: file:42:content
            const matchRe = /^((?:[A-Za-z]:)?[^:]*):(\d+):(.*)$/;
            // Context line: file-42-content
            const ctxRe = /^((?:[A-Za-z]:)?[^-]*)-(\d+)-(.*)$/;

            for (const rl of resultLines) {
                if (!rl || rl === "--") { formatted.push(rl); continue; }

                const m = matchRe.exec(rl);
                if (m) {
                    const tag = lineTag(fnv1a(m[3]));
                    formatted.push(`${m[1]}:>>${tag}.${m[2]}\t${m[3]}`);
                    continue;
                }

                const c = ctxRe.exec(rl);
                if (c) {
                    const tag = lineTag(fnv1a(c[3]));
                    formatted.push(`${c[1]}:  ${tag}.${c[2]}\t${c[3]}`);
                    continue;
                }

                formatted.push(rl);
            }

            resolve_(`\`\`\`\n${formatted.join("\n")}\n\`\`\``);
        });
    });
}
