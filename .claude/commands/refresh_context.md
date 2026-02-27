---
description: Restore project context after memory loss or compression
allowed-tools: Read, Edit
---

# Context Refresh (claude-code-skills)

<!-- SCOPE: Context refresh procedure ONLY. Contains minimal anchor files, deep dive sections, output format. -->
<!-- DO NOT add here: skill details → individual SKILL.md files, architecture → docs/SKILL_ARCHITECTURE_GUIDE.md -->

## Project Profile Constants
| Variable | Description | Value |
|-----------|--------------|--------|
| `<DOCS_ROOT>` | Documentation folder | `docs` |
| `<ENTRY_FILE>` | Repository entry point | `CLAUDE.md` |
| `<SKILLS_ROOT>` | Skills collection root | `.` |

---

## 1. Preparation
> Use this procedure when context was cleared, compressed, or lost (e.g., after `/clear` or session reset).
> Goal: fully reload repository structure, skill architecture patterns, and development workflows.

> [!WARNING]
> Before any work with skills, **ALWAYS read** `docs/SKILL_ARCHITECTURE_GUIDE.md` for best practices 2024-2026: Orchestrator-Worker Pattern, Single Responsibility Principle, Token Efficiency, Task Decomposition guidelines, Red Flags.

---

## 2. Refresh Core Knowledge

### Minimal Anchor (ALWAYS loaded)

**Essential context for orientation (~500 lines, ~15% context):**

- [ ] Read `<ENTRY_FILE>` - repository rules, key concepts, versioning workflow
- [ ] Read `README.md` (sections: Features tables, Key Concepts) - overview of 84 skills in 7 categories
- [ ] Read `docs/SKILL_ARCHITECTURE_GUIDE.md` (sections: TOC, Core Principles, Orchestrator-Worker Pattern)
- [ ] Read `docs/DOCUMENTATION_STANDARDS.md` - industry best practices 2024-2026

**After loading the base set:** Proceed to section 3. Based on current work type, load additional documents from "Deep Dive" below.

---

## 3. Output After Refresh
After completing the refresh, respond with:

1. **Status:** "Context refreshed (Light mode - ~500 lines)."
2. **Project Summary:** "claude-code-skills - Collection of 84 skills for Claude Code in 7 categories (0XX Shared, 1XX Documentation, 2XX Planning, 3XX Task Management, 4XX Execution, 5XX Quality, 6XX Audit, 7XX Bootstrap)."
3. **Current Work Type:** Identify current work type
4. **Next Steps:** what to work on next
5. **Load Recommendation:** which additional documents to load from "Deep Dive"

**Example Output:**
```
Context refreshed (Light mode - ~500 lines).

**Project:** claude-code-skills - 84 skills for Claude Code, integrated with Linear.

**Current Work:** Editing ln-400-story-executor skill (L1 orchestrator).

**Next Steps:** Review ln-400-story-executor/SKILL.md, check orchestration logic.

**Load Recommendation:**
- Load `ln-400-story-executor/SKILL.md` + `references/`
- Load `docs/SKILL_ARCHITECTURE_GUIDE.md` (full) for Orchestrator-Worker Pattern
- Load `ln-401-task-executor/SKILL.md` + `ln-404-test-executor/SKILL.md` (L3 workers)
```

---

## Maintenance

**File Updates:**
- Update this file if folder structure or document paths change
- When adding new skills, add them to corresponding "Deep Dive" section by category (0XX-6XX)

**Content Rules:**
- Keep "Minimal Anchor" under 500 lines total
- Organize skills by category (0XX-6XX), not alphabetically

**Optimization Targets:**
- Light mode refresh: <15% context (~500 lines)
- Medium mode refresh: 15-50% context (500-1500 lines)
- Full mode refresh: 50-75% context (1500-3000 lines)

**Architecture Reminders:**
- **Orchestrator-Worker Pattern:** L1 (Top Orchestrators) -> L2 (Domain Coordinators) -> L3 (Workers)
- **Token Efficiency:** Metadata-Only Loading for orchestrators, Full descriptions only for workers
- **7 Categories:** 0XX Shared, 1XX Docs, 2XX Planning, 3XX Tasks, 4XX Execution, 5XX Quality, 6XX Audit, 7XX Bootstrap

**Last Updated:** 2026-01-10
