#!/usr/bin/env node
// Parse two stream-json benchmark logs and produce comparison report.
// Usage: node parse-results.mjs builtin.jsonl hexline.jsonl [output.md]
import { readFileSync, writeFileSync } from "node:fs";

const [,, builtinFile, hexlineFile, outputFile] = process.argv;
if (!builtinFile || !hexlineFile) {
    process.stderr.write("Usage: node parse-results.mjs <builtin.jsonl> <hexline.jsonl> [output.md]\n");
    process.exit(1);
}

function parseSession(file) {
    const lines = readFileSync(file, "utf8").trim().split("\n");
    const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

    const result = events.find(e => e.type === "result");
    if (!result) return { error: "No result event found" };

    // Count tool calls from assistant content blocks
    const toolCounts = {};
    for (const e of events) {
        if (e.type === "assistant" && e.message?.content) {
            for (const block of e.message.content) {
                if (block.type === "tool_use") {
                    const name = block.name;
                    toolCounts[name] = (toolCounts[name] || 0) + 1;
                }
            }
        }
    }

    const totalTools = Object.values(toolCounts).reduce((a, b) => a + b, 0);

    return {
        turns: result.num_turns,
        duration_ms: result.duration_ms,
        duration_api_ms: result.duration_api_ms,
        cost: result.total_cost_usd,
        is_error: result.is_error,
        output_tokens: result.usage?.output_tokens || 0,
        cache_creation: result.usage?.cache_creation_input_tokens || 0,
        cache_read: result.usage?.cache_read_input_tokens || 0,
        toolCounts,
        totalTools,
        result_text: result.result || "",
    };
}

function delta(a, b) {
    if (a === 0) return "N/A";
    return ((b - a) / a * 100).toFixed(0) + "%";
}

const A = parseSession(builtinFile);
const B = parseSession(hexlineFile);

// Merge all tool names
const allTools = new Set([...Object.keys(A.toolCounts), ...Object.keys(B.toolCounts)]);
const toolRows = [...allTools].sort().map(t =>
    `| ${t} | ${A.toolCounts[t] || "-"} | ${B.toolCounts[t] || "-"} |`
).join("\n");

const date = new Date().toISOString().split("T")[0];
const report = `# Benchmark: Built-in vs Hex-line - ${date}

## 1. Correctness

| Session | Completed | Error |
|---------|-----------|-------|
| Built-in | ${A.is_error ? "FAIL" : "PASS"} | ${A.is_error} |
| Hex-line | ${B.is_error ? "FAIL" : "PASS"} | ${B.is_error} |

## 2. Time

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Wall time | ${(A.duration_ms/1000).toFixed(1)}s | ${(B.duration_ms/1000).toFixed(1)}s | ${delta(A.duration_ms, B.duration_ms)} |
| API time | ${(A.duration_api_ms/1000).toFixed(1)}s | ${(B.duration_api_ms/1000).toFixed(1)}s | ${delta(A.duration_api_ms, B.duration_api_ms)} |

## 3. Cost

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Total cost | $${A.cost.toFixed(4)} | $${B.cost.toFixed(4)} | ${delta(A.cost, B.cost)} |

## 4. Tool Calls

| Tool | Built-in | Hex-line |
|------|----------|----------|
${toolRows}
| **Total** | **${A.totalTools}** | **${B.totalTools}** |

## 5. Tokens

| Metric | Built-in | Hex-line | Delta |
|--------|----------|----------|-------|
| Output tokens | ${A.output_tokens} | ${B.output_tokens} | ${delta(A.output_tokens, B.output_tokens)} |
| Cache creation | ${A.cache_creation} | ${B.cache_creation} | ${delta(A.cache_creation, B.cache_creation)} |
| Cache read | ${A.cache_read} | ${B.cache_read} | ${delta(A.cache_read, B.cache_read)} |
`;

if (outputFile) {
    writeFileSync(outputFile, report, "utf8");
    process.stdout.write("Report saved to " + outputFile + "\n");
} else {
    process.stdout.write(report);
}

// Also print summary to stdout
process.stdout.write("\n--- Summary ---\n");
process.stdout.write("Built-in: " + A.turns + " turns, $" + A.cost.toFixed(2) + ", " + (A.duration_ms/1000).toFixed(0) + "s, " + A.totalTools + " tool calls\n");
process.stdout.write("Hex-line: " + B.turns + " turns, $" + B.cost.toFixed(2) + ", " + (B.duration_ms/1000).toFixed(0) + "s, " + B.totalTools + " tool calls\n");

