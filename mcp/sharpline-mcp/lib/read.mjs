/**
 * File read with FNV-1a hash annotations and range checksums.
 *
 * Output format: {tag}.{lineNum}\t{content}
 * Appends: checksum: {start}-{end}:{8hex}
 */

import { readFileSync, statSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fnv1a, lineTag, rangeChecksum } from "./hash.mjs";
import { validatePath } from "./security.mjs";

const DEFAULT_LIMIT = 2000;

/**
 * Read a file with hash-annotated lines.
 *
 * @param {string} filePath
 * @param {object} opts - { offset, limit, plain, ranges }
 * @returns {string} formatted output
 */
export function readFile(filePath, opts = {}) {
    const real = validatePath(filePath);
    const stat = statSync(real);

    // Directory listing fallback
    if (stat.isDirectory()) {
        const entries = readdirSync(real, { withFileTypes: true });
        const listing = entries.map((e) => `${e.isDirectory() ? "d" : "f"} ${e.name}`).join("\n");
        return `Directory: ${filePath}\n\n\`\`\`\n${listing}\n\`\`\``;
    }

    const content = readFileSync(real, "utf-8");
    const lines = content.split("\n");
    const total = lines.length;

    // Determine ranges to read
    let ranges;
    if (opts.ranges && opts.ranges.length > 0) {
        ranges = opts.ranges.map((r) => ({
            start: Math.max(1, r.start || 1),
            end: Math.min(total, r.end || total),
        }));
    } else {
        const startLine = Math.max(1, opts.offset || 1);
        const maxLines = (opts.limit && opts.limit > 0) ? opts.limit : DEFAULT_LIMIT;
        ranges = [{ start: startLine, end: Math.min(total, startLine - 1 + maxLines) }];
    }

    const parts = [];

    for (const range of ranges) {
        const selected = lines.slice(range.start - 1, range.end);
        const lineHashes = [];

        let formatted;
        if (opts.plain) {
            formatted = selected.map((line, i) => {
                const num = range.start + i;
                lineHashes.push(fnv1a(line));
                return `${num}|${line}`;
            }).join("\n");
        } else {
            formatted = selected.map((line, i) => {
                const num = range.start + i;
                const hash32 = fnv1a(line);
                lineHashes.push(hash32);
                const tag = lineTag(hash32);
                return `${tag}.${num}\t${line}`;
            }).join("\n");
        }

        parts.push(formatted);

        // Range checksum
        const cs = rangeChecksum(lineHashes, range.start, range.end);
        parts.push(`\nchecksum: ${cs}`);
    }

    // Header
    let header = `File: ${filePath} (${total} lines)`;
    if (ranges.length === 1) {
        const r = ranges[0];
        if (r.start > 1 || r.end < total) {
            header += ` [showing ${r.start}-${r.end}]`;
        }
        if (r.end < total) {
            header += ` (${total - r.end} more below)`;
        }
    }

    return `${header}\n\n\`\`\`\n${parts.join("\n")}\n\`\`\``;
}
