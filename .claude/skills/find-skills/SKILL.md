---
name: find-skills
description: Meta-skill for discovering and installing agent skills from the open ecosystem. Use this skill when the user asks "how do I do X", "find a skill for X", "is there a skill for X", or expresses interest in extending agent capabilities.
license: MIT
---

## When to Use This Skill

Use this skill when the user:

- Asks "how do I do X" where X might be a common task with an existing skill
- Says "find a skill for X" or "is there a skill for X"
- Asks "can you do X" where X is a specialized capability
- Expresses interest in extending agent capabilities
- Wants to search for tools, templates, or workflows
- Mentions they wish they had help with a specific domain (design, testing, deployment, etc.)

## What is the Skills CLI?

The Skills CLI (`npx skills`) is a package manager for AI agent skills. It lets you search, install, and update skills from the open ecosystem.

Key commands:
- `npx skills find [query]` — Interactive or keyword-based skill search
- `npx skills add <package>` — Install a skill from GitHub or other sources
- `npx skills check` — Check for skill updates
- `npx skills update` — Update all installed skills

Browse the leaderboard at: https://skills.sh/

## How to Help Users Find Skills

### Step 1: Understand What They Need

Identify:
- The domain (e.g., React, testing, design, deployment)
- The specific task (e.g., writing tests, creating UI, setting up CI/CD)
- Whether this is a common enough task that a skill likely exists

### Step 2: Check the Leaderboard First

Before running a CLI search, check the [skills.sh](https://skills.sh) leaderboard to see if a well-known skill already exists for the domain. Popular, battle-tested skills appear at the top (ranked by total installs).

Common well-known sources:
- `vercel-labs/agent-skills` — General-purpose agent capabilities
- `anthropics/skills` — Anthropic's official skill collection of frontend-design, etc.

### Step 3: Search for Skills

If the leaderboard doesn't cover it, run:

```bash
npx skills find <query>
```

Use specific keywords (e.g., `react performance` not just `react`). Try alternative terms if the first search returns nothing useful.

### Step 4: Verify Quality Before Recommending

Always verify before recommending. Check:

- **Install count** — Prefer 1K+ installs; be cautious under 100
- **Source reputation** — Official sources (vercel-labs, anthropics, microsoft) are more trustworthy than random personal repos
- **GitHub stars** — Treat repos with <100 stars with skepticism
- **Recent updates** — Skills updated within the last few months are more likely to work

### Step 5: Present Options to the User

For each relevant skill found, present:

- **Skill name** and a one-line description
- **Install count** and source (for trust signals)
- **Install command** ready to copy-paste

Format:

```
**skill-name** by owner — Description (⭐ X stars, Y installs)
npx skills add owner/repo@skill -g -y
```

### Step 6: Offer to Install

If the user wants to proceed, install it:

```bash
npx skills add <owner/repo@skill> -g -y
```

For manual installation (when the CLI is unavailable), download the SKILL.md file and place it in `.claude/skills/<skill-name>/SKILL.md`.

## Common Skill Categories

| Category | Example Queries |
|----------|----------------|
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing | testing, jest, playwright, e2e |
| DevOps | deploy, docker, kubernetes, ci-cd |
| Documentation | docs, readme, changelog, api-docs |
| Code Quality | review, lint, refactor, best-practices |
| Design | ui, ux, design-system, accessibility |
| Productivity | workflow, automation, git |

## When No Skills Are Found

If no matching skill is found:

1. **Acknowledge** — Tell the user no existing skill matched their query
2. **Offer to help directly** — Use your general capabilities to assist with the task
3. **Suggest creating one** — If the task is recurring, mention:
   ```bash
   npx skills init <name>
   ```
   This scaffolds a new SKILL.md that can be published for others to use.
