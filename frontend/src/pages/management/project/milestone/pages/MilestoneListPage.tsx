import { milestoneApi } from "@/api";
import { ProTable } from "@/components/datatable/ProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirmdialog";
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
  MilestoneLifecycleStatus,
  Pagination,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Eye, FolderKanban, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  lifecycleStatus?: MilestoneLifecycleStatus[];
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
  const [pendingDelete, setPendingDelete] = useState<MilestoneListItem | null>(null);
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
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

  const handleSelectProject = useCallback((nextProjectId: string) => {
    if (!nextProjectId || nextProjectId === (projectId ?? "all")) return;
    const nextSearch = serializeMilestoneListParams({
      ...listParams,
      teamId: undefined,
      page: 0,
    });
    const queryString = nextSearch.toString();
    const path = nextProjectId === "all" ? "/milestones" : `/projects/${nextProjectId}/milestones`;
    navigate(`${path}${queryString ? `?${queryString}` : ""}`);
  }, [listParams, navigate, projectId]);

  const filters = useMemo<MilestoneTableFilters>(() => ({
    lifecycleStatus: listParams.status,
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

      return milestoneApi.getList(projectId, {
        page: pagination.page ?? 0,
        size: pagination.size ?? 20,
        teamId: listParams.teamId,
        sort: pagination.sort,
        search: normalizedSearch,
        status: nextFilters?.lifecycleStatus,
        mandatory: nextFilters?.mandatory,
        latePolicyType: nextFilters?.latePolicyType,
        deadlineFrom,
        deadlineTo,
      });
    },
  }), [projectId, listParams.teamId]);

  const table = useProTable(tableApi, milestoneListSchema, {
    enabled: true,
    queryKeyParts: [projectId ?? "all", listParams.teamId],
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
      status: nextFilters.lifecycleStatus,
      mandatory: nextFilters.mandatory,
      latePolicyType: nextFilters.latePolicyType,
      deadlineFrom: nextFilters.deadline?.from,
      deadlineTo: nextFilters.deadline?.to,
      page: 0,
    }),
  });
  const deleteMilestone = useMutation({
    mutationFn: (row: MilestoneListItem) => milestoneApi.deleteDraft(String(row.projectId), row.teamId ?? 0, row.id, row.version),
    onSuccess: () => { setPendingDelete(null); void queryClient.invalidateQueries({ queryKey: ["milestone"] }); },
  });

  const response = table.pageData as MilestonePageResponse | undefined;
  const projectActive = Boolean(selectedProjectOption?.canCreate);
  const createTeamId = selectedProjectOption?.teamId;
  const createUrl = `/projects/${projectId}/milestones/new?teamId=${createTeamId}`;
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

  const currentProjectStatus = response?.project?.status ?? selectedProjectOption?.status;
  const currentProjectName = response?.project?.name ?? selectedProjectOption?.name ?? "All projects";

  const openDetail = (row: MilestoneListItem) => {
    const routeState: MilestoneDetailRouteState = {
      projectName: row.projectName ?? response?.project?.name ?? selectedProjectOption?.name,
      returnTo,
    };
    navigate(`/projects/${row.projectId}/milestones/${row.id}${teamId ? `?teamId=${teamId}` : ""}`, { state: routeState });
  };

  const clearSearchAndFilters = () => {
    setSearchParams(serializeMilestoneListParams({ page: 0, size: listParams.size }));
  };

  const createAction = (
    <div className="flex items-center gap-2">
      {projectId ? <ActionButton
        onClick={() => navigate(`/milestone-submissions?projectId=${projectId}`)}
        tooltip="Open milestone review queue"
        title="Review submissions"
        variant="outline"
        icon={<ClipboardCheck size={16} />}
      /> : null}
      {projectId && table.permission?.canCreate ? <ActionButton
      onClick={() => navigate(createUrl)}
      tooltip={projectActive
        ? "Create milestone"
        : "Milestone creation is unavailable for this project or your account."}
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
              value={projectId ?? "all"}
              onValueChange={handleSelectProject}
              disabled={projectOptionsQuery.isPending}
            >
              <SelectTrigger aria-label="Filter by project" className="w-full bg-background">
                <SelectValue placeholder={currentProjectName} />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                sideOffset={4}
                className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1rem)] max-h-[min(20rem,var(--radix-select-content-available-height))]"
              >
                <SelectItem value="all">All projects</SelectItem>
                {projectOptionsQuery.isError ? (
                  <div className="px-2 py-1.5 text-sm text-destructive">
                    Could not load projects.
                  </div>
                ) : projectOptions.length > 0 ? (
                  projectOptions.map((project) => (
                    <SelectItem key={String(project.id)} value={String(project.id)}>
                      <span className="flex min-w-0 items-center gap-2">
                        {project.code ? (
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            [{project.code}]
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate font-medium" title={project.name}>{project.name}</span>
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No projects linked to an active workspace.
                  </div>
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
        {projectId ? <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/projects/${projectId}/milestones?view=risk`)}
        >
          <ShieldAlert className="size-4" />
          Risk monitoring
        </Button> : null}
      </div>
      <ProTable<MilestoneListItem>
        table={table}
        headerActions={createAction}
        renderCard={(props) => <MilestoneTableCard {...props} />}
        onView={openDetail}
        renderRowActions={(milestone) => (
          <div className="flex items-center gap-1">
            <ActionButton onClick={() => openDetail(milestone)} tooltip="View detail" icon={<Eye size={14} />} />
            {(milestone.lifecycleStatus === "PLANNED" || milestone.lifecycleStatus === "IN_PROGRESS" || milestone.lifecycleStatus === "CHANGES_REQUESTED") ? <ActionButton
              onClick={() => navigate(`/projects/${milestone.projectId}/milestones/${milestone.id}/edit${milestone.teamId ? `?teamId=${milestone.teamId}` : ""}`)}
              tooltip="Edit milestone" icon={<Pencil size={14} />}
            /> : null}
            {(milestone.lifecycleStatus === "PLANNED" || milestone.lifecycleStatus === "IN_PROGRESS") ? <ActionButton
              onClick={() => { deleteMilestone.reset(); setPendingDelete(milestone); }}
              tooltip="Delete milestone" icon={<Trash2 size={14} />}
              disabled={deleteMilestone.isPending}
            /> : null}
          </div>
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
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete milestone?"
        description={<div className="space-y-2"><p><strong>{pendingDelete?.title}</strong> will be removed from the workspace.</p>{pendingDelete?.lifecycleStatus === "IN_PROGRESS" && <p>Students may lose access to drafts and linked work. Milestones with submitted records cannot be deleted.</p>}{deleteMilestone.isError && <p className="text-destructive">{getMilestoneApiError(deleteMilestone.error).message}</p>}</div>}
        confirmLabel="Delete milestone"
        loading={deleteMilestone.isPending}
        onCancel={() => { if (!deleteMilestone.isPending) setPendingDelete(null); }}
        onConfirm={() => { if (pendingDelete) deleteMilestone.mutate(pendingDelete); }}
      />
    </MainLayout>
  );
}
