# Input Resolution Pattern

Standard workflow for resolving Story/Task/Epic identifiers when a skill is invoked standalone (without orchestrator args).

## Core Principle

> Every skill works both in pipeline (args from orchestrator) and standalone (auto-detect from context). Args always take priority.

---

## Story Resolution Chain

```
1. CHECK args → if storyId provided (first positional arg) → use it
2. CHECK git branch → parse current branch name (see Git Branch Parsing)
3. CHECK kanban → read docs/tasks/kanban_board.md
   - Filter Stories by skill's Status Filter (defined in each skill's ## Inputs section)
   - If exactly 1 match → suggest to user for confirmation
   - If multiple → go to step 4
4. FALLBACK → AskUserQuestion:
   - Show matching Stories from kanban (status-filtered)
   - Format: "Which Story?" + options from kanban
```

## Task Resolution Chain

```
1. CHECK args → if taskId provided (first positional arg) → use it
2. CHECK parent Story → if Story already resolved (from context/branch):
   - List tasks under that Story filtered by Status Filter
   - If exactly 1 match → suggest to user
3. CHECK kanban → scan all tasks in relevant status
   - If exactly 1 match → suggest to user
4. FALLBACK → AskUserQuestion:
   - Show matching Tasks from kanban (status-filtered)
   - Format: "Which Task?" + options grouped by Story
```

## Epic Resolution Chain

```
1. CHECK args → if epicId provided (first positional arg) → use it
2. CHECK git branch → parse current branch name (see Git Branch Parsing)
3. CHECK kanban → read Epics Overview section
   - Filter by Active epics
   - If exactly 1 active Epic → suggest to user
   - If multiple → go to step 4
4. FALLBACK → AskUserQuestion:
   - Show Epics from kanban
   - Format: "Which Epic?" + options with status
```

---

## Git Branch Parsing

Try patterns in order on current branch name:

| Pattern | Extracts | Example |
|---------|----------|---------|
| `feature/{TEAM_KEY}-{N}-*` | Linear issue ID → resolve to Story | `feature/PROJ-42-auth-flow` → `PROJ-42` |
| `feature/US{NNN}-*` | Story ID (file mode) | `feature/US001-user-login` → `US001` |
| `feature/epic-{N}-*` | Epic ID | `feature/epic-3-payments` → Epic 3 |
| `*` | Skip git detection → next step | `main`, `develop` |

**Detection command:** `git branch --show-current`

---

## AskUserQuestion Format

**Story selection:**
```
Question: "Which Story to {action}?"
Options: [{label: "US001: User Login", description: "Epic 1 · Todo"}, ...]
```

**Task selection:**
```
Question: "Which Task to {action}?"
Options: [{label: "T001: DB Schema", description: "US001 · To Review"}, ...]
```

**Epic selection:**
```
Question: "Which Epic to {action}?"
Options: [{label: "Epic 1: Authentication", description: "Active · 5 stories"}, ...]
```

---

**Version:** 1.0.0
**Last Updated:** 2026-03-04
