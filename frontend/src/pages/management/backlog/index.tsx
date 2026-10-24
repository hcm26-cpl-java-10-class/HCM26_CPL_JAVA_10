import { sprintApi, sprintBacklogApi } from "@/api";
import Loading from "@/components/datatable/common/Loading";
import { ConfirmDeleteModal } from "@/components/datatable/modal/ConfirmDeleteModal";
import { FormModal } from "@/components/datatable/modal/form/FormModal";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/usePermissions";
import type {
  BacklogPriority,
  BacklogStatus,
  SprintBacklogDTO,
  SprintBacklogStatus,
  SprintDTO,
  SprintPlanningItem,
  SprintStatus,
  TaskPriority,
} from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Layers,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  extractErrorMessage,
  useSprintPlanningBoard,
} from "../sprint/hooks/useSprintPlanningBoard";
import { sprintSchema } from "../sprint/sprint.schema";
import {
  incompleteSprintMessage,
  emptySprintBacklogMessage,
  unfinishedSprintItems,
} from "../sprint/workspace/board.constants";
import {
  backlogItemKey,
  formatBacklogRange,
  projectKeyOf,
  statusCounts,
} from "./backlog.constants";
import { backlogItemSchema } from "./backlogItem.schema";
import { BacklogItemDetailSheet } from "./components/BacklogItemDetailSheet";
import { BacklogSection } from "./components/BacklogSection";
import { BacklogToolbar } from "./components/BacklogToolbar";
import { SprintCreateRow } from "./components/SprintCreateRow";

const SPRINTS_QUERY_KEY = ["sprints", "backlog"] as const;

/** `datetime-local` inputs need `yyyy-MM-ddTHH:mm`, the API returns ISO strings. */
const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  return value.length >= 16 ? value.slice(0, 16) : value;
};

/**
 * Board buckets map onto the backend lifecycle: "To Do" is `TODO`, ongoing
 * work is `IN_PROGRESS`, finished work is `DONE`.
 */
const toSprintBacklogStatus = (status: BacklogStatus): SprintBacklogStatus => {
  switch (status) {
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "DONE":
      return "DONE";
    default:
      return "TODO";
  }
};

/**
 * Student backlog page (`/backlogs`, also served by `/sprints`).
 * <p>
 * A Jira style backlog: the selected sprint is shown as one collapsible
 * section, and its `+ Create` row is the single entry point for work items -
 * it lists the items still waiting in the product backlog (one click assigns
 * them to the sprint) and creates brand new items inside the sprint. Work items
 * can be reordered / unassigned by drag and drop or by selection, and their
 * status can move one step along the UFR-PRJ-003-02 workflow.
 */
export default function BacklogPage() {
  const queryClient = useQueryClient();
  const { hasAllPermissions, user } = usePermissions();

  const canCreate = hasAllPermissions(["SPRINT_CREATE"]);
  const canUpdate = hasAllPermissions(["SPRINT_UPDATE"]);
  const canDelete = hasAllPermissions(["SPRINT_DELETE"]);
  const canEditTask = hasAllPermissions(["SPRINT_BACKLOG_UPDATE"]);
  const canEditBoard = canUpdate && canEditTask;

  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<BacklogStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<BacklogPriority | "ALL">(
    "ALL",
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<SprintPlanningItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sprintStatusUpdating, setSprintStatusUpdating] = useState(false);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  const sprintsQuery = useQuery({
    queryKey: SPRINTS_QUERY_KEY,
    queryFn: () =>
      sprintApi.getPage({ page: 0, size: 100, sort: ["id,asc"] }),
  });

  const sprints = useMemo<SprintDTO[]>(
    () => sprintsQuery.data?.content ?? [],
    [sprintsQuery.data],
  );

  /** Default to the sprint that is running right now. */
  useEffect(() => {
    if (sprints.length === 0) return;
    if (
      selectedSprintId &&
      sprints.some((item) => item.id === selectedSprintId)
    ) {
      return;
    }

    const preferred =
      sprints.find((item) => item.status === "ACTIVE") ??
      sprints.find((item) => item.status === "PLANNED") ??
      sprints[sprints.length - 1];

    setSelectedSprintId(preferred?.id ?? null);
  }, [selectedSprintId, sprints]);

  const selectedSprint =
    sprints.find((item) => item.id === selectedSprintId) ?? null;

  const board = useSprintPlanningBoard({
    sprintId: selectedSprintId !== null ? String(selectedSprintId) : undefined,
    canEdit: canEditBoard,
  });

  const matchesFilters = useCallback(
    (item: SprintPlanningItem) => {
      const status = item.status ?? "BACKLOG";

      if (statusFilter !== "ALL" && status !== statusFilter) {
        return false;
      }

      if (priorityFilter !== "ALL" && item.priority !== priorityFilter) {
        return false;
      }

      const normalizedKeyword = keyword.trim().toLowerCase();

      if (!normalizedKeyword) {
        return true;
      }

      const itemKey = `${projectKeyOf(selectedSprint?.name)}-${item.id}`;

      return (
        (item.title ?? "").toLowerCase().includes(normalizedKeyword) ||
        itemKey.toLowerCase().includes(normalizedKeyword)
      );
    },
    [keyword, priorityFilter, selectedSprint?.name, statusFilter],
  );

  const sprintItems = useMemo(
    () => board.sprintItems.filter(matchesFilters),
    [board.sprintItems, matchesFilters],
  );

  const itemKeyPrefix = projectKeyOf(selectedSprint?.name);
  const sprintDueDate = board.plan?.endDate ?? selectedSprint?.endDate ?? null;

  const collapsedSprint = !!collapsed.sprint;
  const allCollapsed = collapsedSprint;

  const sprintIds = board.sprintItems.map((item) => item.id);

  const allSprintSelected =
    sprintIds.length > 0 && sprintIds.every((id) => board.selectedSprint.includes(id));

  const toggleSelectAllSprint = () => {
    if (allSprintSelected) {
      board.selectedSprint.forEach((id) => board.toggleSprintSelection(id));
      return;
    }

    sprintIds
      .filter((id) => !board.selectedSprint.includes(id))
      .forEach((id) => board.toggleSprintSelection(id));
  };

  const refreshSprints = async () => {
    await queryClient.invalidateQueries({ queryKey: SPRINTS_QUERY_KEY });
  };

  const handleCreateSprint = async (values: Record<string, unknown>) => {
    if (submitting) return;

    setSubmitting(true);

    try {
      const created = await sprintApi.create(values as SprintDTO);
      setCreateOpen(false);
      await refreshSprints();

      if (created?.id != null) {
        setSelectedSprintId(created.id);
      }

      toast.success("Đã tạo Sprint mới.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể tạo Sprint."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSprint = async (values: Record<string, unknown>) => {
    if (!selectedSprint?.id || submitting) return;

    setSubmitting(true);

    try {
      await sprintApi.update(String(selectedSprint.id), {
        ...selectedSprint,
        ...values,
      } as SprintDTO);
      setEditOpen(false);
      await refreshSprints();
      await board.load();

      toast.success("Đã cập nhật Sprint.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể cập nhật Sprint."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeSprintStatus = async (status: SprintStatus) => {
    if (!selectedSprint?.id || sprintStatusUpdating) return;

    /** A sprint can only start once it holds at least one backlog item. */
    if (status === "ACTIVE" && board.sprintItems.length === 0) {
      toast.error(emptySprintBacklogMessage());
      return;
    }

    if (status === "COMPLETED") {
      const unfinished = unfinishedSprintItems(board.sprintItems);

      if (unfinished.length > 0) {
        toast.error(incompleteSprintMessage(unfinished.length));
        return;
      }
    }

    setSprintStatusUpdating(true);

    try {
      await sprintApi.update(String(selectedSprint.id), {
        ...selectedSprint,
        status,
      } as SprintDTO);
      await refreshSprints();
      await board.load();

      toast.success(
        status === "COMPLETED"
          ? "Đã hoàn thành Sprint. Phạm vi công việc đã được khóa."
          : status === "ACTIVE"
            ? "Đã bắt đầu Sprint."
            : "Đã cập nhật trạng thái Sprint.",
      );
    } catch (error) {
      toast.error(
        extractErrorMessage(error, "Không thể cập nhật trạng thái Sprint."),
      );
    } finally {
      setSprintStatusUpdating(false);
    }
  };

  const handleDeleteSprint = async () => {
    if (!selectedSprint?.id) return;

    setSubmitting(true);

    try {
      await sprintApi.delete(String(selectedSprint.id));
      setDeleteOpen(false);
      setSelectedSprintId(null);
      await refreshSprints();

      toast.success("Đã xóa Sprint.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể xóa Sprint."));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Inline "+ Create" of the sprint section: the item is created directly in the
   * sprint that is being planned, because a Sprint Backlog item always belongs
   * to exactly one sprint.
   */
  const handleCreateWorkItem = async (values: Record<string, unknown>) => {
    if (submitting || selectedSprintId === null) return;

    setSubmitting(true);

    try {
      await sprintBacklogApi.create({
        sprintId: selectedSprintId,
        title: String(values.title ?? "").trim(),
        description: values.description
          ? String(values.description)
          : null,
        status: "TODO",
        priority: (values.priority as TaskPriority) ?? "MEDIUM",
        estimatedHours:
          values.estimatedHours === "" ||
          values.estimatedHours === null ||
          values.estimatedHours === undefined
            ? null
            : Number(values.estimatedHours),
        // `BaseDTO.isActive` is mandatory on create.
        isActive: true,
      } as SprintBacklogDTO);

      setCreateItemOpen(false);
      await board.load();

      toast.success("Đã tạo và thêm công việc vào Sprint.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể tạo Backlog item."));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * The board works with three buckets (`SPRINT_BACKLOG` / `IN_PROGRESS` /
   * `DONE`); they map onto the four {@link SprintBacklogStatus} values of the
   * backend.
   */
  const handleItemStatusChange = async (
    item: SprintPlanningItem,
    status: BacklogStatus,
  ) => {
    if (!canEditTask || item.status === status) return;

    setBusyItemId(item.id);

    try {
      await sprintBacklogApi.update(String(item.id), {
        status: toSprintBacklogStatus(status),
      } as SprintBacklogDTO);
      await board.load();

      toast.success("Đã cập nhật trạng thái công việc.");
    } catch (error) {
      toast.error(
        extractErrorMessage(error, "Không thể cập nhật trạng thái công việc."),
      );
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      board.setDragTarget(null);
    }
  };

  const handleSprintDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();

    board.setDragged(null);
    board.setDragTarget(null);
  };

  const editInitial = selectedSprint
    ? {
        ...selectedSprint,
        startDate: toDateTimeLocal(selectedSprint.startDate),
        endDate: toDateTimeLocal(selectedSprint.endDate),
      }
    : null;

  const userInitials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`
    .trim()
    .toUpperCase() || user.email?.[0]?.toUpperCase() || "?";

  const sprintActions = (
    <>
      {board.selectedSprint.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          disabled={board.interactionDisabled}
          onClick={() => board.moveToProduct(board.selectedSprint)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Remove ({board.selectedSprint.length})
        </Button>
      )}

      {selectedSprint?.status === "PLANNED" && canUpdate && (
        <Button
          type="button"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          disabled={sprintStatusUpdating || board.sprintItems.length === 0}
          title={
            board.sprintItems.length === 0
              ? "Thêm ít nhất một Backlog item trước khi bắt đầu Sprint"
              : undefined
          }
          onClick={() => void handleChangeSprintStatus("ACTIVE")}
        >
          {sprintStatusUpdating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Start sprint
        </Button>
      )}

      {selectedSprint?.status === "ACTIVE" && canUpdate && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          disabled={sprintStatusUpdating}
          onClick={() => void handleChangeSprintStatus("COMPLETED")}
        >
          {sprintStatusUpdating && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Complete sprint
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground"
            aria-label="Sprint actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          {canUpdate && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              Edit sprint
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                Delete sprint
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <MainLayout pathName={{ backlogs: "Backlogs", sprints: "Sprints" }}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <BacklogToolbar
          keyword={keyword}
          onKeywordChange={setKeyword}
          sprints={sprints}
          sprintId={selectedSprintId}
          onSprintChange={setSelectedSprintId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          allCollapsed={allCollapsed}
          onToggleCollapseAll={() =>
            setCollapsed(allCollapsed ? {} : { sprint: true })
          }
          canCreateSprint={canCreate}
          onCreateSprint={() => setCreateOpen(true)}
          onCreateBacklogItem={() => setCreateItemOpen(true)}
          currentUser={{
            initials: userInitials,
            label: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
              user.email ||
              "You",
          }}
        />

        {board.dirty && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <p className="text-xs font-medium text-primary">
              Unsaved backlog changes — the sprint order and assignments are not
              persisted yet.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                disabled={board.saving}
                onClick={() => void board.load()}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-[11px]"
                disabled={!canEditBoard || board.saving}
                onClick={() => void board.confirmPlan()}
              >
                {board.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        )}

        {sprintsQuery.isLoading ? (
          <Loading />
        ) : sprintsQuery.isError ? (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Unable to load the sprint list</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                {extractErrorMessage(
                  sprintsQuery.error,
                  "The sprint service did not answer. Please try again.",
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => void sprintsQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : sprints.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-20 text-center">
            <span className="rounded-full bg-muted p-3 text-muted-foreground">
              <Layers className="h-5 w-5" />
            </span>
            <h2 className="mt-1 text-sm font-semibold">
              No sprint has been created yet
            </h2>
            <p className="max-w-md text-xs text-muted-foreground">
              Create the first sprint to plan the backlog, track capacity and
              report progress.
            </p>
            {canCreate && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Create Sprint
              </Button>
            )}
          </div>
        ) : board.loading ? (
          <Loading />
        ) : board.loadError ? (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Unable to load the backlog</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{board.loadError}</span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => void board.load()}
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <BacklogSection
              title={selectedSprint?.name ?? "Sprint"}
              meta={formatBacklogRange(
                selectedSprint?.startDate,
                selectedSprint?.endDate,
              )}
              items={sprintItems}
              itemKeyPrefix={itemKeyPrefix}
              selectedIds={board.selectedSprint}
              collapsed={collapsedSprint}
              canEditTask={canEditTask}
              busyItemId={busyItemId}
              counts={statusCounts(board.sprintItems)}
              actions={sprintActions}
              emptyMessage="Nothing planned yet. Use Create below to pull an existing backlog item into this sprint, or to create a new work item."
              dueDate={sprintDueDate}
              draggable={canEditBoard}
              isDropTarget={board.dragTarget === "sprint"}
              footer={
                <SprintCreateRow
                  availableItems={board.productItems}
                  itemKeyPrefix={itemKeyPrefix}
                  canEdit={canEditBoard && !board.locked}
                  busy={board.saving}
                  onAddExisting={(ids) => void board.assignToSprint(ids)}
                  onCreateNew={() => setCreateItemOpen(true)}
                />
              }
              onToggleCollapse={() =>
                setCollapsed((previous) => ({
                  ...previous,
                  sprint: !previous.sprint,
                }))
              }
              onToggleSelectAll={toggleSelectAllSprint}
              onToggleSelect={board.toggleSprintSelection}
              onStatusChange={handleItemStatusChange}
              onOpenDetail={setDetailItem}
              onDragStartItem={(id) => board.setDragged({ id, from: "sprint" })}
              onDragEndItem={() => board.setDragged(null)}
              onDragOverSection={() => board.setDragTarget("sprint")}
              onDragLeaveSection={handleDragLeave}
              onDropSection={handleSprintDrop}
            />
          </div>
        )}
      </div>

      <FormModal
        open={createOpen}
        onClose={setCreateOpen}
        schema={sprintSchema}
        title="Create Sprint"
        onSubmit={handleCreateSprint}
        isSubmitting={submitting}
      />

      <FormModal
        open={createItemOpen}
        onClose={setCreateItemOpen}
        schema={backlogItemSchema}
        title="Create work item"
        onSubmit={handleCreateWorkItem}
        isSubmitting={submitting}
      />

      <FormModal
        open={editOpen}
        onClose={setEditOpen}
        schema={sprintSchema}
        title="Edit Sprint"
        initial={editInitial}
        onSubmit={handleUpdateSprint}
        isSubmitting={submitting}
      />

      <ConfirmDeleteModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteSprint}
        loading={submitting}
        title="Delete sprint"
        description={
          selectedSprint
            ? `"${selectedSprint.name ?? selectedSprint.id}" will be removed. Backlog items that belong to it return to the product backlog.`
            : undefined
        }
      />

      <BacklogItemDetailSheet
        open={detailItem !== null}
        onClose={(open) => {
          if (!open) setDetailItem(null);
        }}
        item={detailItem}
        itemKey={
          detailItem ? backlogItemKey(itemKeyPrefix, detailItem) : undefined
        }
        sprintName={selectedSprint?.name ?? null}
      />
    </MainLayout>
  );
}
