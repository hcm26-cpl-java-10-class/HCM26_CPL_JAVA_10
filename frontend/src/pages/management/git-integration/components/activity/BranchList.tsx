import { GitBranch } from "lucide-react";
import type { GitBranchItem } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../../git-integration.format";
import { BRANCH_BAR } from "../git-integration.styles";
import { RatioBar } from "./RatioBar";

/**
 * WS-GH-02: branches the commits of the period were first pushed to, latest activity first.
 * A row opens the Commits view filtered by that branch.
 */
export function BranchList({ branches, defaultBranch, onSelect }: {
  branches: GitBranchItem[];
  defaultBranch?: string | null;
  onSelect: (branch: string) => void;
}) {
  if (branches.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">No branch activity in this period.</p>;
  const max = Math.max(...branches.map(branch => branch.commits));
  return <>
    <ul className="divide-y">
      {branches.map(branch => <li key={branch.name}>
        <button type="button" onClick={() => onSelect(branch.name)} title={`Show commits on ${branch.name}`}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <GitBranch className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-mono text-[12px] font-medium" title={branch.name}>{branch.name}</span>
                {branch.name === defaultBranch && <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">default</span>}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{branch.commits}</span> {branch.commits === 1 ? "commit" : "commits"}</span>
            </span>
            <RatioBar value={branch.commits} max={max} track={BRANCH_BAR.track} bar={BRANCH_BAR.bar} />
            {branch.lastCommitAt && <span className="block text-[11px] text-muted-foreground">
              last commit <time dateTime={branch.lastCommitAt} title={formatDateTime(branch.lastCommitAt)}>{formatRelative(branch.lastCommitAt)}</time>
            </span>}
          </span>
        </button>
      </li>)}
    </ul>
    <p className="mt-auto border-t px-4 py-2 text-[11px] text-muted-foreground">Each commit counts for the branch it was first pushed to.</p>
  </>;
}
