import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { workspaceGitApi, type GitCommitGranularity } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceEmptyState } from "./workspace.shared";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { useGitActivityParam } from "./git-activity-url-context";

const GRANULARITIES: Array<{ value: GitCommitGranularity; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export interface GitCommitDrilldown {
  from?: string;
  to?: string;
  developerId?: number;
  contributorId?: number;
  branch?: string;
}

export function GitCommitAnalyticsWorkspacePanel({
  workspaceId,
  active = true,
  projectId,
  taskId,
  developerId,
  contributorId,
  branch,
  from,
  to,
  granularity,
  includeBots,
  includeMergeCommits,
  onGranularityChange,
  onIncludeBotsChange,
  onIncludeMergeCommitsChange,
  onBranchChange,
  onDrilldown,
  onShowHistory,
}: {
  workspaceId: number;
  active?: boolean;
  projectId?: number;
  taskId?: number;
  developerId?: number;
  contributorId?: number;
  branch?: string;
  from: string;
  to: string;
  granularity: GitCommitGranularity;
  includeBots: boolean;
  includeMergeCommits: boolean;
  onGranularityChange: (value: GitCommitGranularity) => void;
  onIncludeBotsChange: (value: boolean) => void;
  onIncludeMergeCommitsChange: (value: boolean) => void;
  onBranchChange: (value?: string) => void;
  onDrilldown: (filters: GitCommitDrilldown) => void;
  onShowHistory: (filters: { includeBots: boolean; includeMergeCommits: boolean }) => void;
}) {
  const { user, activeRole } = usePermissions();
  const [showCharts, setShowCharts] = useGitActivityParam<boolean>("gitCommitCharts", false);
  const query = useQuery({
    queryKey: ["git-activity", "commit-analytics", workspaceId, user.email, activeRole,
      granularity, projectId, taskId, developerId, contributorId, branch,
      from, to, includeBots, includeMergeCommits],
    queryFn: ({ signal }) => workspaceGitApi.commitAnalytics(workspaceId, {
      granularity, projectId, taskId, developerId, contributorId, branch,
      from: from || undefined, to: to || undefined,
      includeBots, includeMergeCommits,
    }, signal),
    enabled: active,
    retry: false,
  });

  const data = query.data;
  const maxBranch = Math.max(1, ...(data?.branches.map(row => row.commits) ?? []));
  const showAll = () => onShowHistory({ includeBots, includeMergeCommits });

  return <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 via-white to-white shadow-none">
    <CardHeader className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-sm text-blue-950"><BarChart3 className="size-4 text-blue-700" />Commit overview</CardTitle>
          <CardDescription>Unique commits in the selected scope. Date boundaries use Vietnam time.</CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" aria-expanded={showCharts} aria-controls="git-commit-charts"
          onClick={() => setShowCharts(value => !value)}>
          {showCharts ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {showCharts ? "Hide charts" : "Show charts"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {showCharts && <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Commit trend interval">
          {GRANULARITIES.map(item => <button key={item.value} type="button" aria-pressed={granularity === item.value}
            onClick={() => onGranularityChange(item.value)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${granularity === item.value
              ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {item.label}
          </button>)}
        </div>}
        <Label className="text-xs font-normal text-muted-foreground">
          <Checkbox checked={includeBots} onCheckedChange={value => onIncludeBotsChange(value === true)} />Include bot commits
        </Label>
        <Label className="text-xs font-normal text-muted-foreground">
          <Checkbox checked={includeMergeCommits} onCheckedChange={value => onIncludeMergeCommitsChange(value === true)} />Include merge commits
        </Label>
        <Select value={branch ?? "all branches"} onValueChange={value => onBranchChange(value === "all branches" ? undefined : value)}>
          <SelectTrigger aria-label="Filter analytics by first-seen branch" className="h-8 w-52 text-xs">
            <SelectValue placeholder="All first-seen branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all branches">All first-seen branches</SelectItem>
            {(data?.branchOptions ?? []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {query.isPending ? <div className="space-y-2"><Skeleton className="h-16 w-full" />{showCharts && <Skeleton className="h-52 w-full" />}</div>
        : query.isError ? <WorkspaceEmptyState icon={BarChart3} title="Could not load commit analytics"
          description={query.error instanceof Error ? query.error.message : "Commit analytics are unavailable."}
          action={<Button variant="outline" onClick={() => void query.refetch()}>Retry</Button>} />
        : !data || data.totalCommits === 0 ? <WorkspaceEmptyState icon={BarChart3} title="No synced commits"
          description="Commit analytics will appear after commit history is available." compact />
        : <>
          <Button type="button" variant="outline" className="h-auto w-full justify-between py-3"
            onClick={showAll} aria-label={`View ${data.totalCommits} commits in history`}>
            <span className="text-left"><span className="block text-xs text-muted-foreground">Unique commits</span>
              <span className="block text-2xl font-semibold tabular-nums">{data.totalCommits}</span></span>
            <Badge variant="secondary">View matching commits</Badge>
          </Button>

          <div id="git-commit-charts" hidden={!showCharts} className="space-y-4">
          <section className="space-y-2" aria-label="Commit trend">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Commits by {granularity}</h3>
              <span className="text-xs text-muted-foreground">Select a period to view its commits</span>
            </div>
            <div className="h-56 w-full" role="img" aria-label={`Commit count by ${granularity}`}>
              {active && showCharts && <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8edf3" vertical={false} />
                  <XAxis dataKey="label" interval="preserveStartEnd" tick={{ fontSize: 10, fill: "#94a3b8" }}
                    stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} width={32} tick={{ fontSize: 10, fill: "#94a3b8" }}
                    stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="commits" name="Commits" stroke="#2563eb" strokeWidth={2}
                    dot={{ r: 3, fill: "#2563eb" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>}
            </div>
            <div className="flex flex-wrap gap-1">
              {data.trend.map(point => <Button key={point.key} type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                onClick={() => {
                  const selectedFrom = from && from > point.startDate ? from : point.startDate;
                  const selectedTo = to && to < point.endDate ? to : point.endDate;
                  onDrilldown({ from: selectedFrom, to: selectedTo });
                  showAll();
                }}
                aria-label={`View ${point.commits} commits for ${point.label}`}>
                {point.label} <span className="ml-1 text-muted-foreground">{point.commits}</span>
              </Button>)}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="space-y-2" aria-label="Commits by developer">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">By developer</h3>
                {data.unmappedContributorCommits > 0 && <Badge variant="outline">Unmapped: {data.unmappedContributorCommits}</Badge>}</div>
              <div className="h-48 w-full">
                {active && showCharts && <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.developers} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8edf3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <YAxis type="category" dataKey="name" width={116} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="commits" name="Commits" fill="#10b981" radius={[0, 3, 3, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>}
              </div>
              <div className="flex flex-wrap gap-1">
                {data.developers.map(row => <Button key={`${row.developerId ?? "none"}-${row.contributorId ?? "unknown"}-${row.name}`}
                  type="button" size="sm" variant="ghost" className="h-7 max-w-full px-2 text-xs"
                  disabled={row.developerId == null && row.contributorId == null}
                  title={row.developerId == null && row.contributorId == null
                    ? "This source has no stable identity to filter by." : undefined}
                  onClick={() => {
                    if (row.developerId != null) onDrilldown({ developerId: row.developerId });
                    else if (row.contributorId != null) onDrilldown({ contributorId: row.contributorId });
                    else return;
                    showAll();
                  }}
                  aria-label={`View ${row.commits} commits by ${row.name}`}>
                  <span className="max-w-52 truncate">{row.name}{row.bot ? " · bot" : ""}</span>
                  <span className="ml-1 text-muted-foreground">{row.commits}</span>
                </Button>)}
              </div>
            </section>

            <section className="space-y-2" aria-label="Commits by first-seen branch">
              <h3 className="text-sm font-semibold">By first-seen branch</h3>
              <div className="space-y-2">
                {data.branches.map(row => <Button key={row.branch ?? "unknown-branch"} type="button" variant="ghost"
                  className="h-auto w-full justify-start px-2 py-1.5 text-left" disabled={row.branch == null}
                  onClick={() => { if (row.branch) { onDrilldown({ branch: row.branch }); showAll(); } }}
                  aria-label={`View ${row.commits} commits from ${row.label}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{row.label}</span>
                    <span className="mt-1 block h-1.5 rounded bg-muted">
                      <span className="block h-1.5 rounded bg-violet-500" style={{ width: `${Math.max(4, row.commits / maxBranch * 100)}%` }} />
                    </span>
                  </span>
                  <span className="ml-2 text-xs tabular-nums text-muted-foreground">{row.commits}</span>
                </Button>)}
              </div>
            </section>
          </div>
          </div>
        </>}
    </CardContent>
  </Card>;
}
