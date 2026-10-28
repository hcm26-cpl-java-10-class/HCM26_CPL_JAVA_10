import { milestoneApi } from "@/api";
import { ProTable } from "@/components/datatable/ProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  LatePolicyType,
  MilestoneDetailRouteState,
  MilestoneListItem,
  MilestonePageResponse,
  MilestoneProjectOption,
  MilestoneStatus,
  Pagination,
} from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ClipboardCheck, Eye, FolderKanban, Plus, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MilestoneEmptyState, MilestoneListError } from "../components/MilestoneListStates";
import { MilestoneTableCard } from "../components/MilestoneTableCard";
import { milestoneListSchema } from "../milestone-list.schema";
import {
  hasMilestoneQuery,
  parseMilestoneListParams,
  serializeMilestoneListParams,
} from "../milestone-list-query.utils";
import { getMilestoneApiError } from "../milestone.utils";
import { MilestoneRiskPage } from "./MilestoneRiskPage";
interface MilestoneTableFilters {
  status?: MilestoneStatus[];
  mandatory?: boolean;
  latePolicyType?: LatePolicyType[];
  deadline?: { from?: string; to?: string };
}

function getProjectStatusBadgeVariant(status?: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "PLANNING":
      return "secondary";
    case "CANCELLED":
      return "destructive";
    default:
      return "outline";
  }
}

export function MilestoneListPage() {
  const [params] = useSearchParams();
  return params.get("view") === "risk" ? <MilestoneRiskPage /> : <MilestoneStandardListPage />;
}

function MilestoneStandardListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const serializedSearchParams = searchParams.toString();
  const listParams = useMemo(
    () => parseMilestoneListParams(new URLSearchParams(serializedSearchParams)),
    [serializedSearchParams],
  );
  const teamId = listParams.teamId;

  const projectOptionsQuery = useQuery({
    queryKey: ["milestone-project-options"],
    queryFn: ({ signal }) => milestoneApi.getProjectOptions(signal),
    retry: false,
    staleTime: 30_000,
  });

  const projectOptions: MilestoneProjectOption[] = projectOptionsQuery.data ?? [];
  const selectedProjectOption = useMemo(
    () => projectOptions.find((option) => String(option.id) === String(projectId)),
    [projectId, projectOptions],
  );

  useEffect(() => {
    if (projectId || projectOptionsQuery.isPending) return;
    if (projectOptions.length > 0) {
      const defaultProject = projectOptions[0];
      navigate(
        `/projects/${defaultProject.id}/milestones${location.search}`,
        { replace: true },
      );
    }
  }, [location.search, navigate, projectId, projectOptions, projectOptionsQuery.isPending]);

  const handleSelectProject = useCallback((nextProjectId: string) => {
    if (!nextProjectId || nextProjectId === projectId) return;
    const nextSearch = serializeMilestoneListParams({
      ...listParams,
      teamId: undefined,
      page: 0,
    });
    const queryString = nextSearch.toString();
    navigate(`/projects/${nextProjectId}/milestones${queryString ? `?${queryString}` : ""}`);
  }, [listParams, navigate, projectId]);

  const filters = useMemo<MilestoneTableFilters>(() => ({
    status: listParams.status,
    mandatory: listParams.mandatory,
    latePolicyType: listParams.latePolicyType,
    deadline: listParams.deadlineFrom || listParams.deadlineTo
      ? { from: listParams.deadlineFrom, to: listParams.deadlineTo }
      : undefined,
  }), [
    listParams.deadlineFrom,
    listParams.deadlineTo,
    listParams.latePolicyType,
    listParams.mandatory,
    listParams.status,
  ]);

  const updateListParams = useCallback((patch: Partial<typeof listParams>) => {
    setSearchParams((current) => serializeMilestoneListParams({
      ...parseMilestoneListParams(current),
      ...patch,
    }));
  }, [setSearchParams]);

  const tableApi = useMemo(() => ({
    getPage: (
      pagination: Pagination,
      search?: string,
      nextFilters?: MilestoneTableFilters,
    ) => {
      const normalizedSearch = search?.trim().replace(/\s+/g, " ").slice(0, 120) || undefined;
      let deadlineFrom = nextFilters?.deadline?.from;
      let deadlineTo = nextFilters?.deadline?.to;
      if (deadlineFrom && deadlineTo && deadlineFrom > deadlineTo) {
        [deadlineFrom, deadlineTo] = [deadlineTo, deadlineFrom];
      }

      return milestoneApi.getList(projectId as string, {
        page: pagination.page ?? 0,
        size: pagination.size ?? 20,
        teamId: listParams.teamId,
        sort: pagination.sort,
        search: normalizedSearch,
        status: nextFilters?.status,
        mandatory: nextFilters?.mandatory,
        latePolicyType: nextFilters?.latePolicyType,
        deadlineFrom,
        deadlineTo,
      });
    },
  }), [projectId, listParams.teamId]);

  const table = useProTable(tableApi, milestoneListSchema, {
    enabled: Boolean(projectId),
    queryKeyParts: [projectId, listParams.teamId],
    searchDebounceMs: 300,
    retry: false,
    staleTime: 30_000,
    permissionOverrides: {
      canRead: true,
      canCreate: true,
      canUpdate: false,
      canDelete: false,
      canImport: false,
      canExport: false,
    },
    state: {
      pagination: { page: listParams.page, size: listParams.size },
      search: listParams.search ?? "",
      filters,
    },
    onPaginationChange: (pagination) => updateListParams({
      page: pagination.page ?? 0,
      size: pagination.size ?? listParams.size,
    }),
    onSearchChange: (search) => updateListParams({
      search: search.slice(0, 120) || undefined,
      page: 0,
    }),
    onFiltersChange: (nextFilters: MilestoneTableFilters) => updateListParams({
      status: nextFilters.status,
      mandatory: nextFilters.mandatory,
      latePolicyType: nextFilters.latePolicyType,
      deadlineFrom: nextFilters.deadline?.from,
      deadlineTo: nextFilters.deadline?.to,
      page: 0,
    }),
  });

  const response = table.pageData as MilestonePageResponse | undefined;
  const projectActive = response?.project?.status === "ACTIVE";
  const createUrl = `/projects/${projectId}/milestones/new${teamId ? `?teamId=${teamId}` : ""}`;
  const returnTo = `${location.pathname}${location.search}`;
  const filtered = hasMilestoneQuery(listParams);
  const breadcrumbs = response
    ? { projects: "Projects", [projectId ?? "project"]: response.project?.name ?? "Project", milestones: "Milestones" }
    : { projects: "Projects", milestones: "Milestones" };

  useEffect(() => {
    if (!response || table.isFetching) return;
    if (response.totalElements === 0 && listParams.page > 0) {
      updateListParams({ page: 0 });
      return;
    }
    if (response.totalPages > 0 && listParams.page >= response.totalPages) {
      updateListParams({ page: response.totalPages - 1 });
    }
  }, [listParams.page, response, table.isFetching, updateListParams]);

  if (!projectId) {
    if (projectOptionsQuery.isPending) {
      return (
        <MainLayout pathName={breadcrumbs}>
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-xs" role="status">
            Loading projects...
          </div>
        </MainLayout>
      );
    }

    return (
      <MainLayout pathName={breadcrumbs}>
        <Alert variant={projectOptionsQuery.isError ? "destructive" : "default"}>
          <AlertCircle />
          <AlertTitle>
            {projectOptionsQuery.isError ? "Unable to load projects" : "No projects available"}
          </AlertTitle>
          <AlertDescription>
            {projectOptionsQuery.isError ? (
              <>
                <p>The project list could not be loaded.</p>
                <Button variant="outline" size="sm" onClick={() => void projectOptionsQuery.refetch()}>Try again</Button>
              </>
            ) : (
              <>
                <p>No projects are available in your current scope. You can still open milestones assigned directly to a team.</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/milestones/teams")}>Browse team milestones</Button>
              </>
            )}
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  const currentProjectStatus = response?.project?.status ?? selectedProjectOption?.status;
  const currentProjectName = response?.project?.name ?? selectedProjectOption?.name ?? `Project #${projectId}`;

  const openDetail = (row: MilestoneListItem) => {
    const routeState: MilestoneDetailRouteState = {
      projectName: response?.project?.name ?? selectedProjectOption?.name,
      returnTo,
    };
    navigate(`/projects/${projectId}/milestones/${row.id}${teamId ? `?teamId=${teamId}` : ""}`, { state: routeState });
  };

  const clearSearchAndFilters = () => {
    setSearchParams(serializeMilestoneListParams({ page: 0, size: listParams.size }));
  };

  const createAction = (
    <div className="flex items-center gap-2">
      <ActionButton
        onClick={() => navigate(`/milestone-submissions?projectId=${projectId}`)}
        tooltip="Open milestone review queue"
        title="Review submissions"
        variant="outline"
        icon={<ClipboardCheck size={16} />}
      />
      {table.permission?.canCreate ? <ActionButton
      onClick={() => navigate(createUrl)}
      tooltip={projectActive
        ? "Create milestone"
        : `Milestones cannot be created while the project is ${response?.project?.status?.toLowerCase() ?? "unavailable"}.`}
      title="Create"
      variant="default"
      icon={<Plus size={16} />}
      disabled={!projectActive}
      /> : null}
    </div>
  );

  return (
    <MainLayout pathName={breadcrumbs}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderKanban className="size-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project
            </span>
          </div>
          <div className="min-w-[240px] max-w-md flex-1">
            <Select
              value={String(projectId)}
              onValueChange={handleSelectProject}
              disabled={projectOptionsQuery.isPending}
            >
              <SelectTrigger aria-label="Filter by project" className="w-full bg-background">
                <SelectValue placeholder={currentProjectName} />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.length > 0 ? (
                  projectOptions.map((project) => (
                    <SelectItem key={String(project.id)} value={String(project.id)}>
                      <span className="flex items-center gap-2">
                        {project.code ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            [{project.code}]
                          </span>
                        ) : null}
                        <span className="font-medium">{project.name}</span>
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={String(projectId)}>
                    {currentProjectName}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {currentProjectStatus ? (
            <Badge variant={getProjectStatusBadgeVariant(currentProjectStatus)}>
              {currentProjectStatus}
            </Badge>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/projects/${projectId}/milestones?view=risk`)}
        >
          <ShieldAlert className="size-4" />
          Risk monitoring
        </Button>
      </div>
      <ProTable<MilestoneListItem>
        table={table}
        headerActions={createAction}
        renderCard={(props) => <MilestoneTableCard {...props} />}
        onView={openDetail}
        renderRowActions={(milestone) => (
          <ActionButton
            onClick={() => openDetail(milestone)}
            tooltip="View detail"
            icon={<Eye size={10} className="text-gray-500" />}
          />
        )}
        selectable={false}
        autoPageSize
        renderEmpty={(
          <MilestoneEmptyState
            canCreate={Boolean(table.permission?.canCreate)}
            projectActive={projectActive}
            createUrl={createUrl}
            filtered={filtered}
            onClear={clearSearchAndFilters}
          />
        )}
        renderError={(
          <div className="w-full p-5">
            <MilestoneListError
              error={getMilestoneApiError(table.error)}
              homeUrl="/teacher"
              onRetry={() => void table.refetch()}
            />
          </div>
        )}
        showPagination={!table.error && !table.loading && table.total > 0}
      />
    </MainLayout>
  );
}
