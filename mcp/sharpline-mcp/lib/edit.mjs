/**
 * Hash-verified file editing with diff output.
 *
 * Supports:
 * - Range-based: range "ab.12-cd.15" + checksum
 * - Anchor-based: set_line, replace_lines, insert_after
 * - Text-based: replace { old_text, new_text, all }
 * - dry_run preview, noop detection, diff output
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fnv1a, lineTag, rangeChecksum } from "./hash.mjs";
import { validatePath, validateWritePath } from "./security.mjs";

/**
 * Find line by tag.lineNum reference with fuzzy matching (+-5 lines).
 */
function findLine(lines, lineNum, expectedTag) {
    const idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) {
        throw new Error(`Line ${lineNum} out of range (1-${lines.length})`);
    }

    const actual = lineTag(fnv1a(lines[idx]));
    if (actual === expectedTag) return idx;

    // Fuzzy: search +-5
    for (let d = 1; d <= 5; d++) {
        for (const off of [d, -d]) {
            const c = idx + off;
            if (c >= 0 && c < lines.length && lineTag(fnv1a(lines[c])) === expectedTag) return c;
        }
    }

    // Whitespace-tolerant
    const stripped = lines[idx].replace(/\s+/g, "");
    if (stripped.length > 0) {
        for (let j = Math.max(0, idx - 5); j <= Math.min(lines.length - 1, idx + 5); j++) {
            if (lines[j].replace(/\s+/g, "") === stripped && lineTag(fnv1a(lines[j])) === expectedTag) return j;
        }
    }

    throw new Error(
        `Hash mismatch line ${lineNum}: expected ${expectedTag}, got ${actual}. ` +
        `Content: "${lines[idx].slice(0, 80)}". Re-read the file to get current hashes.`
    );
}

/**
 * Parse a ref string: "ab.12" → { tag: "ab", line: 12 }
 */
function parseRef(ref) {
    const m = ref.trim().match(/^([a-z2-7]{2})\.(\d+)$/);
    if (!m) throw new Error(`Bad ref: "${ref}". Expected "ab.12"`);
    return { tag: m[1], line: parseInt(m[2], 10) };
}

/**
 * Simple unified diff between old and new line arrays.
 */
function simpleDiff(oldLines, newLines) {
    const out = [];
    const max = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < max; i++) {
        const o = i < oldLines.length ? oldLines[i] : undefined;
        const n = i < newLines.length ? newLines[i] : undefined;
        if (o === n) continue;
        if (o !== undefined) out.push(`-${i + 1}| ${o}`);
        if (n !== undefined) out.push(`+${i + 1}| ${n}`);
    }
    return out.length ? out.join("\n") : null;
}

/**
 * Fuzzy text replacement.
 */
function textReplace(content, oldText, newText, all) {
    const norm = content.replace(/\r\n/g, "\n");
    const normOld = oldText.replace(/\r\n/g, "\n");
    const normNew = newText.replace(/\r\n/g, "\n");

    const idx = norm.indexOf(normOld);
    if (idx === -1) {
        throw new Error(`Text not found:\n${normOld.slice(0, 200)}${normOld.length > 200 ? "..." : ""}`);
    }

    if (all) return norm.split(normOld).join(normNew);

    if (norm.indexOf(normOld, idx + 1) !== -1) {
        throw new Error("Multiple matches. Use all:true or provide more context for unique match.");
    }

    return norm.slice(0, idx) + normNew + norm.slice(idx + normOld.length);
}

/**
 * Apply edits to a file.
 *
 * @param {string} filePath
 * @param {Array} edits - parsed edit objects
 * @param {object} opts - { dryRun }
 * @returns {string} result message with diff
 */
export function editFile(filePath, edits, opts = {}) {
    const real = validatePath(filePath);
    const original = readFileSync(real, "utf-8");
    const lines = original.split("\n");
    const origLines = [...lines];

    // Separate anchor edits from text-replace edits
    const anchored = [];
    const texts = [];

    for (const e of edits) {
        if (e.set_line || e.replace_lines || e.insert_after) anchored.push(e);
        else if (e.replace) texts.push(e);
        else throw new Error(`Unknown edit type: ${JSON.stringify(e)}`);
    }

    // Sort anchor edits bottom-to-top
    const sorted = anchored.map((e) => {
        let sortKey;
        if (e.set_line) sortKey = parseRef(e.set_line.anchor).line;
        else if (e.replace_lines) sortKey = parseRef(e.replace_lines.start_anchor).line;
        else if (e.insert_after) sortKey = parseRef(e.insert_after.anchor).line;
        return { ...e, _k: sortKey };
    }).sort((a, b) => b._k - a._k);

    // Apply anchor edits
    for (const e of sorted) {
        if (e.set_line) {
            const { tag, line } = parseRef(e.set_line.anchor);
            const idx = findLine(lines, line, tag);
            const txt = e.set_line.new_text;
            if (!txt && txt !== 0) lines.splice(idx, 1);
            else lines.splice(idx, 1, ...String(txt).split("\n"));
        } else if (e.replace_lines) {
            const s = parseRef(e.replace_lines.start_anchor);
            const en = parseRef(e.replace_lines.end_anchor);
            const si = findLine(lines, s.line, s.tag);
            const ei = findLine(lines, en.line, en.tag);
            const txt = e.replace_lines.new_text;
            if (!txt && txt !== 0) lines.splice(si, ei - si + 1);
            else lines.splice(si, ei - si + 1, ...String(txt).split("\n"));
        } else if (e.insert_after) {
            const { tag, line } = parseRef(e.insert_after.anchor);
            const idx = findLine(lines, line, tag);
            lines.splice(idx + 1, 0, ...e.insert_after.text.split("\n"));
        }
    }

    // Apply text replacements
    let content = lines.join("\n");
    for (const e of texts) {
        if (!e.replace.old_text) throw new Error("replace.old_text required");
        content = textReplace(content, e.replace.old_text, e.replace.new_text || "", e.replace.all || false);
    }

    if (original === content) {
        throw new Error("No changes — edits produced identical content. Re-read file for current state.");
    }

    const diff = simpleDiff(origLines, content.split("\n"));

    if (opts.dryRun) {
        let msg = `Dry run: ${filePath} would change (${content.split("\n").length} lines)`;
        if (diff) msg += `\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\``;
        return msg;
    }

    writeFileSync(real, content, "utf-8");
    let msg = `Updated ${filePath} (${content.split("\n").length} lines)`;
    if (diff) msg += `\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\``;
    return msg;
}
