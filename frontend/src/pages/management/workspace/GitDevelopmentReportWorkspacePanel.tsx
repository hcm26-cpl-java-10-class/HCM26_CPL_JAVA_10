import { useGitActivityParam } from "./git-activity-url-context";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Download, FileBarChart2, LoaderCircle } from "lucide-react";
import { workspaceGitApi, type GitDeveloperActivityRow, type GitProjectDevelopmentReport,
  type GitSprintDevelopmentReport, type GitTaskTraceability } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceEmptyState } from "./workspace.shared";
import { GitDevelopmentComplianceWorkspacePanel } from "./GitDevelopmentComplianceWorkspacePanel";

type ReportView = "project" | "sprint";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not load the development report.";
}

export function GitDevelopmentReportWorkspacePanel({ workspaceId, initialProjectId, showCompliance = true }: {
  workspaceId: number;
  initialProjectId?: number;
  showCompliance?: boolean;
}) {
  const { user, activeRole, hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const requestedReport = params.get("report");
  const view: ReportView = requestedReport === "sprint" ? "sprint" : "project";
  const [projectId, setProjectId] = useGitActivityParam<number | undefined>("gitReportProjectId", initialProjectId, "number");
  const [sprintId, setSprintId] = useGitActivityParam<number | undefined>("gitReportSprintId", undefined, "number");
  const [sprintProjectId, setSprintProjectId] = useGitActivityParam<number | undefined>("gitReportSprintProjectId", undefined, "number");
  const [developerId, setDeveloperId] = useGitActivityParam<number | undefined>("gitReportDeveloperId", undefined, "number");
  const [from, setFrom] = useGitActivityParam<string>("gitReportFrom", "");
  const [to, setTo] = useGitActivityParam<string>("gitReportTo", "");
  const [exporting, setExporting] = useState<"PDF" | "EXCEL" | null>(null);
  const options = useQuery({
    queryKey: ["git-activity", "report-options", workspaceId, user.email, activeRole, projectId],
    queryFn: ({ signal }) => workspaceGitApi.reportOptions(workspaceId, projectId, signal),
    retry: false,
  });
  const sprintOptions = options.data?.sprints ?? [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const defaultSprint = sprintOptions.find(sprint => sprint.name.startsWith("Git Activity Demo - Sprint Report"))
    ?? sprintOptions.find(sprint => sprint.startDate && sprint.endDate
      && sprint.startDate.slice(0, 10) <= today && sprint.endDate.slice(0, 10) >= today)
    ?? sprintOptions[0];
  const selectedSprintId = view === "sprint" ? sprintId ?? defaultSprint?.id : sprintId;
  const developerOptionsProjectId = sprintProjectId ?? projectId;
  const developerOptions = useQuery({
    queryKey: ["git-activity", "report-developer-options", workspaceId, user.email, activeRole, developerOptionsProjectId],
    queryFn: ({ signal }) => workspaceGitApi.reportOptions(workspaceId, developerOptionsProjectId, signal),
    retry: false,
  });
  const projectReport = useQuery({
    queryKey: ["git-activity", "project-report", workspaceId, user.email, activeRole, projectId, sprintId, developerId, from, to],
    queryFn: ({ signal }) => workspaceGitApi.projectDevelopmentReport(workspaceId, {
      projectId, sprintId, developerId, from: from || undefined, to: to || undefined,
    }, signal),
    enabled: view === "project",
    retry: false,
  });
  const sprintReport = useQuery({
    queryKey: ["git-activity", "sprint-report", workspaceId, user.email, activeRole, selectedSprintId],
    queryFn: ({ signal }) => workspaceGitApi.sprintDevelopmentReport(workspaceId, selectedSprintId!, signal),
    enabled: view === "sprint" && selectedSprintId != null,
    retry: false,
  });
  useEffect(() => {
    if (requestedReport !== "sprint" || !sprintReport.isSuccess) return;
    const frame = window.requestAnimationFrame(() => document.getElementById("git-development-reports")
      ?.scrollIntoView({ block: "start", behavior: "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [requestedReport, sprintReport.isSuccess]);
  const selectedProjectName = options.data?.projects.find(project => project.id === projectId)?.name;
  const reportReady = view === "sprint" ? sprintReport.isSuccess : projectReport.isSuccess;
  const exportReport = async (format: "PDF" | "EXCEL") => {
    if (!reportReady || exporting) return;
    setExporting(format);
    try {
      const response = view === "sprint"
        ? await workspaceGitApi.exportSprintDevelopmentReport(workspaceId, selectedSprintId!, format)
        : await workspaceGitApi.exportProjectDevelopmentReport(workspaceId, {
          projectId, sprintId, developerId, from: from || undefined, to: to || undefined, format,
        });
      const blobUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = "development-report-" + (view === "sprint" ? "sprint-" + selectedSprintId : "project")
        + (format === "PDF" ? ".pdf" : ".xlsx");
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success((format === "PDF" ? "PDF" : "Excel") + " report downloaded.");
    } catch {
      toast.error("Could not export this report. Check Workspace access and retry.");
    } finally {
      setExporting(null);
    }
  };

  return <Card id="git-development-reports">
    <CardHeader className="space-y-3">
      <div>
        <CardTitle className="flex items-center gap-2 text-base"><FileBarChart2 className="size-4" />Development Reports</CardTitle>
        <CardDescription>Project and Sprint reports use Workspace-authorized Git, Task and member data.</CardDescription>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={view} onValueChange={value => { if (value === "project" || value === "sprint") {
          setParams(previous => { const next = new URLSearchParams(previous); next.set("report", value); return next; }, { replace: true });
        } }}>
          <SelectTrigger aria-label="Report type" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="project">Project report</SelectItem><SelectItem value="sprint">Sprint report</SelectItem></SelectContent>
        </Select>
        <Select value={projectId?.toString() ?? "all"} onValueChange={value => {
          setProjectId(value === "all" ? undefined : Number(value)); setSprintId(undefined);
          setSprintProjectId(undefined); setDeveloperId(undefined);
        }}>
          <SelectTrigger aria-label="Filter report by Project" className="w-56"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Projects</SelectItem>
            {(options.data?.projects ?? []).map(project => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedSprintId?.toString() ?? "all"} onValueChange={value => {
          const selectedSprint = value === "all" ? undefined : sprintOptions.find(sprint => sprint.id === Number(value));
          setSprintId(selectedSprint?.id); setSprintProjectId(selectedSprint?.projectId); setDeveloperId(undefined);
        }}>
          <SelectTrigger aria-label="Filter report by Sprint" className="w-56"><SelectValue placeholder="All Sprints" /></SelectTrigger>
          <SelectContent>{view === "project" && <SelectItem value="all">All Sprints</SelectItem>}
            {sprintOptions.map(sprint => <SelectItem key={sprint.id} value={String(sprint.id)}>{sprint.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {view === "project" && <>
          <Select value={developerId?.toString() ?? "all"} onValueChange={value => setDeveloperId(value === "all" ? undefined : Number(value))}
            disabled={developerOptions.isPending}>
            <SelectTrigger aria-label="Filter report by developer" className="w-56"><SelectValue placeholder="All developers" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All developers</SelectItem>
              {(developerOptions.data?.developers ?? []).map(developer => <SelectItem key={developer.id} value={String(developer.id)}>
                {developer.name}{developer.login ? ` (@${developer.login})` : ""}
              </SelectItem>)}
            </SelectContent>
          </Select>
          <Input aria-label="Report from date" type="date" value={from} onChange={event => setFrom(event.target.value)} className="w-40" />
          <Input aria-label="Report to date" type="date" value={to} onChange={event => setTo(event.target.value)} className="w-40" />
        </>}
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {reportReady && <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" disabled={exporting !== null || !hasPermission("PROJECT_REPORT_EXPORT")}
          onClick={() => void exportReport("PDF")}>
          {exporting === "PDF" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export PDF
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={exporting !== null || !hasPermission("PROJECT_REPORT_EXPORT")}
          onClick={() => void exportReport("EXCEL")}>
          {exporting === "EXCEL" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export Excel
        </Button>
      </div>}
      {view === "sprint" ? selectedSprintId == null
        ? <WorkspaceEmptyState icon={FileBarChart2} title="Select a Sprint" description="Choose a Sprint to view its development report." compact />
        : sprintReport.isPending ? <ReportSkeleton />
          : sprintReport.isError ? <ReportError message={errorMessage(sprintReport.error)} retry={() => void sprintReport.refetch()} />
            : sprintReport.data && <SprintReport report={sprintReport.data} />
        : <>
            {projectReport.isPending ? <ReportSkeleton />
              : projectReport.isError ? <ReportError message={errorMessage(projectReport.error)} retry={() => void projectReport.refetch()} />
                : projectReport.data && <ProjectReport report={projectReport.data} selectedProjectName={selectedProjectName} />}
            {showCompliance && <GitDevelopmentComplianceWorkspacePanel workspaceId={workspaceId} />}
          </>}
    </CardContent>
  </Card>;
}

function ReportSkeleton() {
  return <div className="space-y-3"><Skeleton className="h-6 w-56" /><div className="grid gap-2 sm:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div></div>;
}

function ReportError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
    <span>{message}</span><Button type="button" size="sm" variant="outline" onClick={retry}>Retry</Button>
  </div>;
}

function ProjectReport({ report, selectedProjectName }: {
  report: GitProjectDevelopmentReport;
  selectedProjectName?: string;
}) {
  const data = report;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{data.projectName ?? selectedProjectName ?? "Project Overview"}</h3>
      {data.mockData && <Badge variant="secondary">Mock fixture</Badge>}
    </div>
    {!data.repositoryConfigured && <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      GitHub is not connected for this Project. Connect a repository in Workspace Git settings; project and task overview remains available.
    </div>}
    <MetricGrid items={[
      ["Commits", data.gitActivity.totalCommits], ["Pull Requests", data.gitActivity.totalPullRequests],
      ["PRs merged", data.gitActivity.mergedPullRequests], ["PRs open", data.gitActivity.openPullRequests],
      ["PRs closed without merge", data.gitActivity.closedWithoutMergePullRequests], ["Total tasks", data.totalTasks],
      ["To do", data.todoTasks], ["In progress", data.inProgressTasks], ["In review", data.reviewTasks], ["Done", data.doneTasks],
    ]} />
    <p className="text-xs text-muted-foreground">Pull Requests counts PRs created in the selected range; PRs merged counts merges in the range. A PR created earlier may count only as merged.</p>
    {!data.repositoryConfigured && data.gitActivity.totalCommits + data.gitActivity.totalPullRequests
      + data.gitActivity.mergedPullRequests === 0
      ? <WorkspaceEmptyState icon={FileBarChart2} title="No Git activity yet" description="Git statistics will appear after the repository is connected and activity is synced." compact />
      : null}
    <Traceability trace={data.taskTraceability} />
    <DeveloperTable rows={data.developerActivity} />
  </div>;
}

function SprintReport({ report }: { report: GitSprintDevelopmentReport }) {
  const overview = report.sprintOverview;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-semibold">{overview.name}</h3><p className="text-xs text-muted-foreground">{formatDate(overview.startDate)} – {formatDate(overview.endDate)}</p></div>
      {report.mockData && <Badge variant="secondary">Mock fixture</Badge>}
    </div>
    <section aria-label="Sprint Overview" className="space-y-2"><h4 className="text-sm font-medium">Sprint Overview</h4>
      <MetricGrid items={[["Total tasks", overview.totalTasks], ["To do", overview.todoTasks], ["In progress", overview.inProgressTasks],
        ["In review", overview.reviewTasks], ["Done", overview.doneTasks], ["Unfinished", overview.unfinishedTasks]]} />
    </section>
    <section aria-label="Sprint Git Activity" className="space-y-2"><h4 className="text-sm font-medium">Git Activity</h4>
      <MetricGrid items={[["Commits", report.gitActivity.totalCommits], ["Pull Requests", report.gitActivity.totalPullRequests],
        ["Merged", report.gitActivity.mergedPullRequests], ["Open", report.gitActivity.openPullRequests],
        ["Closed without merge", report.gitActivity.closedWithoutMergePullRequests]]} />
      <p className="text-xs text-muted-foreground">Pull Requests counts PRs created during the Sprint; Merged counts merges during the Sprint. A PR created earlier may count only as merged.</p>
      {report.gitActivity.totalCommits + report.gitActivity.totalPullRequests
        + report.gitActivity.mergedPullRequests === 0 && <p className="text-sm text-muted-foreground">No Git activity was synced in this Sprint date range.</p>}
    </section>
    <Traceability trace={report.taskTraceability} />
    <DeveloperTable rows={report.developerActivity} />
  </div>;
}

function Traceability({ trace }: { trace: GitTaskTraceability }) {
  return <section aria-label="Task Traceability" className="space-y-2">
    <h4 className="text-sm font-medium">Task Traceability</h4>
    <MetricGrid items={[["Tasks with commits", trace.tasksWithCommits], ["Tasks with PRs", trace.tasksWithPullRequests],
      ["Tasks without Git activity", trace.tasksWithoutGitActivity], ["Commits without Task links", trace.unmappedCommits],
      ["PRs without Task links", trace.unmappedPullRequests]]} />
    <p className="text-xs text-muted-foreground">A task without linked Git activity is not evidence that the task was not completed.</p>
  </section>;
}

function DeveloperTable({ rows }: { rows: GitDeveloperActivityRow[] }) {
  return <section aria-label="Report Developer Activity" className="space-y-2">
    <h4 className="text-sm font-medium">Developer Activity</h4>
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">No member or contributor activity is available for these filters.</p>
      : <div className="overflow-x-auto rounded-md border">
        <Table><TableHeader><TableRow><TableHead>Developer</TableHead><TableHead>Commits</TableHead><TableHead>PRs</TableHead><TableHead>PRs merged</TableHead><TableHead>Active days</TableHead><TableHead>Last activity</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map(row => <TableRow key={`${row.developerId ?? "unmapped"}-${row.contributorId ?? "unknown"}`}>
            <TableCell><span className="font-medium">{row.name}</span>{row.login && <span className="block text-xs text-muted-foreground">@{row.login}</span>}</TableCell>
            <TableCell>{row.commits}</TableCell><TableCell>{row.pullRequests}</TableCell><TableCell>{row.mergedPullRequests}</TableCell>
            <TableCell>{row.activeDays}</TableCell><TableCell>{formatDate(row.lastActiveAt)}</TableCell>
            <TableCell>{row.unmapped ? <Badge variant="outline">Unmapped Contributor</Badge> : row.noActivity ? <Badge variant="secondary">No Activity</Badge> : <Badge variant="outline">Active</Badge>}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>}
  </section>;
}

function MetricGrid({ items }: { items: Array<[string, number]> }) {
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
    {items.map(([label, value]) => <div key={label} className="rounded-md border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>)}
  </div>;
}
