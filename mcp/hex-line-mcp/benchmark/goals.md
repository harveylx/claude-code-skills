# Benchmark Goals — hex-line-mcp

Run each scenario independently. Do not skip steps. Show your work.

## Scenario A: Bug Fix

In function `simpleDiff` in file `lib/edit.mjs`, the default context value `ctx = 3` on line ~114 should be `ctx = 5` (we want more context lines in diffs by default). 

1. Understand what `simpleDiff` does and how `ctx` affects the output
2. Find all places in `lib/` that call `simpleDiff`
3. Change the default value from 3 to 5
4. Verify the file is syntactically correct after the change
5. Report: which files call this function and on which lines

## Scenario C: Cross-file Refactoring

The constant `MAX_DIFF_CHARS` is defined in `lib/format.mjs` and imported in other files.

1. Find where `MAX_DIFF_CHARS` is defined and its current value
2. Find ALL files that import or reference `MAX_DIFF_CHARS`
3. Rename it to `MAX_EDIT_DIFF_CHARS` everywhere — definition and all usages
4. Change its value from 30000 to 50000
5. Verify no file still contains the old name `MAX_DIFF_CHARS`
6. Show the diff of all changed files
