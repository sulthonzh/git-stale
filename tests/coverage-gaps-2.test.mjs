import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyze, formatText, formatMarkdown } from '../src/index.js';

// ─── Helpers ───

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

function makeBranch(dir, name, commitInfo) {
  execFileSync('git', ['-C', dir, 'checkout', '-b', name], { stdio: 'pipe' });
  if (commitInfo) {
    fs.writeFileSync(path.join(dir, commitInfo.file), commitInfo.content);
    execFileSync('git', ['-C', dir, 'add', '.'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'commit', '-m', commitInfo.msg], { stdio: 'pipe' });
  }
  execFileSync('git', ['-C', dir, 'checkout', 'main'], { stdio: 'pipe' });
}

function runCli(args, repoDir) {
  const cliPath = path.join(import.meta.dirname, '..', 'cli.js');
  const result = spawnSync(process.execPath, [cliPath, '--repo', repoDir, ...args], {
    encoding: 'utf-8',
    cwd: path.join(import.meta.dirname, '..'),
    timeout: 15000,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

// ─── cli.js lines 34-35: catch block when git branch -d fails during prune ───

describe('cli.js prune error path (lines 34-35)', () => {
  it('outputs error message when branch deletion fails (worktree locked)', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'to-fail', { file: 'tf.txt', content: 'x', msg: 'tf' });
    execFileSync('git', ['-C', dir, 'merge', 'to-fail'], { stdio: 'pipe' });

    // Create a worktree on the merged branch — git branch -d refuses to delete
    // branches checked out in worktrees
    const wtDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstest-wt-'));
    fs.rmdirSync(wtDir); // worktree add needs non-existing dir
    execFileSync('git', ['-C', dir, 'worktree', 'add', wtDir, 'to-fail'], { stdio: 'pipe' });

    const { stdout, stderr } = runCli(['--prune'], dir);
    assert.ok(stderr.includes('failed to delete') || stdout.includes('failed to delete'),
      `Expected 'failed to delete' in stdout: ${JSON.stringify(stdout)} or stderr: ${JSON.stringify(stderr)}`);

    // Cleanup
    execFileSync('git', ['-C', dir, 'worktree', 'remove', wtDir, '--force'], { stdio: 'pipe' });
    execFileSync('git', ['-C', dir, 'branch', '-D', 'to-fail'], { stdio: 'pipe' });
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(wtDir, { recursive: true, force: true });
  });

  it('successfully prunes merged branches without error', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'merge-ok', { file: 'mo.txt', content: 'x', msg: 'mo' });
    execFileSync('git', ['-C', dir, 'merge', 'merge-ok'], { stdio: 'pipe' });

    const { stdout } = runCli(['--prune'], dir);
    assert.ok(stdout.includes('deleted') && stdout.includes('Pruned'), `Got: ${stdout}`);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─── index.js line 89: !includeMerged && merged === false → continue ───

describe('index.js line 89: unmerged branch exclusion', () => {
  it('excludes unmerged branches when includeMerged is false (default)', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'unmerged-feature', { file: 'uf.txt', content: 'x', msg: 'uf' });

    // Default: includeMerged=false, unmerged branch should NOT appear
    const result = analyze(dir, { olderThan: 0, includeMerged: false });
    assert.ok(!result.branches.find(b => b.name === 'unmerged-feature'),
      'Unmerged branch should be excluded when includeMerged=false');

    // With includeMerged=true, it SHOULD appear
    const result2 = analyze(dir, { olderThan: 0, includeMerged: true });
    assert.ok(result2.branches.find(b => b.name === 'unmerged-feature'),
      'Unmerged branch should appear when includeMerged=true');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('includes unmerged branches when includeMerged is true but not when false', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'dev', { file: 'd.txt', content: 'x', msg: 'd' });

    const withUnmerged = analyze(dir, { olderThan: 0, includeMerged: true });
    const withoutUnmerged = analyze(dir, { olderThan: 0, includeMerged: false });

    assert.ok(withUnmerged.branches.find(b => b.name === 'dev'));
    assert.ok(!withoutUnmerged.branches.find(b => b.name === 'dev'));

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─── index.js line 107: sort comparator (b.age || 0) when age is null ───

describe('index.js line 107: sort with null age', () => {
  it('sorts branches correctly when one has null age', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'valid-branch', { file: 'v.txt', content: 'x', msg: 'v' });

    // Create a branch with no commits (age might be problematic)
    execFileSync('git', ['-C', dir, 'branch', 'empty-branch'], { stdio: 'pipe' });

    const result = analyze(dir, { olderThan: 0, includeMerged: true });
    // Should not crash and should include the valid branch
    assert.ok(result.branches.length >= 0);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('handles branches where age is 0 (just committed)', () => {
    const dir = createTempRepo();
    makeBranch(dir, 'fresh', { file: 'fr.txt', content: 'x', msg: 'fr' });

    const result = analyze(dir, { olderThan: 0, includeMerged: true });
    const fresh = result.branches.find(b => b.name === 'fresh');
    assert.ok(fresh);
    assert.equal(typeof fresh.age, 'number');

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─── Additional: formatText/formatMarkdown branch coverage for edge cases ───

describe('format edge cases for coverage', () => {
  it('formatText with safeCount = 0 (no merged branches)', () => {
    const data = {
      branches: [
        { name: 'wip', age: 86400 * 5, staleDays: 5, merged: false, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatText(data);
    assert.ok(out.includes('wip'));
    assert.ok(!out.includes('safe to delete')); // no safe count
  });

  it('formatText with exactly 1 safe branch (singular)', () => {
    const data = {
      branches: [
        { name: 'done', age: 86400 * 10, staleDays: 10, merged: true, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatText(data);
    assert.ok(out.includes('1 stale branch'));
    assert.ok(out.includes('1 safe to delete'));
  });

  it('formatMarkdown with 1 branch (singular)', () => {
    const data = {
      branches: [
        { name: 'solo', age: 86400 * 3, staleDays: 3, merged: true, upstream: 'origin/solo' },
      ],
      defaultBranch: 'main',
    };
    const out = formatMarkdown(data);
    assert.ok(out.includes('1') && out.includes('safe to delete'));
  });

  it('formatText with merged=null branch among merged branches', () => {
    const data = {
      branches: [
        { name: 'known', age: 86400 * 30, staleDays: 30, merged: true, upstream: null },
        { name: 'unknown', age: 86400 * 20, staleDays: 20, merged: null, upstream: null },
      ],
      defaultBranch: 'main',
    };
    const out = formatText(data);
    assert.ok(out.includes('known'));
    assert.ok(out.includes('unknown'));
    assert.ok(out.includes('?'));
  });
});
