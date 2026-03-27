---
name: ln-523-auto-test-planner
description: "Plans automated tests (E2E/Integration/Unit) using Risk-Based Testing after research. Calculates priorities, delegates to ln-301-task-creator."
license: MIT
---

> **Paths:** File paths (`shared/`, `references/`, `../ln-*`) are relative to skills repo root. If not found at CWD, locate this SKILL.md directory and go up one level for repo root.

# Automated Test Planner

Creates Story test task with comprehensive automated test coverage (E2E/Integration/Unit) based on Risk-Based Testing methodology and research findings.

## Inputs

| Input | Required | Source | Description |
|-------|----------|--------|-------------|
| `storyId` | Yes | args, git branch, kanban, user | Story to process |

**Resolution:** Story Resolution Chain.
**Status filter:** To Review

## Purpose & Scope
- **Create** comprehensive test task for Story automation
- **Calculate** risk-based priorities (Impact x Probability)
- **Generate** 11-section test plan from Story AC and research findings
- **Delegate** to ln-301-task-creator (CREATE) or ln-302-task-replanner (REPLAN)
- **NOT** for: research (ln-521), orchestration (ln-520)

## When to Use This Skill

This skill should be used when:
- **Invoked by ln-520-test-planner** after ln-521 research
- All implementation tasks in Story are Done
- Research findings available in Linear comment (from ln-521)

**Prerequisites:**
- All implementation Tasks in Story status = Done
- ln-521-test-researcher completed (research comment exists)

**Automation:** Supports `autoApprove: true` (default when invoked by ln-520) to skip manual confirmation.

## When NOT to Use

Do NOT use if:
- Research NOT completed -> Wait for ln-521
- Implementation tasks NOT all Done -> Complete impl tasks first

## Workflow

### Phase 0: Tools Config

**MANDATORY READ:** Load `shared/references/tools_config_guide.md`, `shared/references/storage_mode_detection.md`, and `shared/references/input_resolution_pattern.md`

Extract: `task_provider` = Task Management → Provider (`linear` | `file`).

### Phase 1: Discovery (Automated)

1. **Resolve storyId:** Run Story Resolution Chain per guide (status filter: [To Review]).
2. Auto-discover Team ID from `docs/tasks/kanban_board.md` (see CLAUDE.md "Configuration Auto-Discovery")

### Phase 2: Story + Tasks Analysis (NO Dialog)

**Step 0: Study Project Test Files**
1. Scan for test-related files:
   - tests/README.md (commands, setup, environment)
   - Test configs (jest.config.js, vitest.config.ts, pytest.ini)
   - Existing test structure (tests/, __tests__/ directories)
   - Coverage config (.coveragerc, coverage.json)
2. Extract: test commands, framework, patterns, coverage thresholds
3. Ensures test planning aligns with project practices

**Step 1: Load Research Findings**
1. Fetch Story (must have label "user-story"):
   - IF `task_provider` = `linear`: `get_issue(storyId)` — extract Story.id (UUID, NOT short ID)
   - IF `task_provider` = `file`: `Read story.md` — extract Story metadata
2. Load research comment (from ln-521): "## Test Research: {Feature}"
   - IF `task_provider` = `linear`: `list_comments(issueId=storyId)` → find matching comment
   - IF `task_provider` = `file`: `Glob("docs/tasks/epics/*/stories/*/comments/*.md")` → find matching comment
   - If not found -> WARNING: proceed with Story AC only
3. Parse Story AC and research into test scenarios:
   - Each AC → candidate E2E test
   - Edge cases from research → candidate Unit tests
   - Integration patterns from research → candidate Integration tests

**Step 2: Analyze Story + Tasks**
1. Parse Story: Goal, Test Strategy, Technical Notes, AC list
2. Fetch all child Tasks (status = Done):
   - IF `task_provider` = `linear`: `list_issues(parentId=Story.id, state="Done")`
   - IF `task_provider` = `file`: `Glob("docs/tasks/epics/*/stories/*/tasks/*.md")` → filter by `**Status:** Done`
3. Analyze each Task:
   - Components implemented
   - Business logic added
   - Integration points created
   - Conditional branches (if/else/switch)
4. Identify what needs testing

### Phase 3: Risk-Based Test Planning (Automated)

**MANDATORY READ:** Load `shared/references/risk_based_testing_guide.md` for complete methodology.

**E2E-First Approach:** Prioritize by business risk (Priority = Impact x Probability), not coverage metrics.

**Workflow:**

**Step 1: Risk Assessment**

Calculate Priority for each scenario derived from Story AC and research findings:

```
Priority = Business Impact (1-5) x Probability (1-5)
```

**Decision Criteria:**
- Priority ≥15 -> **MUST test**
- Priority 9-14 -> **SHOULD test** if not covered
- Priority <=8 -> **SKIP**

**Step 2: E2E Test Selection (2-5):** Baseline 2 (positive + negative) ALWAYS + 0-3 additional (Priority ≥15 only)

**Step 3: Unit Test Selection (0-15):** DEFAULT 0. Add ONLY for complex business logic (Priority ≥15): financial, security, algorithms

**Step 4: Integration Test Selection:** DEFAULT 0. Add ONLY if E2E gaps AND Priority ≥15: rollback, concurrency, external API errors

**Step 5: Validation:** Each test passes Usefulness Criteria (Priority ≥15, Confidence ROI, Behavioral, Predictive, Specific, Non-Duplicative)

### Phase 4: Test Task Generation (Automated)

Generates complete test task per `test_task_template.md` (11 sections):

**Sections 1-7:** Context, Risk Matrix, E2E/Integration/Unit Tests (with Priority scores + justifications), Coverage, DoD

**Section 8:** Existing Tests to Fix (analysis of affected tests from implementation tasks)

**Section 9:** Infrastructure Changes (packages, Docker, configs - based on test dependencies)

**Section 10:** Documentation Updates (README, CHANGELOG, tests/README, config docs)

**Section 11:** Legacy Code Cleanup (deprecated patterns, backward compat, dead code)

Shows preview for review.

### Phase 5: Confirmation & Delegation

**Step 1:** Preview generated test plan (always displayed for transparency)

**Step 2:** Confirmation logic:
- **autoApprove: true** (default from ln-520) -> proceed automatically
- **Manual run** -> prompt user to type "confirm"

**Step 3:** Check for existing test task

- IF `task_provider` = `linear`: `list_issues(parentId=Story.id, label="tests")`
- IF `task_provider` = `file`: `Glob("docs/tasks/epics/*/stories/*/tasks/*.md")` → filter by `**Labels:**` containing `tests`

**Decision:**
- **Count = 0** -> **CREATE MODE** (Step 4a)
- **Count >= 1** -> **REPLAN MODE** (Step 4b)

**Step 4a: CREATE MODE** (if Count = 0)

Invoke ln-301-task-creator worker with taskType: "test"

**Pass to worker:**
- taskType, teamId, storyData (Story.id, title, AC, Technical Notes, Context)
- researchFindings (from ln-521 comment)
- testPlan (e2eTests, integrationTests, unitTests, riskPriorityMatrix)
- infrastructureChanges, documentationUpdates, legacyCleanup

**Worker returns:** Task URL + summary

**Step 4b: REPLAN MODE** (if Count >= 1)

Invoke ln-302-task-replanner worker with taskType: "test"

**Pass to worker:**
- Same data as CREATE MODE + existingTaskIds

**Worker returns:** Operations summary + warnings

**Step 5:** Return summary to orchestrator (ln-520)

---

## Definition of Done

**Research Findings Loaded:**
- [ ] Research comment "## Test Research: {Feature}" found (from ln-521)
- [ ] Story AC parsed into test scenarios

**Risk-Based Test Plan Generated:**
- [ ] Risk Priority Matrix calculated for all scenarios
- [ ] E2E tests: Baseline positive + negative, additional only if Priority ≥15
- [ ] Integration tests: ONLY if E2E doesn't cover AND Priority ≥15
- [ ] Unit tests: ONLY complex business logic with Priority ≥15
- [ ] Each test passes all 6 Usefulness Criteria
- [ ] No framework/library testing: Each test validates OUR business logic only

**Test Task Description Complete (11 sections):**
- [ ] All 11 sections populated per template
- [ ] Risk Priority Matrix included
- [ ] Each test beyond baseline 2 justified

**Worker Delegation Executed:**
- [ ] CREATE MODE: Delegated to ln-301-task-creator
- [ ] REPLAN MODE: Delegated to ln-302-task-replanner
- [ ] Linear Issue URL returned

**Output:**
- **CREATE MODE:** Linear Issue URL + confirmation
- **REPLAN MODE:** Operations summary + URLs

## Reference Files

- **Tools config:** `shared/references/tools_config_guide.md`
- **Storage mode operations:** `shared/references/storage_mode_detection.md`
- **Risk-based testing methodology:** `shared/references/risk_based_testing_guide.md`
- **Auto-discovery patterns:** `shared/references/auto_discovery_pattern.md`
- **MANDATORY READ:** `shared/references/research_tool_fallback.md`

### risk_based_testing_guide.md

**Purpose**: Risk-Based Testing methodology (detailed guide)

**Location**: [shared/references/risk_based_testing_guide.md](shared/references/risk_based_testing_guide.md)

### test_task_template.md (CENTRALIZED)

**Location**: `shared/templates/test_task_template.md`

**Usage**: Workers (ln-301, ln-302) load via Template Loading logic

## Critical Rules

- **E2E-first, not unit-first:** Baseline is always 2 E2E (positive + negative); unit/integration added only for Priority >= 15
- **No framework testing:** Every test must validate OUR business logic; never test library/framework behavior
- **Usefulness enforcement:** Every test beyond baseline must pass all 6 Usefulness Criteria (see risk_based_testing_guide.md)
- **Delegate, don't create:** Task creation goes through ln-301/ln-302 workers; this skill generates the plan only

## Best Practices

**Minimum Viable Testing:** Start with baseline E2E (positive + negative). Each additional test must pass all 6 Usefulness Criteria.

**Risk-Based Testing:** Prioritize by Business Impact x Probability. E2E-first from Story AC and research findings. Priority ≥15 scenarios covered by tests.

## Reference Files

| File | Purpose |
|------|---------|
| `references/risk_based_testing_examples.md` | Practical examples of risk-based testing (learning reference) |

---

**Version:** 1.0.0
**Last Updated:** 2026-01-15
