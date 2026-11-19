import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Filter,
  FolderOpen,
  Inbox,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  SearchX,
  Share2,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { projectAnalyticsApi } from "@/api/features/project-analytics.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { BacklogItemDetailSheet } from "@/pages/management/backlog/components/BacklogItemDetailSheet";
import type { SprintPlanningItem } from "@/types";
import type {
  ProjectAnalyticsDrillDownItem,
  ProjectAnalyticsDrillDownTarget,
  ProjectAnalyticsRequestFilters,
} from "@/types/features/project-analytics";
import { getHomePathByRole } from "@/utils/rbac.utils";
import { AnalyticsDrillDownDrawer } from "./AnalyticsDrillDownDrawer";
import { AnalyticsFilterBar } from "./AnalyticsFilterBar";
import { AnalyticsKpiCards } from "./AnalyticsKpiCards";
import { AnalyticsTrendCharts } from "./AnalyticsTrendCharts";
import { CurrentWindowWorkItems } from "./CurrentWindowWorkItems";
import { WorkItemCompletionTrendCard } from "./WorkItemCompletionTrendCard";
import { WorkItemCreationTrendCard } from "./WorkItemCreationTrendCard";
import { WorkItemCycleTimeCard } from "./WorkItemCycleTimeCard";
import { WorkItemLeadTimeCard } from "./WorkItemLeadTimeCard";
import {
  analyticsFilterKeys,
  clearAnalyticsFilters,
  hasAnalyticsFilters,
  readAnalyticsFilters,
  writeAnalyticsFilters,
} from "./analytics-filters";
import { ChartSkeleton } from "./analytics-chart-ui";

function statusCode(error: unknown) {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/** Reads the field keyed filter errors of an HTTP 422 answer (AC04). */
function filterFieldErrors(error: unknown): Record<string, string> {
  if (statusCode(error) !== 422) return {};
  const body = (error as { response?: { data?: { errors?: Record<string, string[] | string> } } })
    .response?.data;
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(body?.errors ?? {})) {
    const message = Array.isArray(value) ? value[0] : value;
    if (message) errors[field] = message;
  }
  return errors;
}

function formatLocalTime(value: number, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }
}

function PageState({ icon: Icon, title, description, ignorePaths, children }: {
  icon: LucideIcon; title: string; description: string; ignorePaths?: string[]; children?: ReactNode;
}) {
  return <MainLayout contentClassName="bg-slate-50/70 dark:bg-background" ignorePaths={ignorePaths}
    pathName={{ projects: "Project Management", analytics: "Analytics" }}>
    <div className="flex min-h-[60vh] items-center justify-center px-2 py-8">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{children}</div>
        </CardContent>
      </Card>
    </div>
  </MainLayout>;
}

/** UI-ACC-05: the visitor is authenticated but outside this project's scope. */
function PermissionDenied({ homePath, ignorePaths }: { homePath: string; ignorePaths?: string[] }) {
  return <PageState icon={ShieldAlert} title="403 · Permission denied" ignorePaths={ignorePaths}
    description="You do not have access to analytics for this project. Ask your program manager to check your project membership.">
    <Button asChild variant="outline" size="sm"><Link to={homePath}><ArrowLeft />Back to dashboard</Link></Button>
  </PageState>;
}

function ProjectNotFound({ homePath, ignorePaths }: { homePath: string; ignorePaths?: string[] }) {
  return <PageState icon={SearchX} title="404 · Project not found" ignorePaths={ignorePaths}
    description="This project does not exist or has been deleted. Check the address or return to your dashboard.">
    <Button asChild variant="outline" size="sm"><Link to={homePath}><ArrowLeft />Back to dashboard</Link></Button>
  </PageState>;
}

function ShellLoading() {
  return <div role="status" aria-label="Loading project analytics" className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-44" /></div>
        </div>
        <div className="flex gap-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-20" /></div>
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <AnalyticsKpiCards kpis={[]} isLoading />
      <div className="grid gap-4 xl:grid-cols-2">
        {(["bar", "line", "line", "bar"] as const).map((variant, key) => (
          <Card key={key} className="gap-0 rounded-xl py-0 shadow-xs">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-md" />
                <Skeleton className="h-3.5 w-36" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
            <ChartSkeleton variant={variant} />
          </Card>
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  </div>;
}

/**
 * US-ANL-009 AC02 & Empty State: centered illustrated state distinguishing a
 * brand-new project (0 Sprints and 0 Backlog items) from an empty filtered scope.
 */
function AnalyticsEmptyState({
  uninitializedProject,
  hasActiveFilters,
  backlogHref,
  onReset,
}: {
  uninitializedProject: boolean;
  hasActiveFilters: boolean;
  backlogHref: string;
  onReset: () => void;
}) {
  const Icon = uninitializedProject ? FolderOpen : Inbox;
  const title = uninitializedProject
    ? "No work item data available yet"
    : "No Sprint or Backlog items found";
  const message = uninitializedProject
    ? "No work item data available yet. Create items in Backlog or Sprint Board to see analytics."
    : "No Sprint or Backlog items found for the selected filter";

  return (
    <section
      aria-label="Empty analytics state"
      className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        <Icon className="size-7" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-muted-foreground">{message}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {(!uninitializedProject || hasActiveFilters) && (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onReset}>
            <RotateCcw className="size-3.5" />
            Reset Filters
          </Button>
        )}
        {uninitializedProject && (
          <Button asChild size="sm" className="h-8 gap-1.5 bg-blue-600 text-xs text-white hover:bg-blue-700">
            <Link to={backlogHref}>Go to Backlog</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

function AnalyticsHeader({ sprintLabel, updatedLabel, projectName }: {
  sprintLabel: string;
  updatedLabel: string;
  projectName?: string | null;
}) {
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Analytics link copied.");
    } catch {
      toast.error("Could not copy the analytics link.");
    }
  }

  return <header className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
        <BarChart3 className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight" title={projectName ?? undefined}>
            Project Analytics
          </h1>
          <span className="shrink-0 text-[11px] font-semibold text-foreground/80">{sprintLabel}</span>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{updatedLabel}</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 pt-0.5">
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void share()}>
        <Share2 className="size-3.5" />Share
      </Button>
      <Button type="button" size="sm" className="h-8 gap-1.5 bg-slate-900 text-xs text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        onClick={() => window.print()}>
        Export
      </Button>
    </div>
  </header>;
}

/**
 * `projectId` can be passed explicitly when the page is embedded in another
 * shell (e.g. the workspace analytics tab), where the URL only carries the
 * workspace id. Standalone `/projects/:projectId/analytics` keeps using the
 * route param.
 */
export default function ProjectAnalyticsPage({ projectId: projectIdProp }: { projectId?: number } = {}) {
  const { projectId: rawProjectId, id: workspaceId } = useParams<{ projectId: string; id: string }>();
  const location = useLocation();
  const projectId = projectIdProp ?? Number(rawProjectId);
  const validId = Number.isSafeInteger(projectId) && projectId > 0;
  const { activeRole, effectivePermissions } = usePermissions();
  const homePath = getHomePathByRole(activeRole, effectivePermissions);
  const projectSegment = projectIdProp != null ? undefined : rawProjectId ? [rawProjectId] : undefined;

  // US-ANL-002: the scope filter lives in the URL so it survives navigation.
  const [params, setParams] = useSearchParams();
  const applied = readAnalyticsFilters(params);

  // US-ANL-008: click-to-drill-down drawer and UFR-PRJ-004 task detail modal.
  const [drillDownTarget, setDrillDownTarget] = useState<ProjectAnalyticsDrillDownTarget | null>(null);
  const [detailTarget, setDetailTarget] = useState<{
    item: SprintPlanningItem;
    itemKey: string;
    sprintName: string | null;
  } | null>(null);

  const openDrillDownItem = useCallback((row: ProjectAnalyticsDrillDownItem) => {
    if (row.backlogItemId == null) return;
    const itemKey = row.taskCode.split(" · ")[0] || row.taskCode;
    setDetailTarget({
      item: {
        id: row.backlogItemId,
        title: row.title,
        sprintId: row.sprintId,
        projectId,
        assigneeDisplayName: row.assigneeName,
      },
      itemKey,
      sprintName: row.sprintName,
    });
  }, [projectId]);

  const apply = useCallback((next: ProjectAnalyticsRequestFilters) => {
    setDrillDownTarget(null);
    setParams(current => writeAnalyticsFilters(current, next), { replace: true });
  }, [setParams]);

  const reset = useCallback(() => {
    setDrillDownTarget(null);
    setParams(current => clearAnalyticsFilters(current), { replace: true });
  }, [setParams]);

  const query = useQuery({
    queryKey: ["project-analytics-shell", projectId, applied],
    queryFn: ({ signal }) => projectAnalyticsApi.shell(projectId, applied, signal),
    enabled: validId,
    retry: false,
    // AC04: a rejected filter must never blank the charts that are already shown.
    placeholderData: keepPreviousData,
    // AC02: never keep analytics data around after the session is gone.
    staleTime: 0,
    gcTime: 0,
  });

  if (!validId) return <ProjectNotFound homePath={homePath} ignorePaths={projectSegment} />;

  const status = statusCode(query.error);
  const rejected = status === 422;
  if (query.isError && !rejected) {
    if (status === 403) return <PermissionDenied homePath={homePath} ignorePaths={projectSegment} />;
    if (status === 404) return <ProjectNotFound homePath={homePath} ignorePaths={projectSegment} />;
    if (status === 401) {
      return <PageState icon={LockKeyhole} title="Session expired" ignorePaths={projectSegment}
        description="Your session is no longer valid. Sign in again to view project analytics.">
        <Button asChild size="sm"><Link to="/login">Sign in</Link></Button>
      </PageState>;
    }
  }

  const transientError = query.isError && !rejected;
  const transientErrorMessage = "Unable to load analytics data right now. Please try again.";
  const retryAnalytics = () => { void query.refetch(); };

  const shell = query.data;
  const fieldErrors = filterFieldErrors(query.error);
  const rejectedMessage = rejected && isAxiosError(query.error)
    ? (query.error.response?.data as { message?: string } | undefined)?.message ?? "The analytics filters are not valid"
    : "The analytics filters are not valid";

  const selectedSprint = shell
    ? shell.filters.sprints.find(item =>
      item.sprintId === (shell.filters.sprintId ?? shell.filters.defaultSprintId))
    : undefined;
  const sprintLabel = selectedSprint?.name ?? (shell?.filters.scope === "SPRINT" ? "Sprint scope" : "All work items");
  const tenantTimeZone = shell?.window.timeZone
    ?? shell?.completionTrend?.timeZone
    ?? shell?.cycleTimeTrend?.timeZone
    ?? "Asia/Ho_Chi_Minh";
  const updatedLabel = query.dataUpdatedAt
    ? `Updated today at ${formatLocalTime(query.dataUpdatedAt, tenantTimeZone)} (${tenantTimeZone})`
    : "Updated just now";

  const backlogParams = new URLSearchParams(location.search);
  analyticsFilterKeys.forEach(key => backlogParams.delete(key));
  backlogParams.set("tab", "backlog");
  const backlogHref = workspaceId ? `${location.pathname}?${backlogParams.toString()}` : "/backlogs";

  const hasActiveFilters = hasAnalyticsFilters(applied);
  const uninitializedProject = shell != null
    && shell.filters.sprints.length === 0
    && shell.filters.backlogItemCount === 0;
  const totalWorkItemsKpi = shell?.kpis.find(item => item.key === "total-work-items")?.value;
  const scopeIsEmpty = shell != null
    && !query.isFetching
    && !transientError
    && (totalWorkItemsKpi === "0" || shell.creationTrend.state === "EMPTY")
    && shell.creationTrend.state === "EMPTY"
    && shell.cycleTimeTrend.state === "EMPTY"
    && shell.leadTimeTrend.state === "EMPTY"
    && shell.completionTrend.state === "EMPTY"
    && shell.widgets.every(widget => widget.state === "EMPTY");

  return <MainLayout contentClassName="bg-slate-50/70 dark:bg-background"
    pathName={{ projects: "Project Management", [String(projectId)]: shell?.projectName ?? "Project analytics", analytics: "Analytics" }}>
    {query.isPending && !shell ? (
      <ShellLoading />
    ) : !shell ? (
      rejected ? (
        <PageState icon={Filter} title="422 · Filters not accepted" ignorePaths={projectSegment}
          description={rejectedMessage}>
          <Button variant="outline" size="sm" onClick={reset}><X />Clear filters</Button>
        </PageState>
      ) : (
        <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
          <div className="space-y-4">
            <AnalyticsHeader sprintLabel={sprintLabel} updatedLabel={updatedLabel} />
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{transientErrorMessage}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={query.isFetching}
                className="h-7 gap-1.5 bg-background text-xs text-foreground"
                onClick={retryAnalytics}
              >
                <RefreshCw className={query.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
                Retry
              </Button>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <WorkItemCreationTrendCard
                isLoading={query.isFetching}
                errorMessage={transientErrorMessage}
                onRetry={retryAnalytics}
                retrying={query.isFetching}
              />
              <WorkItemCycleTimeCard
                isLoading={query.isFetching}
                errorMessage={transientErrorMessage}
                onRetry={retryAnalytics}
                retrying={query.isFetching}
              />
              <WorkItemLeadTimeCard
                isLoading={query.isFetching}
                errorMessage={transientErrorMessage}
                onRetry={retryAnalytics}
                retrying={query.isFetching}
              />
              <WorkItemCompletionTrendCard
                isLoading={query.isFetching}
                errorMessage={transientErrorMessage}
                onRetry={retryAnalytics}
                retrying={query.isFetching}
              />
            </div>
          </div>
        </div>
      )
    ) : (
      <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
        <div className="space-y-4">
          <AnalyticsHeader sprintLabel={sprintLabel} updatedLabel={updatedLabel} projectName={shell.projectName} />

          <AnalyticsFilterBar
            filters={shell.filters}
            dateWindow={shell.window}
            applied={applied}
            fieldErrors={fieldErrors}
            isFetching={query.isFetching}
            onApply={apply}
            onReset={reset}
          />

          {rejected && (
            <p role="alert" className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs leading-5 text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {rejectedMessage}. The last valid charts are still shown — correct the highlighted filter and apply again.
              </span>
            </p>
          )}

          {transientError && !query.isFetching && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{transientErrorMessage}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={query.isFetching}
                className="h-7 gap-1.5 bg-background text-xs text-foreground"
                onClick={retryAnalytics}
              >
                <RefreshCw className={query.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
                Retry
              </Button>
            </div>
          )}

          {scopeIsEmpty ? (
            <AnalyticsEmptyState
              uninitializedProject={uninitializedProject}
              hasActiveFilters={hasActiveFilters}
              backlogHref={backlogHref}
              onReset={reset}
            />
          ) : (
            <>
              <AnalyticsKpiCards kpis={shell.kpis} isLoading={query.isFetching} />
              <div className="grid gap-4 xl:grid-cols-2">
                <WorkItemCreationTrendCard
                  trend={shell.creationTrend}
                  onDrillDown={setDrillDownTarget}
                  isLoading={query.isFetching}
                  errorMessage={transientError ? transientErrorMessage : null}
                  onRetry={retryAnalytics}
                  retrying={query.isFetching}
                />
                <WorkItemCycleTimeCard
                  trend={shell.cycleTimeTrend}
                  onDrillDown={setDrillDownTarget}
                  isLoading={query.isFetching}
                  errorMessage={transientError ? transientErrorMessage : null}
                  onRetry={retryAnalytics}
                  retrying={query.isFetching}
                />
                <WorkItemLeadTimeCard
                  trend={shell.leadTimeTrend}
                  onDrillDown={setDrillDownTarget}
                  isLoading={query.isFetching}
                  errorMessage={transientError ? transientErrorMessage : null}
                  onRetry={retryAnalytics}
                  retrying={query.isFetching}
                />
                <WorkItemCompletionTrendCard
                  trend={shell.completionTrend}
                  onDrillDown={setDrillDownTarget}
                  isLoading={query.isFetching}
                  errorMessage={transientError ? transientErrorMessage : null}
                  onRetry={retryAnalytics}
                  retrying={query.isFetching}
                />
              </div>
              <AnalyticsTrendCharts
                widgets={shell.widgets}
                granularity={shell.window.granularity}
                isLoading={query.isFetching}
                errorMessage={transientError ? transientErrorMessage : null}
                onRetry={retryAnalytics}
                retrying={query.isFetching}
              />
              <CurrentWindowWorkItems
                projectId={projectId}
                projectCode={shell.projectCode}
                projectName={shell.projectName}
                scope={shell.filters.scope}
                sprintId={shell.filters.sprintId}
                itemType={shell.filters.itemType}
                dateWindow={shell.window}
                backlogHref={backlogHref}
              />
            </>
          )}
          <AnalyticsDrillDownDrawer
            projectId={projectId}
            appliedFilters={applied}
            target={drillDownTarget}
            onChangeTarget={setDrillDownTarget}
            onClose={() => setDrillDownTarget(null)}
            onOpenWorkItem={openDrillDownItem}
          />
          <BacklogItemDetailSheet
            open={detailTarget !== null}
            onClose={open => { if (!open) setDetailTarget(null); }}
            item={detailTarget?.item ?? null}
            itemKey={detailTarget?.itemKey}
            sprintName={detailTarget?.sprintName ?? null}
            canEdit={false}
            canMove={false}
            canDelete={false}
            readOnly
          />
        </div>
      </div>
    )}
  </MainLayout>;
}
