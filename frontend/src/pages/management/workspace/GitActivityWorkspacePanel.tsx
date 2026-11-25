import { useGitActivityParam } from "./git-activity-url-context";
import { useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { GitActivityUrlState } from "./git-activity-url-state";
import { useGitActivityRefresh } from "./useGitActivityRefresh";
import { ArrowUpRight, ClipboardCheck, FileBarChart2, GitBranch, GitCommitHorizontal,
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
import type { WorkspaceAssignmentContext } from "@/types/features/project-assignment";
import { GitProjectScopeContext, gitProjectScope, useGitProjectFilter } from "./git-project-scope";
import { GitProjectSelect } from "./GitProjectSelect";
import { GitLinkedTasks, GitTaskBadges } from "./GitDetailLists";

const GIT_SECTIONS = [
  { id: "commits", label: "Commits", icon: GitCommitHorizontal, description: "Commit overview, trends and searchable history." },
  { id: "pull-requests", label: "Pull Requests", icon: GitPullRequest, description: "PR overview, merge time and searchable history." },
  { id: "reviews", label: "Code reviews", icon: ClipboardCheck, description: "Review outcomes and first response time." },
  { id: "contributors", label: "Contributors", icon: Users, description: "Member contribution and unmapped accounts." },
  { id: "unmapped", label: "Unmapped", icon: ListTodo, description: "Find Git activity without Task links." },
  { id: "rules", label: "Rules", icon: Settings2, description: "Configure commit message and Task ID checks." },
  { id: "compliance", label: "Compliance", icon: ClipboardCheck, description: "Review saved rule validation results." },
  { id: "reports", label: "Reports", icon: FileBarChart2, description: "Open project or sprint development reports." },
] as const;
type GitSectionId = typeof GIT_SECTIONS[number]["id"];

function validSection(value: string | null): GitSectionId {
  if (value === "commit-analytics") return "commits";
  if (value === "pr-analytics") return "pull-requests";
  return GIT_SECTIONS.find(section => section.id === value)?.id ?? "commits";
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

export function GitActivityWorkspacePanel({ workspaceId, projectId: initialProjectId, projectScope }: {
  workspaceId: number; projectId?: number; projectScope?: WorkspaceAssignmentContext;
}) {
  return <GitProjectScopeContext.Provider value={gitProjectScope(projectScope, initialProjectId!)}>
    <GitActivityUrlState><GitActivityContent workspaceId={workspaceId} initialProjectId={initialProjectId} /></GitActivityUrlState>
  </GitProjectScopeContext.Provider>;
}

function GitActivityContent({ workspaceId, initialProjectId }: { workspaceId: number; initialProjectId?: number }) {
  const { user, activeRole } = usePermissions();
  const [params] = useSearchParams();
  const location = useLocation();
  const [section, setSection] = useGitActivityParam<string>("gitSection", "commits");
  const taskIdValue = params.get("taskId");
  const taskId = taskIdValue && /^\d+$/.test(taskIdValue) ? Number(taskIdValue) : undefined;
  const sections = taskId ? GIT_SECTIONS.filter(item => ["commits", "pull-requests"].includes(item.id)) : GIT_SECTIONS;
  const requestedSection = validSection(section);
  const activeSection = sections.some(item => item.id === requestedSection) ? requestedSection : "commits";
  const task = useQuery({
    queryKey: ["git-activity", "task-context", workspaceId, taskId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceGitApi.taskContext(workspaceId, taskId!, signal),
    enabled: taskId != null, retry: false,
  });
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const returnParams = new URLSearchParams(returnTo?.split("?")[1]);
  returnParams.set("tab", params.get("gitReturnTab") === "sprints" ? "sprints" : "backlog");
  if (!returnTo && (params.get("gitReturnProject") || task.data?.projectId)) {
    returnParams.set("project", params.get("gitReturnProject") ?? String(task.data?.projectId));
  }
  if (taskId) returnParams.set("itemId", String(taskId));
  const taskReturnUrl = `/management/workspaces/${workspaceId}?${returnParams}`;
  const [search, setSearch] = useGitActivityParam<string>("gitCommitSearch", "");
  const deferredSearch = useDeferredValue(search.trim());
  const [sort, setSort] = useGitActivityParam<"newest" | "oldest">("gitCommitSort", "newest");
  const projectFilter = useGitProjectFilter("gitCommitProjectId");
  const { projectId, setProjectId } = projectFilter;
  const [developerId, setDeveloperId] = useGitActivityParam<number | undefined>("gitCommitDeveloperId", undefined, "number");
  const [contributorId, setContributorId] = useGitActivityParam<number | undefined>("gitCommitContributorId", undefined, "number");
  const [branch, setBranch] = useGitActivityParam<string | undefined>("gitCommitBranch", undefined);
  const [from, setFrom] = useGitActivityParam<string>("gitCommitFrom", "");
  const [to, setTo] = useGitActivityParam<string>("gitCommitTo", "");
  const [granularity, setGranularity] = useGitActivityParam<GitCommitGranularity>("gitCommitGranularity", "day");
  const includeBots = true;
  const [includeMergeCommits, setIncludeMergeCommits] = useGitActivityParam<boolean>("gitCommitIncludeMergeCommits", false);
  const [page, setPage] = useGitActivityParam<number>("gitCommitPage", 0);
  const [selectedCommitId, setSelectedCommitId] = useGitActivityParam<number | null>("gitCommitDetail", null, "number");
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
      sort, page, taskId, projectId, developerId, contributorId, branch, from, to, includeBots, includeMergeCommits],
    queryFn: ({ signal }) => workspaceGitApi.commits(workspaceId, {
      search: deferredSearch || undefined, sort, page, size: 20, taskId,
      projectId, developerId, contributorId, branch,
      includeBots, includeMergeCommits,
      from: from || undefined, to: to || undefined,
    }, signal),
    enabled: activeSection === "commits",
    retry: false,
  });
  const details = useQuery({
    queryKey: ["git-activity", "commit", workspaceId, user.email, activeRole, selectedCommitId],
    queryFn: ({ signal }) => workspaceGitApi.commit(workspaceId, selectedCommitId!, signal),
    enabled: selectedCommitId !== null,
    retry: false,
  });

  const repo = status.data;
  useGitActivityRefresh(repo != null && !repo.mockData, repo?.syncStatus);
  const rows = history.data?.content ?? [];
  const sectionInfo = GIT_SECTIONS.find(section => section.id === activeSection) ?? GIT_SECTIONS[0];
  const changeSection = (section: string) => {
    setSelectedCommitId(null);
    setSection(section);
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
  const showHistory = (inclusion: { includeMergeCommits: boolean }) => {
    setIncludeMergeCommits(inclusion.includeMergeCommits);
    setSearch("");
    setPage(0);
    document.getElementById("git-commit-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const pullRequestView = activeSection === "pull-requests" ? "pull-requests" : "reviews";
  return <div className="space-y-4">
    <div className="min-w-0 overflow-x-auto rounded-xl border bg-white p-1 shadow-sm" role="tablist" aria-label="Git Activity sections">
      <div className="flex w-max min-w-full gap-1">
        {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab"
          id={`git-tab-${id}`} aria-controls={`git-panel-${id}`} aria-selected={activeSection === id}
          tabIndex={activeSection === id ? 0 : -1} onClick={() => changeSection(id)}
          onKeyDown={event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const index = sections.findIndex(section => section.id === activeSection);
            const offset = event.key === "ArrowRight" ? 1 : -1;
            const next = sections[(index + offset + sections.length) % sections.length];
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
      {taskId && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div><Badge variant="outline" className="border-blue-200 bg-white font-mono text-blue-800">{params.get("taskCode") ?? `TASK-${taskId}`}</Badge>
          <p className="mt-1 text-sm font-medium text-blue-950">{task.data?.title ?? (task.isPending ? "Loading task…" : "Task unavailable")}</p>
          <p className="text-xs text-blue-800">Showing only Git activities linked to this task.</p>
          {task.isError && <p role="alert" className="text-xs text-destructive">{errorMessage(task.error)}</p>}
        </div>
        <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to={taskReturnUrl}>Back to task</Link></Button>
          <Button asChild size="sm" variant="ghost"><Link to={`/management/workspaces/${workspaceId}?tab=git-activity${initialProjectId ? `&project=${initialProjectId}` : ""}`}>All Workspace activity</Link></Button>
        </div>
      </div>}
    </div>

    <section id={`git-panel-${activeSection}`} role="tabpanel" aria-labelledby={`git-tab-${activeSection}`} tabIndex={0} className="min-w-0 space-y-4 outline-none">
    <div hidden={activeSection !== "commits"}>
    <Card id="git-commit-history" className="overflow-hidden shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="text-base">Commits</CardTitle>
            <CardDescription>Project, developer, branch and date filters apply to the overview and history. Search filters the list.</CardDescription></div>
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
          <GitProjectSelect {...projectFilter} onChange={value => {
            setProjectId(value); setDeveloperId(undefined);
            setContributorId(undefined); setPage(0);
          }} label="Filter by Project" className="w-48" />
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
        <GitCommitAnalyticsWorkspacePanel active={activeSection === "commits"} workspaceId={workspaceId} projectId={projectId} taskId={taskId}
          developerId={developerId} contributorId={contributorId} branch={branch}
          from={from} to={to} granularity={granularity} includeMergeCommits={includeMergeCommits}
          onGranularityChange={setGranularity}
          onIncludeMergeCommitsChange={value => { setIncludeMergeCommits(value); setPage(0); }}
          onBranchChange={value => { setBranch(value); setPage(0); }}
          onDrilldown={applyDrilldown} onShowHistory={showHistory} />
        <h3 id="git-commit-list" className="scroll-mt-24 pt-2 text-sm font-semibold text-slate-900">Commit history</h3>
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
            <Table className="min-w-[56rem] table-fixed">
              <TableHeader><TableRow><TableHead>Commit</TableHead><TableHead className="w-36">Author</TableHead><TableHead className="w-40">Committed</TableHead><TableHead className="w-36">Branch</TableHead><TableHead className="w-36">Tasks</TableHead><TableHead className="w-28 text-right">Source</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map(commit => <TableRow key={commit.id}>
                <TableCell className="max-w-[28rem]">
                  <button type="button" className="block max-w-full text-left" onClick={() => setSelectedCommitId(commit.id)}>
                    <span className="block truncate font-medium hover:underline">{commit.message.split("\n")[0] || "(no message)"}</span>
                    <span className="font-mono text-xs text-muted-foreground">{commit.shortSha}</span>
                  </button>
                </TableCell>
                <TableCell><span className="block truncate" title={commit.authorName}>{commit.authorName}</span>{commit.authorLogin && <span className="block truncate text-xs text-muted-foreground" title={commit.authorLogin}>@{commit.authorLogin}</span>}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{formatDate(commit.committedAt)}</TableCell>
                <TableCell><span className="block truncate" title={commit.branch ?? undefined}>{commit.branch ?? "—"}</span></TableCell>
                <TableCell><GitTaskBadges tasks={commit.tasks} /></TableCell>
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
    <div hidden={!(activeSection === "pull-requests" || activeSection === "reviews")}>
      <GitPullRequestsWorkspacePanel active={activeSection === "pull-requests" || activeSection === "reviews"}
        workspaceId={workspaceId} taskId={taskId} initialProjectId={initialProjectId} view={pullRequestView} />
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
          : taskId && details.data && !details.data.tasks.some(task => task.taskId === taskId)
            ? <p role="alert" className="text-sm text-destructive">This commit is not linked to the selected task.</p>
          : details.data && <div className="space-y-4">
            <div><pre className="whitespace-pre-wrap break-words font-sans text-sm font-medium">{details.data.message || "(no message)"}</pre><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{details.data.sha}</p></div>
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Author</dt><dd>{details.data.authorName}{details.data.authorLogin ? ` (@${details.data.authorLogin})` : ""}</dd>
              <dt className="text-muted-foreground">Committed</dt><dd>{formatDate(details.data.committedAt)}</dd>
              <dt className="text-muted-foreground">Branch</dt><dd>{details.data.branch ?? "—"}</dd>
              <dt className="text-muted-foreground">Repository</dt><dd>{details.data.repositoryName}</dd>
            </dl>
            <div className="space-y-2"><p className="text-sm font-medium">Linked tasks</p>
              <GitLinkedTasks key={details.data.id} tasks={details.data.tasks} /></div>
            {details.data.htmlUrl ? <Button asChild><a href={details.data.htmlUrl} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight className="ml-1 size-4" /></a></Button>
              : <p className="text-sm text-muted-foreground">View on GitHub will be available after the repository is connected.</p>}
          </div>}
      </DialogContent>
    </Dialog>
    </section>
  </div>;
}

