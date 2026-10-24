import { milestoneApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/datatable/toolbar/SearchInput";
import { usePermissions } from "@/hooks/usePermissions";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowUpDown, LayoutGrid, LoaderCircle, Plus, Table2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { MilestoneFilterPopover } from "../components/MilestoneFilterPopover";
import { MilestoneEmptyState, MilestoneListError, MilestoneListSkeleton } from "../components/MilestoneListStates";
import { MilestoneListView } from "../components/MilestoneListView";
import { MilestonePagination } from "../components/MilestonePagination";
import {
  hasMilestoneQuery,
  parseMilestoneListParams,
  serializeMilestoneListParams,
} from "../milestone-list-query.utils";
import { getMilestoneApiError } from "../milestone.utils";

export function MilestoneListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const serializedSearchParams = searchParams.toString();
  const listParams = useMemo(
    () => parseMilestoneListParams(new URLSearchParams(serializedSearchParams)),
    [serializedSearchParams],
  );
  const [searchValue, setSearchValue] = useState(listParams.search ?? "");
  const canCreate = hasPermission("MILESTONE_CREATE");

  const updateListParams = useCallback((patch: Partial<typeof listParams>) => {
    setSearchParams(serializeMilestoneListParams({ ...listParams, ...patch }));
  }, [listParams, setSearchParams]);

  useEffect(() => {
    setSearchValue(listParams.search ?? "");
  }, [listParams.search]);

  useEffect(() => {
    const normalizedSearch = searchValue.trim().replace(/\s+/g, " ").slice(0, 120) || undefined;
    if (normalizedSearch === listParams.search) return;
    const timeout = window.setTimeout(() => updateListParams({ search: normalizedSearch, page: 0 }), 300);
    return () => window.clearTimeout(timeout);
  }, [listParams.search, searchValue, updateListParams]);

  const listQuery = useQuery({
    queryKey: ["projects", projectId, "milestones", "list", listParams],
    queryFn: () => milestoneApi.getList(projectId as string, listParams),
    enabled: Boolean(projectId),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });

  const setPagination = (nextPage: number, nextSize = listParams.size) => {
    updateListParams({ page: nextPage, size: nextSize });
  };

  useEffect(() => {
    const response = listQuery.data;
    if (!response || listQuery.isPlaceholderData) return;
    if (response.totalElements === 0 && listParams.page > 0) {
      setPagination(0);
      return;
    }
    if (response.totalPages > 0 && listParams.page >= response.totalPages) {
      setPagination(response.totalPages - 1);
    }
  }, [listQuery.data, listQuery.isPlaceholderData, listParams.page]);

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
  const filtering = hasMilestoneQuery(listParams) || Boolean(searchValue.trim());
  const clearSearchAndFilters = () => {
    setSearchValue("");
    setSearchParams(serializeMilestoneListParams({ page: 0, size: listParams.size }));
  };

  return (
    <MainLayout pathName={breadcrumbs}>
      <div className="grid h-full w-full grid-rows-[auto_1fr_auto] gap-4 font-inter">
        <div className="grid gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold">{response.project.name}</h1>
                <Badge variant="secondary">{response.project.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {response.totalElements} {filtering ? "matching " : ""}milestone{response.totalElements === 1 ? "" : "s"} · ordered by earliest deadline
              </p>
            </div>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex" aria-live="polite">
              {changingPage ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUpDown className="size-4" />}
              {changingPage ? "Updating results…" : "Deadline · earliest first"}
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <MilestoneFilterPopover
                value={listParams}
                onChange={(patch) => updateListParams({ ...patch, page: 0 })}
                onClear={() => updateListParams({
                  status: undefined,
                  mandatory: undefined,
                  latePolicyType: undefined,
                  deadlineFrom: undefined,
                  deadlineTo: undefined,
                  page: 0,
                })}
              />
              <SearchInput search={searchValue} onSearchChange={(value) => setSearchValue(value.slice(0, 120))} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={viewMode === "table" ? "Switch to card view" : "Switch to table view"}
                title={viewMode === "table" ? "Switch to card view" : "Switch to table view"}
                onClick={() => setViewMode((current) => current === "table" ? "card" : "table")}
              >
                {viewMode === "table" ? <LayoutGrid /> : <Table2 />}
              </Button>
              {canCreate ? (
                projectActive ? (
                  <Button asChild><Link to={createUrl}><Plus /> Create milestone</Link></Button>
                ) : (
                  <Button disabled title={`Milestones cannot be created while the project is ${response.project.status.toLowerCase()}.`}><Plus /> Create milestone</Button>
                )
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md border bg-card text-card-foreground">
          {response.totalElements === 0 ? (
            <MilestoneEmptyState
              canCreate={canCreate}
              projectActive={projectActive}
              createUrl={createUrl}
              filtered={filtering}
              onClear={clearSearchAndFilters}
            />
          ) : (
            <MilestoneListView
              milestones={response.content}
              projectId={projectId}
              projectName={response.project.name}
              returnTo={returnTo}
              loading={changingPage}
              viewMode={viewMode}
            />
          )}
        </div>

        {response.totalElements > 0 ? (
          <MilestonePagination
            page={response.page}
            size={response.size}
            totalElements={response.totalElements}
            totalPages={response.totalPages}
            loading={changingPage}
            onPageChange={(nextPage) => setPagination(nextPage)}
            onSizeChange={(nextSize) => setPagination(0, nextSize)}
          />
        ) : <div />}
      </div>
    </MainLayout>
  );
}
