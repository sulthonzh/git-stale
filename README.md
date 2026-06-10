# git-stale

Find stale local git branches that are safe to delete.

You know that feeling — your `git branch` list is 40 branches long, half of them are from months ago, and you're not sure which ones are merged. `git-stale` tells you exactly which branches are safe to nuke.

## Why

I got tired of manually checking `git branch --merged main` and then squinting at dates. This does it in one command — shows which branches are old, which are merged, and which are safe to delete.

## Install

```bash
npm install -g git-stale
```

Or just run it directly:

```bash
npx git-stale
```

## Usage

```bash
# Show all stale branches
git-stale

# Only branches older than 30 days
git-stale --older-than 30d

# Show everything including unmerged (has unmerged work)
git-stale --include-unmerged

# Delete all merged stale branches
git-stale --prune

# JSON output
git-stale --json

# Markdown output (for docs/issues)
git-stale --markdown

# Different repo
git-stale --repo ~/projects/my-app
```

## What It Shows

```
Stale branches (default: main)
──────────────────────────────────
Branch            Age               Merged  Status
──────────────────────────────────
feature-old-ui    3 months ago      yes     🗑️  safe to delete
fix/login-bug     2 months ago      yes     🗑️  safe to delete
experiment/raft   45 days ago       no      ⚠️  has unmerged work

3 stale branches (2 safe to delete)
```

## Options

| Flag | Description |
|------|-------------|
| `--older-than <n[d\|m\|y]>` | Minimum age (e.g. `30d`, `3m`, `1y`, or bare `60` for days) |
| `--include-unmerged` | Show branches with unmerged work too |
| `--no-merge-check` | Skip merge check (faster for large repos) |
| `--prune` | Delete all merged stale branches |
| `--json` | Output as JSON |
| `--markdown` | Output as Markdown |
| `--repo <path>` | Path to git repo (default: current directory) |

## Exit Codes

- `0` — no merged stale branches found
- `1` — merged stale branches found (safe to delete)
- `2` — error

Great for CI: `git-stale --older-than 90d && echo "clean"`

## How It Works

1. Lists all local branches except current and default (main/master)
2. Checks each branch's last commit timestamp
3. Checks if branch is merged into the default branch (`merge-base --is-ancestor`)
4. Filters by age and merge status
5. Shows results sorted oldest first

## License

MIT
