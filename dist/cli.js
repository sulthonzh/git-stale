#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const args = process.argv.slice(2);
function usage() {
    console.log(`git-stale — find stale, abandoned, and forgotten git branches

Usage:
  git-stale [options]             Show stale branches (default: table)
  git-stale cleanup [options]     Show branches safe to delete (merged & stale)

Options:
  --days <n>       Stale threshold in days (default: 30)
  --ancient <n>    Ancient threshold in days (default: 90)
  --default <br>   Default branch name (auto-detected)
  --remote         Include remote branches
  --merged         Only show merged branches
  --unmerged       Only show unmerged branches
  --exclude <pat>  Exclude branch pattern (repeatable)
  --json           JSON output
  --markdown       Markdown output
  --repo <path>    Repository path (default: cwd)
  -h, --help       Show this help
  -v, --version    Show version
`);
}
function parseArgs(args) {
    const config = {};
    let format = "table";
    let command = "list";
    const exclude = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        switch (a) {
            case "--days":
                config.staleDays = parseInt(args[++i], 10);
                break;
            case "--ancient":
                config.ancientDays = parseInt(args[++i], 10);
                break;
            case "--default":
                config.defaultBranch = args[++i];
                break;
            case "--remote":
                config.remote = true;
                break;
            case "--merged":
                config.mergedOnly = true;
                break;
            case "--unmerged":
                config.unmergedOnly = true;
                break;
            case "--exclude":
                exclude.push(args[++i]);
                break;
            case "--json":
                format = "json";
                break;
            case "--markdown":
                format = "markdown";
                break;
            case "--repo":
                config.repoPath = args[++i];
                break;
            case "cleanup":
                command = "cleanup";
                break;
            case "-h":
            case "--help":
                usage();
                process.exit(0);
            case "-v":
            case "--version":
                console.log("git-stale v1.0.0");
                process.exit(0);
        }
    }
    if (exclude.length)
        config.exclude = exclude;
    return { command, config, format };
}
const { command, config, format } = parseArgs(args);
try {
    const result = (0, index_1.analyze)(config);
    const fullConfig = {
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
    if (command === "cleanup") {
        console.log((0, index_1.formatCleanup)(result, fullConfig));
    }
    else {
        switch (format) {
            case "json":
                console.log((0, index_1.formatJSON)(result));
                break;
            case "markdown":
                console.log((0, index_1.formatMarkdown)(result, fullConfig));
                break;
            default:
                console.log((0, index_1.formatTable)(result, fullConfig));
        }
    }
}
catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
