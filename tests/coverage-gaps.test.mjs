import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyze, formatAge, parseArgs, formatText, formatMarkdown,
  getBranches, getDefaultBranch, getBranchAge, runGit
} from '../src/index.js';

// ─── Helpers: create temp git repos ───

function createTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstest-'));
  execFileSync('git', ['init', '-b', 'main', dir], { stdio: 'pipe' });
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@test.com'], { stdio: 'pipe' });
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test'], { stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'file.txt'), 'content');
  execFileSync('git', ['-C', dir, 'add', '.'], { stdio: 'pipe' });
  execFileSync('git', ['-C', dir, 'commit', '-m', 'initial'], { stdio: 'pipe' });
  return dir;
}

function makeCommit(dir, filename, content, msg) {
  fs.writeFileSync(path.join(dir, filename), content);
  execFileSync('git', ['-C', dir, 'add', '.'], { stdio: 'pipe' });
  execFileSync('git', ['-C', dir, 'commit', '-m', msg], { stdio: 'pipe' });
}

function makeBranch(dir, name, commitInfo) {
  execFileSync('git', ['-C', dir, 'checkout', '-b', name], { stdio: 'pipe' });
  if (commitInfo) makeCommit(dir, commitInfo.file, commitInfo.content, commitInfo.msg);
  execFileSync('git', ['-C', dir, 'checkout', 'main'], { stdio: 'pipe' });
}

// Use spawnSync to avoid pipe deadlocks with nested execFileSync
function runCli(args, repoDir) {
  const result = spawnSync(process.execPath, ['cli.js', '--repo', repoDir, ...args], {
    encoding: 'utf-8',
    cwd: path.join(import.meta.dirname, '..'),
    timeout: 10000,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

// ─── getDefaultBranch: cover fallback to 'main' (line 37) ───

describe('getDefaultBranch coverage gaps', () => {
  it('returns "main" when no standard branch exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstest-'));
    execFileSync('git', ['init', '-b', 'custom', dir], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@test.com'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test'], { stdio: 'pipe' });
    fs.writeFileSync(path.join(dir, 'f.txt'), 'x');
    execFileSync('git', ['-C', dir, 'add', '.'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'commit', '-m', 'init'], { stdio: 'pipe' });
    assert.equal(getDefaultBranch(dir), 'main');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects master as default branch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstest-'));
    execFileSync('git', ['init', '-b', 'master', dir], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@test.com'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test'], { stdio: 'pipe' });
    fs.writeFileSync(path.join(dir, 'f.txt'), 'x');
    execFileSync('git', ['-C', dir, 'add', '.'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'commit', '-m', 'init'], { stdio: 'pipe' });
    assert.equal(getDefaultBranch(dir), 'master');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects trunk as default branch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstest-'));
    execFileSync('git', ['init', '-b', 'trunk', dir], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@test.com'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test'], { stdio: 'pipe' });
    fs.writeFileSync(path.join(dir, 'f.txt'), 'x');
    execFileSync('git', ['-C', dir, 'add', '.'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'commit', '-m', 'init'], { stdio: 'pipe' });
    assert.equal(getDefaultBranch(dir), 'trunk');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects develop as default branch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstest-'));
    execFileSync('git', ['init', '-b', 'develop', dir], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@test.com'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test'], { stdio: 'pipe' });
    fs.writeFileSync(path.join(dir, 'f.txt'), 'x');
    execFileSync('git', ['-C', dir, 'add', '.'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'commit', '-m', 'init'], { stdio: 'pipe' });
    assert.equal(getDefaultBranch(dir), 'develop');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─── getBranchAge: cover null output (lines 43-45) ───

describe('getBranchAge coverage gaps', () => {
  it('returns null for non-existent branch', () => {
    const dir = createTempRepo();
    assert.equal(getBranchAge('nonexistent-branch-xyz', dir), null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns numeric age for valid branch with commits', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'feature-test', { file: 'feat.txt', content: 'x', msg: 'feat' });
    const age = getBranchAge('feature-test', dir);
    assert.equal(typeof age, 'number');
    assert.ok(age >= 0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─── runGit: cover error path directly ───

describe('runGit coverage gaps', () => {
  it('returns null for invalid git command', () => {
    assert.equal(runGit(['not-a-real-command'], process.cwd()), null);
  });

  it('returns null for non-existent directory', () => {
    assert.equal(runGit(['status'], '/nonexistent/path/xyz'), null);
  });

  it('returns trimmed output for valid command', () => {
    const dir = createTempRepo();
    assert.equal(runGit(['branch', '--show-current'], dir), 'main');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─── getBranches: cover empty repo and parsing ───

describe('getBranches coverage gaps', () => {
  it('returns empty array for repo with no commits', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstest-'));
    execFileSync('git', ['init', '-b', 'main', dir], { stdio: 'pipe' });
    assert.deepEqual(getBranches(dir), []);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('parses upstream tracking info', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'tracked', { file: 't.txt', content: 'x', msg: 't' });
    execFileSync('git', ['-C', dir, 'config', 'branch.tracked.remote', 'origin'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'config', 'branch.tracked.merge', 'refs/heads/tracked'], { stdio: 'pipe' });
    const branches = getBranches(dir);
    const tracked = branches.find(b => b.name === 'tracked');
    assert.ok(tracked);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─── analyze: edge cases ───

describe('analyze coverage gaps', () => {
  it('excludes current branch from results', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'stale', { file: 's.txt', content: 'x', msg: 's' });
    const result = analyze(dir, { olderThan: 0, includeMerged: true });
    assert.ok(!result.branches.find(b => b.name === 'main'));
    assert.ok(!result.branches.find(b => b.name === result.current));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('excludes default branch from results', () => {
    const dir = createTempRepo();
    const result = analyze(dir, { olderThan: 0, includeMerged: true });
    assert.ok(!result.branches.find(b => b.name === result.defaultBranch));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('filters out unmerged branches when includeMerged=false', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'merged', { file: 'm.txt', content: 'x', msg: 'm' });
    execFileSync('git', ['-C', dir, 'merge', 'merged'], { stdio: 'pipe' });
    makeBranch(dir, 'unmerged', { file: 'u.txt', content: 'x', msg: 'u' });
    const result = analyze(dir, { olderThan: 0, includeMerged: false });
    assert.ok(result.branches.find(b => b.name === 'merged'));
    assert.ok(!result.branches.find(b => b.name === 'unmerged'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('respects noMergeCheck option (merged is null)', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'branch-a', { file: 'a.txt', content: 'x', msg: 'a' });
    const result = analyze(dir, { olderThan: 0, noMergeCheck: true });
    assert.equal(result.branches[0].merged, null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('sorts branches by age descending', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'older', { file: 'o.txt', content: 'x', msg: 'o' });
    makeBranch(dir, 'newer', { file: 'n.txt', content: 'x', msg: 'n' });
    const result = analyze(dir, { olderThan: 0, includeMerged: true });
    assert.ok(result.branches.length >= 2);
    for (let i = 1; i < result.branches.length; i++) {
      assert.ok(result.branches[i - 1].age >= result.branches[i].age);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('filters by olderThan correctly', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'recent', { file: 'r.txt', content: 'x', msg: 'r' });
    const result = analyze(dir, { olderThan: 99999, includeMerged: true });
    assert.equal(result.branches.length, 0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─── CLI integration tests (using spawnSync to avoid pipe deadlocks) ───

describe('CLI integration', () => {
  let repoDir;

  before(() => {
    repoDir = createTempRepo();
    makeBranch(repoDir, 'stale-merged', { file: 'sm.txt', content: 'x', msg: 'sm' });
    execFileSync('git', ['-C', repoDir, 'merge', 'stale-merged'], { stdio: 'pipe' });
    makeBranch(repoDir, 'stale-unmerged', { file: 'su.txt', content: 'x', msg: 'su' });
  });

  after(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('shows --version', () => {
    const { stdout } = runCli(['--version'], repoDir);
    assert.ok(/^\d+\.\d+\.\d+/.test(stdout.trim()));
  });

  it('shows -V (short version flag)', () => {
    const { stdout } = runCli(['-V'], repoDir);
    assert.ok(stdout.trim().length > 0);
  });

  it('shows --help', () => {
    const { stdout } = runCli(['--help'], repoDir);
    assert.ok(stdout.includes('git-stale'));
    assert.ok(stdout.includes('USAGE'));
  });

  it('shows -h (short help flag)', () => {
    const { stdout } = runCli(['-h'], repoDir);
    assert.ok(stdout.includes('git-stale'));
  });

  it('outputs text format by default', () => {
    const { stdout } = runCli(['--include-unmerged'], repoDir);
    assert.ok(stdout.includes('Stale branches') || stdout.includes('No stale branches'));
  });

  it('outputs JSON format', () => {
    const { stdout } = runCli(['--json', '--include-unmerged'], repoDir);
    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed.branches));
    assert.ok(typeof parsed.defaultBranch === 'string');
  });

  it('outputs Markdown format', () => {
    const { stdout } = runCli(['--markdown', '--include-unmerged'], repoDir);
    assert.ok(stdout.includes('|') || stdout.includes('No stale branches'));
  });

  it('respects --older-than filter', () => {
    const { stdout } = runCli(['--older-than', '99999d', '--include-unmerged', '--json'], repoDir);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.branches.length, 0);
  });

  it('filters unmerged by default (only shows merged)', () => {
    const { stdout } = runCli(['--json'], repoDir);
    const parsed = JSON.parse(stdout);
    assert.ok(!parsed.branches.find(b => b.name === 'stale-unmerged'));
  });

  it('shows unmerged with --include-unmerged', () => {
    const { stdout } = runCli(['--json', '--include-unmerged'], repoDir);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.branches.find(b => b.name === 'stale-unmerged'));
  });

  it('exits with code 1 when safe-to-delete branches exist', () => {
    const { status } = runCli([], repoDir);
    assert.equal(status, 1); // merged branches present → exit 1
  });

  it('exits with code 0 when no safe-to-delete branches', () => {
    // Use --include-unmerged but no merged branches in output by default
    // Create a fresh repo with only unmerged branches
    const dir = createTempRepo();
    makeBranch(dir, 'only-unmerged', { file: 'ou.txt', content: 'x', msg: 'ou' });
    const { status } = runCli([], dir);
    assert.equal(status, 0); // no merged branches → exit 0
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('outputs no stale branches message for clean repo', () => {
    const dir = createTempRepo();
    const { stdout } = runCli([], dir);
    assert.ok(stdout.includes('No stale branches'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('prunes merged branches with --prune', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'to-prune', { file: 'tp.txt', content: 'x', msg: 'tp' });
    execFileSync('git', ['-C', dir, 'merge', 'to-prune'], { stdio: 'pipe' });
    const { stdout } = runCli(['--prune'], dir);
    assert.ok(stdout.includes('deleted') || stdout.includes('Pruned'));
    // Verify branch was actually deleted
    const branches = execFileSync('git', ['-C', dir, 'branch', '--format=%(refname:short)'], { encoding: 'utf-8', stdio: 'pipe' }).trim();
    assert.ok(!branches.includes('to-prune'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('shows no-prune message when nothing to prune', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'only-unmerged', { file: 'ou.txt', content: 'x', msg: 'ou' });
    const { stdout } = runCli(['--prune'], dir);
    assert.ok(stdout.includes('No merged stale branches'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('prunes correct count for multiple merged branches', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'merged1', { file: 'm1.txt', content: 'x', msg: 'm1' });
    execFileSync('git', ['-C', dir, 'merge', 'merged1'], { stdio: 'pipe' });
    makeBranch(dir, 'merged2', { file: 'm2.txt', content: 'x', msg: 'm2' });
    execFileSync('git', ['-C', dir, 'merge', 'merged2'], { stdio: 'pipe' });
    const { stdout } = runCli(['--prune'], dir);
    assert.ok(stdout.includes('Pruned 2'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('outputs markdown format from CLI', () => {
    const { stdout } = runCli(['--markdown', '--include-unmerged'], repoDir);
    assert.ok(stdout.includes('|') || stdout.includes('No stale'))
  });

  it('handles --no-merge-check flag from CLI', () => {
    const { stdout } = runCli(['--no-merge-check', '--json'], repoDir);
    const parsed = JSON.parse(stdout);
    // With noMergeCheck, all old branches should appear with merged=null
    for (const b of parsed.branches) {
      assert.equal(b.merged, null);
    }
  });
});

// ─── formatText edge cases ───

describe('formatText additional edge cases', () => {
  it('renders upstream info in text output', () => {
    const data = {
      branches: [
        { name: 'feat', age: 86400, staleDays: 1, merged: false, upstream: 'origin/feat' },
      ],
      defaultBranch: 'main',
    };
    const out = formatText(data);
    assert.ok(out.includes('feat'));
    assert.ok(out.includes('unmerged work'));
  });

  it('handles branch with staleDays exactly 0 (today)', () => {
    const data = {
      branches: [
        { name: 'fresh', age: 0, staleDays: 0, merged: true, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatText(data);
    assert.ok(out.includes('fresh'));
    assert.ok(out.includes('today'));
  });
});

// ─── formatMarkdown edge cases ───

describe('formatMarkdown additional edge cases', () => {
  it('handles null merged in markdown table', () => {
    const data = {
      branches: [
        { name: 'mystery', age: 86400 * 10, staleDays: 10, merged: null, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatMarkdown(data);
    assert.ok(out.includes('mystery'));
    assert.ok(out.includes('?'));
  });

  it('handles all merged branches (safe count equals total)', () => {
    const data = {
      branches: [
        { name: 'a', age: 86400 * 30, staleDays: 30, merged: true, upstream: null },
        { name: 'b', age: 86400 * 60, staleDays: 60, merged: true, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatMarkdown(data);
    assert.ok(out.includes('2') && out.includes('safe to delete'));
  });
});

// ─── parseArgs: additional edge cases ───

describe('parseArgs additional edge cases', () => {
  it('handles --repo with path containing spaces', () => {
    const opts = parseArgs(['node', 'cli.js', '--repo', '/path/with spaces/repo']);
    assert.equal(opts.repo, '/path/with spaces/repo');
  });

  it('handles --prune flag combined with other flags', () => {
    const opts = parseArgs(['node', 'cli.js', '--prune', '--older-than', '30d', '--json']);
    assert.equal(opts.prune, true);
    assert.equal(opts.olderThan, 30);
    assert.equal(opts.format, 'json');
  });

  it('does not set prune for unrelated flags', () => {
    const opts = parseArgs(['node', 'cli.js', '--json']);
    assert.equal(opts.prune, false);
  });

  it('handles multiple unknown flags', () => {
    const opts = parseArgs(['node', 'cli.js', '--foo', '--bar', '--baz']);
    assert.equal(opts.format, 'text');
  });

  it('handles --older-than with uppercase unit (invalid)', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', '30D']);
    assert.equal(opts.olderThan, 0);
  });

  it('handles --older-than with just unit (no number)', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', 'd']);
    assert.equal(opts.olderThan, 0);
  });

  it('handles --older-than 0d (zero days)', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', '0d']);
    assert.equal(opts.olderThan, 0);
  });

  it('handles --older-than 0 (bare zero)', () => {
    const opts = parseArgs(['node', 'cli.js', '--older-than', '0']);
    assert.equal(opts.olderThan, 0);
  });
});

// ─── formatAge additional edge cases ───

describe('formatAge additional edge cases', () => {
  it('handles very large numbers', () => {
    const result = formatAge(86400 * 365 * 100);
    assert.ok(result.includes('years'));
  });

  it('handles 29 days (just under month threshold)', () => {
    assert.equal(formatAge(29 * 86400), '29 days ago');
  });

  it('handles exactly 30 days (month boundary)', () => {
    assert.equal(formatAge(30 * 86400), '1 month ago');
  });

  it('handles 364 days (just under year)', () => {
    assert.equal(formatAge(364 * 86400), '12 months ago');
  });
});
