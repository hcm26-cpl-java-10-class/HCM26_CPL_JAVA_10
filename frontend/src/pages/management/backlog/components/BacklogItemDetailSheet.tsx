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
  BacklogPriority,
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

const NO_SPRINT = "none";

interface BacklogItemDetailSheetProps {
  open: boolean;
  onClose: (open: boolean) => void;
  item: SprintPlanningItem | null;
  itemKey?: string;
  sprintName?: string | null;
  /** Sprint options of the "Sprint" field. */
  sprints?: SprintDTO[];
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
  /** Temporary assignee id: the project member module is not implemented yet. */
  assignee: string;
  /** `yyyy-MM-dd`, converted to ISO date-time when saved. */
  startDate: string;
  endDate: string;
  estimatedHours: string;
}

const toDateInput = (value?: string | null) =>
  value && value.length >= 10 ? value.slice(0, 10) : "";

const toDraft = (detail: SprintBacklogDTO): Draft => ({
  title: detail.title ?? "",
  description: detail.description ?? "",
  status: detail.status ?? "TODO",
  workType: (detail.workType as SprintBacklogWorkType | null | undefined) ?? "TASK",
  priority: (detail.priority as BacklogPriority | null | undefined) ?? "MEDIUM",
  assignee:
    detail.assigneeProjectMemberId != null
      ? String(detail.assigneeProjectMemberId)
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

  const commitDescription = () => {
    const description = draft?.description ?? "";

    if (description === (detail?.description ?? "")) {
      return;
    }

    void save({ description: description.trim() });
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

  /**
   * TEMPORARY assignee: a raw project member id until that module exists.
   * The backend keeps the stored id when the request sends `null`, so an empty
   * input simply restores the current value.
   */
  const commitAssignee = () => {
    const raw = (draft?.assignee ?? "").trim();
    const current = detail?.assigneeProjectMemberId ?? null;

    if (!raw) {
      setDraft((previous) =>
        previous
          ? { ...previous, assignee: current != null ? String(current) : "" }
          : previous,
      );
      return;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value <= 0 || value === current) {
      if (detail) {
        setDraft(toDraft(detail));
      }
      return;
    }

    void save({ assigneeProjectMemberId: value } as Partial<SprintBacklogDTO>);
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
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the work item…
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
                  disabled={!canEdit || saving}
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
                    {SPRINT_BACKLOG_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {backlogStatusMeta(statusToBoard(option.value)).label}
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
                onBlur={commitDescription}
              />
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
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold text-muted-foreground">
                      {draft.assignee || <User className="h-3 w-3" />}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={draft.assignee}
                      disabled={!canEdit || saving}
                      placeholder="Member id (temporary)"
                      className={inlineFieldClass}
                      onChange={(event) =>
                        setDraft((previous) =>
                          previous
                            ? { ...previous, assignee: event.target.value }
                            : previous,
                        )
                      }
                      onBlur={commitAssignee}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </div>
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
                      <SelectItem value={NO_SPRINT}>
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
                  <span className="px-2 text-sm text-muted-foreground">
                    {detail?.createdBy != null
                      ? `Member #${detail.createdBy}`
                      : "—"}
                  </span>
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
    case "REVIEW":
      return "IN_PROGRESS" as const;
    case "DONE":
      return "DONE" as const;
    default:
      return "SPRINT_BACKLOG" as const;
  }
};
