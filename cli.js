#!/usr/bin/env node
'use strict';

const { parseArgs, analyze, formatText, formatJSON, formatMarkdown, HELP } = require('./src/index');
const { execFileSync } = require('child_process');
const pkg = require('./package.json');

const options = parseArgs(process.argv);

if (options.help) {
  console.log(HELP);
  process.exit(0);
}

if (options.version) {
  console.log(pkg.version);
  process.exit(0);
}

const cwd = options.repo || process.cwd();
const data = analyze(cwd, options);

if (options.prune) {
  const toDelete = data.branches.filter(b => b.merged);
  if (toDelete.length === 0) {
    console.log('No merged stale branches to prune.');
    process.exit(0);
  }
  for (const b of toDelete) {
    try {
      execFileSync('git', ['branch', '-d', b.name], { cwd, stdio: 'pipe' });
      console.log(`  deleted ${b.name}`);
    } catch (e) {
      console.error(`  failed to delete ${b.name}: ${e.message}`);
    }
  }
  console.log(`\nPruned ${toDelete.length} branch${toDelete.length === 1 ? '' : 'es'}.`);
  process.exit(0);
}

switch (options.format) {
  case 'json':
    console.log(formatJSON(data));
    break;
  case 'markdown':
    console.log(formatMarkdown(data));
    break;
  default:
    console.log(formatText(data));
}

const safeCount = data.branches.filter(b => b.merged).length;
process.exit(safeCount > 0 ? 1 : 0);
