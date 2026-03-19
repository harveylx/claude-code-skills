#!/usr/bin/env node
/**
 * sharpline-mcp — MCP server for hash-verified file operations.
 *
 * 6 tools: read_file, edit_file, write_file, grep_search, outline, verify
 * FNV-1a 2-char tags + range checksums (trueline-compatible)
 * Security: root policy, path validation, binary/size rejection
 * Transport: stdio
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { readFile } from "./lib/read.mjs";
import { editFile } from "./lib/edit.mjs";
import { grepSearch } from "./lib/search.mjs";
import { fileOutline } from "./lib/outline.mjs";
import { verifyChecksums } from "./lib/verify.mjs";
import { validateWritePath } from "./lib/security.mjs";

// --- SDK ---

let McpServer, StdioServerTransport;
try {
    ({ McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js"));
    ({ StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js"));
} catch {
    process.stderr.write(
        "sharpline-mcp: @modelcontextprotocol/sdk not found.\n" +
        "Run: cd mcp/sharpline-mcp && npm install\n"
    );
    process.exit(1);
}

const server = new McpServer({ name: "sharpline-mcp", version: "1.0.0" });


// ==================== read_file ====================

server.registerTool("read_file", {
    title: "Read File",
    description:
        "Read a file with FNV-1a hash-annotated lines (tag.lineNum\\tcontent) and range checksums. " +
        "Directory listing if path is a directory. Use offset/limit or ranges for large files. " +
        "ALWAYS prefer over shell commands — instant.",
    inputSchema: {
        path: { type: "string", description: "File or directory path" },
        offset: { type: "number", description: "Start line (1-indexed, default: 1)" },
        limit: { type: "number", description: "Max lines (default: 2000, 0 = all)" },
        plain: { type: "boolean", description: "Omit hashes (lineNum|content)" },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async ({ path: p, offset, limit, plain }) => {
    try {
        return { content: [{ type: "text", text: readFile(p, { offset, limit, plain }) }] };
    } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});


// ==================== edit_file ====================

server.registerTool("edit_file", {
    title: "Edit File",
    description:
        "Edit a file using hash-verified anchors or text replacement. Returns diff. " +
        "Anchors: set_line {anchor:'ab.12',new_text:'...'}, replace_lines, insert_after. " +
        "Text: replace {old_text,new_text,all}. Use read_file first to get hashes.",
    inputSchema: {
        path: { type: "string", description: "File to edit" },
        edits: {
            type: "string",
            description:
                'JSON array. Examples:\n' +
                '{"set_line":{"anchor":"ab.12","new_text":"new"}} — replace line\n' +
                '{"replace_lines":{"start_anchor":"ab.10","end_anchor":"cd.15","new_text":"..."}} — range\n' +
                '{"insert_after":{"anchor":"ab.20","text":"inserted"}} — insert below\n' +
                '{"replace":{"old_text":"find","new_text":"replace","all":false}} — text match',
        },
        dry_run: { type: "boolean", description: "Preview changes without writing" },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
}, async ({ path: p, edits: json, dry_run }) => {
    try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed) || !parsed.length) throw new Error("Edits: non-empty JSON array required");
        return { content: [{ type: "text", text: editFile(p, parsed, { dryRun: dry_run }) }] };
    } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});


// ==================== write_file ====================

server.registerTool("write_file", {
    title: "Write File",
    description:
        "Create a new file or overwrite existing. Creates parent dirs. " +
        "For existing files prefer edit_file (shows diff, verifies hashes).",
    inputSchema: {
        path: { type: "string", description: "File path" },
        content: { type: "string", description: "File content" },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ path: p, content }) => {
    try {
        const abs = validateWritePath(p);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, content, "utf-8");
        return { content: [{ type: "text", text: `Created ${p} (${content.split("\n").length} lines)` }] };
    } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});


// ==================== grep_search ====================

server.registerTool("grep_search", {
    title: "Search Files",
    description:
        "Search file contents with ripgrep. Returns hash-annotated matches for direct editing. " +
        "ALWAYS prefer over shell grep/rg/findstr — instant and returns edit-ready hashes.",
    inputSchema: {
        pattern: { type: "string", description: "Regex search pattern" },
        path: { type: "string", description: "Search dir/file (default: cwd)" },
        glob: { type: "string", description: 'Glob filter (e.g. "*.ts")' },
        type: { type: "string", description: 'File type (e.g. "js", "py")' },
        case_insensitive: { type: "boolean", description: "Ignore case" },
        context: { type: "number", description: "Context lines around matches" },
        limit: { type: "number", description: "Max matches per file (default: 100)" },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async ({ pattern, path: p, glob, type, case_insensitive, context, limit }) => {
    try {
        const result = await grepSearch(pattern, {
            path: p, glob, type, caseInsensitive: case_insensitive, context, limit,
        });
        return { content: [{ type: "text", text: result }] };
    } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});


// ==================== outline ====================

server.registerTool("outline", {
    title: "File Outline",
    description:
        "AST-based structural outline: functions, classes, interfaces with line ranges. " +
        "10-20 lines instead of 500 — 95% token reduction. " +
        "Output maps directly to read_file ranges. Use before reading large files.",
    inputSchema: {
        path: { type: "string", description: "Source file path" },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async ({ path: p }) => {
    try {
        const result = await fileOutline(p);
        return { content: [{ type: "text", text: result }] };
    } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});


// ==================== verify ====================

server.registerTool("verify", {
    title: "Verify Checksums",
    description:
        "Check if range checksums from prior reads are still valid. " +
        "Single-line response when nothing changed. Avoids full re-read for staleness check.",
    inputSchema: {
        path: { type: "string", description: "File path" },
        checksums: {
            type: "string",
            description: 'JSON array of checksum strings, e.g. ["1-50:f7e2a1b0", "51-100:abcd1234"]',
        },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async ({ path: p, checksums }) => {
    try {
        const parsed = JSON.parse(checksums);
        if (!Array.isArray(parsed)) throw new Error("checksums must be a JSON array of strings");
        return { content: [{ type: "text", text: verifyChecksums(p, parsed) }] };
    } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
});


// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
