import { execSync } from "child_process";

// --- Types ---

export interface BranchInfo {
  name: string;
  isRemote: boolean;
  isMerged: boolean;
  lastCommitDate: string; // ISO
  lastCommitAuthor: string;
  lastCommitSubject: string;
  daysSinceLastCommit: number;
  aheadOfDefault: number;
  behindDefault: number;
  totalCommits: number;
  hasOpenPR?: boolean;
}

export interface StaleConfig {
  /** Days threshold to consider a branch stale (default: 30) */
  staleDays: number;
  /** Days threshold to consider a branch ancient (default: 90) */
  ancientDays: number;
  /** Default branch name (auto-detected if not set) */
  defaultBranch: string;
  /** Include remote branches (default: false) */
  remote: boolean;
  /** Branch patterns to exclude (glob) */
  exclude: string[];
  /** Only show merged branches */
  mergedOnly: boolean;
  /** Only show unmerged branches */
  unmergedOnly: boolean;
  /** Repo path (default: cwd) */
  repoPath: string;
}

export interface StaleResult {
  defaultBranch: string;
  branches: BranchInfo[];
  staleCount: number;
  ancientCount: number;
  mergedCount: number;
  unmergedCount: number;
}

// --- Helpers ---

function git(args: string, repoPath: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function matchGlob(pattern: string, name: string): boolean {
  const re = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
  );
  return re.test(name);
}

// --- Core ---

export function detectDefaultBranch(repoPath: string): string {
  // Try HEAD reference first
  const head = git("symbolic-ref refs/remotes/origin/HEAD", repoPath);
  if (head) return head.replace("refs/remotes/origin/", "");

  const branch = git("symbolic-ref HEAD", repoPath);
  if (branch) return branch.replace("refs/heads/", "");

  return "main";
}

export function getBranches(
  repoPath: string,
  remote: boolean
): { name: string; isRemote: boolean }[] {
  const branches: { name: string; isRemote: boolean }[] = [];

  const local = git("branch --format='%(refname:short)'", repoPath);
  if (local) {
    for (const b of local.split("\n")) {
      const trimmed = b.trim();
      if (trimmed) branches.push({ name: trimmed, isRemote: false });
    }
  }

  if (remote) {
    const remotes = git("branch -r --format='%(refname:short)'", repoPath);
    if (remotes) {
      for (const b of remotes.split("\n")) {
        const trimmed = b.trim();
        if (trimmed && !trimmed.includes(" -> ")) {
          branches.push({ name: trimmed, isRemote: true });
        }
      }
    }
  }

  return branches;
}

export function isMerged(
  branchName: string,
  defaultBranch: string,
  repoPath: string
): boolean {
  // exit code 0 = merged
  try {
    execSync(`git merge-base --is-ancestor ${branchName} ${defaultBranch}`, {
      cwd: repoPath,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

export function getAheadBehind(
  branchName: string,
  defaultBranch: string,
  repoPath: string
): { ahead: number; behind: number } {
  const output = git(
    `rev-list --left-right --count ${branchName}...${defaultBranch}`,
    repoPath
  );
  if (!output) return { ahead: 0, behind: 0 };
  const parts = output.split("\t");
  return {
    ahead: parseInt(parts[0], 10) || 0,
    behind: parseInt(parts[1], 10) || 0,
  };
}

export function analyze(config: Partial<StaleConfig> = {}): StaleResult {
  const cfg: StaleConfig = {
    staleDays: 30,
    ancientDays: 90,
    defaultBranch: "",
    remote: false,
    exclude: [],
    mergedOnly: false,
    unmergedOnly: false,
    repoPath: process.cwd(),
    ...config,
  };

  const defaultBranch =
    cfg.defaultBranch || detectDefaultBranch(cfg.repoPath);

  const rawBranches = getBranches(cfg.repoPath, cfg.remote);

  const branches: BranchInfo[] = [];

  for (const { name, isRemote } of rawBranches) {
    // Skip default branch
    const bareName = isRemote ? name.replace(/^[^/]+\//, "") : name;
    if (bareName === defaultBranch || name === defaultBranch) continue;

    // Exclude patterns
    if (cfg.exclude.some((p) => matchGlob(p, bareName) || matchGlob(p, name)))
      continue;

    const merged = isMerged(name, defaultBranch, cfg.repoPath);

    if (cfg.mergedOnly && !merged) continue;
    if (cfg.unmergedOnly && merged) continue;

    const logFormat = "%ai%n%an%n%s";
    const logOutput = git(
      `log -1 --format=${logFormat} ${name}`,
      cfg.repoPath
    );
    const logLines = logOutput.split("\n");
    const lastCommitDate = logLines[0] || "";
    const lastCommitAuthor = logLines[1] || "";
    const lastCommitSubject = logLines.slice(2).join("\n") || "";

    const daysSince = lastCommitDate ? daysBetween(lastCommitDate) : -1;

    const { ahead, behind } = getAheadBehind(
      name,
      defaultBranch,
      cfg.repoPath
    );

    const totalCommits = parseInt(
      git(`rev-list --count ${name}`, cfg.repoPath) || "0",
      10
    );

    branches.push({
      name,
      isRemote,
      isMerged: merged,
      lastCommitDate,
      lastCommitAuthor,
      lastCommitSubject,
      daysSinceLastCommit: daysSince,
      aheadOfDefault: ahead,
      behindDefault: behind,
      totalCommits,
    });
  }

  // Sort: most stale first
  branches.sort((a, b) => b.daysSinceLastCommit - a.daysSinceLastCommit);

  const staleCount = branches.filter(
    (b) => b.daysSinceLastCommit >= cfg.staleDays
  ).length;
  const ancientCount = branches.filter(
    (b) => b.daysSinceLastCommit >= cfg.ancientDays
  ).length;
  const mergedCount = branches.filter((b) => b.isMerged).length;
  const unmergedCount = branches.filter((b) => !b.isMerged).length;

  return {
    defaultBranch,
    branches,
    staleCount,
    ancientCount,
    mergedCount,
    unmergedCount,
  };
}

// --- Formatters ---

export function formatTable(result: StaleResult, config: StaleConfig): string {
  if (result.branches.length === 0) {
    return "No branches found. Clean repo! 🎉";
  }

  const lines: string[] = [];
  const nameWidth = Math.max(
    12,
    ...result.branches.map((b) => b.name.length)
  );
  const authorWidth = Math.max(
    8,
    ...result.branches.map((b) => b.lastCommitAuthor.length)
  );

  lines.push(
    `Default branch: ${result.defaultBranch} | Stale ≥${config.staleDays}d | Ancient ≥${config.ancientDays}d`
  );
  lines.push("");
  lines.push(
    `${"Branch".padEnd(nameWidth)}  ${"Days".padStart(5)}  ${"Age".padEnd(7)}  ${"Merged".padEnd(7)}  ${"Author".padEnd(authorWidth)}  ${"Ahead".padStart(5)}  Last commit`
  );
  lines.push("-".repeat(nameWidth + authorWidth + 60));

  for (const b of result.branches) {
    const age =
      b.daysSinceLastCommit >= config.ancientDays
        ? "ancient"
        : b.daysSinceLastCommit >= config.staleDays
        ? "stale"
        : "fresh";
    const merged = b.isMerged ? "yes" : "no";
    lines.push(
      `${b.name.padEnd(nameWidth)}  ${String(b.daysSinceLastCommit).padStart(5)}  ${age.padEnd(7)}  ${merged.padEnd(7)}  ${b.lastCommitAuthor.padEnd(authorWidth)}  ${String(b.aheadOfDefault).padStart(5)}  ${b.lastCommitSubject.slice(0, 40)}`
    );
  }

  lines.push("");
  lines.push(
    `Total: ${result.branches.length} branches | ${result.staleCount} stale | ${result.ancientCount} ancient | ${result.mergedCount} merged | ${result.unmergedCount} unmerged`
  );

  return lines.join("\n");
}

export function formatJSON(result: StaleResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatMarkdown(result: StaleResult, config: StaleConfig): string {
  const lines: string[] = [];
  lines.push(`# Git Stale Branch Report`);
  lines.push("");
  lines.push(`- **Default branch:** ${result.defaultBranch}`);
  lines.push(`- **Stale threshold:** ${config.staleDays} days`);
  lines.push(`- **Ancient threshold:** ${config.ancientDays} days`);
  lines.push(`- **Total branches:** ${result.branches.length}`);
  lines.push(`- **Stale:** ${result.staleCount} | **Ancient:** ${result.ancientCount} | **Merged:** ${result.mergedCount} | **Unmerged:** ${result.unmergedCount}`);
  lines.push("");

  if (result.branches.length === 0) {
    lines.push("*No branches found.*");
    return lines.join("\n");
  }

  lines.push("| Branch | Days | Age | Merged | Author | Ahead | Last Commit |");
  lines.push("|--------|------|-----|--------|--------|-------|-------------|");

  for (const b of result.branches) {
    const age =
      b.daysSinceLastCommit >= config.ancientDays
        ? "ancient"
        : b.daysSinceLastCommit >= config.staleDays
        ? "stale"
        : "fresh";
    lines.push(
      `| \`${b.name}\` | ${b.daysSinceLastCommit} | ${age} | ${b.isMerged ? "✅" : "❌"} | ${b.lastCommitAuthor} | ${b.aheadOfDefault} | ${b.lastCommitSubject.slice(0, 40)} |`
    );
  }

  return lines.join("\n");
}

export function formatCleanup(
  result: StaleResult,
  config: StaleConfig
): string {
  // Only show merged stale branches safe to delete
  const safe = result.branches.filter(
    (b) => b.isMerged && !b.isRemote && b.daysSinceLastCommit >= config.staleDays
  );

  if (safe.length === 0) {
    return "No safe-to-delete branches found.";
  }

  const lines: string[] = [];
  lines.push(`# Branches safe to delete (${safe.length} merged & stale):`);
  lines.push("");
  for (const b of safe) {
    lines.push(`git branch -d ${b.name}  # ${b.daysSinceLastCommit}d old, by ${b.lastCommitAuthor}`);
  }
  lines.push("");
  lines.push("# Delete all at once:");
  lines.push(safe.map((b) => `git branch -d ${b.name}`).join(" && "));

  return lines.join("\n");
}
