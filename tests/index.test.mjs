import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatAge, daysBetween, parseArgs, formatText, formatJSON, formatMarkdown, HELP, isMerged, analyze } from '../src/index.js';

describe('formatAge', () => {
  it('shows "today" for 0 seconds', () => {
    assert.equal(formatAge(0), 'today');
  });
  it('shows days for < 30 days', () => {
    assert.equal(formatAge(5 * 86400), '5 days ago');
  });
  it('shows months for >= 30 days', () => {
    assert.equal(formatAge(60 * 86400), '2 months ago');
  });
  it('shows singular day', () => {
    assert.equal(formatAge(86400), '1 day ago');
  });
  it('shows singular month', () => {
    assert.equal(formatAge(30 * 86400), '1 month ago');
  });
  it('shows "?" for null', () => {
    assert.equal(formatAge(null), '?');
  });
  it('shows "?" for undefined', () => {
    assert.equal(formatAge(undefined), '?');
  });
  it('shows "?" for NaN', () => {
    assert.equal(formatAge(NaN), '?');
  });
  it('handles 1 year', () => {
    assert.equal(formatAge(365 * 86400), '12 months ago');
  });
  it('handles 2+ years', () => {
    assert.equal(formatAge(730 * 86400), '24 months ago');
  });
});

describe('daysBetween', () => {
  it('converts seconds to days', () => {
    assert.equal(daysBetween(3 * 86400), 3);
  });
  it('returns Infinity for null', () => {
    assert.equal(daysBetween(null), Infinity);
  });
  it('returns 0 for 0', () => {
    assert.equal(daysBetween(0), 0);
  });
  it('returns Infinity for undefined', () => {
    assert.equal(daysBetween(undefined), Infinity);
  });
  it('floors partial days', () => {
    assert.equal(daysBetween(86400 + 43200), 1); // 1.5 days → 1
  });
});

describe('parseArgs', () => {
  it('returns defaults with no args', () => {
    const opts = parseArgs(['node', 'cli.js']);
    assert.equal(opts.olderThan, 0);
    assert.equal(opts.format, 'text');
    assert.equal(opts.includeMerged, false);
    assert.equal(opts.prune, false);
  });
  it('parses --older-than 30d', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', '30d']);
    assert.equal(opts.olderThan, 30);
  });
  it('parses --older-than 3m', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', '3m']);
    assert.equal(opts.olderThan, 90);
  });
  it('parses --older-than 1y', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', '1y']);
    assert.equal(opts.olderThan, 365);
  });
  it('parses --older-than 60 (bare number)', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', '60']);
    assert.equal(opts.olderThan, 60);
  });
  it('parses --older-than 2y', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', '2y']);
    assert.equal(opts.olderThan, 730);
  });
  it('parses --json', () => {
    const opts = parseArgs(['node', 'cli.js', '--json']);
    assert.equal(opts.format, 'json');
  });
  it('parses --markdown', () => {
    const opts = parseArgs(['node', 'cli.js', '--markdown']);
    assert.equal(opts.format, 'markdown');
  });
  it('parses --include-unmerged', () => {
    const opts = parseArgs(['node', 'cli.js', '--include-unmerged']);
    assert.equal(opts.includeMerged, true);
  });
  it('parses --no-merge-check', () => {
    const opts = parseArgs(['node', 'cli.js', '--no-merge-check']);
    assert.equal(opts.noMergeCheck, true);
  });
  it('parses --repo path', () => {
    const opts = parseArgs(['node', 'cli.js', '--repo', '/tmp/myrepo']);
    assert.equal(opts.repo, '/tmp/myrepo');
  });
  it('parses --prune', () => {
    const opts = parseArgs(['node', 'cli.js', '--prune']);
    assert.equal(opts.prune, true);
  });
  it('returns help for --help', () => {
    const opts = parseArgs(['node', 'cli.js', '--help']);
    assert.equal(opts.help, true);
  });
  it('returns help for -h', () => {
    const opts = parseArgs(['node', 'cli.js', '-h']);
    assert.equal(opts.help, true);
  });
  it('returns version for --version', () => {
    const opts = parseArgs(['node', 'cli.js', '--version']);
    assert.equal(opts.version, true);
  });
  it('returns version for -V', () => {
    const opts = parseArgs(['node', 'cli.js', '-V']);
    assert.equal(opts.version, true);
  });
  it('ignores unknown flags gracefully', () => {
    const opts = parseArgs(['node', 'cli.js', '--unknown-flag']);
    assert.equal(opts.format, 'text');
  });
  it('parses multiple flags together', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', '90d', '--json', '--include-unmerged']);
    assert.equal(opts.olderThan, 90);
    assert.equal(opts.format, 'json');
    assert.equal(opts.includeMerged, true);
  });
  it('handles invalid --older-than value gracefully', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', 'abc']);
    assert.equal(opts.olderThan, 0); // stays default
  });
});

describe('formatText', () => {
  it('shows clean message when no stale branches', () => {
    const out = formatText({ branches: [], defaultBranch: 'main' });
    assert.ok(out.includes('No stale branches'));
  });
  it('lists stale branches with details', () => {
    const data = {
      branches: [
        { name: 'feature-old', age: 90 * 86400, staleDays: 90, merged: true, upstream: null },
        { name: 'bugfix-stuck', age: 45 * 86400, staleDays: 45, merged: false, upstream: 'origin/bugfix-stuck' },
      ],
      defaultBranch: 'main',
    };
    const out = formatText(data);
    assert.ok(out.includes('feature-old'));
    assert.ok(out.includes('bugfix-stuck'));
    assert.ok(out.includes('safe to delete'));
    assert.ok(out.includes('unmerged work'));
    assert.ok(out.includes('2 stale branches'));
  });
  it('shows singular for 1 branch', () => {
    const data = {
      branches: [
        { name: 'old-thing', age: 60 * 86400, staleDays: 60, merged: true, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatText(data);
    assert.ok(out.includes('1 stale branch'));
  });
  it('handles null merged (no-merge-check mode)', () => {
    const data = {
      branches: [
        { name: 'mystery', age: 60 * 86400, staleDays: 60, merged: null, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatText(data);
    assert.ok(out.includes('mystery'));
    assert.ok(out.includes('?'));
  });
});

describe('formatJSON', () => {
  it('outputs valid JSON', () => {
    const data = { branches: [{ name: 'test', age: 100, staleDays: 0, merged: true }], defaultBranch: 'main' };
    const out = formatJSON(data);
    const parsed = JSON.parse(out);
    assert.equal(parsed.branches.length, 1);
    assert.equal(parsed.branches[0].name, 'test');
  });
  it('outputs empty branches array', () => {
    const data = { branches: [], defaultBranch: 'main' };
    const out = formatJSON(data);
    const parsed = JSON.parse(out);
    assert.equal(parsed.branches.length, 0);
  });
  it('includes all branch fields', () => {
    const data = { branches: [{ name: 'feat', age: 5000, staleDays: 0, merged: false, upstream: 'origin/feat' }], defaultBranch: 'main' };
    const out = formatJSON(data);
    const parsed = JSON.parse(out);
    const b = parsed.branches[0];
    assert.equal(b.name, 'feat');
    assert.equal(b.age, 5000);
    assert.equal(b.merged, false);
    assert.equal(b.upstream, 'origin/feat');
  });
});

describe('formatMarkdown', () => {
  it('shows clean message when no stale branches', () => {
    const out = formatMarkdown({ branches: [], defaultBranch: 'main' });
    assert.ok(out.includes('No stale branches'));
  });
  it('renders markdown table', () => {
    const data = {
      branches: [
        { name: 'feat-x', age: 30 * 86400, staleDays: 30, merged: true, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatMarkdown(data);
    assert.ok(out.includes('feat-x'));
    assert.ok(out.includes('|'));
    assert.ok(out.includes('Safe to delete'));
  });
  it('renders multiple branches with counts', () => {
    const data = {
      branches: [
        { name: 'a', age: 30 * 86400, staleDays: 30, merged: true, upstream: null },
        { name: 'b', age: 60 * 86400, staleDays: 60, merged: false, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatMarkdown(data);
    assert.ok(out.includes('2'));
    assert.ok(out.includes('1'));
  });
});

describe('HELP', () => {
  it('includes usage info', () => {
    assert.ok(HELP.includes('git-stale'));
    assert.ok(HELP.includes('--older-than'));
    assert.ok(HELP.includes('--prune'));
    assert.ok(HELP.includes('--json'));
    assert.ok(HELP.includes('--markdown'));
  });
  it('includes --version flag', () => {
    assert.ok(HELP.includes('--version'));
    assert.ok(HELP.includes('-V'));
  });
  it('includes --no-merge-check', () => {
    assert.ok(HELP.includes('--no-merge-check'));
  });
});

describe('isMerged', () => {
  it('returns false for non-existent branch', () => {
    // Non-existent branch in a real repo should return false
    const result = isMerged('nonexistent-branch-xyz', 'main', process.cwd());
    assert.equal(result, false);
  });
});

describe('analyze', () => {
  it('returns structure with branches array and defaultBranch', () => {
    const result = analyze(process.cwd(), { olderThan: 0, includeMerged: true });
    assert.ok(Array.isArray(result.branches));
    assert.ok(typeof result.defaultBranch === 'string');
  });
  it('respects olderThan filter', () => {
    // With a very high olderThan, should get very few or no branches
    const result = analyze(process.cwd(), { olderThan: 99999, includeMerged: true });
    assert.ok(result.branches.length === 0 || result.branches.every(b => b.staleDays >= 99999));
  });
});
