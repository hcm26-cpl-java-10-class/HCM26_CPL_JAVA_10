import { RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GitInsightsRange, GitRepositoryInsights } from "@/types/features/git-integration";
import type { GitHubTabTarget } from "../../github-tab.params";
import { formatDuration, spanLabel } from "../../insights.utils";
import { CHART_COLORS } from "../git-integration.styles";
import { Segmented } from "./ActivityControls";
import { BranchList } from "./BranchList";
import { CommitActivityChart } from "./CommitActivityChart";
import { ContributorList } from "./ContributorList";

const PANEL = "flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-card dark:border-border";
const RANGES: Array<{ id: GitInsightsRange; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

function PanelHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50/40 px-4 py-2.5 dark:bg-muted/20">
    <h4 className="text-sm font-semibold">{title}</h4>
    {aside}
  </div>;
}

function Figure({ value, label }: { value: ReactNode; label: string }) {
  return <span className="whitespace-nowrap"><span className="font-semibold tabular-nums text-foreground">{value}</span> {label}</span>;
}

/**
 * WS-GH-02: activity of the chosen period — commit chart, contributors, branches. The range
 * picker sits on this section's heading, so it is clear which numbers follow it (the tiles
 * and lists above are the current state and do not change with it).
 */
export function ActivitySection({ query, range, onRange, defaultBranch, onNavigate }: {
  query: { data?: GitRepositoryInsights; isPending: boolean; isError: boolean; isFetching: boolean; isPlaceholderData: boolean; refetch: () => unknown };
  range: GitInsightsRange;
  onRange: (range: GitInsightsRange) => void;
  defaultBranch?: string | null;
  onNavigate: (target: GitHubTabTarget) => void;
}) {
  const data = query.data;
  const summary = data?.summary;
  const switching = query.isPlaceholderData && query.isFetching;

  return <section aria-labelledby="gh-activity-heading" className="min-w-0 space-y-3 pt-2">
    <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-2">
      <div className="space-y-0.5">
        <h3 id="gh-activity-heading" className="text-sm font-semibold">Activity</h3>
        <p className="text-[11px] text-muted-foreground">
          {data ? `${spanLabel(data.from, data.to)} · these numbers follow the selected period` : "Commits, contributors and branches of the selected period"}
        </p>
      </div>
      <Segmented label="Activity period" value={range} options={RANGES} onChange={onRange} />
    </div>

    {query.isPending ? <div role="status" aria-label="Loading activity" className="space-y-3">
      <Skeleton className="h-[260px] rounded-xl" />
      <div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
    </div> : query.isError || !data || !summary ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
      The activity of this period could not be loaded.
      <Button variant="ghost" size="sm" className="h-7" disabled={query.isFetching} onClick={() => void query.refetch()}>
        <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />Try again
      </Button>
    </div> : <div className={cn("space-y-3 transition-opacity", switching && "opacity-60")} aria-busy={switching}>
      <section aria-label="Commit activity" className={PANEL}>
        <PanelHeader title="Commit activity" aside={<span className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2 rounded-t-[2px]" style={{ background: CHART_COLORS.bar }} aria-hidden="true" />Commits</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: CHART_COLORS.merged }} aria-hidden="true" />PR merged</span>
        </span>} />
        <div className="space-y-3 px-4 pb-3 pt-3">
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Figure value={summary.commits} label={summary.commits === 1 ? "commit" : "commits"} />
            <span aria-hidden="true">·</span>
            <Figure value={summary.activeDays} label={summary.activeDays === 1 ? "active day" : "active days"} />
            <span aria-hidden="true">·</span>
            <Figure value={summary.pullRequestsMerged} label={summary.pullRequestsMerged === 1 ? "PR merged" : "PRs merged"} />
            {summary.medianHoursToMerge != null && <>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap" title="Median time from opening a pull request to merging it">
                median <span className="font-semibold tabular-nums text-foreground">{formatDuration(summary.medianHoursToMerge)}</span> to merge
              </span>
            </>}
          </p>
          <CommitActivityChart daily={data.daily} range={data.range}
            onSelect={(from, to) => onNavigate({ view: "commits", from, to, range })} />
          {data.truncated && <p className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            <TriangleAlert className="size-3.5" aria-hidden="true" />This period has more commits than can be counted at once; the numbers are a lower bound.
          </p>}
        </div>
      </section>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <section aria-label="Contributors" className={PANEL}>
          <PanelHeader title={<>Contributors <span className="font-normal text-muted-foreground">· {summary.contributors}</span></>} />
          <ContributorList contributors={data.contributors} others={data.otherContributors}
            onSelect={author => onNavigate({ view: "commits", author, range })} />
        </section>
        <section aria-label="Active branches" className={PANEL}>
          <PanelHeader title="Active branches" />
          <BranchList branches={data.branches} defaultBranch={defaultBranch}
            onSelect={branch => onNavigate({ view: "commits", branch, range })} />
        </section>
      </div>
    </div>}
  </section>;
}
