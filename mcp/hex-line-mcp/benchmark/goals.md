# Benchmark Goals v2 — hex-line-mcp

Run each scenario independently. Do not skip steps. Show your work.

## Scenario S1: Navigate a large file

File `server.mjs` (408 lines) registers 11 tool handlers. Without reading the entire file:

1. Find which line the `verify` tool is registered on and what function it calls from lib/
2. Find which line the `bulk_replace` tool is registered on and what function it calls
3. Find where the `directory_tree` handler reads `max_depth` parameter and what default it uses
4. Report: tool name, registration line, imported handler function, default values

## Scenario S2: Rename across many files

The function `readText` is defined in `lib/format.mjs` and imported in multiple other files.

1. Find where `readText` is defined
2. Find ALL files that import or call `readText`
3. Rename it to `readFileText` everywhere — definition, all imports, all call sites
4. Verify no file still contains the old name `readText`
5. Show the diff of every changed file

## Scenario S3: Three sequential edits with verification

In `lib/edit.mjs` (537 lines), make these 3 changes one at a time:

1. In function `simpleDiff` (line ~114): change the default `ctx = 3` to `ctx = 5`
2. In function `editFile` (line ~217): change the default conflict policy from `"conservative"` to `"strict"`  
3. In function `buildErrorSnippet` (line ~45): change `radius = 5` to `radius = 3`

After EACH individual change, verify the file is still syntactically valid. After all 3 changes, confirm the final state with `node -c lib/edit.mjs`.

## Scenario S4: Codebase exploration and documentation

Analyze the `lib/` directory which contains 19 source files.

1. List all files with their sizes (lines and bytes)
2. For the 5 largest files, list their exported functions with parameter signatures
3. Build a dependency map: which file imports from which other file in lib/
4. Identify any files that are never imported by another file in lib/ (leaf modules)
5. Write the complete analysis to `lib/MODULES.md`
