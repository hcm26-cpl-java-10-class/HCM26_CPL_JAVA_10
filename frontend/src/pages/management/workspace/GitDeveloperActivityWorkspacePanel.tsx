import { useGitActivityParam } from "./git-activity-url-context";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Users } from "lucide-react";
import { workspaceGitApi } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceEmptyState } from "./workspace.shared";
import { useGitProjectFilter } from "./git-project-scope";
import { GitProjectSelect } from "./GitProjectSelect";
import { GitListPagination } from "./GitListPagination";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not load developer activity.";
}

export function GitDeveloperActivityWorkspacePanel({ workspaceId }: {
  workspaceId: number;
  initialProjectId?: number;
}) {
  const { user, activeRole } = usePermissions();
  const projectFilter = useGitProjectFilter("gitDeveloperProjectId");
  const { projectId, setProjectId } = projectFilter;
  const [developerId, setDeveloperId] = useGitActivityParam<number | undefined>("gitDeveloperDeveloperId", undefined, "number");
  const [from, setFrom] = useGitActivityParam<string>("gitDeveloperFrom", "");
  const [to, setTo] = useGitActivityParam<string>("gitDeveloperTo", "");
  const [page, setPage] = useGitActivityParam<number>("gitDeveloperPage", 0);
  const options = useQuery({
    queryKey: ["git-activity", "report-options", workspaceId, user.email, activeRole, projectId],
    queryFn: ({ signal }) => workspaceGitApi.reportOptions(workspaceId, projectId, signal),
    retry: false,
  });
  const activity = useQuery({
    queryKey: ["git-activity", "developers", workspaceId, user.email, activeRole, projectId, developerId, from, to],
    queryFn: ({ signal }) => workspaceGitApi.developerActivity(workspaceId, {
      projectId, developerId, from: from || undefined, to: to || undefined,
    }, signal),
    retry: false,
  });
  const data = activity.data;
  const total = data?.developers.length ?? 0;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(total / 10) - 1));
  const rows = data?.developers.slice(currentPage * 10, currentPage * 10 + 10) ?? [];

  return <Card>
    <CardHeader className="space-y-3">
      <div>
        <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" />Developer Activity</CardTitle>
        <CardDescription>Recorded commit and pull request activity by Workspace member. These signals describe participation, not productivity.</CardDescription>
      </div>
      <div className="flex flex-wrap gap-2">
        <GitProjectSelect {...projectFilter} label="Filter developer activity by Project" onChange={value => {
          setProjectId(value); setDeveloperId(undefined); setPage(0);
        }} />
        <Select value={developerId?.toString() ?? "all"} onValueChange={value => { setDeveloperId(value === "all" ? undefined : Number(value)); setPage(0); }}>
          <SelectTrigger aria-label="Filter by developer" className="w-56"><SelectValue placeholder="All developers" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All developers</SelectItem>
            {(options.data?.developers ?? []).map(developer => <SelectItem key={developer.id} value={String(developer.id)}>
              {developer.name}{developer.login ? ` (@${developer.login})` : ""}
            </SelectItem>)}
          </SelectContent>
        </Select>
        <Input aria-label="Developer activity from date" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(0); }} className="w-40" />
        <Input aria-label="Developer activity to date" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(0); }} className="w-40" />
        <Button type="button" variant="outline" size="sm" onClick={() => {
          void options.refetch(); void activity.refetch();
        }} disabled={options.isFetching || activity.isFetching}>
          <RefreshCw className={`mr-1 size-4 ${activity.isFetching ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      {activity.isPending ? <div className="grid gap-2 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
        : activity.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
          <span>{errorMessage(activity.error)}</span><Button type="button" size="sm" variant="outline" onClick={() => void activity.refetch()}>Retry</Button>
        </div> : <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Commits" value={data?.totalCommits ?? 0} />
            <Metric label="Pull Requests" value={data?.totalPullRequests ?? 0} />
            <Metric label="Merged Pull Requests" value={data?.mergedPullRequests ?? 0} />
          </div>
          {(data?.developers.length ?? 0) === 0 ? <WorkspaceEmptyState icon={Activity}
            title="No developer activity" description="Members and Git contributors will appear here when they are available in the selected scope." compact />
            : <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Developer</TableHead><TableHead>Commits</TableHead><TableHead>PRs created</TableHead><TableHead>PRs merged</TableHead><TableHead>Active days</TableHead><TableHead>Last activity</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Mapping</TableHead></TableRow></TableHeader>
                <TableBody>{rows.map(row => <TableRow key={`${row.developerId ?? "unmapped"}-${row.contributorId ?? "unknown"}`}>
                  <TableCell><span className="font-medium">{row.name}</span>{row.login && <span className="block text-xs text-muted-foreground">@{row.login}</span>}</TableCell>
                  <TableCell>{row.commits}</TableCell><TableCell>{row.pullRequests}</TableCell><TableCell>{row.mergedPullRequests}</TableCell>
                  <TableCell>{row.activeDays}</TableCell><TableCell className="whitespace-nowrap">{formatDate(row.lastActiveAt)}</TableCell>
                  <TableCell>{row.unmapped ? <Badge variant="outline">Unmapped Contributor</Badge>
                    : row.noActivity ? <Badge variant="secondary">No Activity</Badge> : <Badge variant="outline">Active</Badge>}</TableCell>
                  <TableCell className="text-right">{row.unmapped ? <Button asChild type="button" size="sm" variant="outline">
                    <Link to={`/management/workspaces/${workspaceId}?tab=github&view=members${projectId ? `&project=${projectId}` : ""}`}>Assign to member</Link>
                  </Button> : "—"}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>}
          {total > 0 && <GitListPagination page={currentPage} total={total} onChange={setPage} label="contributors" loading={activity.isFetching} />}
        </>}
    </CardContent>
  </Card>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border bg-card px-3 py-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
  </div>;
}
