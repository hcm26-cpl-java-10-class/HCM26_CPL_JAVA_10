import { milestoneApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowUpDown, LoaderCircle, Plus } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { MilestoneEmptyState, MilestoneListError, MilestoneListSkeleton } from "../components/MilestoneListStates";
import { MilestoneListView } from "../components/MilestoneListView";
import { MilestonePagination } from "../components/MilestonePagination";
import { getMilestoneApiError } from "../milestone.utils";

const DEFAULT_PAGE = 0;
const DEFAULT_SIZE = 20;
const ALLOWED_PAGE_SIZES = new Set([10, 20, 30, 50, 100]);

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_PAGE;
}

function parseSize(value: string | null): number {
  const parsed = Number(value);
  return ALLOWED_PAGE_SIZES.has(parsed) ? parsed : DEFAULT_SIZE;
}

export function MilestoneListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const page = parsePage(searchParams.get("page"));
  const size = parseSize(searchParams.get("size"));
  const canCreate = hasPermission("MILESTONE_CREATE");

  const listQuery = useQuery({
    queryKey: ["projects", projectId, "milestones", "list", page, size],
    queryFn: () => milestoneApi.getList(projectId as string, { page, size }),
    enabled: Boolean(projectId),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });

  const setPagination = (nextPage: number, nextSize = size) => {
    setSearchParams({ page: String(nextPage), size: String(nextSize) });
  };

  useEffect(() => {
    const response = listQuery.data;
    if (!response || listQuery.isPlaceholderData) return;
    if (response.totalElements === 0 && page > 0) {
      setPagination(0);
      return;
    }
    if (response.totalPages > 0 && page >= response.totalPages) {
      setPagination(response.totalPages - 1);
    }
  }, [listQuery.data, listQuery.isPlaceholderData, page]);

  const breadcrumbs = listQuery.data
    ? { projects: "Projects", [projectId ?? "project"]: listQuery.data.project.name, milestones: "Milestones" }
    : { projects: "Projects", milestones: "Milestones" };

  if (!projectId) {
    return (
      <MainLayout pathName={breadcrumbs}>
        <Alert variant="destructive"><AlertCircle /><AlertTitle>Missing project ID</AlertTitle><AlertDescription>The project for this milestone list could not be determined.</AlertDescription></Alert>
      </MainLayout>
    );
  }

  if (listQuery.isLoading) {
    return <MainLayout pathName={breadcrumbs}><MilestoneListSkeleton /></MainLayout>;
  }

  if (listQuery.isError || !listQuery.data) {
    return (
      <MainLayout pathName={breadcrumbs}>
        <MilestoneListError error={getMilestoneApiError(listQuery.error)} homeUrl="/teacher" onRetry={() => void listQuery.refetch()} />
      </MainLayout>
    );
  }

  const response = listQuery.data;
  const projectActive = response.project.status === "ACTIVE";
  const createUrl = `/projects/${projectId}/milestones/new`;
  const returnTo = `${location.pathname}${location.search}`;
  const changingPage = listQuery.isFetching && !listQuery.isLoading;

  return (
    <MainLayout pathName={breadcrumbs}>
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{response.project.status}</Badge>
                <span className="text-sm text-muted-foreground">{response.totalElements} milestone{response.totalElements === 1 ? "" : "s"}</span>
              </div>
              <CardTitle className="mt-3 text-2xl">{response.project.name} milestones</CardTitle>
              <CardDescription className="mt-2">Review delivery milestones, deadlines, and late submission policies.</CardDescription>
            </div>
            {canCreate ? (
              projectActive ? (
                <Button asChild className="shrink-0"><Link to={createUrl}><Plus /> Create milestone</Link></Button>
              ) : (
                <Button disabled className="shrink-0" title={`Milestones cannot be created while the project is ${response.project.status.toLowerCase()}.`}><Plus /> Create milestone</Button>
              )
            ) : null}
          </CardHeader>
        </Card>

        <Card className="overflow-hidden">
          {response.totalElements === 0 ? (
            <MilestoneEmptyState canCreate={canCreate} projectActive={projectActive} createUrl={createUrl} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <h2 className="font-semibold">Project milestones</h2>
                  <p className="text-sm text-muted-foreground">Open a milestone to view its checklist and review settings.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {changingPage ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUpDown className="size-4" />}
                  {changingPage ? "Loading page…" : "Deadline · earliest first"}
                </div>
              </div>
              <CardContent className="p-0">
                <MilestoneListView
                  milestones={response.content}
                  projectId={projectId}
                  projectName={response.project.name}
                  returnTo={returnTo}
                  loading={changingPage}
                />
                <MilestonePagination
                  page={response.page}
                  size={response.size}
                  totalElements={response.totalElements}
                  totalPages={response.totalPages}
                  loading={changingPage}
                  onPageChange={(nextPage) => setPagination(nextPage)}
                  onSizeChange={(nextSize) => setPagination(0, nextSize)}
                />
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
