# Audit Scoring Algorithm

Unified scoring formula for all L3 audit workers (ln-6XX series).

## Penalty Formula

```
penalty = (critical × 2.0) + (high × 1.0) + (medium × 0.5) + (low × 0.2)
score = max(0, 10 - penalty)
```

## Score Interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| 10/10 | No issues | None required |
| 8-9/10 | Minor issues | Low priority fixes |
| 6-7/10 | Moderate issues | Address in next sprint |
| 4-5/10 | Significant issues | Prioritize fixes |
| 1-3/10 | Critical issues | Immediate action required |

## Severity Guidelines

| Severity | Weight | Typical Issues |
|----------|--------|----------------|
| CRITICAL | 2.0 | Security vulnerabilities, data loss risks, RFC/standard violations |
| HIGH | 1.0 | Architecture violations, outdated dependencies with CVEs, blocking bugs |
| MEDIUM | 0.5 | Best practice violations, code smells, minor performance issues |
| LOW | 0.2 | Style issues, minor inconsistencies, cosmetic problems |

## Calculation Example

**Input:** 1 CRITICAL + 2 HIGH + 3 MEDIUM + 2 LOW

**Calculation:**
```
penalty = (1 × 2.0) + (2 × 1.0) + (3 × 0.5) + (2 × 0.2)
        = 2.0 + 2.0 + 1.5 + 0.4
        = 5.9

score = max(0, 10 - 5.9) = 4.1
```

**Result:** 4.1/10 (Significant issues)

## Diagnostic Sub-Scores (ln-641, ln-643)

Workers ln-641 and ln-643 additionally report 4 diagnostic sub-scores (0-100 each):
- **Compliance** — How well does implementation follow documented pattern?
- **Completeness** — Are all required components present?
- **Quality** — Code quality of pattern implementation
- **Implementation** — Technical correctness of implementation

These sub-scores are **informational only** — reported in AUDIT-META for diagnostic purposes. The primary `score` field uses the same penalty formula as all other workers.

## Usage in SKILL.md

Reference this file instead of duplicating formula:

```markdown
## Reference Files
- **Scoring algorithm:** `shared/references/audit_scoring.md`
```

---
**Version:** 2.0.0
**Last Updated:** 2026-03-01
