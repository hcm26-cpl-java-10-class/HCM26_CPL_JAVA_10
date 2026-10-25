import { milestoneApi } from "@/api";
import { ProTable } from "@/components/datatable/ProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  LatePolicyType,
  MilestoneDetailRouteState,
  MilestoneListItem,
  MilestonePageResponse,
  MilestoneStatus,
  Pagination,
} from "@/types";
import { AlertCircle, Eye, Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";

interface MilestoneTableFilters {
  status?: MilestoneStatus[];
  mandatory?: boolean;
  latePolicyType?: LatePolicyType[];
  deadline?: { from?: string; to?: string };
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
        sort: pagination.sort,
        search: normalizedSearch,
        status: nextFilters?.status,
        mandatory: nextFilters?.mandatory,
        latePolicyType: nextFilters?.latePolicyType,
        deadlineFrom,
        deadlineTo,
      });
    },
  }), [projectId]);

  const table = useProTable(tableApi, milestoneListSchema, {
    enabled: Boolean(projectId),
    queryKeyParts: [projectId],
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
  const projectActive = response?.project.status === "ACTIVE";
  const createUrl = `/projects/${projectId}/milestones/new`;
  const returnTo = `${location.pathname}${location.search}`;
  const filtered = hasMilestoneQuery(listParams);
  const breadcrumbs = response
    ? { projects: "Projects", [projectId ?? "project"]: response.project.name, milestones: "Milestones" }
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
    return (
      <MainLayout pathName={breadcrumbs}>
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Missing project ID</AlertTitle>
          <AlertDescription>The project for this milestone list could not be determined.</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  const openDetail = (row: MilestoneListItem) => {
    const routeState: MilestoneDetailRouteState = {
      projectName: response?.project.name,
      returnTo,
    };
    navigate(`/projects/${projectId}/milestones/${row.id}`, { state: routeState });
  };

  const clearSearchAndFilters = () => {
    setSearchParams(serializeMilestoneListParams({ page: 0, size: listParams.size }));
  };

  const createAction = table.permission?.canCreate ? (
    <ActionButton
      onClick={() => navigate(createUrl)}
      tooltip={projectActive
        ? "Create milestone"
        : `Milestones cannot be created while the project is ${response?.project.status.toLowerCase() ?? "unavailable"}.`}
      title="Create"
      variant="default"
      icon={<Plus size={16} />}
      disabled={!projectActive}
    />
  ) : undefined;

  return (
    <MainLayout pathName={breadcrumbs}>
      <div className="mb-3 flex justify-end"><Button variant="outline" onClick={() => navigate(`/projects/${projectId}/milestones?view=risk`)}>Risk monitoring</Button></div>
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
