import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Filter,
  LockKeyhole,
  RefreshCw,
  SearchX,
  Share2,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { projectAnalyticsApi } from "@/api/features/project-analytics.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { ProjectAnalyticsRequestFilters } from "@/types/features/project-analytics";
import { getHomePathByRole } from "@/utils/rbac.utils";
import { AnalyticsFilterBar } from "./AnalyticsFilterBar";
import { AnalyticsKpiCards } from "./AnalyticsKpiCards";
import { AnalyticsTrendCharts } from "./AnalyticsTrendCharts";
import { CurrentWindowWorkItems } from "./CurrentWindowWorkItems";
import { WorkItemCreationTrendCard } from "./WorkItemCreationTrendCard";
import { WorkItemCycleTimeCard } from "./WorkItemCycleTimeCard";
import {
  analyticsFilterKeys,
  clearAnalyticsFilters,
  readAnalyticsFilters,
  writeAnalyticsFilters,
} from "./analytics-filters";

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

function formatUtcTime(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(key =>
        <Skeleton key={key} className="h-[112px] rounded-xl" />)}</div>
      <div className="grid gap-4 xl:grid-cols-2">{[0, 1, 2, 3].map(key =>
        <Skeleton key={key} className="h-64 rounded-xl" />)}</div>
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  </div>;
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

  const apply = useCallback((next: ProjectAnalyticsRequestFilters) => {
    setParams(current => writeAnalyticsFilters(current, next), { replace: true });
  }, [setParams]);

  const reset = useCallback(() => {
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
    return <PageState icon={AlertCircle} title="Unable to load analytics" ignorePaths={projectSegment}
      description="The analytics workspace could not be loaded. Check your connection and try again.">
      <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
        <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />Try again
      </Button>
    </PageState>;
  }

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
  const updatedLabel = query.dataUpdatedAt
    ? `Updated today at ${formatUtcTime(query.dataUpdatedAt)} UTC`
    : "Updated just now";

  const backlogParams = new URLSearchParams(location.search);
  analyticsFilterKeys.forEach(key => backlogParams.delete(key));
  backlogParams.set("tab", "backlog");
  const backlogHref = workspaceId ? `${location.pathname}?${backlogParams.toString()}` : "/backlogs";

  return <MainLayout contentClassName="bg-slate-50/70 dark:bg-background"
    pathName={{ projects: "Project Management", [String(projectId)]: shell?.projectName ?? "Project analytics", analytics: "Analytics" }}>
    {query.isPending || !shell ? (
      rejected ? (
        <PageState icon={Filter} title="422 · Filters not accepted" ignorePaths={projectSegment}
          description={rejectedMessage}>
          <Button variant="outline" size="sm" onClick={reset}><X />Clear filters</Button>
        </PageState>
      ) : <ShellLoading />
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

          <AnalyticsKpiCards kpis={shell.kpis} />
          <div className="grid gap-4 xl:grid-cols-2">
            <WorkItemCreationTrendCard trend={shell.creationTrend} />
            <WorkItemCycleTimeCard trend={shell.cycleTimeTrend} />
          </div>
          <AnalyticsTrendCharts widgets={shell.widgets} granularity={shell.window.granularity} />
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
        </div>
      </div>
    )}
  </MainLayout>;
}
