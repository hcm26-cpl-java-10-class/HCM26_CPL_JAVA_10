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
  SprintBacklogWorkType,
  SprintDTO,
  SprintPlanningItem,
  SprintStatus,
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
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "../sprint/hooks/useSprintPlanningBoard";
import { sprintSchema } from "../sprint/sprint.schema";
import {
  emptySprintBacklogMessage,
  incompleteSprintMessage,
  unfinishedSprintItems,
} from "../sprint/workspace/board.constants";
import { backlogItemKey, formatBacklogRange, projectKeyOf, statusCounts } from "./backlog.constants";
import { BacklogItemDetailSheet } from "./components/BacklogItemDetailSheet";
import { BacklogSection } from "./components/BacklogSection";
import { BacklogToolbar } from "./components/BacklogToolbar";
import {
  SprintCreateRow,
  type BacklogCreateValues,
} from "./components/SprintCreateRow";

const SPRINTS_QUERY_KEY = ["sprints", "backlog"] as const;
const BACKLOG_ITEMS_QUERY_KEY = ["sprint-backlogs", "backlog-page"] as const;

/** Key of the product backlog box (items without a sprint). */
const BACKLOG_SECTION_KEY = "backlog";
const SPRINT_SECTION_PREFIX = "sprint-";

const sprintSectionKey = (sprintId: number) =>
  `${SPRINT_SECTION_PREFIX}${sprintId}`;

/** `sprint-12` -> 12, `backlog` -> null (product backlog). */
const sprintIdOfSection = (key: string): number | null => {
  if (!key.startsWith(SPRINT_SECTION_PREFIX)) {
    return null;
  }

  const parsed = Number(key.slice(SPRINT_SECTION_PREFIX.length));

  return Number.isFinite(parsed) ? parsed : null;
};

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
 * Reverse mapping used when the `/backlogs` page reads the flat list of Sprint
 * Backlog records (the backend has no `BACKLOG` status).
 */
const toBoardStatus = (
  status: SprintBacklogStatus | null | undefined,
  hasSprint: boolean,
): BacklogStatus => {
  switch (status) {
    case "IN_PROGRESS":
    case "REVIEW":
      return "IN_PROGRESS";
    case "DONE":
      return "DONE";
    case "TODO":
      return "SPRINT_BACKLOG";
    default:
      return hasSprint ? "SPRINT_BACKLOG" : "BACKLOG";
  }
};

const toPlanningItem = (dto: SprintBacklogDTO): SprintPlanningItem => ({
  id: dto.id as number,
  title: dto.title ?? null,
  description: dto.description ?? null,
  priority: (dto.priority as BacklogPriority | null | undefined) ?? null,
  status: toBoardStatus(dto.status, dto.sprintId != null),
  workType: (dto.workType as SprintBacklogWorkType | null | undefined) ?? "TASK",
  sprintId: dto.sprintId ?? null,
  assigneeProjectMemberId: dto.assigneeProjectMemberId ?? null,
  startDate: dto.startDate ?? null,
  endDate: dto.endDate ?? null,
  estimatedHours: dto.estimatedHours ?? null,
  sprintOrder: null,
});

/** One collapsible box of the board: a sprint, or the product backlog. */
interface BoardSection {
  key: string;
  sprint: SprintDTO | null;
  sprintId: number | null;
  title: string;
  meta: string | null;
  prefix: string;
  /** Items matching the search / status / priority filters. */
  items: SprintPlanningItem[];
  /** Every item of the box, filters ignored. */
  allItems: SprintPlanningItem[];
  /** Completed / cancelled sprints have a frozen scope. */
  locked: boolean;
  dueDate: string | null;
}

/**
 * Student backlog page (`/backlogs`, also served by `/sprints`).
 * <p>
 * Every sprint is rendered as its own collapsible box and the product backlog
 * (items without a sprint) gets a box of its own at the bottom. Each box has a
 * `+ Create` row that creates a work item inside that box, and work items can
 * be moved between boxes by drag and drop or by selection. Their status moves
 * one step along the UFR-PRJ-003-02 workflow.
 */
export default function BacklogPage() {
  const queryClient = useQueryClient();
  const { hasAllPermissions, user } = usePermissions();

  const canCreate = hasAllPermissions(["SPRINT_CREATE"]);
  const canUpdate = hasAllPermissions(["SPRINT_UPDATE"]);
  const canDelete = hasAllPermissions(["SPRINT_DELETE"]);
  const canEditTask = hasAllPermissions(["SPRINT_BACKLOG_UPDATE"]);
  const canEditBoard = canUpdate && canEditTask;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<BacklogStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<BacklogPriority | "ALL">(
    "ALL",
  );

  /** Selected work items per box key. */
  const [selected, setSelected] = useState<Record<string, number[]>>({});

  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<SprintDTO | null>(null);
  const [deletingSprint, setDeletingSprint] = useState<SprintDTO | null>(null);
  const [detailItem, setDetailItem] = useState<SprintPlanningItem | null>(null);

  const [submitting, setSubmitting] = useState(false);
  /** Box whose inline create bar is saving (`null` = idle). */
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [movingSelection, setMovingSelection] = useState(false);

  const [dragged, setDragged] = useState<{ id: number; from: string } | null>(
    null,
  );
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  const sprintsQuery = useQuery({
    queryKey: SPRINTS_QUERY_KEY,
    queryFn: () => sprintApi.getPage({ page: 0, size: 100, sort: ["id,asc"] }),
  });

  const itemsQuery = useQuery({
    queryKey: BACKLOG_ITEMS_QUERY_KEY,
    queryFn: () =>
      sprintBacklogApi.getPage({ page: 0, size: 500, sort: ["id,asc"] }),
  });

  const sprints = useMemo<SprintDTO[]>(
    () => sprintsQuery.data?.content ?? [],
    [sprintsQuery.data],
  );

  /** Work items grouped by sprint id (`null` = product backlog). */
  const groupedItems = useMemo(() => {
    const knownSprintIds = new Set(
      sprints
        .map((sprint) => sprint.id)
        .filter((id): id is number => id != null),
    );
    const grouped = new Map<number | null, SprintPlanningItem[]>();

    (itemsQuery.data?.content ?? []).forEach((dto) => {
      if (dto.id == null) return;

      const key =
        dto.sprintId != null && knownSprintIds.has(dto.sprintId)
          ? dto.sprintId
          : null;
      const list = grouped.get(key) ?? [];

      list.push(toPlanningItem(dto));
      grouped.set(key, list);
    });

    return grouped;
  }, [itemsQuery.data, sprints]);

  const itemIdsOf = useCallback(
    (sprintId: number | null) =>
      (groupedItems.get(sprintId) ?? []).map((item) => item.id),
    [groupedItems],
  );

  const matchesFilters = useCallback(
    (item: SprintPlanningItem, prefix: string) => {
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

      const itemKey = backlogItemKey(prefix, item);

      return (
        (item.title ?? "").toLowerCase().includes(normalizedKeyword) ||
        itemKey.toLowerCase().includes(normalizedKeyword)
      );
    },
    [keyword, priorityFilter, statusFilter],
  );

  const sections = useMemo<BoardSection[]>(() => {
    const build = (
      sprint: SprintDTO | null,
      items: SprintPlanningItem[],
    ): BoardSection => {
      const sprintStatus = sprint?.status ?? null;
      const prefix = sprint ? projectKeyOf(sprint.name) : "PRJ";

      return {
        key: sprint?.id != null ? sprintSectionKey(sprint.id) : BACKLOG_SECTION_KEY,
        sprint,
        sprintId: sprint?.id ?? null,
        title:
          sprint?.name?.trim() ||
          (sprint?.id != null ? `Sprint ${sprint.id}` : "Backlog"),
        meta: sprint
          ? formatBacklogRange(sprint.startDate, sprint.endDate)
          : null,
        prefix,
        items: items.filter((item) => matchesFilters(item, prefix)),
        allItems: items,
        locked: sprintStatus === "COMPLETED" || sprintStatus === "CANCELLED",
        dueDate: sprint?.endDate ?? null,
      };
    };

    const sprintSections = sprints
      .filter((sprint) => sprint.id != null)
      .map((sprint) => build(sprint, groupedItems.get(sprint.id as number) ?? []));

    return [...sprintSections, build(null, groupedItems.get(null) ?? [])];
  }, [groupedItems, matchesFilters, sprints]);

  const allCollapsed =
    sections.length > 0 && sections.every((section) => !!collapsed[section.key]);

  const refreshBoard = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: BACKLOG_ITEMS_QUERY_KEY });
  }, [queryClient]);

  const refreshSprints = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SPRINTS_QUERY_KEY });
  }, [queryClient]);

  const selectedIdsOf = (key: string, items: SprintPlanningItem[]) => {
    const ids = selected[key] ?? [];

    return ids.filter((id) => items.some((item) => item.id === id));
  };

  const toggleSelect = (key: string, id: number) => {
    setSelected((previous) => {
      const current = previous[key] ?? [];

      return {
        ...previous,
        [key]: current.includes(id)
          ? current.filter((value) => value !== id)
          : [...current, id],
      };
    });
  };

  const toggleSelectAll = (key: string, ids: number[]) => {
    setSelected((previous) => {
      const current = previous[key] ?? [];
      const allSelected =
        ids.length > 0 && ids.every((id) => current.includes(id));

      return { ...previous, [key]: allSelected ? [] : ids };
    });
  };

  const clearSelection = (key: string) => {
    setSelected((previous) => ({ ...previous, [key]: [] }));
  };

  const handleCreateSprint = async (values: Record<string, unknown>) => {
    if (submitting) return;

    setSubmitting(true);

    try {
      await sprintApi.create(values as SprintDTO);
      setCreateSprintOpen(false);
      await refreshSprints();

      toast.success("Đã tạo Sprint mới.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể tạo Sprint."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSprint = async (values: Record<string, unknown>) => {
    if (!editingSprint?.id || submitting) return;

    setSubmitting(true);

    try {
      await sprintApi.update(String(editingSprint.id), {
        ...editingSprint,
        ...values,
      } as SprintDTO);
      setEditingSprint(null);
      await refreshSprints();
      await refreshBoard();

      toast.success("Đã cập nhật Sprint.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể cập nhật Sprint."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeSprintStatus = async (
    section: BoardSection,
    status: SprintStatus,
  ) => {
    const sprint = section.sprint;

    if (!sprint?.id || statusUpdatingId !== null) return;

    /** A sprint can only start once it holds at least one backlog item. */
    if (status === "ACTIVE" && section.allItems.length === 0) {
      toast.error(emptySprintBacklogMessage());
      return;
    }

    if (status === "COMPLETED") {
      const unfinished = unfinishedSprintItems(section.allItems);

      if (unfinished.length > 0) {
        toast.error(incompleteSprintMessage(unfinished.length));
        return;
      }
    }

    setStatusUpdatingId(sprint.id);

    try {
      await sprintApi.update(String(sprint.id), {
        ...sprint,
        status,
      } as SprintDTO);
      await refreshSprints();
      await refreshBoard();

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
      setStatusUpdatingId(null);
    }
  };

  const handleDeleteSprint = async () => {
    if (!deletingSprint?.id) return;

    setSubmitting(true);

    try {
      await sprintApi.delete(String(deletingSprint.id));
      setDeletingSprint(null);
      await refreshSprints();
      await refreshBoard();

      toast.success("Đã xóa Sprint.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể xóa Sprint."));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Creates a work item straight from the inline create bar of a box.
   * <p>
   * The owning sprint comes from the box that opened the bar (`null` for the
   * product backlog) and the due date picked in the bar is stored as the
   * schedule the backend expects (`startDate` / `endDate` are a both-or-none
   * pair).
   *
   * @returns `true` when the item was created so the bar can reset itself.
   */
  const handleCreateItem = async (
    boxKey: string,
    sprintId: number | null,
    values: BacklogCreateValues,
  ): Promise<boolean> => {
    if (creatingKey !== null) return false;

    setCreatingKey(boxKey);

    try {
      await sprintBacklogApi.create({
        sprintId,
        title: values.title,
        workType: values.workType,
        status: "TODO",
        priority: "MEDIUM",
        assigneeProjectMemberId: values.assigneeProjectMemberId,
        startDate: values.dueDate ? `${values.dueDate}T00:00:00` : null,
        endDate: values.dueDate ? `${values.dueDate}T23:59:00` : null,
        // `BaseDTO.isActive` is mandatory on create.
        isActive: true,
      } as SprintBacklogDTO);

      await refreshBoard();

      toast.success(
        sprintId === null
          ? "Đã tạo công việc trong Backlog."
          : "Đã tạo công việc trong Sprint.",
      );

      return true;
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể tạo công việc."));

      return false;
    } finally {
      setCreatingKey(null);
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
      await refreshBoard();

      toast.success("Đã cập nhật trạng thái công việc.");
    } catch (error) {
      toast.error(
        extractErrorMessage(error, "Không thể cập nhật trạng thái công việc."),
      );
    } finally {
      setBusyItemId(null);
    }
  };

  /** Moves the selected work items of a sprint box back to the backlog box. */
  const handleRemoveSelection = async (
    section: BoardSection,
    ids: number[],
  ) => {
    const sprintId = section.sprintId;

    if (!canEditBoard || sprintId === null || ids.length === 0) return;

    setMovingSelection(true);

    try {
      const remaining = itemIdsOf(sprintId).filter((id) => !ids.includes(id));

      await sprintApi.updateBacklog(String(sprintId), remaining);
      clearSelection(section.key);
      await refreshBoard();

      toast.success(
        ids.length === 1
          ? "Đã chuyển công việc về Backlog."
          : `Đã chuyển ${ids.length} công việc về Backlog.`,
      );
    } catch (error) {
      toast.error(
        extractErrorMessage(error, "Không thể chuyển công việc về Backlog."),
      );
    } finally {
      setMovingSelection(false);
    }
  };

  /**
   * Drag and drop between two boxes: the Sprint Planning endpoint of the target
   * sprint re-assigns the item, and dropping onto the backlog box removes it
   * from its current sprint.
   */
  const moveItemToSection = async (
    source: { id: number; from: string },
    targetKey: string,
  ) => {
    if (!canEditBoard) return;

    const sourceSprintId = sprintIdOfSection(source.from);
    const targetSprintId = sprintIdOfSection(targetKey);

    if (sourceSprintId === targetSprintId) return;

    setBusyItemId(source.id);

    try {
      if (targetSprintId === null) {
        if (sourceSprintId === null) return;

        await sprintApi.updateBacklog(
          String(sourceSprintId),
          itemIdsOf(sourceSprintId).filter((id) => id !== source.id),
        );
      } else {
        const targetIds = itemIdsOf(targetSprintId);

        if (targetIds.includes(source.id)) return;

        await sprintApi.updateBacklog(String(targetSprintId), [
          ...targetIds,
          source.id,
        ]);
      }

      if (sourceSprintId !== null) {
        clearSelection(source.from);
      }

      await refreshBoard();

      toast.success("Đã chuyển công việc sang box khác.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể chuyển công việc."));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragTarget(null);
    }
  };

  const handleDropOnSection = (
    event: DragEvent<HTMLElement>,
    targetKey: string,
  ) => {
    event.preventDefault();

    const source = dragged;

    setDragged(null);
    setDragTarget(null);

    if (!source || source.from === targetKey) return;

    void moveItemToSection(source, targetKey);
  };

  const renderSprintActions = (
    section: BoardSection,
    selectedIds: number[],
  ) => {
    const sprint = section.sprint;

    if (!sprint?.id) return null;

    const updating = statusUpdatingId === sprint.id;

    return (
      <>
        {selectedIds.length > 0 && canEditBoard && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            disabled={movingSelection || section.locked}
            onClick={() => void handleRemoveSelection(section, selectedIds)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Remove ({selectedIds.length})
          </Button>
        )}

        {sprint.status === "PLANNED" && canUpdate && (
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            disabled={updating || section.allItems.length === 0}
            title={
              section.allItems.length === 0
                ? "Thêm ít nhất một Backlog item trước khi bắt đầu Sprint"
                : undefined
            }
            onClick={() => void handleChangeSprintStatus(section, "ACTIVE")}
          >
            {updating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Start sprint
          </Button>
        )}

        {sprint.status === "ACTIVE" && canUpdate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            disabled={updating}
            onClick={() => void handleChangeSprintStatus(section, "COMPLETED")}
          >
            {updating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
              <DropdownMenuItem onClick={() => setEditingSprint(sprint)}>
                Edit sprint
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeletingSprint(sprint)}>
                  Delete sprint
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  };

  const userInitials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`
      .trim()
      .toUpperCase() || user.email?.[0]?.toUpperCase() || "?";

  const detailSection = detailItem
    ? sections.find((section) =>
        section.allItems.some((item) => item.id === detailItem.id),
      )
    : undefined;

  const editInitial = editingSprint
    ? {
        ...editingSprint,
        startDate: toDateTimeLocal(editingSprint.startDate),
        endDate: toDateTimeLocal(editingSprint.endDate),
      }
    : null;

  /**
   * Member ids already used on the board, offered as quick picks by the
   * assignee picker of the inline create bar.
   */
  const assigneeOptions = useMemo(() => {
    const ids = new Set<number>();

    (itemsQuery.data?.content ?? []).forEach((dto) => {
      if (dto.assigneeProjectMemberId != null) {
        ids.add(dto.assigneeProjectMemberId);
      }
    });

    return [...ids].sort((left, right) => left - right).slice(0, 8);
  }, [itemsQuery.data]);

  const loading = sprintsQuery.isLoading || itemsQuery.isLoading;
  const loadError = sprintsQuery.isError
    ? extractErrorMessage(
        sprintsQuery.error,
        "The sprint service did not answer. Please try again.",
      )
    : itemsQuery.isError
      ? extractErrorMessage(
          itemsQuery.error,
          "The backlog service did not answer. Please try again.",
        )
      : null;

  return (
    <MainLayout pathName={{ backlogs: "Backlogs", sprints: "Sprints" }}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <BacklogToolbar
          keyword={keyword}
          onKeywordChange={setKeyword}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          allCollapsed={allCollapsed}
          onToggleCollapseAll={() =>
            setCollapsed(
              allCollapsed
                ? {}
                : Object.fromEntries(
                    sections.map((section) => [section.key, true]),
                  ),
            )
          }
          canCreateSprint={canCreate}
          onCreateSprint={() => setCreateSprintOpen(true)}
          currentUser={{
            initials: userInitials,
            label:
              `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
              user.email ||
              "You",
          }}
        />

        {loading ? (
          <Loading />
        ) : loadError ? (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Unable to load the backlog</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{loadError}</span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  void sprintsQuery.refetch();
                  void itemsQuery.refetch();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            {sprints.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
                <span className="rounded-full bg-muted p-3 text-muted-foreground">
                  <Layers className="h-5 w-5" />
                </span>
                <h2 className="mt-1 text-sm font-semibold">
                  No sprint has been created yet
                </h2>
                <p className="max-w-md text-xs text-muted-foreground">
                  Create the first sprint to plan the backlog, track capacity and
                  report progress. Work items created in the backlog box below
                  keep waiting for a sprint.
                </p>
                {canCreate && (
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => setCreateSprintOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Create Sprint
                  </Button>
                )}
              </div>
            )}

            {sections.map((section) => {
              const selectedIds = selectedIdsOf(section.key, section.allItems);
              const sectionEditable = canEditBoard && !section.locked;
              const isSprintBox = section.sprint !== null;

              return (
                <BacklogSection
                  key={section.key}
                  title={section.title}
                  meta={section.meta}
                  items={section.items}
                  itemKeyPrefix={section.prefix}
                  selectedIds={selectedIds}
                  collapsed={!!collapsed[section.key]}
                  canEditTask={canEditTask && !section.locked}
                  busyItemId={busyItemId}
                  counts={statusCounts(section.allItems)}
                  actions={
                    isSprintBox
                      ? renderSprintActions(section, selectedIds)
                      : undefined
                  }
                  footer={
                    <SprintCreateRow
                      canEdit={sectionEditable}
                      hint={
                        isSprintBox
                          ? "Create a work item inside this sprint."
                          : "Create a work item in the product backlog."
                      }
                      creating={creatingKey === section.key}
                      assigneeOptions={assigneeOptions}
                      onCreate={(values) =>
                        handleCreateItem(section.key, section.sprintId, values)
                      }
                    />
                  }
                  emptyMessage={
                    isSprintBox
                      ? "Nothing planned yet. Use Create below to add a work item to this sprint."
                      : "The product backlog is empty. Use Create below to add a work item."
                  }
                  dueDate={section.dueDate}
                  draggable={sectionEditable}
                  isDropTarget={dragTarget === section.key}
                  onToggleCollapse={() =>
                    setCollapsed((previous) => ({
                      ...previous,
                      [section.key]: !previous[section.key],
                    }))
                  }
                  onToggleSelectAll={() =>
                    toggleSelectAll(section.key, section.items.map((item) => item.id))
                  }
                  onToggleSelect={(id) => toggleSelect(section.key, id)}
                  onStatusChange={handleItemStatusChange}
                  onOpenDetail={setDetailItem}
                  onDragStartItem={(id) =>
                    setDragged({ id, from: section.key })
                  }
                  onDragEndItem={() => setDragged(null)}
                  onDragOverSection={() => setDragTarget(section.key)}
                  onDragLeaveSection={handleDragLeave}
                  onDropSection={(event) =>
                    handleDropOnSection(event, section.key)
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <FormModal
        open={createSprintOpen}
        onClose={setCreateSprintOpen}
        schema={sprintSchema}
        title="Create Sprint"
        onSubmit={handleCreateSprint}
        isSubmitting={submitting}
      />

      <FormModal
        open={editingSprint !== null}
        onClose={(open) => {
          if (!open) setEditingSprint(null);
        }}
        schema={sprintSchema}
        title="Edit Sprint"
        initial={editInitial}
        onSubmit={handleUpdateSprint}
        isSubmitting={submitting}
      />

      <ConfirmDeleteModal
        open={deletingSprint !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingSprint(null);
        }}
        onConfirm={handleDeleteSprint}
        loading={submitting}
        title="Delete sprint"
        description={
          deletingSprint
            ? `"${deletingSprint.name ?? deletingSprint.id}" will be removed. Backlog items that belong to it return to the product backlog.`
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
          detailItem && detailSection
            ? backlogItemKey(detailSection.prefix, detailItem)
            : undefined
        }
        sprintName={detailSection?.sprint?.name ?? null}
        sprints={sprints}
        canEdit={canEditTask && !detailSection?.locked}
        canMove={canEditBoard && !detailSection?.locked}
        canDelete={canDelete}
        onChanged={() => refreshBoard()}
        onDeleted={async () => {
          setDetailItem(null);
          await refreshBoard();
        }}
      />
    </MainLayout>
  );
}
