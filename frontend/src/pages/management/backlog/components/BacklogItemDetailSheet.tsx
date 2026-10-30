import { sprintApi, sprintBacklogApi } from "@/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  BacklogAssigneeOption,
  BacklogPriority,
  MilestoneOption,
  SprintBacklogDTO,
  SprintBacklogStatus,
  SprintBacklogWorkType,
  SprintDTO,
  SprintPlanningItem,
} from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Link2,
  Loader2,
  MoreHorizontal,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  SPRINT_BACKLOG_PRIORITY_OPTIONS,
  SPRINT_BACKLOG_STATUS_OPTIONS,
  SPRINT_BACKLOG_WORK_TYPE_OPTIONS,
} from "../../sprint-backlog/sprintBacklog.constants";
import { extractErrorMessage } from "../../sprint/hooks/useSprintPlanningBoard";
import {
  backlogPriorityMeta,
  backlogStatusMeta,
  backlogWorkTypeMeta,
} from "../backlog.constants";
import { BacklogSubtasksPanel } from "./BacklogSubtasksPanel";

const NO_SPRINT = "none";
const NO_MILESTONE = "none";
/** Sentinel of the assignee picker (Radix forbids an empty SelectItem value). */
const NO_ASSIGNEE = "none";

/** Business rule of UFR-PRJ-003-02: description <= 2000 characters. */
const MAX_DESCRIPTION_LENGTH = 2000;

interface BacklogItemDetailSheetProps {
  open: boolean;
  onClose: (open: boolean) => void;
  item: SprintPlanningItem | null;
  itemKey?: string;
  sprintName?: string | null;
  /** Sprint options of the "Sprint" field. */
  sprints?: SprintDTO[];
  /** Milestone options of the "Milestone" field (UFR-PRJ-003-02). */
  milestones?: MilestoneOption[];
  /** Active members of the workspace team (assignee picker). */
  assignees?: BacklogAssigneeOption[];
  /** Workspace-specific workflow statuses shown in the status selector. */
  workflowStatuses?: { value: SprintBacklogStatus; label: string }[];
  /** Optional workspace transition policy; generic backlog keeps its legacy selector. */
  allowedStatusTransitions?: (status: SprintBacklogStatus) => SprintBacklogStatus[];
  /**
   * Team of the open workspace. The panel resolves the assignee options by
   * project when the board is not scoped to a team (global `/backlogs` page),
   * so the picker still offers the members of the team that owns the project.
   */
  teamId?: number | null;
  /** SPRINT_BACKLOG_UPDATE (title, description, status, priority, dates, estimate). */
  canEdit: boolean;
  /** SPRINT_UPDATE (moving the item to another sprint / back to the backlog). */
  canMove: boolean;
  canDelete: boolean;
  /** Called after a successful mutation so the board can reload. */
  onChanged?: () => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
}

interface Draft {
  title: string;
  description: string;
  status: SprintBacklogStatus;
  /** Story / Bug / Task (fixed set). */
  workType: SprintBacklogWorkType;
  priority: BacklogPriority;
  /** Linked milestone UUID, empty when the item has no milestone. */
  milestoneId: string;
  /** `project_members.id` of the assignee, empty when unassigned. */
  assignee: string;
  /** `project_members.id` of the reporter, empty when not set. */
  reporter: string;
  /** `yyyy-MM-dd`, converted to ISO date-time when saved. */
  startDate: string;
  endDate: string;
  estimatedHours: string;
}

const toDateInput = (value?: string | null) =>
  value && value.length >= 10 ? value.slice(0, 10) : "";

/** `Nguyen Van An` -> `NA` (avatar bubble of the assignee picker). */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const toDraft = (detail: SprintBacklogDTO): Draft => ({
  title: detail.title ?? "",
  description: detail.description ?? "",
  status: detail.status ?? "TODO",
  workType: (detail.workType as SprintBacklogWorkType | null | undefined) ?? "TASK",
  priority: (detail.priority as BacklogPriority | null | undefined) ?? "MEDIUM",
  milestoneId: detail.milestoneId ?? "",
  assignee:
    detail.assigneeProjectMemberId != null
      ? String(detail.assigneeProjectMemberId)
      : "",
  reporter:
    detail.reporterProjectMemberId != null
      ? String(detail.reporterProjectMemberId)
      : "",
  startDate: toDateInput(detail.startDate),
  endDate: toDateInput(detail.endDate),
  estimatedHours:
    detail.estimatedHours != null ? String(detail.estimatedHours) : "",
});

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const DetailRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-2 py-0.5">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <div className="min-w-0">{children}</div>
  </div>
);

/** Borderless field that only shows its border on hover / focus (Jira style). */
const inlineFieldClass =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm shadow-none hover:border-input focus-visible:border-input focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60";

/**
 * Right hand side work item panel of the `/backlogs` board.
 * <p>
 * Jira style: the item is edited directly in the panel - the summary, the
 * description, the status, the priority, the sprint it belongs to, the dates
 * and the estimate are all interactive and are persisted through the Sprint
 * Backlog API as soon as a field is committed.
 */
export function BacklogItemDetailSheet({
  open,
  onClose,
  item,
  itemKey,
  sprintName,
  sprints = [],
  milestones = [],
  assignees = [],
  workflowStatuses = [],
  allowedStatusTransitions,
  teamId = null,
  canEdit,
  canMove,
  canDelete,
  onChanged,
  onDeleted,
}: BacklogItemDetailSheetProps) {
  const detailQuery = useQuery({
    queryKey: ["sprint-backlog", "detail", item?.id ?? null],
    queryFn: () => sprintBacklogApi.getById(String(item!.id)),
    enabled: open && item?.id != null,
  });

  const detail = detailQuery.data;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Assignee candidates of the item: the team of the open workspace when the
   * board is team-scoped, otherwise the team of the item's sprint, otherwise
   * the team that owns the project of the work item.
   */
  const projectId = detail?.projectId ?? item?.projectId ?? null;
  const sprintId = detail?.sprintId ?? item?.sprintId ?? null;
  const sprintTeamId =
    sprints.find((sprint) => sprint.id === sprintId)?.teamId ?? null;
  const resolvedTeamId = teamId ?? sprintTeamId;
  const assigneeOptionsQuery = useQuery({
    queryKey: [
      "sprint-backlog",
      "assignee-options",
      resolvedTeamId ?? "none",
      projectId ?? "none",
    ],
    queryFn: () => sprintBacklogApi.getAssigneeOptions(resolvedTeamId, projectId),
    enabled:
      open &&
      item?.id != null &&
      (resolvedTeamId != null || projectId != null),
    staleTime: 60_000,
  });

  /** Members offered by the picker (the board list wins when it is present). */
  const assigneeOptions =
    assignees.length > 0 ? assignees : assigneeOptionsQuery.data ?? [];

  /** Switching to another item resets the editor until its record is loaded. */
  useEffect(() => {
    setDraft(null);
  }, [item?.id]);

  /**
   * Mirrors the server record into the editor. Re-runs after every refetch so
   * the panel always shows the persisted values.
   */
  useEffect(() => {
    if (open && detail) {
      setDraft(toDraft(detail));
    }
  }, [detail, open]);

  if (!item) {
    return null;
  }

  const status = backlogStatusMeta(
    draft?.status ? statusToBoard(draft.status) : item.status,
  );
  const priority = backlogPriorityMeta(draft?.priority ?? item.priority);
  const workType = backlogWorkTypeMeta(draft?.workType ?? item.workType);
  const WorkTypeIcon = workType.icon;
  const currentSprintId = detail?.sprintId ?? null;
  const statusOptions = allowedStatusTransitions
    ? [...new Set([draft?.status ?? detail?.status ?? "TODO", ...allowedStatusTransitions(draft?.status ?? detail?.status ?? "TODO")])]
        .map((value) => workflowStatuses.find((option) => option.value === value)
          ?? SPRINT_BACKLOG_STATUS_OPTIONS.find((option) => option.value === value))
        .filter((option): option is { value: SprintBacklogStatus; label: string } => option != null)
    : [...SPRINT_BACKLOG_STATUS_OPTIONS, ...workflowStatuses.filter((custom) => !SPRINT_BACKLOG_STATUS_OPTIONS.some((known) => known.value === custom.value))]
        .filter((option) => draft?.status !== "DONE" || option.value === "DONE" || option.value === "REVIEW");

  const save = async (patch: Partial<SprintBacklogDTO>) => {
    if (!item || !canEdit) return;

    setSaving(true);

    try {
      await sprintBacklogApi.update(String(item.id), patch as SprintBacklogDTO);
      await detailQuery.refetch();
      await onChanged?.();
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể cập nhật công việc."));
      // Restore the last persisted values (the draft otherwise keeps the input).
      if (detail) {
        setDraft(toDraft(detail));
      }
      await detailQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

  const commitTitle = () => {
    const title = (draft?.title ?? "").trim();

    if (!title || title === (detail?.title ?? "")) {
      return;
    }

    void save({ title });
  };

  /**
   * "Save" of the description editor: persists the typed description.
   */
  const commitDescription = () => {
    const description = draft?.description ?? "";

    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      toast.error("Mô tả không được vượt quá 2000 ký tự");
      setDraft((previous) =>
        previous
          ? { ...previous, description: detail?.description ?? "" }
          : previous,
      );
      return;
    }

    if (description === (detail?.description ?? "")) {
      return;
    }

    void save({ description: description.trim() });
  };

  /** "Cancel" of the description editor: restores the persisted description. */
  const cancelDescription = () => {
    setDraft((previous) =>
      previous
        ? { ...previous, description: detail?.description ?? "" }
        : previous,
    );
  };

  /** True while the description holds changes that were not saved yet. */
  const descriptionDirty =
    (draft?.description ?? "") !== (detail?.description ?? "");

  /**
   * Links / unlinks the milestone of the item (UFR-PRJ-003-02). A 404 from the
   * backend means the milestone disappeared meanwhile: the panel restores the
   * persisted value and the toast explains it.
   */
  const commitMilestone = (value: string) => {
    if (!canEdit || saving) return;

    const current = detail?.milestoneId ?? null;
    const next = value === NO_MILESTONE ? null : value;

    if (next === current) {
      return;
    }

    setDraft((previous) =>
      previous ? { ...previous, milestoneId: next ?? "" } : previous,
    );

    if (next === null) {
      void save({ clearMilestone: true } as Partial<SprintBacklogDTO>);
      return;
    }

    void save({ milestoneId: next });
  };

  const commitDate = (key: "startDate" | "endDate", value: string) => {
    const start = key === "startDate" ? value : draft?.startDate ?? "";
    const end = key === "endDate" ? value : draft?.endDate ?? "";

    if (!start && !end) {
      return;
    }

    // The backend requires both ends as soon as one of them is provided.
    const startIso = start ? `${start}T00:00:00` : `${end}T00:00:00`;
    const endIso = end ? `${end}T23:59:00` : `${start}T23:59:00`;

    setDraft((previous) =>
      previous
        ? {
            ...previous,
            startDate: start || end,
            endDate: end || start,
          }
        : previous,
    );

    void save({ startDate: startIso, endDate: endIso });
  };

  const commitEstimate = () => {
    const raw = (draft?.estimatedHours ?? "").trim();
    const current = detail?.estimatedHours;

    if (!raw) {
      return;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0 || value === current) {
      return;
    }

    void save({ estimatedHours: value });
  };

  /** Work type is a fixed set: the panel only picks one of the values. */
  const commitWorkType = (value: SprintBacklogWorkType) => {
    if (!draft || value === draft.workType) {
      return;
    }

    setDraft((previous) => (previous ? { ...previous, workType: value } : previous));
    void save({ workType: value } as Partial<SprintBacklogDTO>);
  };

  /** The assignee is picked from the active members of the workspace team. */
  const commitAssignee = (value: string) => {
    const current = detail?.assigneeProjectMemberId ?? null;

    // "Unassigned" clears the assignee; the backend needs the explicit flag
    // because a null id otherwise means "keep the current assignee".
    if (value === "" || value === NO_ASSIGNEE) {
      if (current == null) return;

      setDraft((previous) =>
        previous ? { ...previous, assignee: "" } : previous,
      );
      void save({ clearAssignee: true } as Partial<SprintBacklogDTO>);
      return;
    }

    const next = Number(value);

    if (!Number.isFinite(next) || next <= 0 || next === current) {
      return;
    }

    setDraft((previous) =>
      previous ? { ...previous, assignee: value } : previous,
    );

    void save({ assigneeProjectMemberId: next } as Partial<SprintBacklogDTO>);
  };

  /**
   * The reporter is picked from the active members of the team, exactly like
   * the assignee ("No reporter" clears it with the explicit backend flag).
   */
  const commitReporter = (value: string) => {
    const current = detail?.reporterProjectMemberId ?? null;

    if (value === "" || value === NO_ASSIGNEE) {
      if (current == null) return;

      setDraft((previous) =>
        previous ? { ...previous, reporter: "" } : previous,
      );
      void save({ clearReporter: true } as Partial<SprintBacklogDTO>);
      return;
    }

    const next = Number(value);

    if (!Number.isFinite(next) || next <= 0 || next === current) {
      return;
    }

    setDraft((previous) =>
      previous ? { ...previous, reporter: value } : previous,
    );

    void save({ reporterProjectMemberId: next } as Partial<SprintBacklogDTO>);
  };

  /** Moves the item to another sprint (`null` = product backlog). */
  const changeSprint = async (value: string) => {
    if (!canMove || saving) return;

    const targetId = value === NO_SPRINT ? null : Number(value);

    if (targetId === currentSprintId) {
      return;
    }

    setSaving(true);

    try {
      if (targetId === null) {
        if (currentSprintId !== null) {
          const siblings = await sprintBacklogApi.getBySprintId(currentSprintId);

          await sprintApi.updateBacklog(
            String(currentSprintId),
            siblings
              .map((sibling) => sibling.id)
              .filter((id): id is number => id != null && id !== item.id),
          );
        }
      } else {
        const targetItems = await sprintBacklogApi.getBySprintId(targetId);

        await sprintApi.updateBacklog(String(targetId), [
          ...targetItems
            .map((target) => target.id)
            .filter((id): id is number => id != null && id !== item.id),
          item.id,
        ]);
      }

      await detailQuery.refetch();
      await onChanged?.();

      toast.success(
        targetId === null
          ? "Đã chuyển công việc về Backlog."
          : "Đã chuyển công việc sang Sprint.",
      );
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể chuyển công việc."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    setSaving(true);

    try {
      await sprintBacklogApi.delete(String(item.id));
      toast.success("Đã xóa công việc.");
      await onDeleted?.();
      onClose(false);
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể xóa công việc."));
    } finally {
      setSaving(false);
    }
  };

  const copyKey = async () => {
    if (!itemKey) return;

    try {
      await navigator.clipboard.writeText(itemKey);
      toast.success(`Đã sao chép ${itemKey}.`);
    } catch {
      toast.error("Không thể sao chép.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          {/* Rows show the work type as an icon only; the detail view names it. */}
          <span className={cn("shrink-0", workType.iconClass)}>
            <WorkTypeIcon className="h-4 w-4" />
          </span>
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            {workType.label}
          </span>
          <span className="truncate font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {itemKey ?? `PRJ-${item.id}`}
          </span>

          {saving && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}

          <SheetTitle className="sr-only">
            {draft?.title || item.title || "Work item"}
          </SheetTitle>

          <div className="ml-auto flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground"
              title="Copy item key"
              onClick={() => void copyKey()}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground"
              title="Copy link"
              onClick={() => void copyKey()}
            >
              <Link2 className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 text-muted-foreground"
                  aria-label="Work item actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => void copyKey()}>
                  Copy item key
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={saving}
                      onClick={() => void handleDelete()}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete work item
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground"
              aria-label="Close panel"
              onClick={() => onClose(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!draft ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
            {detailQuery.isError ? (
              <>
                <p role="alert" className="text-destructive">Could not load this work item. Check your access and connection, then retry.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void detailQuery.refetch()} disabled={detailQuery.isFetching}>
                  {detailQuery.isFetching ? "Retrying…" : "Try again"}
                </Button>
              </>
            ) : (
              <><Loader2 className="h-4 w-4 animate-spin" />Loading the work item…</>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4">
              <Input
                value={draft.title}
                disabled={!canEdit || saving}
                placeholder="Work item summary"
                className="h-auto border-0 px-0 text-xl font-semibold shadow-none focus-visible:ring-0 disabled:opacity-100"
                onChange={(event) =>
                  setDraft((previous) =>
                    previous
                      ? { ...previous, title: event.target.value }
                      : previous,
                  )
                }
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select
                  value={draft.status}
                  disabled={!canEdit || saving || currentSprintId == null}
                  onValueChange={(value) => {
                    setDraft((previous) =>
                      previous
                        ? { ...previous, status: value as SprintBacklogStatus }
                        : previous,
                    );
                    void save({ status: value as SprintBacklogStatus });
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className={cn(
                      "h-7 gap-1 rounded-full px-2 text-[11px] font-medium",
                      status.pill,
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={draft.priority}
                  disabled={!canEdit || saving}
                  onValueChange={(value) => {
                    setDraft((previous) =>
                      previous
                        ? { ...previous, priority: value as BacklogPriority }
                        : previous,
                    );
                    void save({ priority: value as BacklogPriority } as Partial<SprintBacklogDTO>);
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className={cn(
                      "h-7 gap-1 rounded-full px-2 text-[11px] font-medium",
                      priority.pill,
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPRINT_BACKLOG_PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {backlogPriorityMeta(option.value).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {detailQuery.isFetching && (
                  <span className="text-[11px] text-muted-foreground">
                    Refreshing…
                  </span>
                )}
              </div>
            </div>

            <div className="px-5 pb-5">
              <h3 className="text-sm font-semibold text-foreground">
                Description
              </h3>
              <Textarea
                value={draft.description}
                disabled={!canEdit || saving}
                placeholder="Add a description…"
                rows={4}
                className="mt-1 min-h-20 resize-y border-transparent bg-muted/30 text-sm shadow-none hover:border-input"
                onChange={(event) =>
                  setDraft((previous) =>
                    previous
                      ? { ...previous, description: event.target.value }
                      : previous,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelDescription();
                  }
                }}
              />
              <div className="mt-1 flex items-center gap-1">
                <p
                  className={cn(
                    "mr-auto text-right text-[10px]",
                    draft.description.length > MAX_DESCRIPTION_LENGTH
                      ? "font-semibold text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {draft.description.length}/{MAX_DESCRIPTION_LENGTH} ký tự
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-6 px-2 text-[11px] text-muted-foreground"
                  disabled={!canEdit || saving || !descriptionDirty}
                  onClick={cancelDescription}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="xs"
                  className="h-6 px-2 text-[11px]"
                  disabled={!canEdit || saving || !descriptionDirty}
                  onClick={commitDescription}
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="px-5 pb-5">
              <BacklogSubtasksPanel key={item.id} backlogId={item.id} />
            </div>

            <div className="px-5 pb-8">
              <h3 className="text-sm font-semibold text-foreground">Details</h3>

              <div className="mt-2 rounded-lg border bg-card p-3">
                <DetailRow label="Work type">
                  <Select
                    value={draft.workType}
                    disabled={!canEdit || saving}
                    onValueChange={(value) =>
                      commitWorkType(value as SprintBacklogWorkType)
                    }
                  >
                    <SelectTrigger size="sm" className={inlineFieldClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPRINT_BACKLOG_WORK_TYPE_OPTIONS.map((option) => {
                        const optionMeta = backlogWorkTypeMeta(option.value);
                        const OptionIcon = optionMeta.icon;

                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <span className="flex items-center gap-2">
                              <OptionIcon
                                className={cn("h-4 w-4", optionMeta.iconClass)}
                              />
                              {optionMeta.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </DetailRow>

                <DetailRow label="Assignee">
                  <Select
                    value={draft.assignee || NO_ASSIGNEE}
                    disabled={!canEdit || saving}
                    onValueChange={(value) => commitAssignee(value)}
                  >
                    <SelectTrigger size="sm" className={inlineFieldClass}>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ASSIGNEE}>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          Unassigned
                        </span>
                      </SelectItem>
                      {assigneeOptions.map((member) => (
                        <SelectItem
                          key={member.id}
                          value={String(member.id)}
                        >
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[9px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                              {initialsOf(member.fullName)}
                            </span>
                            <span className="truncate">{member.fullName}</span>
                            {member.role && (
                              <span className="text-xs text-muted-foreground">
                                {member.role}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                      {/* Legacy / out-of-scope id: keep it visible instead of
                          silently dropping the stored assignee. */}
                      {draft.assignee !== "" &&
                        !assigneeOptions.some(
                          (member) => String(member.id) === draft.assignee,
                        ) && (
                          <SelectItem value={draft.assignee}>
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Member #{draft.assignee}
                            </span>
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </DetailRow>

                <DetailRow label="Sprint">
                  <Select
                    value={
                      currentSprintId != null ? String(currentSprintId) : NO_SPRINT
                    }
                    disabled={!canMove || saving}
                    onValueChange={(value) => void changeSprint(value)}
                  >
                    <SelectTrigger size="sm" className={inlineFieldClass}>
                      <SelectValue placeholder="Add sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SPRINT} disabled={draft.status !== "TODO"}>
                        Backlog (no sprint)
                      </SelectItem>
                      {sprints
                        .filter((sprint) => sprint.id != null)
                        .map((sprint) => (
                          <SelectItem key={sprint.id} value={String(sprint.id)}>
                            {sprint.name ?? `Sprint ${sprint.id}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </DetailRow>

                <DetailRow label="Milestone">
                  <Select
                    value={draft.milestoneId || NO_MILESTONE}
                    disabled={!canEdit || saving}
                    onValueChange={(value) => commitMilestone(value)}
                  >
                    <SelectTrigger size="sm" className={inlineFieldClass}>
                      <SelectValue placeholder="Link a milestone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_MILESTONE}>
                        No milestone
                      </SelectItem>
                      {milestones.map((milestone) => (
                        <SelectItem key={milestone.id} value={milestone.id}>
                          {milestone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DetailRow>

                <DetailRow label="Start date">
                  <Input
                    type="date"
                    value={draft.startDate}
                    disabled={!canEdit || saving}
                    className={inlineFieldClass}
                    onChange={(event) =>
                      commitDate("startDate", event.target.value)
                    }
                  />
                </DetailRow>

                <DetailRow label="Due date">
                  <Input
                    type="date"
                    value={draft.endDate}
                    disabled={!canEdit || saving}
                    className={inlineFieldClass}
                    onChange={(event) => commitDate("endDate", event.target.value)}
                  />
                </DetailRow>

                <DetailRow label="Estimate (hours)">
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={draft.estimatedHours}
                    disabled={!canEdit || saving}
                    placeholder="Add estimate"
                    className={inlineFieldClass}
                    onChange={(event) =>
                      setDraft((previous) =>
                        previous
                          ? { ...previous, estimatedHours: event.target.value }
                          : previous,
                      )
                    }
                    onBlur={commitEstimate}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </DetailRow>

                <DetailRow label="Reporter">
                  <Select
                    value={draft.reporter || NO_ASSIGNEE}
                    disabled={!canEdit || saving}
                    onValueChange={(value) => commitReporter(value)}
                  >
                    <SelectTrigger size="sm" className={inlineFieldClass}>
                      <SelectValue placeholder="No reporter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ASSIGNEE}>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          No reporter
                        </span>
                      </SelectItem>
                      {assigneeOptions.map((member) => (
                        <SelectItem key={member.id} value={String(member.id)}>
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[9px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                              {initialsOf(member.fullName)}
                            </span>
                            <span className="truncate">{member.fullName}</span>
                            {member.role && (
                              <span className="text-xs text-muted-foreground">
                                {member.role}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                      {/* Legacy / out-of-scope id: keep it visible instead of
                          silently dropping the stored reporter. */}
                      {draft.reporter !== "" &&
                        !assigneeOptions.some(
                          (member) => String(member.id) === draft.reporter,
                        ) && (
                          <SelectItem value={draft.reporter}>
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Member #{draft.reporter}
                            </span>
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </DetailRow>

                <DetailRow label="Board">
                  <span className="px-2 text-sm text-muted-foreground">
                    {sprintName ?? "Product backlog"}
                  </span>
                </DetailRow>

                <DetailRow label="Created">
                  <span className="px-2 text-sm text-muted-foreground">
                    {formatDateTime(detail?.createdAt)}
                  </span>
                </DetailRow>

                <DetailRow label="Updated">
                  <span className="px-2 text-sm text-muted-foreground">
                    {formatDateTime(detail?.updatedAt)}
                  </span>
                </DetailRow>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Backend status -> board status (used for the colour pills only). */
const statusToBoard = (status: SprintBacklogStatus) => {
  switch (status) {
    case "IN_PROGRESS":
      return "IN_PROGRESS" as const;
    case "REVIEW":
      return "REVIEW" as const;
    case "BLOCKED":
      return "BLOCKED" as const;
    case "DONE":
      return "DONE" as const;
    default:
      return "SPRINT_BACKLOG" as const;
  }
};
