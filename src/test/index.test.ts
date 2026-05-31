import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  detectDefaultBranch,
  getBranches,
  isMerged,
  getAheadBehind,
  formatTable,
  formatJSON,
  formatMarkdown,
  formatCleanup,
  StaleResult,
  StaleConfig,
} from "../index.js";
import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "git-stale-test-"));
  execSync(`git init -b main`, { cwd: dir, stdio: "pipe" });
  execSync(`git config user.email "test@test.com"`, { cwd: dir, stdio: "pipe" });
  execSync(`git config user.name "Test"`, { cwd: dir, stdio: "pipe" });
  execSync(`echo "# test" > README.md`, { cwd: dir, stdio: "pipe" });
  execSync(`git add . && git commit -m "init"`, { cwd: dir, stdio: "pipe" });
  return dir;
}

function makeBranch(dir: string, name: string, daysAgo = 0) {
  const dateStr = new Date(Date.now() - daysAgo * 86400000).toISOString();
  execSync(`git checkout -b ${name}`, { cwd: dir, stdio: "pipe" });
  execSync(`echo "${name}" > ${name}.txt`, { cwd: dir, stdio: "pipe" });
  execSync(`git add .`, { cwd: dir, stdio: "pipe" });
  execSync(`git commit -m "branch ${name}" --date="${dateStr}"`, {
    cwd: dir,
    stdio: "pipe",
    env: { ...process.env, GIT_AUTHOR_DATE: dateStr, GIT_COMMITTER_DATE: dateStr },
  });
  execSync(`git checkout main`, { cwd: dir, stdio: "pipe" });
}

describe("git-stale", () => {
  it("detects default branch", () => {
    const dir = makeRepo();
    const branch = detectDefaultBranch(dir);
    assert.equal(branch, "main");
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists local branches", () => {
    const dir = makeRepo();
    makeBranch(dir, "feature-a");
    const branches = getBranches(dir, false);
    assert.equal(branches.length, 2);
    assert.equal(branches.some((b: any) => b.name === "main"), true);
    assert.equal(branches.some((b: any) => b.name === "feature-a"), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("detects merged branches", () => {
    const dir = makeRepo();
    makeBranch(dir, "merged-branch");
    // Merge it
    execSync(`git merge merged-branch`, { cwd: dir, stdio: "pipe" });
    const merged = isMerged("merged-branch", "main", dir);
    assert.equal(merged, true);

    makeBranch(dir, "unmerged-branch");
    const unmerged = isMerged("unmerged-branch", "main", dir);
    assert.equal(unmerged, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("gets ahead/behind counts", () => {
    const dir = makeRepo();
    makeBranch(dir, "ahead-branch");
    const ab = getAheadBehind("ahead-branch", "main", dir);
    assert.equal(ab.ahead, 1);
    assert.equal(ab.behind, 0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("analyzes branches with stale detection", () => {
    const dir = makeRepo();
    makeBranch(dir, "fresh-branch", 5);
    makeBranch(dir, "stale-branch", 45);

    const result = analyze({ repoPath: dir, staleDays: 30, ancientDays: 90 });
    assert.equal(result.defaultBranch, "main");
    assert.equal(result.branches.length, 2);
    assert.equal(result.staleCount, 1);
    assert.equal(result.ancientCount, 0);

    const stale = result.branches.find((b) => b.name === "stale-branch");
    assert.ok(stale);
    assert.equal(stale!.isMerged, false);
    assert.ok(stale!.daysSinceLastCommit >= 40);
    rmSync(dir, { recursive: true, force: true });
  });

  it("respects exclude patterns", () => {
    const dir = makeRepo();
    makeBranch(dir, "feature-a");
    makeBranch(dir, "feature-b");
    makeBranch(dir, "hotfix-c");

    const result = analyze({
      repoPath: dir,
      exclude: ["feature-*"],
    });
    assert.equal(result.branches.length, 1);
    assert.equal(result.branches[0].name, "hotfix-c");
    rmSync(dir, { recursive: true, force: true });
  });

  it("filters merged only", () => {
    const dir = makeRepo();
    makeBranch(dir, "merged-one");
    execSync(`git merge merged-one`, { cwd: dir, stdio: "pipe" });
    makeBranch(dir, "unmerged-one");

    const result = analyze({ repoPath: dir, mergedOnly: true });
    assert.equal(result.branches.every((b: any) => b.isMerged), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("filters unmerged only", () => {
    const dir = makeRepo();
    makeBranch(dir, "merged-one");
    execSync(`git merge merged-one`, { cwd: dir, stdio: "pipe" });
    makeBranch(dir, "unmerged-one");

    const result = analyze({ repoPath: dir, unmergedOnly: true });
    assert.equal(result.branches.every((b: any) => !b.isMerged), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("formats table output", () => {
    const dir = makeRepo();
    makeBranch(dir, "test-branch", 10);
    const result = analyze({ repoPath: dir });
    const cfg: StaleConfig = {
      staleDays: 30, ancientDays: 90, defaultBranch: "main",
      remote: false, exclude: [], mergedOnly: false, unmergedOnly: false, repoPath: dir,
    };
    const table = formatTable(result, cfg);
    assert.ok(table.includes("test-branch"));
    assert.ok(table.includes("Total:"));
    rmSync(dir, { recursive: true, force: true });
  });

  it("formats JSON output", () => {
    const dir = makeRepo();
    makeBranch(dir, "json-branch", 10);
    const result = analyze({ repoPath: dir });
    const json = formatJSON(result);
    const parsed = JSON.parse(json);
    assert.ok(parsed.branches);
    assert.equal(parsed.defaultBranch, "main");
    rmSync(dir, { recursive: true, force: true });
  });

  it("formats markdown output", () => {
    const dir = makeRepo();
    makeBranch(dir, "md-branch", 10);
    const result = analyze({ repoPath: dir });
    const cfg: StaleConfig = {
      staleDays: 30, ancientDays: 90, defaultBranch: "main",
      remote: false, exclude: [], mergedOnly: false, unmergedOnly: false, repoPath: dir,
    };
    const md = formatMarkdown(result, cfg);
    assert.ok(md.includes("# Git Stale Branch Report"));
    assert.ok(md.includes("md-branch"));
    rmSync(dir, { recursive: true, force: true });
  });

  it("formatCleanup shows safe-to-delete merged branches", () => {
    const dir = makeRepo();
    makeBranch(dir, "old-merged", 45);
    execSync(`git merge old-merged`, { cwd: dir, stdio: "pipe" });
    makeBranch(dir, "old-unmerged", 45);

    const result = analyze({ repoPath: dir, staleDays: 30 });
    const cfg: StaleConfig = {
      staleDays: 30, ancientDays: 90, defaultBranch: "main",
      remote: false, exclude: [], mergedOnly: false, unmergedOnly: false, repoPath: dir,
    };
    const cleanup = formatCleanup(result, cfg);
    assert.ok(cleanup.includes("old-merged"));
    assert.ok(!cleanup.includes("old-unmerged"));
    rmSync(dir, { recursive: true, force: true });
  });

  it("handles empty repo gracefully", () => {
    const dir = makeRepo();
    const result = analyze({ repoPath: dir });
    assert.equal(result.branches.length, 0);
    const cfg: StaleConfig = {
      staleDays: 30, ancientDays: 90, defaultBranch: "main",
      remote: false, exclude: [], mergedOnly: false, unmergedOnly: false, repoPath: dir,
    };
    const table = formatTable(result, cfg);
    assert.ok(table.includes("No branches found"));
    rmSync(dir, { recursive: true, force: true });
  });

  it("ancient detection works", () => {
    const dir = makeRepo();
    makeBranch(dir, "ancient-branch", 120);

    const result = analyze({ repoPath: dir, staleDays: 30, ancientDays: 90 });
    assert.equal(result.ancientCount, 1);
    rmSync(dir, { recursive: true, force: true });
  });
});
