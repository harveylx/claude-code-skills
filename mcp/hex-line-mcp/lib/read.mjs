/**
 * File read with FNV-1a hash annotations and range checksums.
 *
 * Output format: {tag}.{lineNum}\t{content}
 * Appends: checksum: {start}-{end}:{8hex}
 */

import { statSync } from "node:fs";
import { fnv1a, lineTag, rangeChecksum } from "@levnikolaevich/hex-common/text-protocol/hash";
import { validatePath, normalizePath } from "./security.mjs";
import { getGraphDB, fileAnnotations, getRelativePath } from "./graph-enrich.mjs";
import { relativeTime, listDirectory, readText, MAX_OUTPUT_CHARS } from "./format.mjs";
import { rememberSnapshot } from "./revisions.mjs";

const DEFAULT_LIMIT = 2000;

function parseRangeEntry(entry, total) {
    if (typeof entry === "string") {
        const match = entry.trim().match(/^(\d+)(?:-(\d*)?)?$/);
        if (!match) throw new Error(`Invalid range "${entry}". Use "10", "10-25", or "10-"`);
        const start = Number(match[1]);
        const end = match[2] === undefined || match[2] === "" ? total : Number(match[2]);
        return { start, end };
    }

    if (!entry || typeof entry !== "object") {
        throw new Error("ranges entries must be strings or {start,end} objects");
    }

    const start = Number(entry.start ?? 1);
    const end = entry.end === undefined || entry.end === null ? total : Number(entry.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error("ranges entries must contain numeric start/end values");
    }
    return { start, end };
}

/**
 * Read a file with hash-annotated lines.
 *
 * @param {string} filePath
 * @param {object} opts - { offset, limit, plain, ranges, includeGraph }
 * @returns {string} formatted output
 */
export function readFile(filePath, opts = {}) {
    filePath = normalizePath(filePath);
    const real = validatePath(filePath);
    const stat = statSync(real);

    // Directory listing fallback
    if (stat.isDirectory()) {
        const { text } = listDirectory(real, { metadata: true });
        return `Directory: ${filePath}\n\n\`\`\`\n${text}\n\`\`\``;
    }

    const snapshot = rememberSnapshot(real, readText(real), { mtimeMs: stat.mtimeMs, size: stat.size });
    const lines = snapshot.lines;
    const total = lines.length;

    // Determine ranges to read
    let ranges;
    if (opts.ranges && opts.ranges.length > 0) {
        ranges = opts.ranges.map((entry) => {
            const parsed = parseRangeEntry(entry, total);
            return {
                start: Math.max(1, parsed.start),
                end: Math.min(total, parsed.end),
            };
        });
    } else {
        const startLine = Math.max(1, opts.offset || 1);
        const maxLines = (opts.limit && opts.limit > 0) ? opts.limit : DEFAULT_LIMIT;
        ranges = [{ start: startLine, end: Math.min(total, startLine - 1 + maxLines) }];
    }

    const parts = [];

    let cappedAtLine = 0;

    for (const range of ranges) {
        const selected = lines.slice(range.start - 1, range.end);
        const lineHashes = [];
        const formatted = [];
        let charCount = 0;

        for (let i = 0; i < selected.length; i++) {
            const line = selected[i];
            const num = range.start + i;
            const hash32 = fnv1a(line);
            const entry = opts.plain
                ? `${num}|${line}`
                : `${lineTag(hash32)}.${num}\t${line}`;

            if (charCount + entry.length > MAX_OUTPUT_CHARS && formatted.length > 0) {
                cappedAtLine = num;
                break;
            }
            lineHashes.push(hash32);
            formatted.push(entry);
            charCount += entry.length + 1;
        }

        // Update range end to actual lines shown
        const actualEnd = formatted.length > 0
            ? range.start + formatted.length - 1
            : range.start;
        range.end = actualEnd;

        parts.push(formatted.join("\n"));

        // Range checksum (only for lines actually shown)
        const cs = rangeChecksum(lineHashes, range.start, actualEnd);
        parts.push(`checksum: ${cs}`);

        if (cappedAtLine) break;
    }

    // Header
    const sizeKB = (stat.size / 1024).toFixed(1);
    const ago = relativeTime(stat.mtime);
    let meta = `${total} lines, ${sizeKB}KB, ${ago}`;
    if (ranges.length === 1) {
        const r = ranges[0];
        if (r.start > 1 || r.end < total) {
            meta += `, showing ${r.start}-${r.end}`;
        }
        if (r.end < total) {
            meta += `, ${total - r.end} more below`;
        }
    }

    // Graph enrichment (opt-in)
    const db = opts.includeGraph ? getGraphDB(real) : null;
    const relFile = db ? getRelativePath(real) : null;
    let graphLine = "";
    if (db && relFile) {
        const annos = fileAnnotations(db, relFile);
        if (annos.length > 0) {
            const items = annos.map(a => {
                const counts = (a.callees || a.callers) ? ` ${a.callees}\u2193 ${a.callers}\u2191` : "";
                return `${a.name} [${a.kind}${counts}]`;
            });
            graphLine = `\nGraph: ${items.join(" | ")}`;
        }
    }

    let result =
        `File: ${filePath}${graphLine}\nmeta: ${meta}\nrevision: ${snapshot.revision}\nfile: ${snapshot.fileChecksum}\n\n${parts.join("\n\n")}`;

    // Character cap notice
    if (cappedAtLine) {
        result += `\n\nOUTPUT_CAPPED at line ${cappedAtLine} (${MAX_OUTPUT_CHARS} char limit). Use offset=${cappedAtLine} to continue reading.`;
    }

    return result;
}
