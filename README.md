# git-stale

Find stale, abandoned, and forgotten git branches. Clean up your repo.

## Why

Every repo accumulates branches. Feature branches from 6 months ago, hotfixes nobody deleted, experiment branches people forgot about. `git-stale` surfaces them so you can clean house.

## Install

```bash
npm install -g git-stale
```

## Usage

### List stale branches

```bash
git-stale
```

```
Default branch: main | Stale ≥30d | Ancient ≥90d

Branch           Days  Age     Merged  Author   Ahead  Last commit
----------------------------------------------------------------------
feature/auth      67   stale   no      alice        3  add OAuth2
hotfix/rate-fix   45   stale   yes     bob          0  fix rate limit
experiment/ui     12   fresh   no      charlie      5  try new layout

Total: 3 branches | 2 stale | 0 ancient | 1 merged | 2 unmerged
```

### Show cleanup commands

```bash
git-stale cleanup
```

Outputs `git branch -d` commands for merged stale branches that are safe to delete.

### Options

| Flag | Description |
|------|-------------|
| `--days <n>` | Stale threshold (default: 30) |
| `--ancient <n>` | Ancient threshold (default: 90) |
| `--default <br>` | Default branch name (auto-detected) |
| `--remote` | Include remote branches |
| `--merged` | Only show merged branches |
| `--unmerged` | Only show unmerged branches |
| `--exclude <pat>` | Exclude branch pattern (repeatable) |
| `--json` | JSON output |
| `--markdown` | Markdown output |
| `--repo <path>` | Repository path (default: cwd) |

### Examples

```bash
# Find branches older than 60 days
git-stale --days 60

# Only unmerged stale branches
git-stale --unmerged

# Exclude release branches
git-stale --exclude "release/*"

# JSON for scripts
git-stale --json

# Markdown report
git-stale --markdown > stale-report.md

# What can I safely delete?
git-stale cleanup
```

## API

```typescript
import { analyze, formatTable, formatJSON } from "git-stale";

const result = analyze({
  repoPath: "/path/to/repo",
  staleDays: 30,
  ancientDays: 90,
  exclude: ["release/*"],
  mergedOnly: false,
  unmergedOnly: false,
  remote: false,
});

console.log(formatTable(result, config));
console.log(formatJSON(result));
```

## What it checks

- **Last commit age** — days since last commit on each branch
- **Merge status** — whether the branch has been merged into default
- **Ahead/behind** — how many commits ahead or behind the default branch
- **Total commits** — commit count on the branch
- **Author** — who made the last commit

## Zero dependencies

Runs on Node.js 18+. No external dependencies.

## License

MIT
