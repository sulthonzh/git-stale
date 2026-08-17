export interface BranchInfo {
    name: string;
    isRemote: boolean;
    isMerged: boolean;
    lastCommitDate: string;
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
export declare function detectDefaultBranch(repoPath: string): string;
export declare function getBranches(repoPath: string, remote: boolean): {
    name: string;
    isRemote: boolean;
}[];
export declare function isMerged(branchName: string, defaultBranch: string, repoPath: string): boolean;
export declare function getAheadBehind(branchName: string, defaultBranch: string, repoPath: string): {
    ahead: number;
    behind: number;
};
export declare function analyze(config?: Partial<StaleConfig>): StaleResult;
export declare function formatTable(result: StaleResult, config: StaleConfig): string;
export declare function formatJSON(result: StaleResult): string;
export declare function formatMarkdown(result: StaleResult, config: StaleConfig): string;
export declare function formatCleanup(result: StaleResult, config: StaleConfig): string;
