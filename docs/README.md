# Documentation

<!-- SCOPE: Index for docs/ directory. Each subdirectory owns one aspect of documentation. -->

## Structure

```
docs/
├── architecture/                    # How skills are built
│   ├── SKILL_ARCHITECTURE_GUIDE.md  # L0-L3 hierarchy, SRP, token efficiency
│   └── AGENT_TEAMS_PLATFORM_GUIDE.md # Heartbeat, crash recovery, Windows
├── best-practice/                   # How to use Claude Code effectively
│   ├── COMPONENT_SELECTION.md       # Command vs Agent vs Skill decisions
│   └── WORKFLOW_TIPS.md             # Curated tips from Claude Code creators
├── standards/                       # How to write documentation
│   ├── DOCUMENTATION_STANDARDS.md   # 90 requirements for project docs
│   └── GITHUB_README_BEST_PRACTICES.md # README writing guidelines
└── TROUBLESHOOTING.md               # Known issues and solutions
```

## Responsibility Boundaries

| Directory | Owns | Does NOT own |
|-----------|------|-------------|
| `architecture/` | Skill design patterns, Agent Teams runtime | Individual skill workflows |
| `best-practice/` | Claude Code usage guidance, component selection | Platform API reference |
| `standards/` | Documentation quality requirements, README format | Skill-specific writing rules |
| `TROUBLESHOOTING.md` | Known issues, solutions | Runtime protocols |
