import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AlertCircle, ArrowLeft, ArrowRight, BarChart3, FolderSearch, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { projectAnalyticsApi } from "@/api/features/project-analytics.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { ProjectAnalyticsProjectOption } from "@/types/features/project-analytics";
import { getHomePathByRole } from "@/utils/rbac.utils";

function statusCode(error: unknown) {
  return isAxiosError(error) ? error.response?.status : undefined;
}

function ProjectCard({ project, onOpen }: { project: ProjectAnalyticsProjectOption; onOpen: () => void }) {
  return <Card className="transition-shadow hover:shadow-md">
    <CardContent className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          <BarChart3 className="size-4" />
        </span>
        {project.status && <Badge variant="secondary" className="text-[10px] uppercase">{project.status}</Badge>}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {project.code && <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{project.code}</p>}
        <p className="break-words text-sm font-semibold leading-5">{project.name ?? "Untitled project"}</p>
      </div>
      <Button size="sm" variant="outline" className="w-full justify-between" onClick={onOpen}>
        Open analytics<ArrowRight className="size-3.5" />
      </Button>
    </CardContent>
  </Card>;
}

/**
 * US-ANL-001 / UI-MNT-05: mentors and program managers pick an authorized
 * project here, then open the read-only Analytics workspace for it.
 */
export default function ProjectAnalyticsIndexPage() {
  const navigate = useNavigate();
  const { activeRole, effectivePermissions } = usePermissions();
  const homePath = getHomePathByRole(activeRole, effectivePermissions);
  const query = useQuery({
    queryKey: ["project-analytics-options"],
    queryFn: ({ signal }) => projectAnalyticsApi.projects(signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const denied = query.isError && statusCode(query.error) === 403;
  const failed = query.isError && !denied;

  return <MainLayout contentClassName="bg-slate-50/70 dark:bg-background"
    pathName={{ analytics: "Analytics", projects: "Project analytics" }}>
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 shadow-xs dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
            <BarChart3 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Analytics · Learning Analytics</p>
            <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">Project Analytics</h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Select a project in your authorized scope to view its Sprint and Backlog insights.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild><Link to={homePath}><ArrowLeft />Back to dashboard</Link></Button>
      </header>

      {query.isPending ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading projects">
        {[0, 1, 2].map(key => <Skeleton key={key} className="h-44 rounded-xl" />)}
      </div> : denied ? <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><ShieldAlert className="size-6" /></span>
        <div><p className="text-sm font-semibold">Permission denied</p><p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">You do not have access to project analytics. Ask your program manager to review your role.</p></div>
        <Button variant="outline" size="sm" asChild><Link to={homePath}>Back to dashboard</Link></Button>
      </CardContent></Card> : failed ? <Card><CardContent className="flex flex-wrap items-center gap-3 py-8">
        <AlertCircle className="size-5 text-destructive" />
        <p role="alert" className="flex-1 text-sm">Project analytics could not be loaded. Please try again.</p>
        <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw className={query.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />Try again
        </Button>
      </CardContent></Card> : !query.data?.length ? <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><FolderSearch className="size-6" /></span>
        <div><p className="text-sm font-semibold">No projects available</p><p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">You are not a member, mentor or manager of any project yet.</p></div>
        <Button variant="outline" size="sm" asChild><Link to={homePath}>Back to dashboard</Link></Button>
      </CardContent></Card> : <section aria-label="Available projects" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {query.data.map(project => <ProjectCard key={project.projectId} project={project}
          onOpen={() => navigate(`/projects/${project.projectId}/analytics`)} />)}
      </section>}

      {query.isFetching && !query.isPending && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />Refreshing authorized projects…
      </p>}
    </div>
  </MainLayout>;
}
