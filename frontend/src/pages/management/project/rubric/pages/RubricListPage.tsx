import { rubricApi } from "@/api";
import { ProTable } from "@/components/datatable/ProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { usePermissions } from "@/hooks/usePermissions";
import type {
  Pagination,
  RubricListItem,
  RubricPage,
  RubricVersionStatus,
} from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { RubricEmptyState, RubricListError } from "../components/RubricListStates";
import { RubricRowActions } from "../components/RubricRowActions";
import { RubricTableCard } from "../components/RubricTableCard";
import {
  hasRubricQuery,
  parseRubricListParams,
  serializeRubricListParams,
} from "../rubric-list-query.utils";
import { rubricListSchema } from "../rubric-list.schema";

interface RubricTableFilters {
  latestStatus?: RubricVersionStatus;
}

export function RubricListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deleteTarget, setDeleteTarget] = useState<RubricListItem | null>(null);
  const [publishTarget, setPublishTarget] = useState<RubricListItem | null>(null);
  const serializedSearchParams = searchParams.toString();
  const params = useMemo(
    () => parseRubricListParams(new URLSearchParams(serializedSearchParams)),
    [serializedSearchParams],
  );
  const filters = useMemo<RubricTableFilters>(() => ({
    latestStatus: params.status,
  }), [params.status]);

  const updateListParams = useCallback((patch: Partial<typeof params>) => {
    setSearchParams((current) => serializeRubricListParams({
      ...parseRubricListParams(current),
      ...patch,
    }));
  }, [setSearchParams]);

  const tableApi = useMemo(() => ({
    getPage: (
      pagination: Pagination,
      search?: string,
      nextFilters?: RubricTableFilters,
    ) => rubricApi.getList({
      page: pagination.page ?? 0,
      size: pagination.size ?? 20,
      search: search?.trim().replace(/\s+/g, " ").slice(0, 150) || undefined,
      status: nextFilters?.latestStatus,
    }),
  }), []);

  const table = useProTable(tableApi, rubricListSchema, {
    queryKeyRoot: "rubrics",
    searchDebounceMs: 300,
    retry: false,
    staleTime: 30_000,
    permissionOverrides: {
      canUpdate: false,
      canDelete: false,
      canImport: false,
      canExport: false,
    },
    state: {
      pagination: { page: params.page, size: params.size },
      search: params.search ?? "",
      filters,
    },
    onPaginationChange: (pagination) => updateListParams({
      page: pagination.page ?? 0,
      size: pagination.size ?? params.size,
    }),
    onSearchChange: (search) => updateListParams({
      search: search.slice(0, 150) || undefined,
      page: 0,
    }),
    onFiltersChange: (nextFilters: RubricTableFilters) => updateListParams({
      status: nextFilters.latestStatus,
      page: 0,
    }),
  });

  const response = table.pageData as RubricPage | undefined;
  const canUpdate = hasPermission("RUBRIC_UPDATE");
  const canDelete = hasPermission("RUBRIC_DELETE");
  const canCreate = hasPermission("RUBRIC_CREATE");
  const filtered = hasRubricQuery(params);

  useEffect(() => {
    if (!response || table.isFetching || table.error) return;
    if (response.totalElements === 0 && params.page > 0) {
      updateListParams({ page: 0 });
      return;
    }
    if (response.totalPages > 0 && params.page >= response.totalPages) {
      updateListParams({ page: response.totalPages - 1 });
    }
  }, [params.page, response, table.error, table.isFetching, updateListParams]);

  const deleteMutation = useMutation({
    mutationFn: (rubric: RubricListItem) =>
      rubricApi.deleteDraft(rubric.id, rubric.latestVersionId),
    onSuccess: async (_, rubric) => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      toast.success(rubric.versionCount === 1
        ? "Rubric deleted successfully."
        : "Latest draft deleted successfully.");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not delete the rubric draft.");
    },
  });

  const publishMutation = useMutation({
    mutationFn: (rubric: RubricListItem) =>
      rubricApi.publish(rubric.id, rubric.latestVersionId),
    onSuccess: async () => {
      setPublishTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rubrics"] }),
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey.at(-1) === "create-options",
        }),
      ]);
      toast.success("Rubric version published and is now available to milestones.");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not publish the rubric draft.");
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: (rubric: RubricListItem) =>
      rubricApi.createVersion(rubric.id, rubric.latestVersionId),
    onSuccess: async (result, rubric) => {
      await queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      const draft = result.versions.find((version) => version.status === "DRAFT");
      toast.success("New draft version created.");
      navigate(draft ? `/rubrics/${rubric.id}/versions/${draft.id}/edit` : `/rubrics/${rubric.id}`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not create a new draft version.");
    },
  });

  const openDetail = (rubric: RubricListItem) => {
    navigate(`/rubrics/${rubric.id}`);
  };

  const openEdit = (rubric: RubricListItem) => {
    navigate(`/rubrics/${rubric.id}/versions/${rubric.latestVersionId}/edit`);
  };

  const clearSearchAndFilters = () => {
    setSearchParams(serializeRubricListParams({ page: 0, size: params.size }));
  };

  const createAction = table.permission?.canCreate ? (
    <ActionButton
      onClick={() => navigate("/rubrics/new")}
      tooltip="Create rubric"
      title="Create"
      variant="default"
      icon={<Plus size={16} />}
    />
  ) : undefined;

  return (
    <MainLayout pathName={{ rubrics: "Rubrics" }}>
      <>
        <ProTable<RubricListItem>
          table={table}
          headerActions={createAction}
          renderCard={(props) => <RubricTableCard {...props} />}
          renderRowActions={(rubric) => (
            <RubricRowActions
              rubric={rubric}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canCreate={canCreate}
              onView={openDetail}
              onEdit={openEdit}
              onPublish={setPublishTarget}
              onCreateVersion={(rubric) => newVersionMutation.mutate(rubric)}
              onDelete={setDeleteTarget}
            />
          )}
          onView={openDetail}
          selectable={false}
          autoPageSize
          renderEmpty={(
            <RubricEmptyState
              filtered={filtered}
              canCreate={Boolean(table.permission?.canCreate)}
              onClear={clearSearchAndFilters}
            />
          )}
          renderError={(
            <RubricListError
              error={table.error}
              onRetry={() => void table.refetch()}
            />
          )}
          showPagination={!table.error && !table.loading && table.total > 0}
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title={deleteTarget?.versionCount === 1 ? "Delete this rubric?" : "Delete the latest draft?"}
          description={deleteTarget?.versionCount === 1
            ? "This is the rubric's only version, so deleting the draft will permanently delete the entire rubric."
            : "Only the latest draft version will be deleted. Previously published versions will remain available to milestones."}
          confirmLabel={deleteTarget?.versionCount === 1 ? "Delete rubric" : "Delete draft"}
          loading={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget) deleteMutation.mutate(deleteTarget);
          }}
        />

        <ConfirmDialog
          open={Boolean(publishTarget)}
          title={`Publish version ${publishTarget?.latestVersionNumber ?? ""}?`}
          description={publishTarget ? (
            <span className="grid gap-2">
              <span>
                {publishTarget.criteriaCount} criteria · {publishTarget.totalMaxScore} total points.
              </span>
              <span>
                Publishing makes this version immutable and immediately available to milestones. Future changes require a new draft version.
              </span>
            </span>
          ) : undefined}
          confirmLabel="Publish version"
          loadingLabel="Publishing..."
          destructive={false}
          loading={publishMutation.isPending}
          onCancel={() => setPublishTarget(null)}
          onConfirm={() => {
            if (publishTarget) publishMutation.mutate(publishTarget);
          }}
        />
      </>
    </MainLayout>
  );
}
