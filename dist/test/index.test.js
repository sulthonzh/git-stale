"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const index_js_1 = require("../index.js");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
function makeRepo() {
    const dir = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "git-stale-test-"));
    (0, child_process_1.execSync)(`git init -b main`, { cwd: dir, stdio: "pipe" });
    (0, child_process_1.execSync)(`git config user.email "test@test.com"`, { cwd: dir, stdio: "pipe" });
    (0, child_process_1.execSync)(`git config user.name "Test"`, { cwd: dir, stdio: "pipe" });
    (0, child_process_1.execSync)(`echo "# test" > README.md`, { cwd: dir, stdio: "pipe" });
    (0, child_process_1.execSync)(`git add . && git commit -m "init"`, { cwd: dir, stdio: "pipe" });
    return dir;
}
function makeBranch(dir, name, daysAgo = 0) {
    const dateStr = new Date(Date.now() - daysAgo * 86400000).toISOString();
    (0, child_process_1.execSync)(`git checkout -b ${name}`, { cwd: dir, stdio: "pipe" });
    (0, child_process_1.execSync)(`echo "${name}" > ${name}.txt`, { cwd: dir, stdio: "pipe" });
    (0, child_process_1.execSync)(`git add .`, { cwd: dir, stdio: "pipe" });
    (0, child_process_1.execSync)(`git commit -m "branch ${name}" --date="${dateStr}"`, {
        cwd: dir,
        stdio: "pipe",
        env: { ...process.env, GIT_AUTHOR_DATE: dateStr, GIT_COMMITTER_DATE: dateStr },
    });
    (0, child_process_1.execSync)(`git checkout main`, { cwd: dir, stdio: "pipe" });
}
(0, node_test_1.describe)("git-stale", () => {
    (0, node_test_1.it)("detects default branch", () => {
        const dir = makeRepo();
        const branch = (0, index_js_1.detectDefaultBranch)(dir);
        strict_1.default.equal(branch, "main");
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("lists local branches", () => {
        const dir = makeRepo();
        makeBranch(dir, "feature-a");
        const branches = (0, index_js_1.getBranches)(dir, false);
        strict_1.default.equal(branches.length, 2);
        strict_1.default.equal(branches.some((b) => b.name === "main"), true);
        strict_1.default.equal(branches.some((b) => b.name === "feature-a"), true);
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("detects merged branches", () => {
        const dir = makeRepo();
        makeBranch(dir, "merged-branch");
        // Merge it
        (0, child_process_1.execSync)(`git merge merged-branch`, { cwd: dir, stdio: "pipe" });
        const merged = (0, index_js_1.isMerged)("merged-branch", "main", dir);
        strict_1.default.equal(merged, true);
        makeBranch(dir, "unmerged-branch");
        const unmerged = (0, index_js_1.isMerged)("unmerged-branch", "main", dir);
        strict_1.default.equal(unmerged, false);
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("gets ahead/behind counts", () => {
        const dir = makeRepo();
        makeBranch(dir, "ahead-branch");
        const ab = (0, index_js_1.getAheadBehind)("ahead-branch", "main", dir);
        strict_1.default.equal(ab.ahead, 1);
        strict_1.default.equal(ab.behind, 0);
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("analyzes branches with stale detection", () => {
        const dir = makeRepo();
        makeBranch(dir, "fresh-branch", 5);
        makeBranch(dir, "stale-branch", 45);
        const result = (0, index_js_1.analyze)({ repoPath: dir, staleDays: 30, ancientDays: 90 });
        strict_1.default.equal(result.defaultBranch, "main");
        strict_1.default.equal(result.branches.length, 2);
        strict_1.default.equal(result.staleCount, 1);
        strict_1.default.equal(result.ancientCount, 0);
        const stale = result.branches.find((b) => b.name === "stale-branch");
        strict_1.default.ok(stale);
        strict_1.default.equal(stale.isMerged, false);
        strict_1.default.ok(stale.daysSinceLastCommit >= 40);
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("respects exclude patterns", () => {
        const dir = makeRepo();
        makeBranch(dir, "feature-a");
        makeBranch(dir, "feature-b");
        makeBranch(dir, "hotfix-c");
        const result = (0, index_js_1.analyze)({
            repoPath: dir,
            exclude: ["feature-*"],
        });
        strict_1.default.equal(result.branches.length, 1);
        strict_1.default.equal(result.branches[0].name, "hotfix-c");
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("filters merged only", () => {
        const dir = makeRepo();
        makeBranch(dir, "merged-one");
        (0, child_process_1.execSync)(`git merge merged-one`, { cwd: dir, stdio: "pipe" });
        makeBranch(dir, "unmerged-one");
        const result = (0, index_js_1.analyze)({ repoPath: dir, mergedOnly: true });
        strict_1.default.equal(result.branches.every((b) => b.isMerged), true);
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("filters unmerged only", () => {
        const dir = makeRepo();
        makeBranch(dir, "merged-one");
        (0, child_process_1.execSync)(`git merge merged-one`, { cwd: dir, stdio: "pipe" });
        makeBranch(dir, "unmerged-one");
        const result = (0, index_js_1.analyze)({ repoPath: dir, unmergedOnly: true });
        strict_1.default.equal(result.branches.every((b) => !b.isMerged), true);
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("formats table output", () => {
        const dir = makeRepo();
        makeBranch(dir, "test-branch", 10);
        const result = (0, index_js_1.analyze)({ repoPath: dir });
        const cfg = {
            staleDays: 30, ancientDays: 90, defaultBranch: "main",
            remote: false, exclude: [], mergedOnly: false, unmergedOnly: false, repoPath: dir,
        };
        const table = (0, index_js_1.formatTable)(result, cfg);
        strict_1.default.ok(table.includes("test-branch"));
        strict_1.default.ok(table.includes("Total:"));
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("formats JSON output", () => {
        const dir = makeRepo();
        makeBranch(dir, "json-branch", 10);
        const result = (0, index_js_1.analyze)({ repoPath: dir });
        const json = (0, index_js_1.formatJSON)(result);
        const parsed = JSON.parse(json);
        strict_1.default.ok(parsed.branches);
        strict_1.default.equal(parsed.defaultBranch, "main");
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("formats markdown output", () => {
        const dir = makeRepo();
        makeBranch(dir, "md-branch", 10);
        const result = (0, index_js_1.analyze)({ repoPath: dir });
        const cfg = {
            staleDays: 30, ancientDays: 90, defaultBranch: "main",
            remote: false, exclude: [], mergedOnly: false, unmergedOnly: false, repoPath: dir,
        };
        const md = (0, index_js_1.formatMarkdown)(result, cfg);
        strict_1.default.ok(md.includes("# Git Stale Branch Report"));
        strict_1.default.ok(md.includes("md-branch"));
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("formatCleanup shows safe-to-delete merged branches", () => {
        const dir = makeRepo();
        makeBranch(dir, "old-merged", 45);
        (0, child_process_1.execSync)(`git merge old-merged`, { cwd: dir, stdio: "pipe" });
        makeBranch(dir, "old-unmerged", 45);
        const result = (0, index_js_1.analyze)({ repoPath: dir, staleDays: 30 });
        const cfg = {
            staleDays: 30, ancientDays: 90, defaultBranch: "main",
            remote: false, exclude: [], mergedOnly: false, unmergedOnly: false, repoPath: dir,
        };
        const cleanup = (0, index_js_1.formatCleanup)(result, cfg);
        strict_1.default.ok(cleanup.includes("old-merged"));
        strict_1.default.ok(!cleanup.includes("old-unmerged"));
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("handles empty repo gracefully", () => {
        const dir = makeRepo();
        const result = (0, index_js_1.analyze)({ repoPath: dir });
        strict_1.default.equal(result.branches.length, 0);
        const cfg = {
            staleDays: 30, ancientDays: 90, defaultBranch: "main",
            remote: false, exclude: [], mergedOnly: false, unmergedOnly: false, repoPath: dir,
        };
        const table = (0, index_js_1.formatTable)(result, cfg);
        strict_1.default.ok(table.includes("No branches found"));
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
    (0, node_test_1.it)("ancient detection works", () => {
        const dir = makeRepo();
        makeBranch(dir, "ancient-branch", 120);
        const result = (0, index_js_1.analyze)({ repoPath: dir, staleDays: 30, ancientDays: 90 });
        strict_1.default.equal(result.ancientCount, 1);
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    });
});
