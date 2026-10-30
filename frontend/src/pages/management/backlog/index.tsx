import { milestoneApi, sprintApi, sprintBacklogApi, teamBacklogApi } from "@/api";
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
  BacklogAssigneeOption,
  BacklogPriority,
  BacklogStatus,
  MilestoneOption,
  SprintBacklogDTO,
  SprintBacklogStatus,
  SprintBacklogWorkType,
  SprintDTO,
  SprintPlanningItem,
  SprintStatus,
} from "@/types";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
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
  type BacklogCreateResult,
  type BacklogCreateValues,
} from "./components/SprintCreateRow";

const SPRINTS_QUERY_KEY = ["sprints", "backlog"] as const;
const BACKLOG_ITEMS_QUERY_KEY = ["sprint-backlogs", "backlog-page"] as const;
const MILESTONE_OPTIONS_QUERY_KEY = ["milestones", "backlog-options"] as const;
/** Team members offered by the assignee picker of the create bar. */
const ASSIGNEE_OPTIONS_QUERY_KEY = ["sprint-backlogs", "assignee-options"] as const;
/** Team-scoped board of a workspace (only its own sprints and items). */
const TEAM_BOARD_QUERY_KEY = ["team-backlog-board"] as const;
/** Projects the user can see, used to build the work item key prefix. */
const PROJECT_NAMES_QUERY_KEY = ["projects", "backlog-key-prefix"] as const;

const MILESTONE_CHANGED_MESSAGE =
  "Milestone không tồn tại hoặc đã bị thay đổi";

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
 * Board statuses map onto the backend lifecycle: the product backlog is
 * `TODO`, and the workflow columns are `TODO` (To do), `IN_PROGRESS`,
 * `REVIEW` and `DONE` - the same statuses the workspace Kanban board uses.
 */
const toSprintBacklogStatus = (status: BacklogStatus): SprintBacklogStatus => {
  switch (status) {
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "REVIEW":
      return "REVIEW";
    case "DONE":
      return "DONE";
    case "BLOCKED":
      return "BLOCKED";
    default:
      return "TODO";
  }
};

/**
 * Reverse mapping used when the `/backlogs` page reads the flat list of Sprint
 * Backlog records (the backend has no `BACKLOG` status).
 * <p>
 * `REVIEW` is kept as its own column so the Backlogs tab shows the same
 * statuses as the workspace Kanban board instead of reporting review work as
 * in progress.
 */
const toBoardStatus = (
  status: SprintBacklogStatus | null | undefined,
  hasSprint: boolean,
): BacklogStatus => {
  switch (status) {
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "REVIEW":
      return "REVIEW";
    case "BLOCKED":
      return "BLOCKED";
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
  projectId: dto.projectId ?? null,
  milestoneId: dto.milestoneId ?? null,
  milestoneName: dto.milestoneName ?? null,
  milestoneDueDate: dto.milestoneDueDate ?? null,
  estimatedHours: dto.estimatedHours ?? null,
  sprintOrder: null,
});

/**
 * Maps an API failure of the create call onto the inline create bar.
 * <p>
 * 422 responses carry a per-field map (`errors`) that is forwarded so the
 * offending input can be highlighted while the other values stay untouched
 * (AC02). A 404 means the linked milestone vanished, so the shared message of
 * AC03 is shown instead.
 */
const toCreateResult = (error: unknown): BacklogCreateResult => {
  if (!axios.isAxiosError(error)) {
    return { ok: false, message: "Không thể tạo Backlog item." };
  }

  const status = error.response?.status;
  const data = error.response?.data as
    | { message?: string; errors?: Record<string, string[]> }
    | undefined;

  const fieldErrors: Record<string, string> = {};

  Object.entries(data?.errors ?? {}).forEach(([field, messages]) => {
    const first = Array.isArray(messages) ? messages[0] : messages;

    if (typeof first === "string" && first.trim()) {
      fieldErrors[field] = first;
    }
  });

  if (status === 404) {
    return { ok: false, message: MILESTONE_CHANGED_MESSAGE };
  }

  const firstFieldError = Object.values(fieldErrors)[0];

  return {
    ok: false,
    fieldErrors,
    message:
      firstFieldError ??
      (typeof data?.message === "string" && data.message.trim()
        ? data.message
        : "Không thể tạo Backlog item."),
  };
};

/** One collapsible box of the board: a sprint, or the product backlog. */
interface BoardSection {
  key: string;
  sprint: SprintDTO | null;
  sprintId: number | null;
  /** Project of the box, used to scope the milestone picker. */
  projectId: number | null;
  /** Team owning the sprint of the box (used by the assignee picker). */
  teamId: number | null;
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

export interface BacklogBoardProps {
  /**
   * `true` when the board is mounted inside a page section (workspace Backlog
   * tab) instead of being the whole route page, so it must not claim the full
   * viewport height.
   */
  embedded?: boolean;
  /**
   * Project the board is scoped to. The value comes from the workspace of the
   * open team, so every workspace lists only the sprints and work items of its
   * own project instead of the whole database (`null` = unscoped, the
   * `/backlogs` route page).
   */
  projectId?: number | null;
  /**
   * Team of the open workspace. When it is set the board reads the team-scoped
   * endpoint (`/teams/{teamId}/backlog-board`), so a team workspace lists only
   * its own sprints and work items instead of every record of the tenant
   * (`null` = tenant-wide, the `/backlogs` route page).
   */
  teamId?: number | null;
  /**
   * Name of the workspace project. It is the fallback source of the work item
   * key prefix (`Student Support Portal` -> `SSP`) when the workspace does not
   * configure one, so the workspace page passes the name it already has
   * instead of relying on a second lookup.
   */
  projectName?: string | null;
  /**
   * Key prefix configured for the workspace (`FA` by default). It is the same
   * prefix the backend numbers the tasks of the workspace with, so it wins
   * over the project acronym when it is present (`FA-21`).
   */
  taskKeyPrefix?: string | null;
}

/**
 * Student backlog board (`/backlogs`, also served by `/sprints` and by the
 * Backlog tab of a workspace).
 * <p>
 * Every sprint is rendered as its own collapsible box and the product backlog
 * (items without a sprint) gets a box of its own at the bottom. Each box has a
 * `+ Create` row that creates a work item inside that box, and work items can
 * be moved between boxes by drag and drop or by selection. Their status moves
 * one step along the UFR-PRJ-003-02 workflow.
 */
export function BacklogBoard({
  embedded = false,
  projectId = null,
  teamId = null,
  projectName = null,
  taskKeyPrefix = null,
}: BacklogBoardProps) {
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

  /**
   * Team-scoped data of the open workspace. It replaces the tenant-wide page
   * queries below whenever the board is mounted for a team workspace.
   */
  const teamQuery = useQuery({
    queryKey: [...TEAM_BOARD_QUERY_KEY, teamId ?? "none"],
    queryFn: () => teamBacklogApi.getBoard(teamId as number),
    enabled: teamId != null,
  });

  /**
   * Names of the projects the user can see. The work item key prefix is taken
   * from the project of a box (`Student Support Portal` -> `SSP`), so a sprint
   * name can never leak into the key of its work items.
   */
  const projectNamesQuery = useQuery({
    queryKey: [...PROJECT_NAMES_QUERY_KEY],
    queryFn: ({ signal }) => milestoneApi.getProjectOptions(signal),
    staleTime: 60_000,
    retry: false,
  });

  const sprintsQuery = useQuery({
    queryKey: [...SPRINTS_QUERY_KEY, projectId ?? "all"],
    queryFn: () =>
      sprintApi.getPage(
        { page: 0, size: 100, sort: ["id,asc"] },
        undefined,
        projectId == null ? undefined : { ids: [], projectId },
      ),
    enabled: teamId == null,
  });

  const itemsQuery = useQuery({
    queryKey: [...BACKLOG_ITEMS_QUERY_KEY, projectId ?? "all"],
    queryFn: () =>
      sprintBacklogApi.getPage(
        { page: 0, size: 500, sort: ["id,asc"] },
        undefined,
        projectId == null ? undefined : { ids: [], projectId },
      ),
    enabled: teamId == null,
  });

  /**
   * Active milestones the user can link a backlog item to (UFR-PRJ-003-02).
   * Inside a team workspace the request is scoped to that team, so the picker
   * only offers its own milestones instead of every milestone of the tenant.
   */
  const milestonesQuery = useQuery({
    queryKey: [...MILESTONE_OPTIONS_QUERY_KEY, teamId ?? "all"],
    queryFn: () => milestoneApi.getBacklogOptions(teamId),
    staleTime: 60_000,
  });

  /**
   * Active members of the workspace team, so the assignee picker of a work
   * item offers the people of that team instead of a raw member id. When the
   * board is not team-scoped (project scoped board or the global `/backlogs`
   * page) the project is sent too, so the backend resolves the team that owns
   * it and the picker still lists real members.
   */
  const assigneesQuery = useQuery({
    queryKey: [...ASSIGNEE_OPTIONS_QUERY_KEY, teamId ?? "none", projectId ?? "none"],
    queryFn: () => sprintBacklogApi.getAssigneeOptions(teamId, projectId),
    enabled: teamId != null || projectId != null,
    staleTime: 60_000,
  });

  const assignees = useMemo(
    () => assigneesQuery.data ?? [],
    [assigneesQuery.data],
  );

  const milestones = useMemo<MilestoneOption[]>(
    () => milestonesQuery.data ?? [],
    [milestonesQuery.data],
  );

  /**
   * Project that owns new sprints / work items. Inside a team workspace the
   * scope comes from the team itself when the workspace has no project.
   */
  const scopedProjectId = projectId ?? teamQuery.data?.projectId ?? null;

  /**
   * `projectId -> project name` lookup behind the work item key prefix. The
   * name the workspace page already knows wins over the options response.
   */
  const projectNames = useMemo(() => {
    const names = new Map<number, string>();

    (projectNamesQuery.data ?? []).forEach((option) => {
      const id = Number(option.id);
      const name = option.name?.trim();

      if (Number.isFinite(id) && name) {
        names.set(id, name);
      }
    });

    if (projectId != null && projectName?.trim()) {
      names.set(projectId, projectName.trim());
    }

    return names;
  }, [projectId, projectName, projectNamesQuery.data]);

  const sprints = useMemo<SprintDTO[]>(
    () =>
      teamId != null
        ? (teamQuery.data?.sprints ?? [])
        : (sprintsQuery.data?.content ?? []),
    [sprintsQuery.data, teamId, teamQuery.data],
  );

  /** Work items of the board (already team-scoped inside a workspace). */
  const items = useMemo<SprintBacklogDTO[]>(
    () =>
      teamId != null
        ? (teamQuery.data?.items ?? [])
        : (itemsQuery.data?.content ?? []),
    [itemsQuery.data, teamId, teamQuery.data],
  );

  /** Work items grouped by sprint id (`null` = product backlog). */
  const groupedItems = useMemo(() => {
    const knownSprintIds = new Set(
      sprints
        .map((sprint) => sprint.id)
        .filter((id): id is number => id != null),
    );
    const grouped = new Map<number | null, SprintPlanningItem[]>();

    items.forEach((dto) => {
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
  }, [items, sprints]);

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
      const sectionProjectId = sprint?.projectId ?? scopedProjectId ?? null;
      /**
       * Work item key prefix of the box: the prefix configured for the
       * workspace (`FA`) wins, because it is the one the backend numbers the
       * tasks with; otherwise the acronym of the workspace project
       * (`Student Support Portal` -> `SSP`). The sprint name is never used, so
       * two sprints of the same project share the same key prefix.
       */
      const prefix =
        taskKeyPrefix?.trim() ||
        projectKeyOf(
          sectionProjectId == null ? null : projectNames.get(sectionProjectId),
        );

      return {
        key: sprint?.id != null ? sprintSectionKey(sprint.id) : BACKLOG_SECTION_KEY,
        sprint,
        sprintId: sprint?.id ?? null,
        projectId: sectionProjectId,
        teamId: sprint?.teamId ?? teamId ?? null,
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
  }, [
    groupedItems,
    matchesFilters,
    projectNames,
    scopedProjectId,
    sprints,
    taskKeyPrefix,
  ]);

  const allCollapsed =
    sections.length > 0 && sections.every((section) => !!collapsed[section.key]);

  /**
   * Assignee names of the rows. Boards that are not scoped to a workspace (the
   * global `/backlogs` page) have no board level team / project, so the query
   * above stays empty; the members of every project rendered on the board are
   * then fetched so a row can still show the `NA` initials bubble of its
   * assignee instead of the raw `project_members.id`.
   */
  const boardProjectIds = useMemo(
    () =>
      Array.from(
        new Set(
          sections
            .map((section) => section.projectId)
            .filter((id): id is number => id != null),
        ),
      ),
    [sections],
  );

  const projectAssigneeQueries = useQueries({
    queries: (assignees.length > 0 ? [] : boardProjectIds).map((projectId) => ({
      queryKey: [...ASSIGNEE_OPTIONS_QUERY_KEY, "project", projectId],
      queryFn: () => sprintBacklogApi.getAssigneeOptions(null, projectId),
      staleTime: 60_000,
    })),
  });

  const rowAssignees: BacklogAssigneeOption[] =
    assignees.length > 0
      ? assignees
      : Array.from(
          new Map(
            projectAssigneeQueries
              .flatMap((query) => query.data ?? [])
              .map((member) => [member.id, member] as const),
          ).values(),
        );

  const refreshBoard = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: BACKLOG_ITEMS_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: TEAM_BOARD_QUERY_KEY });
  }, [queryClient]);

  const refreshSprints = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SPRINTS_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: TEAM_BOARD_QUERY_KEY });
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
      await sprintApi.create({
        ...values,
        projectId:
          scopedProjectId ?? (values.projectId as number | null | undefined) ?? null,
        // Keeps the new sprint inside the team workspace that created it.
        teamId,
      } as SprintDTO);
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
   * pair). The milestone is optional (UFR-PRJ-003-02).
   *
   * @returns the outcome so the bar can reset itself or highlight the fields
   *          rejected by the API (422) and keep the typed values (404).
   */
  const handleCreateItem = async (
    boxKey: string,
    sprintId: number | null,
    values: BacklogCreateValues,
    boxProjectId: number | null,
  ): Promise<BacklogCreateResult> => {
    if (creatingKey !== null) {
      return { ok: false, message: "Another backlog item is being saved." };
    }

    setCreatingKey(boxKey);

    try {
      await sprintBacklogApi.create({
        sprintId,
        projectId: milestoneProjectIdOf(values.milestoneId) ?? boxProjectId,
        milestoneId: values.milestoneId,
        title: values.title,
        description: values.description,
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

      return { ok: true };
    } catch (error) {
      const result = toCreateResult(error);

      // AC03: the milestone disappeared between loading the options and
      // saving, so the form keeps its values and asks for another milestone.
      if (result.message) {
        toast.error(result.message);
      }

      return result;
    } finally {
      setCreatingKey(null);
    }
  };

  /** Project of the picked milestone, so the item joins the right project. */
  const milestoneProjectIdOf = (milestoneId: string | null) =>
    milestoneId == null
      ? null
      : (milestones.find((milestone) => milestone.id === milestoneId)
          ?.projectId ?? null);

  /**
   * The board uses the same workflow as the workspace Kanban board:
   * `SPRINT_BACKLOG` (To do) / `IN_PROGRESS` / `REVIEW` / `DONE`.
   * Any of them can be picked in any direction - the team owns its board.
   */
  const handleItemStatusChange = async (
    item: SprintPlanningItem,
    status: BacklogStatus,
  ) => {
    if (!canEditTask || item.status === status) return;

    const target = toSprintBacklogStatus(status);

    /**
     * A product backlog item is outside the sprint workflow: the backend only
     * lets it sit in To do until it joins a sprint, so the other statuses are
     * explained instead of letting the API reject them.
     */
    if (item.sprintId == null && target !== "TODO") {
      toast.error(
        "Công việc trong Backlog cần được thêm vào Sprint trước khi đổi sang trạng thái này.",
      );
      return;
    }

    setBusyItemId(item.id);

    try {
      await sprintBacklogApi.update(String(item.id), {
        status: target,
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
   * Milestones a box may link: the ones of its project. The product backlog box
   * has no project, so it offers every active milestone and the backend derives
   * the project of the item from the chosen milestone.
   */
  const milestonesFor = useCallback(
    (projectId: number | null) =>
      projectId == null
        ? milestones
        : milestones.filter(
            (milestone) =>
              milestone.projectId == null || milestone.projectId === projectId,
          ),
    [milestones],
  );

  const loading =
    teamId != null
      ? teamQuery.isLoading
      : sprintsQuery.isLoading || itemsQuery.isLoading;
  const loadError =
    teamId != null
      ? teamQuery.isError
        ? extractErrorMessage(
            teamQuery.error,
            "The team backlog service did not answer. Please try again.",
          )
        : null
      : sprintsQuery.isError
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
    <>
      <div
        className={
          embedded
            ? "flex flex-col gap-3"
            : "flex min-h-0 flex-1 flex-col gap-3"
        }
      >
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
                  if (teamId != null) {
                    void teamQuery.refetch();
                    return;
                  }

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
          <div
            className={
              embedded
                ? "flex flex-col gap-3"
                : "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
            }
          >
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
                      assignees={assignees}
                      milestones={milestonesFor(section.projectId)}
                      projectId={section.projectId}
                      teamId={section.teamId}
                      onCreate={(values) =>
                        handleCreateItem(
                          section.key,
                          section.sprintId,
                          values,
                          section.projectId,
                        )
                      }
                    />
                  }
                  emptyMessage={
                    isSprintBox
                      ? "Nothing planned yet. Use Create below to add a work item to this sprint."
                      : "The product backlog is empty. Use Create below to add a work item."
                  }
                  dueDate={section.dueDate}
                  assignees={rowAssignees}
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
        milestones={milestonesFor(
          detailItem?.projectId ?? detailSection?.projectId ?? null,
        )}
        assignees={assignees}
        teamId={teamId}
        canEdit={canEditTask && !detailSection?.locked}
        canMove={canEditBoard && !detailSection?.locked}
        canDelete={canDelete}
        onChanged={() => refreshBoard()}
        onDeleted={async () => {
          setDetailItem(null);
          await refreshBoard();
        }}
      />
    </>
  );
}

/**
 * Route page of the backlog board (`/backlogs`).
 */
export default function BacklogPage() {
  return (
    <MainLayout pathName={{ backlogs: "Backlogs", sprints: "Sprints" }}>
      <BacklogBoard />
    </MainLayout>
  );
}
