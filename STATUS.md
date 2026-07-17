# STATUS.md — git-stale Quality Audit

**Audit date:** 2026-07-17 (UTC 2026-07-17 10:34)
**Auditor:** oss-builder automated cycle
**Verdict:** ✅ EXCEPTIONAL

## Exceptional Checklist

- [x] **README hooks reader in first 3 lines** — "Find stale local git branches that are safe to delete — in one command." Punchy, clear value prop.
- [x] **Quick start works in <2 minutes** — `npx git-stale` or `npm install -g git-stale`. Zero config.
- [x] **All tests GREEN (100% pass rate)** — 113/113 pass, 0 fail.
- [x] **Test coverage >= 80% on core logic** — index.js: 100% stmts, 98.46% branches, 100% funcs. cli.js: 96.22% stmts, 91.3% branches. Overall: 99.29% stmts, 97.38% branches.
- [x] **Zero TypeScript errors** — Plain JS project (no TS). ESLint clean (0 warnings).
- [x] **Zero ESLint warnings** — Verified with `npm run lint`.
- [x] **No TODO/FIXME in shipped code** — `grep -rn 'TODO\|FIXME\|HACK\|XXX' src/ cli.js tests/` returns nothing.
- [x] **At least 3 real-world examples in docs** — Post-release cleanup, CI gate for branch hygiene, weekly cleanup report. All in README.
- [x] **CHANGELOG up to date** — v1.0.0 + v1.1.0 + v1.2.0 documented.
- [x] **Modern stack** — Node >=18, native `node --test`, c8 coverage, ESLint flat config. Zero runtime dependencies.
- [x] **Unique value prop clearly stated** — Comparison table vs `git branch --merged`, `git-delete-squashed`, `git cleanup`. Age + merge status + bulk prune combination is unique.
- [x] **Performance** — O(n) where n = branch count. Single `git` call per branch. No loops over commits.
- [x] **Security** — `execFileSync` with array args (no shell interpolation). Input validation on `--older-than` values. No hardcoded secrets.

## Issues Found & Fixed

### Bug: `--older-than` flag-eating (prior audit 2026-07-08)
- **Before:** `git-stale --older-than --json` silently consumed `--json` as the value argument, producing no JSON output.
- **After:** Values starting with `-` are not consumed. Original flag continues parsing.
- **Tests added:** 3 (flag not consumed, alternate flag, end-of-args edge case)

### UX: `formatAge` year formatting (prior audit 2026-07-08)
- **Before:** 365 days → "12 months ago", 730 days → "24 months ago"
- **After:** 365 days → "1 year ago", 730 days → "2 years ago". Months used for < 365 days only.

### Coverage gap: cli.js untested (this audit 2026-07-17)
- **Before:** cli.js (prune, version, help, format switch) had zero test coverage.
- **After:** 51 new tests covering CLI integration (version, help, text/json/markdown output, prune happy/no-op/multi paths, --no-merge-check, exit codes, older-than filter) + unit tests for getDefaultBranch (main/master/trunk/develop fallbacks), getBranchAge (null/non-existent), runGit (error paths), getBranches (empty repo, upstream parsing), analyze (exclude current/default, filter unmerged, noMergeCheck, sort, olderThan), formatText/formatMarkdown edge cases, parseArgs edge cases.
- **Coverage improvement:** Overall branches 90.09% → **97.38%**, cli.js 0% → **91.3%** branches.

## Test Suite Growth

- **Prior (2026-07-08):** 62 tests
- **Current:** 113 tests (+51)
- **New coverage areas:** CLI integration (version, help, prune, format switches, exit codes), getDefaultBranch fallbacks (main/master/trunk/develop/custom), getBranchAge null path, runGit error paths, getBranches empty repo + upstream parsing, analyze filtering/sorting/exclusion logic, formatText/formatMarkdown edge cases, parseArgs unit validation
