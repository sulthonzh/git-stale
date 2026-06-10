'use strict';

const { execSync } = require('child_process');
const path = require('path');

function runGit(args, cwd) {
  try {
    return execSync(`git ${args}`, { encoding: 'utf-8', cwd, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function getBranches(cwd) {
  const output = runGit('branch --format=%(refname:short)%(upstream:short)', cwd);
  if (!output) return [];
  return output.split('\n').filter(Boolean).map(line => {
    const [name, upstream] = line.split(/\s+/);
    return { name, upstream: upstream || null };
  });
}

function getCurrentBranch(cwd) {
  return runGit('branch --show-current', cwd);
}

function getDefaultBranch(cwd) {
  // Try common defaults
  for (const candidate of ['main', 'master', 'trunk', 'develop']) {
    const result = runGit(`rev-parse --verify ${candidate}`, cwd);
    if (result) return candidate;
  }
  return 'main';
}

function getBranchAge(branch, cwd) {
  const output = runGit(`log -1 --format=%ct ${branch}`, cwd);
  if (!output) return null;
  const commitTs = parseInt(output, 10);
  const nowTs = Math.floor(Date.now() / 1000);
  return nowTs - commitTs;
}

function isMerged(branch, defaultBranch, cwd) {
  const result = runGit(`merge-base --is-ancestor ${branch} ${defaultBranch}`, cwd);
  return result !== null; // exit code 0 = is ancestor = merged
}

function formatAge(seconds) {
  if (seconds == null) return '?';
  const days = Math.floor(seconds / 86400);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}

function daysBetween(seconds) {
  if (seconds == null) return Infinity;
  return Math.floor(seconds / 86400);
}

function analyze(cwd, options = {}) {
  const { olderThan = 0, includeMerged = false, noMergeCheck = false } = options;
  const current = getCurrentBranch(cwd);
  const defaultBranch = getDefaultBranch(cwd);
  const branches = getBranches(cwd);

  const results = [];
  for (const b of branches) {
    if (b.name === current) continue;
    if (b.name === defaultBranch) continue;

    const age = getBranchAge(b.name, cwd);
    const merged = noMergeCheck ? null : isMerged(b.name, defaultBranch, cwd);
    const staleDays = daysBetween(age);

    if (staleDays < olderThan) continue;
    if (!includeMerged && merged === false) continue;

    results.push({
      name: b.name,
      age,
      staleDays,
      merged,
      upstream: b.upstream,
    });
  }

  results.sort((a, b) => (b.age || 0) - (a.age || 0));
  return { branches: results, defaultBranch, current };
}

function formatText(data) {
  const { branches, defaultBranch } = data;
  if (branches.length === 0) {
    return 'No stale branches found. Clean codebase!';
  }

  const maxName = Math.max(...branches.map(b => b.name.length), 4);
  let out = `Stale branches (default: ${defaultBranch})\n`;
  out += `${'─'.repeat(maxName + 30)}\n`;
  out += `${'Branch'.padEnd(maxName)}  Age               Merged  Status\n`;
  out += `${'─'.repeat(maxName + 30)}\n`;

  for (const b of branches) {
    const age = formatAge(b.age).padEnd(17);
    const merged = b.merged === null ? '  ?  ' : b.merged ? ' yes  ' : '  no  ';
    const status = b.merged ? '🗑️  safe to delete' : '⚠️  has unmerged work';
    out += `${b.name.padEnd(maxName)}  ${age} ${merged} ${status}\n`;
  }

  out += `\n${branches.length} stale branch${branches.length === 1 ? '' : 'es'} found`;
  const safeCount = branches.filter(b => b.merged).length;
  if (safeCount > 0) out += ` (${safeCount} safe to delete)`;

  return out;
}

function formatJSON(data) {
  return JSON.stringify(data, null, 2);
}

function formatMarkdown(data) {
  const { branches, defaultBranch } = data;
  if (branches.length === 0) return 'No stale branches found.';

  let out = `## Stale Branches (default: \`${defaultBranch}\`)\n\n`;
  out += '| Branch | Age | Merged | Status |\n';
  out += '|--------|-----|--------|--------|\n';

  for (const b of branches) {
    const age = formatAge(b.age);
    const merged = b.merged === null ? '?' : b.merged ? '✅' : '❌';
    const status = b.merged ? 'Safe to delete' : 'Unmerged work';
    out += `| \`${b.name}\` | ${age} | ${merged} | ${status} |\n`;
  }

  const safeCount = branches.filter(b => b.merged).length;
  out += `\n**${branches.length}** stale branch${branches.length === 1 ? '' : 'es'}`;
  if (safeCount > 0) out += ` — **${safeCount}** safe to delete`;

  return out;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { olderThan: 0, format: 'text', includeMerged: false, noMergeCheck: false, repo: null, prune: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--older-than' && args[i + 1]) {
      const val = args[++i];
      const match = val.match(/^(\d+)(d|m|y)?$/);
      if (match) {
        let n = parseInt(match[1], 10);
        if (match[2] === 'm') n *= 30;
        if (match[2] === 'y') n *= 365;
        options.olderThan = n;
      }
    } else if (arg === '--all') {
      options.includeMerged = true;
      // Actually --all means show all branches including unmerged
      // Let me reconsider: --all shows unmerged too
    } else if (arg === '--include-unmerged') {
      options.includeMerged = true;
    } else if (arg === '--no-merge-check') {
      options.noMergeCheck = true;
    } else if (arg === '--json') {
      options.format = 'json';
    } else if (arg === '--markdown') {
      options.format = 'markdown';
    } else if (arg === '--repo' && args[i + 1]) {
      options.repo = args[++i];
    } else if (arg === '--prune') {
      options.prune = true;
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    }
  }

  return options;
}

const HELP = `
git-stale — find stale local branches safe to delete

USAGE
  git-stale [options]

OPTIONS
  --older-than <n[d|m|y]>   Minimum age in days (default: 0)
                            Use 30d, 3m, 1y for days/months/years
  --include-unmerged        Show branches with unmerged work too
  --no-merge-check          Skip merge check (faster)
  --prune                   Delete all branches that are merged & old
  --json                    Output as JSON
  --markdown                Output as Markdown
  --repo <path>             Path to git repo (default: current dir)
  -h, --help                Show this help

EXAMPLES
  git-stale                          Show all stale branches
  git-stale --older-than 30d         Branches older than 30 days
  git-stale --include-unmerged       Show all old branches
  git-stale --prune                  Delete merged stale branches
  git-stale --json                   Machine-readable output
`;

module.exports = { analyze, formatText, formatJSON, formatMarkdown, parseArgs, formatAge, daysBetween, HELP, getBranches, getCurrentBranch, getDefaultBranch, getBranchAge, isMerged };
