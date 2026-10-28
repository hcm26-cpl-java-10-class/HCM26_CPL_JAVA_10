import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  BacklogAssigneeOption,
  MilestoneOption,
  SprintBacklogWorkType,
} from "@/types";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  Milestone as MilestoneIcon,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BACKLOG_WORK_TYPE_META } from "../backlog.constants";

/** Values collected by the inline create bar (UFR-PRJ-003-02). */
export interface BacklogCreateValues {
  workType: SprintBacklogWorkType;
  title: string;
  /** Structured description, `null` when the user left it empty. */
  description: string | null;
  /** `yyyy-MM-dd` picked in the bar, `null` when the user cleared it. */
  dueDate: string | null;
  assigneeProjectMemberId: number | null;
  /** Milestone UUID, `null` when the item is not linked to a milestone. */
  milestoneId: string | null;
}

/**
 * Outcome of the create call.
 * <p>
 * `fieldErrors` mirrors the 422 per-field map of the API so the bar can
 * highlight the offending inputs without losing the other values (AC02).
 */
export interface BacklogCreateResult {
  ok: boolean;
  /** Business message shown above the bar (404 milestone, 409, ...). */
  message?: string;
  fieldErrors?: Record<string, string>;
}

interface SprintCreateRowProps {
  /** False when the box is locked (completed / cancelled sprint) or the user may not edit. */
  canEdit: boolean;
  /** Hint shown next to the collapsed "+ Create" trigger. */
  hint: string;
  /** True while this box is saving the work item. */
  creating: boolean;
  /**
   * Active members of the workspace team, offered by the assignee picker.
   * Empty when the board is not scoped to a team (`/backlogs` route page).
   */
  assignees?: BacklogAssigneeOption[];
  /** Active milestones the item can be linked to (UFR-PRJ-003-02). */
  milestones?: MilestoneOption[];
  /** Resolves the outcome so the bar can reset itself or show the API errors. */
  onCreate: (values: BacklogCreateValues) => Promise<BacklogCreateResult>;
}

/** `yyyy-MM-dd` of today in the browser timezone (due date default). */
const todayValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 10);
};

/** `2026-10-25` -> `25 Oct` (parsed as a local day, not as UTC midnight). */
const formatDueDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

/** Compact field used inside the due date / assignee popovers. */
const compactInputClass =
  "h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

/** `Nguyen Van An` -> `NA` (avatar bubble of the assignee picker). */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const WORK_TYPES = Object.keys(
  BACKLOG_WORK_TYPE_META,
) as SprintBacklogWorkType[];

/** Business rule of UFR-PRJ-003-02 (description <= 2000 characters). */
const MAX_DESCRIPTION_LENGTH = 2000;
/** Business rule of UFR-PRJ-003-02 (title 1..250 characters). */
const MAX_TITLE_LENGTH = 250;

const NO_MILESTONE = "none";

/**
 * Jira style "+ Create" row shown BELOW a backlog box (outside its border).
 * <p>
 * Clicking it expands an inline create bar - no modal box - holding exactly the
 * fields needed to file a backlog item (UFR-PRJ-003-02): the work type (shown
 * as its icon only), the title, the structured description, the linked
 * milestone, a due date that defaults to today, an assignee and the save
 * button. Enter submits, Escape cancels.
 * <p>
 * Validation follows the acceptance criteria: a missing title and an
 * oversized description are highlighted on their field (422), and a milestone
 * that no longer exists keeps the typed values while showing the API message
 * (404).
 */
export function SprintCreateRow({
  canEdit,
  hint,
  creating,
  assignees = [],
  milestones = [],
  onCreate,
}: SprintCreateRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [workType, setWorkType] = useState<SprintBacklogWorkType>("TASK");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [dueDate, setDueDate] = useState(todayValue);
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const titleRef = useRef<HTMLInputElement | null>(null);

  /** The bar focuses its title field as soon as it opens, like Jira. */
  useEffect(() => {
    if (expanded) {
      titleRef.current?.focus();
    }
  }, [expanded]);

  const workTypeMeta = BACKLOG_WORK_TYPE_META[workType];
  const WorkTypeIcon = workTypeMeta.icon;
  const selectedMilestone =
    milestones.find((milestone) => milestone.id === milestoneId) ?? null;
  const selectedAssignee =
    assignees.find((member) => String(member.id) === assignee) ?? null;

  const reset = () => {
    setTitle("");
    setDescription("");
    setMilestoneId("");
    setWorkType("TASK");
    setDueDate(todayValue());
    setAssignee("");
    setError(null);
    setFieldErrors({});
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;

      const next = { ...previous };
      delete next[field];

      return next;
    });
  };

  const submit = async () => {
    if (creating) return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const localErrors: Record<string, string> = {};

    // AC02: the API answers 422; the bar pre-validates the name so the user
    // sees the message immediately. The description is left to the API so the
    // real 422 (and its per-field map) drives the highlight and the message.
    if (!trimmedTitle) {
      localErrors.title = "Vui lòng nhập tên Backlog item";
    }

    const parsedAssignee = assignee.trim() === "" ? null : Number(assignee);

    if (
      parsedAssignee !== null &&
      (!Number.isFinite(parsedAssignee) || parsedAssignee <= 0)
    ) {
      setError("The assignee must be a positive project member id.");
      return;
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setError(null);
      titleRef.current?.focus();
      return;
    }

    setError(null);
    setFieldErrors({});

    const result = await onCreate({
      workType,
      title: trimmedTitle,
      description: trimmedDescription || null,
      dueDate: dueDate || null,
      assigneeProjectMemberId: parsedAssignee,
      milestoneId: milestoneId === "" ? null : milestoneId,
    });

    if (result.ok) {
      reset();
      setExpanded(false);
      return;
    }

    setFieldErrors(result.fieldErrors ?? {});
    setError(result.message ?? null);
  };

  if (!expanded) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-1 py-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          disabled={!canEdit}
          onClick={() => setExpanded(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Create
        </Button>

        <span className="truncate text-[11px] text-muted-foreground">
          {canEdit ? hint : "The scope of this box is locked."}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-0.5">
      <div
        className={cn(
          "flex flex-col gap-1 rounded-md border bg-card px-1.5 py-1 shadow-xs ring-1 ring-primary/10 focus-within:ring-2 focus-within:ring-primary/25",
          fieldErrors.title || fieldErrors.description
            ? "border-destructive/70 ring-destructive/20"
            : "border-primary/70",
        )}
      >
        <div className="flex items-center gap-1">
          {/* Work type: the icon carries the meaning, the name lives in the menu. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className={cn("h-7 gap-0.5 px-1", workTypeMeta.iconClass)}
                title={`Work type: ${workTypeMeta.label}`}
                aria-label={`Work type: ${workTypeMeta.label}`}
              >
                <WorkTypeIcon className="size-4" />
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel>Work type</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {WORK_TYPES.map((value) => {
                const meta = BACKLOG_WORK_TYPE_META[value];
                const Icon = meta.icon;

                return (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => setWorkType(value)}
                  >
                    <Icon className={cn("h-4 w-4", meta.iconClass)} />
                    {meta.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={titleRef}
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Backlog item name…"
            aria-label="Backlog item name"
            aria-invalid={Boolean(fieldErrors.title)}
            className={cn(
              "h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground",
              fieldErrors.title && "placeholder:text-destructive/70",
            )}
            onChange={(event) => {
              setTitle(event.target.value);
              clearFieldError("title");
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                reset();
                setExpanded(false);
              }
            }}
          />

          {/* Milestone: optional link to a milestone of the project. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className={cn(
                  "h-7 max-w-40 gap-1 px-1.5 text-[11px]",
                  fieldErrors.milestoneId
                    ? "text-destructive"
                    : selectedMilestone
                      ? "text-sky-600 dark:text-sky-400"
                      : "text-muted-foreground/70",
                )}
                title={selectedMilestone?.label ?? "Link a milestone"}
              >
                <MilestoneIcon className="size-3.5" />
                <span className="max-w-28 truncate">
                  {selectedMilestone?.name ?? "Milestone"}
                </span>
              </Button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-72 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Linked milestone
              </p>

              <select
                value={milestoneId === "" ? NO_MILESTONE : milestoneId}
                aria-label="Linked milestone"
                className={compactInputClass}
                onChange={(event) => {
                  setMilestoneId(
                    event.target.value === NO_MILESTONE
                      ? ""
                      : event.target.value,
                  );
                  clearFieldError("milestoneId");
                  if (error) setError(null);
                }}
              >
                <option value={NO_MILESTONE}>No milestone</option>
                {milestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.label}
                  </option>
                ))}
              </select>

              {milestones.length === 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  No active milestone is available for this project.
                </p>
              )}

              {selectedMilestone?.dueDate && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Deadline: {formatDueDate(selectedMilestone.dueDate.slice(0, 10))}
                </p>
              )}
            </PopoverContent>
          </Popover>

        {/* Due date: defaults to today, so the item always has a target day. */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className={cn(
                "h-7 gap-1 px-1.5 text-[11px]",
                dueDate ? "text-muted-foreground" : "text-muted-foreground/70",
              )}
              title="Due date"
            >
              <CalendarDays className="size-3.5" />
              {dueDate ? formatDueDate(dueDate) : "Due date"}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-56 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Due date
            </p>

            <input
              type="date"
              value={dueDate}
              aria-label="Due date"
              className={compactInputClass}
              onChange={(event) => setDueDate(event.target.value)}
            />

            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setDueDate(todayValue())}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setDueDate("")}
              >
                Clear
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Assignee: active members of the team that owns the workspace. */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn(
                "h-7 w-7 rounded-full border text-[10px] font-semibold",
                selectedAssignee
                  ? "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                  : "border-transparent text-muted-foreground",
              )}
              title={selectedAssignee ? selectedAssignee.fullName : "Unassigned"}
            >
              {selectedAssignee ? initialsOf(selectedAssignee.fullName) : (
                <UserRound className="size-3.5" />
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-64 p-2">
            <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
              Assignee
            </p>

            {assignees.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted-foreground">
                No team member is available in this workspace.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {assignees.map((member) => {
                  const isSelected = String(member.id) === assignee;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                        isSelected && "bg-accent",
                      )}
                      onClick={() => {
                        setAssignee(String(member.id));
                        if (error) setError(null);
                      }}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                        {initialsOf(member.fullName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {member.fullName}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {[member.role, member.userCode]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {isSelected && <Check className="size-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-1 flex justify-end border-t pt-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setAssignee("")}
              >
                Unassign
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          size="xs"
          className="h-7 whitespace-nowrap"
          disabled={creating}
          onClick={() => void submit()}
        >
          {creating && <Loader2 className="size-3.5 animate-spin" />}
          Save Backlog Item
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 text-muted-foreground"
          aria-label="Cancel"
          onClick={() => {
            reset();
            setExpanded(false);
          }}
        >
          <X className="size-3.5" />
        </Button>
        </div>

        {/* Structured description (1 - 2000 characters), optional. */}
        <div className="flex items-start gap-2 px-1 pb-0.5">
          <Textarea
            value={description}
            rows={2}
            placeholder="Detailed description (optional, up to 2000 characters)…"
            aria-label="Backlog item description"
            aria-invalid={Boolean(fieldErrors.description)}
            className={cn(
              "min-h-14 flex-1 resize-y border-transparent bg-muted/30 text-xs shadow-none hover:border-input",
              fieldErrors.description && "border-destructive/70",
            )}
            onChange={(event) => {
              setDescription(event.target.value);
              clearFieldError("description");
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                reset();
                setExpanded(false);
              }
            }}
          />
          <span
            className={cn(
              "w-16 shrink-0 pt-1 text-right text-[10px]",
              description.length > MAX_DESCRIPTION_LENGTH
                ? "font-semibold text-destructive"
                : "text-muted-foreground",
            )}
          >
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </span>
        </div>
      </div>

      <span
        className={cn(
          "px-1 text-[11px]",
          error || Object.keys(fieldErrors).length > 0
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {fieldErrors.title ??
          fieldErrors.description ??
          fieldErrors.milestoneId ??
          error ??
          hint}
      </span>
    </div>
  );
}
