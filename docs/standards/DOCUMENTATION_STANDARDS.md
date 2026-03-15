# Documentation Standards

**Requirements for Claude Code Project Documentation**

<!-- SCOPE: Documentation requirements for target project docs created by skills. -->

---

## Categories

| Category | Priority levels | Validator |
|----------|----------------|-----------|
| **Core Documentation** | Critical + Important | Structure audit |
| **Claude Code Integration** | Critical + Important | Structure audit |
| **AI-Friendly Writing** | Important | Content audit |
| **Markdown Best Practices** | Important | markdownlint |
| **Code Examples Quality** | Critical + Important | Manual + CI |
| **DIATAXIS Framework** | Desired | Manual |
| **Project Files** | Critical + Important | Manual |
| **Quality Checks** | Important | markdownlint, Vale |
| **Front Matter (SSG)** | Desired | Conditional |
| **Visual Documentation** | Desired | Manual |
| **Conventional Commits** | Desired | commitlint |
| **Security & Compliance** | Critical + Important | Manual |
| **Performance** | Important | Manual |
| **AI-First Documentation** | Critical + Important | Content audit |

---

## Critical Requirements

| Requirement | Rationale |
|------------|-----------|
| CLAUDE.md ≤ 200 lines per file | Claude Code context optimization |
| All code examples runnable | Prevent documentation drift |
| LICENSE file exists | Legal compliance |
| Never commit secrets | Security breach prevention |
| Stack Adaptation | Documents match project stack (.NET -> C# links, not Python) |
| NO_CODE in docs | No code blocks; tables/ASCII/links instead (AI fetches code dynamically) |

---

## Important Requirements

**Claude Code Integration:**
- @-sourcing support in CLAUDE.md (DRY pattern)
- Use `.claude/rules/` for organizing large instruction sets

**AI-Friendly Writing:**
- Use second person ("you" vs "users")
- Active voice instead of passive
- Short sentences (max 25 words)
- Prohibited phrases: "please note", "simply", "just", "easily"

**Markdown Best Practices:**
- Header depth <= h3 (rarely h4)
- Descriptive links (not "click here")
- Callouts/Admonitions for important info
- Files end with single blank line (POSIX)

**Project Files:**
- CONTRIBUTING.md (contribution process)
- SECURITY.md (vulnerability reporting)
- .gitignore for docs (exclude generated files)

**Quality Checks:**
- markdownlint-cli2 (.markdownlint.jsonc)
- Vale.sh (.vale.ini for editorial checks)
- Link checking (dead link detection)

**Security & Compliance:**
- GitHub Secrets for CI/CD
- .env.example instead of .env
- Vulnerability reporting process (SECURITY.md)

**AI-First Documentation:**

| Requirement | Rationale | Source |
|-------------|-----------|--------|
| **Format Priority** | Tables/ASCII > Lists > Text; optimized for LLM parsing | Redocly |
| **Self-contained pages** | Each page standalone; LLM reads without nav context | kapa.ai |
| **Consistent terminology** | One concept = one term; no synonyms | kapa.ai |
| **Semantic chunking** | 500-800 chars for tech docs; semantic boundaries | Pinecone |
| **llms.txt file** | Index file for AI agents (Markdown format) | llmstxt.org |

---

## Desired Requirements

- DIATAXIS framework (Tutorial/How-to/Reference/Explanation sections)
- Mermaid diagrams, workflow diagrams, sequence diagrams
- Conventional Commits format, auto-generate CHANGELOG
- Realistic variable names (not foo/bar), show expected output
- CODE_OF_CONDUCT.md, README badges
- Front Matter for SSG (Hugo/Docusaurus)
- Title case for h1 / Sentence case for h2+

---

## Standards Compliance

| Standard | Reference |
|----------|-----------|
| **ISO/IEC/IEEE 29148:2018** | Requirements Engineering |
| **ISO/IEC/IEEE 42010:2022** | Architecture Description |
| **DIATAXIS Framework** | diataxis.fr |
| **RFC 2119, WCAG 2.1 AA** | Requirement keywords, Accessibility |
| **Conventional Commits** | conventionalcommits.org |
| **Semantic Versioning** | semver.org |
| **llms.txt Standard** | llmstxt.org |

---

## Verification Checklist

- [ ] CLAUDE.md <= 200 lines, concise and focused
- [ ] All code examples runnable, no placeholders
- [ ] LICENSE file exists
- [ ] No secrets committed (API keys in .env only)
- [ ] Header depth <= h3, files end with blank line
- [ ] Active voice, second person, short sentences
- [ ] SCOPE tag in docs, cross-references accurate
- [ ] Stack Adaptation: all links/refs match project stack
- [ ] Format Priority: Tables > Lists > Text
- [ ] Self-contained pages: each doc standalone

**Version:** 3.0.0
**Last Updated:** 2026-03-15
