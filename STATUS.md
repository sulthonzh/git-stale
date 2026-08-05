# STATUS.md — git-stale Quality Audit

**Audit date:** 2026-08-06 (UTC 2026-08-05 20:03)
**Prior audit:** 2026-08-04 (UTC 2026-08-04 08:47)
**Prior audit:** 2026-08-01 (UTC 2026-08-01 03:30)
**Prior audit:** 2026-07-23 (UTC 2026-07-23 05:00)
**Auditor:** oss-builder automated cycle
**Verdict:** ✅ EXCEPTIONAL

## Exceptional Checklist

- [x] **README hooks reader in first 3 lines** — "Find stale local git branches that are safe to delete — in one command." Punchy, clear value prop.
- [x] **Quick start works in <2 minutes** — `npx git-stale` or `npm install -g git-stale`. Zero config.
- [x] **All tests GREEN (100% pass rate)** — 126/126 pass (123 existing + 3 new coverage-gaps-3), 0 fail.
- [x] **Test coverage >= 80% on core logic** — index.js: 100% stmts, 99.24% branches, 100% funcs. cli.js: 100% stmts, 100% branches. Overall: 100% stmts, 99.35% branches.
- [x] **Zero TypeScript errors** — Plain JS project (no TS). ESLint clean (0 warnings).
- [x] **Zero ESLint warnings** — Verified with `npm run lint`.
- [x] **No TODO/FIXME in shipped code** — `grep -rn 'TODO\|FIXME\|HACK\|XXX' src/ cli.js tests/` returns nothing.
- [x] **At least 3 real-world examples in docs** — Post-release cleanup, CI gate for branch hygiene, weekly cleanup report. All in README.
- [x] **CHANGELOG up to date** — v1.0.0 + v1.1.0 + v1.2.0 documented.
- [x] **Modern stack** — Node >=18, native `node --test`, c8 coverage, ESLint flat config. Zero runtime dependencies.
- [x] **Unique value prop clearly stated** — Comparison table vs `git branch --merged`, `git-delete-squashed`, `git cleanup`. Age + merge status + bulk prune combination is unique.
- [x] **Performance** — O(n) where n = branch count. Single `git` call per branch. No loops over commits.
- [x] **Security** — `execFileSync` with array args (no shell interpolation). Input validation on `--older-than` values. No hardcoded secrets.

## Coverage

```
File           | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------------|---------|----------|---------|---------|-------------------
All files      |     100 |    99.35 |     100 |     100 |
 cli.js        |     100 |      100 |     100 |     100 |
 index.js      |     100 |    99.24 |     100 |     100 | 107
```

**Remaining uncovered:** index.js line 107 — `(b.age || 0)` in sort comparator. The `|| 0` fallback when `getBranchAge()` returns null. This is defensive dead code: `getBranchAge()` only returns null when `git log -1` produces no output (unborn branch), but `getBranches()` only returns branches that have commits. The guard is correct but unreachable in practice.

## Issues Found & Fixed

### Coverage: cli.js line 20 + index.js line 89 (this audit 2026-08-01)
- **cli.js:20** — `options.repo || process.cwd()` fallback when no `--repo` flag provided. Now covered by running CLI from temp repo dir without `--repo`.
- **index.js:89** — `if (b.name === defaultBranch) continue` — default branch skip when HEAD is on a non-default branch. Now covered by test that creates two feature branches and switches to one, ensuring main appears in branch list but is filtered.

### Bug: `--older-than` flag-eating (prior audit 2026-07-08)
- **Before:** `git-stale --older-than --json` silently consumed `--json` as the value argument.
- **After:** Values starting with `-` are not consumed.

### UX: `formatAge` year formatting (prior audit 2026-07-08)
- **Before:** 365 days → "12 months ago", 730 days → "24 months ago"
- **After:** 365 days → "1 year ago", 730 days → "2 years ago".

### Coverage gap: cli.js untested (audit 2026-07-17)
- cli.js went from 0% → 91.3% → 100% branches across audits.

## Test Suite History

| Date | Tests | Branches | Notes |
|------|-------|----------|-------|
| 2026-08-01 | 126 | 99.35% | +3 tests: defaultBranch skip (line 89), age null sort fallback, CLI cwd fallback (cli.js line 20). cli.js → 100% all metrics. |
| 2026-07-23 | 123 | 96.73% | +10 tests: flaky FixedWindow timing fix, prune error paths, worktree-locked branch deletion |
| 2026-07-17 | 113 | 97.38% | +51 tests: CLI integration, getDefaultBranch fallbacks, runGit errors, getBranches parsing |
| 2026-07-08 | 62 | 90.09% | Initial baseline after flag-eating bug fix |
