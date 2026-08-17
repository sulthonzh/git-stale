# Changelog

All notable changes to **git-stale** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-07-08

### Fixed
- **Bug:** `--older-than` flag ate the next argument if it started with `--` (e.g. `--older-than --json` silently consumed `--json`). Now refuses to consume flag-like tokens.
- **UX:** `formatAge()` now shows "1 year ago" / "2 years ago" for year-scale durations instead of "12 months ago" / "24 months ago".
- **Guard:** `formatAge()` now returns `'?'` for negative values (previously rendered nonsensical "-1 days ago").

### Added
- 12 new tests (50 → 62 total): flag-eating edge cases, year formatting, negative/Infinity inputs, safe-to-delete count accuracy, long branch names, markdown edge cases.
- STATUS.md with full exceptional checklist audit.

## [1.1.0] — 2026-06-19

### Security
- **Critical:** Replaced `execSync` (string interpolation) with `execFileSync` (array args) across all git calls. Prevents command injection via crafted branch names (e.g. `foo; rm -rf /`).
- `isMerged` now uses `execFileSync` instead of relying on `execSync` exit code.

### Added
- `--version` / `-V` flag to print version.
- `prepublishOnly` script — tests must pass before npm publish.
- `exports` field in package.json for clean `require('git-stale')` usage.
- 22 new tests (28 → 50 total): NaN/undefined guards, multi-flag parsing, version flag, JSON field completeness, markdown counts, analyze integration, isMerged edge case.

### Changed
- Removed dead `--all` option code (had "Let me reconsider" comment — never finished).
- `files` field in package.json now includes CHANGELOG.md.

### Fixed
- `formatAge(NaN)` now returns `'?'` instead of `'NaN months ago'`.

## [1.0.0] — 2026-06-10

### Added
- Initial release.
- Find stale local git branches by age and merge status.
- `--older-than`, `--include-unmerged`, `--no-merge-check`, `--prune` options.
- `--json`, `--markdown`, `--repo` output/format flags.
- 28 tests covering core functionality.
