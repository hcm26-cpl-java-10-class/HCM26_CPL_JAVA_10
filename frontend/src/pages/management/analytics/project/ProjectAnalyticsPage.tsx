import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Clock3,
  Filter,
  Gauge,
  Info,
  Layers3,
  LineChart,
  Loader2,
  LockKeyhole,
  RefreshCw,
  SearchX,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { projectAnalyticsApi } from "@/api/features/project-analytics.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { ProjectAnalyticsWidget } from "@/types/features/project-analytics";
import { getHomePathByRole } from "@/utils/rbac.utils";

const WIDGET_ICONS: Record<string, LucideIcon> = {
  "sprint-burndown": LineChart,
  "sprint-velocity": Gauge,
  "backlog-health": Layers3,
  "team-workload": Users,
};

function statusCode(error: unknown) {
  return isAxiosError(error) ? error.response?.status : undefined;
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
  return <div role="status" aria-label="Loading project analytics" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-7 w-56" /><Skeleton className="h-3 w-80" /></div>
      <Skeleton className="h-6 w-32 rounded-full" />
    </div>
    <Skeleton className="h-24 w-full rounded-xl" />
    <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map(key =>
      <Skeleton key={key} className="h-56 rounded-xl" />)}</div>
  </div>;
}

function AnalyticsHeader({ code, name, status }: { code?: string | null; name?: string | null; status?: string | null }) {
  return <header className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 shadow-xs dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
        <BarChart3 className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Project Management · Analytics</p>
        <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">Project Analytics</h1>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Sprint and Backlog insights for your authorized project. This view is read-only.</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {code && <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">{code}</Badge>}
      {name && <span className="max-w-64 truncate text-xs font-medium text-foreground" title={name}>{name}</span>}
      {status && <Badge variant="secondary" className="uppercase">{status}</Badge>}
      <Badge variant="outline" className="gap-1 text-[10px]"><LockKeyhole className="size-3" />Read only</Badge>
    </div>
  </header>;
}

function FilterBarPlaceholder({ planned }: { planned: string[] }) {
  return <section aria-label="Analytics filters" className="rounded-xl border bg-card p-3.5 shadow-xs">
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Filter className="size-3.5" />Filters</span>
      {planned.map(label => <span key={label} className="rounded-md border border-dashed bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">{label}</span>)}
      <Badge variant="outline" className="ml-auto text-[10px]">Coming soon</Badge>
    </div>
    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      Filtering will be enabled in a later analytics release. For now this workspace only reads project, sprint and backlog data.
    </p>
  </section>;
}

function WidgetCard({ widget }: { widget: ProjectAnalyticsWidget }) {
  const Icon = WIDGET_ICONS[widget.key] ?? BarChart3;
  return <Card className="min-h-52 shadow-xs">
    <CardHeader className="flex-row items-start gap-2.5">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"><Icon className="size-4" /></span>
      <div className="min-w-0 space-y-1">
        <CardTitle className="text-sm">{widget.title}</CardTitle>
        <CardDescription className="text-[11px] leading-5">{widget.description}</CardDescription>
      </div>
    </CardHeader>
    <CardContent>
      <div className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/20 text-center">
        <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
        <p className="text-[11px] font-medium text-muted-foreground">Awaiting analytics data</p>
        <p className="text-[10px] text-muted-foreground/80">This widget is part of the Analytics shell.</p>
      </div>
    </CardContent>
  </Card>;
}

export default function ProjectAnalyticsPage() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = Number(rawProjectId);
  const validId = Number.isSafeInteger(projectId) && projectId > 0;
  const { activeRole, effectivePermissions } = usePermissions();
  const homePath = getHomePathByRole(activeRole, effectivePermissions);
  const projectSegment = rawProjectId ? [rawProjectId] : undefined;
  const query = useQuery({
    queryKey: ["project-analytics-shell", projectId],
    queryFn: ({ signal }) => projectAnalyticsApi.shell(projectId, signal),
    enabled: validId,
    retry: false,
    // AC02: never keep analytics data around after the session is gone.
    staleTime: 0,
    gcTime: 0,
  });

  if (!validId) return <ProjectNotFound homePath={homePath} ignorePaths={projectSegment} />;
  if (query.isError) {
    const status = statusCode(query.error);
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
  return <MainLayout contentClassName="bg-slate-50/70 dark:bg-background"
    pathName={{ projects: "Project Management", [String(projectId)]: shell?.projectName ?? "Project analytics", analytics: "Analytics" }}>
    <div className="space-y-4">
      {query.isPending || !shell ? <ShellLoading /> : <>
        <AnalyticsHeader code={shell.projectCode} name={shell.projectName} status={shell.projectStatus} />
        <FilterBarPlaceholder planned={shell.filters?.planned ?? []} />
        <section aria-label="Analytics widgets" className="grid gap-4 md:grid-cols-2">
          {shell.widgets.map(widget => <WidgetCard key={widget.key} widget={widget} />)}
        </section>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {query.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <LockKeyhole className="size-3.5" />}
          Opening this view only reads project data; it never changes sprint or task state.
        </p>
      </>}
    </div>
  </MainLayout>;
}
