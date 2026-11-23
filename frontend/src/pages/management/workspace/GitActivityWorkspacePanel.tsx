import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, BarChart3, ClipboardCheck, ExternalLink, FileBarChart2, GitBranch, GitCommitHorizontal,
  GitPullRequest, ListTodo, Search, Settings2, Users } from "lucide-react";
import { workspaceGitApi, type GitCommitGranularity } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkspaceEmptyState } from "./workspace.shared";
import { usePermissions } from "@/hooks/usePermissions";
import { GitPullRequestsWorkspacePanel } from "./GitPullRequestsWorkspacePanel";
import { GitCommitAnalyticsWorkspacePanel, type GitCommitDrilldown } from "./GitCommitAnalyticsWorkspacePanel";
import { GitDeveloperActivityWorkspacePanel } from "./GitDeveloperActivityWorkspacePanel";
import { GitDevelopmentReportWorkspacePanel } from "./GitDevelopmentReportWorkspacePanel";
import { GitDevelopmentRulesWorkspacePanel } from "./GitDevelopmentRulesWorkspacePanel";
import { GitUnmappedActivitiesWorkspacePanel } from "./GitUnmappedActivitiesWorkspacePanel";
import { GitDevelopmentComplianceWorkspacePanel } from "./GitDevelopmentComplianceWorkspacePanel";

const GIT_SECTIONS = [
  { id: "commit-analytics", label: "Commit analytics", icon: BarChart3, description: "Commit trend, contributors and branches." },
  { id: "commits", label: "Commits", icon: GitCommitHorizontal, description: "Search, filter and inspect commit history." },
  { id: "pr-analytics", label: "PR analytics", icon: BarChart3, description: "PR states, merge time and developer activity." },
  { id: "pull-requests", label: "Pull Requests", icon: GitPullRequest, description: "Browse PRs and inspect submitted reviews." },
  { id: "reviews", label: "Code reviews", icon: ClipboardCheck, description: "Review outcomes and first response time." },
  { id: "contributors", label: "Contributors", icon: Users, description: "Member contribution and unmapped accounts." },
  { id: "unmapped", label: "Unmapped", icon: ListTodo, description: "Find Git activity without Task links." },
  { id: "rules", label: "Rules", icon: Settings2, description: "Configure commit message and Task ID checks." },
  { id: "compliance", label: "Compliance", icon: ClipboardCheck, description: "Review saved rule validation results." },
  { id: "reports", label: "Reports", icon: FileBarChart2, description: "Open project or sprint development reports." },
] as const;
type GitSectionId = typeof GIT_SECTIONS[number]["id"];

function validSection(value: string | null): GitSectionId {
  return GIT_SECTIONS.find(section => section.id === value)?.id ?? "commit-analytics";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not load Git Activity.";
}

export function GitActivityWorkspacePanel({ workspaceId, projectId: initialProjectId }: { workspaceId: number; projectId?: number }) {
  const { user, activeRole } = usePermissions();
  const [params, setParams] = useSearchParams();
  const activeSection = validSection(params.get("gitSection"));
  const taskIdValue = params.get("taskId");
  const taskId = taskIdValue && /^\d+$/.test(taskIdValue) ? Number(taskIdValue) : undefined;
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [projectId, setProjectId] = useState<number | undefined>();
  const [developerId, setDeveloperId] = useState<number | undefined>();
  const [contributorId, setContributorId] = useState<number | undefined>();
  const [branch, setBranch] = useState<string | undefined>();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [granularity, setGranularity] = useState<GitCommitGranularity>("day");
  const [includeBots, setIncludeBots] = useState(false);
  const [includeMergeCommits, setIncludeMergeCommits] = useState(false);
  const [detailInclusion, setDetailInclusion] = useState<{ includeBots: boolean; includeMergeCommits: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [selectedCommitId, setSelectedCommitId] = useState<number | null>(null);
  const status = useQuery({
    queryKey: ["git-activity", "status", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceGitApi.activityStatus(workspaceId, signal),
    retry: false,
  });
  const filters = useQuery({
    queryKey: ["git-activity", "filters", workspaceId, user.email, activeRole, projectId],
    queryFn: ({ signal }) => workspaceGitApi.activityFilters(workspaceId, projectId, signal),
    retry: false,
  });
  const history = useQuery({
    queryKey: ["git-activity", "commits", workspaceId, user.email, activeRole, deferredSearch,
      sort, page, taskId, projectId, developerId, contributorId, branch, from, to, detailInclusion],
    queryFn: ({ signal }) => workspaceGitApi.commits(workspaceId, {
      search: deferredSearch || undefined, sort, page, size: 20, taskId,
      projectId, developerId, contributorId, branch,
      includeBots: detailInclusion?.includeBots, includeMergeCommits: detailInclusion?.includeMergeCommits,
      from: from || undefined, to: to || undefined,
    }, signal),
    retry: false,
  });
  const details = useQuery({
    queryKey: ["git-activity", "commit", workspaceId, user.email, activeRole, selectedCommitId],
    queryFn: ({ signal }) => workspaceGitApi.commit(workspaceId, selectedCommitId!, signal),
    enabled: selectedCommitId !== null,
    retry: false,
  });

  const repo = status.data;
  const rows = history.data?.content ?? [];
  const sectionInfo = GIT_SECTIONS.find(section => section.id === activeSection) ?? GIT_SECTIONS[0];
  const workspaceProjectLabel = initialProjectId == null ? null
    : filters.data?.projects.find(project => project.id === initialProjectId)?.name ?? `Project #${initialProjectId}`;
  const changeSection = (section: string) => {
    setSelectedCommitId(null);
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("gitSection", section);
      return next;
    });
  };
  const applyDrilldown = (filters: GitCommitDrilldown) => {
    if ("developerId" in filters || "contributorId" in filters) {
      setDeveloperId(filters.developerId);
      setContributorId(filters.contributorId);
    }
    if ("branch" in filters) setBranch(filters.branch);
    if ("from" in filters) setFrom(filters.from ?? "");
    if ("to" in filters) setTo(filters.to ?? "");
    setPage(0);
  };
  const showHistory = (inclusion: { includeBots: boolean; includeMergeCommits: boolean }) => {
    setDetailInclusion(inclusion);
    setSearch("");
    setPage(0);
    changeSection("commits");
  };
  const pullRequestView = activeSection === "pr-analytics" ? "analytics"
    : activeSection === "pull-requests" ? "pull-requests" : "reviews";
  return <div className="space-y-4">
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b bg-gradient-to-r from-slate-50 via-white to-blue-50/60 px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900"><span className="grid size-8 place-items-center rounded-lg bg-blue-100 text-blue-700"><GitBranch className="size-4" /></span>Git Activity</CardTitle>
          <CardDescription>Repository activity shared by this Workspace and its accessible modules.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {repo?.mockData && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Mock data</Badge>}
          {status.isPending ? <Skeleton className="h-6 w-28" /> : status.isError
            ? <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-800">Status unavailable</Badge>
            : repo?.connected && <SyncStatusBadge status={repo.syncStatus} repositoryStatus={repo.status} mockData={repo.mockData} />}
          {status.isError && <Button type="button" size="sm" variant="outline" onClick={() => void status.refetch()}>Retry</Button>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">Repository</span>
          {repo?.repositoryName ? repo.repositoryUrl
            ? <a className="inline-flex min-w-0 items-center gap-1 truncate font-medium text-blue-700 hover:underline" href={repo.repositoryUrl} target="_blank" rel="noreferrer">
              {repo.repositoryName}<ExternalLink className="size-3 shrink-0" /></a>
            : <span className="truncate font-medium text-slate-800">{repo.repositoryName}</span>
            : <span className="font-medium text-slate-700">No repository linked</span>}
        </div>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex flex-wrap items-center gap-2"><span className="text-muted-foreground">Data scope</span>
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">Workspace and accessible modules</Badge>
          {workspaceProjectLabel && <Badge variant="secondary" className="max-w-52 truncate">Project context: {workspaceProjectLabel}</Badge>}
        </div>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex items-center gap-2 text-muted-foreground">
          Last synced <span className="font-medium text-slate-700">{repo?.lastSyncedAt ? formatDate(repo.lastSyncedAt) : "Not available"}</span>
        </div>
        {repo?.status === "INACTIVE" && <p className="w-full text-xs text-amber-800">No repository is linked now. Historical activity is retained.</p>}
        {(repo?.status === "DISCONNECTED" || repo?.status === "ERROR") && <p className="w-full text-xs text-amber-800">Repository metadata and history are retained while the connection is repaired.</p>}
        {repo?.mockData && <p className="w-full text-xs text-amber-800">Sample activity is shown; GitHub links will be available after connection.</p>}
        {!repo?.connected && !repo?.repositoryName && !status.isPending && !status.isError && <p className="w-full text-xs text-muted-foreground">Link a repository to view synchronized commit and Pull Request activity.</p>}
      </CardContent>
    </Card>

    <div className="min-w-0 overflow-x-auto rounded-xl border bg-white p-1 shadow-sm" role="tablist" aria-label="Git Activity sections">
      <div className="flex w-max min-w-full gap-1">
        {GIT_SECTIONS.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab"
          id={`git-tab-${id}`} aria-controls={`git-panel-${id}`} aria-selected={activeSection === id}
          tabIndex={activeSection === id ? 0 : -1} onClick={() => changeSection(id)}
          onKeyDown={event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const index = GIT_SECTIONS.findIndex(section => section.id === activeSection);
            const offset = event.key === "ArrowRight" ? 1 : -1;
            const next = GIT_SECTIONS[(index + offset + GIT_SECTIONS.length) % GIT_SECTIONS.length];
            changeSection(next.id);
            window.requestAnimationFrame(() => document.getElementById(`git-tab-${next.id}`)?.focus());
          }}
          className={`inline-flex h-10 flex-none items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeSection === id
            ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
          <Icon className="size-4" />{label}
        </button>)}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <div><p className="text-sm font-semibold text-slate-900">{sectionInfo.label}</p><p className="text-xs text-muted-foreground">{sectionInfo.description}</p></div>
      {taskId && <Badge variant="outline" className="border-blue-200 bg-blue-50 font-mono text-blue-800">Filtered to TASK-{taskId}</Badge>}
    </div>

    <section id={`git-panel-${activeSection}`} role="tabpanel" aria-labelledby={`git-tab-${activeSection}`} tabIndex={0} className="min-w-0 space-y-4 outline-none">
    <div hidden={activeSection !== "commit-analytics"}>
      <GitCommitAnalyticsWorkspacePanel active={activeSection === "commit-analytics"} workspaceId={workspaceId} projectId={projectId} taskId={taskId}
        developerId={developerId} contributorId={contributorId} branch={branch}
        from={from} to={to} granularity={granularity} includeBots={includeBots} includeMergeCommits={includeMergeCommits}
        onGranularityChange={setGranularity} onIncludeBotsChange={setIncludeBots}
        onIncludeMergeCommitsChange={setIncludeMergeCommits} onBranchChange={value => { setBranch(value); setPage(0); }}
        onDrilldown={applyDrilldown} onShowHistory={showHistory} />
    </div>

    <div hidden={activeSection !== "commits"}>
    <Card id="git-commit-history" className="overflow-hidden shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="text-base">Commits</CardTitle>
            <CardDescription>Search covers every commit you can access in this Workspace.</CardDescription></div>
          {history.data && <Badge variant="outline">{history.data.totalElements} commits</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input aria-label="Search commits" placeholder="Search SHA, message or author" value={search}
              onChange={event => { setSearch(event.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={sort} onValueChange={value => { if (value === "newest" || value === "oldest") { setSort(value); setPage(0); } }}>
            <SelectTrigger aria-label="Sort commits" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem></SelectContent>
          </Select>
          <Select value={projectId?.toString() ?? "all"} onValueChange={value => {
            setProjectId(value === "all" ? undefined : Number(value)); setDeveloperId(undefined);
            setContributorId(undefined); setPage(0);
          }}>
            <SelectTrigger aria-label="Filter by Project" className="w-48"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Projects</SelectItem>
              {(filters.data?.projects ?? []).map(project => <SelectItem key={project.id} value={project.id.toString()}>{project.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={developerId?.toString() ?? "all"} onValueChange={value => {
            setDeveloperId(value === "all" ? undefined : Number(value)); setContributorId(undefined);
            setPage(0);
          }}>
            <SelectTrigger aria-label="Filter by developer" className="w-48"><SelectValue placeholder="All developers" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All developers</SelectItem>
              {(filters.data?.developers ?? []).map(developer => <SelectItem key={developer.id} value={developer.id.toString()}>
                {developer.name}{developer.login ? ` (@${developer.login})` : ""}
              </SelectItem>)}
            </SelectContent>
          </Select>
          <Input aria-label="From date" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(0); }} className="w-40" />
          <Input aria-label="To date" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(0); }} className="w-40" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {contributorId != null && <div className="flex flex-wrap items-center gap-2" aria-label="Active contributor filter">
          <Badge variant="outline">Contributor #{contributorId}</Badge>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => { setContributorId(undefined); setPage(0); }}>
            Clear contributor filter
          </Button>
        </div>}
        {history.isPending ? <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          : history.isError ? <WorkspaceEmptyState icon={GitBranch} title="Could not load commits"
            description={errorMessage(history.error)} action={<Button variant="outline" onClick={() => void history.refetch()}>Retry</Button>} />
          : rows.length === 0 ? <WorkspaceEmptyState icon={GitBranch}
            title={taskId ? "No Git activity for this task" : "No commits yet"}
            description={repo?.mockData ? "The mock repository does not have a matching commit." : "Synced commits will appear here when they are available."} compact />
          : <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Commit</TableHead><TableHead>Author</TableHead><TableHead>Committed</TableHead><TableHead>Branch</TableHead><TableHead>Tasks</TableHead><TableHead className="text-right">Source</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map(commit => <TableRow key={commit.id}>
                <TableCell className="max-w-[28rem]">
                  <button type="button" className="block max-w-full text-left" onClick={() => setSelectedCommitId(commit.id)}>
                    <span className="block truncate font-medium hover:underline">{commit.message.split("\n")[0] || "(no message)"}</span>
                    <span className="font-mono text-xs text-muted-foreground">{commit.shortSha}</span>
                  </button>
                </TableCell>
                <TableCell><span>{commit.authorName}</span>{commit.authorLogin && <span className="block text-xs text-muted-foreground">@{commit.authorLogin}</span>}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(commit.committedAt)}</TableCell>
                <TableCell>{commit.branch ?? "—"}</TableCell>
                <TableCell>{commit.tasks.length ? commit.tasks.map(task => <Badge key={task.taskId} variant="outline" className="mr-1 max-w-44 truncate">{task.title}</Badge>) : "—"}</TableCell>
                <TableCell className="text-right">{commit.htmlUrl ? <Button asChild variant="ghost" size="sm">
                  <a href={commit.htmlUrl} target="_blank" rel="noreferrer" aria-label={`View commit ${commit.shortSha} on GitHub`}>GitHub <ArrowUpRight className="ml-1 size-3.5" /></a>
                </Button> : <span className="text-xs text-muted-foreground">Pending link</span>}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>}
        {history.data && history.data.totalPages > 1 && <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {page + 1} of {history.data.totalPages}</span>
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0 || history.isFetching} onClick={() => setPage(value => Math.max(0, value - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= history.data.totalPages || history.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></div>
        </div>}
      </CardContent>
    </Card>
    </div>

    <div hidden={activeSection !== "unmapped"}>
      <GitUnmappedActivitiesWorkspacePanel workspaceId={workspaceId} initialProjectId={initialProjectId} />
    </div>
    <div hidden={!(["pr-analytics", "pull-requests", "reviews"] as string[]).includes(activeSection)}>
      <GitPullRequestsWorkspacePanel workspaceId={workspaceId} taskId={taskId} view={pullRequestView} />
    </div>
    <div hidden={activeSection !== "contributors"}>
      <GitDeveloperActivityWorkspacePanel workspaceId={workspaceId} initialProjectId={initialProjectId} />
    </div>
    <div hidden={activeSection !== "rules"}><GitDevelopmentRulesWorkspacePanel workspaceId={workspaceId} /></div>
    <div hidden={activeSection !== "compliance"}><GitDevelopmentComplianceWorkspacePanel workspaceId={workspaceId} /></div>
    <div hidden={activeSection !== "reports"}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2">
        <p className="text-xs text-amber-900">Compliance results have a separate view so report filters and validation details stay easy to scan.</p>
        <Button type="button" size="sm" variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
          onClick={() => changeSection("compliance")}><ClipboardCheck className="size-4" />View compliance</Button>
      </div>
      <GitDevelopmentReportWorkspacePanel workspaceId={workspaceId} initialProjectId={initialProjectId} showCompliance={false} />
    </div>

    <Dialog open={selectedCommitId !== null} onOpenChange={open => { if (!open) setSelectedCommitId(null); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Commit details</DialogTitle><DialogDescription>Synced commit metadata and permitted Task links.</DialogDescription></DialogHeader>
        {details.isPending ? <div className="space-y-2"><Skeleton className="h-5 w-56" /><Skeleton className="h-24 w-full" /></div>
          : details.isError ? <p role="alert" className="text-sm text-destructive">{errorMessage(details.error)}</p>
          : details.data && <div className="space-y-4">
            <div><pre className="whitespace-pre-wrap break-words font-sans text-sm font-medium">{details.data.message || "(no message)"}</pre><p className="mt-1 font-mono text-xs text-muted-foreground">{details.data.sha}</p></div>
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Author</dt><dd>{details.data.authorName}{details.data.authorLogin ? ` (@${details.data.authorLogin})` : ""}</dd>
              <dt className="text-muted-foreground">Committed</dt><dd>{formatDate(details.data.committedAt)}</dd>
              <dt className="text-muted-foreground">Branch</dt><dd>{details.data.branch ?? "—"}</dd>
              <dt className="text-muted-foreground">Repository</dt><dd>{details.data.repositoryName}</dd>
            </dl>
            <div className="space-y-2"><p className="text-sm font-medium">Linked tasks</p>
              {details.data.tasks.length ? details.data.tasks.map(task => <div key={task.taskId} className="rounded-md border px-3 py-2 text-sm">{task.title} <span className="text-muted-foreground">· #{task.taskId} · {task.source}</span></div>)
                : <p className="text-sm text-muted-foreground">No Task is linked to this commit.</p>}</div>
            {details.data.htmlUrl ? <Button asChild><a href={details.data.htmlUrl} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight className="ml-1 size-4" /></a></Button>
              : <p className="text-sm text-muted-foreground">View on GitHub will be available after the repository is connected.</p>}
          </div>}
      </DialogContent>
    </Dialog>
    </section>
  </div>;
}

function SyncStatusBadge({ status, repositoryStatus, mockData }: {
  status: string | null; repositoryStatus: string | null; mockData: boolean;
}) {
  const normalized = status?.toUpperCase() ?? "NOT_SYNCED";
  const presentation: Record<string, { label: string; className: string }> = {
    READY: { label: mockData ? "Mock data ready" : "Synced", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    SYNCING: { label: "Syncing", className: "border-blue-200 bg-blue-50 text-blue-800" },
    PARTIAL: { label: "Partially synced", className: "border-amber-200 bg-amber-50 text-amber-800" },
    ERROR: { label: "Sync error", className: "border-rose-200 bg-rose-50 text-rose-800" },
    NOT_SYNCED: { label: repositoryStatus === "DISCONNECTED" ? "Disconnected" : "Not synced", className: "border-slate-200 bg-slate-100 text-slate-700" },
  };
  const item = presentation[normalized] ?? { label: normalized.replaceAll("_", " "), className: "border-slate-200 bg-slate-100 text-slate-700" };
  return <Badge variant="outline" className={item.className}>{item.label}</Badge>;
}
