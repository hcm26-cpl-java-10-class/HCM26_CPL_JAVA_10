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
import { cn } from "@/lib/utils";
import type { SprintBacklogWorkType } from "@/types";
import {
  CalendarDays,
  ChevronDown,
  Loader2,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BACKLOG_WORK_TYPE_META } from "../backlog.constants";

/** Values collected by the inline create bar. */
export interface BacklogCreateValues {
  workType: SprintBacklogWorkType;
  title: string;
  /** `yyyy-MM-dd` picked in the bar, `null` when the user cleared it. */
  dueDate: string | null;
  assigneeProjectMemberId: number | null;
}

interface SprintCreateRowProps {
  /** False when the box is locked (completed / cancelled sprint) or the user may not edit. */
  canEdit: boolean;
  /** Hint shown next to the collapsed "+ Create" trigger. */
  hint: string;
  /** True while this box is saving the work item. */
  creating: boolean;
  /** Member ids already used on the board, offered as quick picks. */
  assigneeOptions?: number[];
  /**
   * Resolves `true` when the work item was created: the bar then resets and
   * collapses again, exactly like the Jira inline create.
   */
  onCreate: (values: BacklogCreateValues) => Promise<boolean>;
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

const WORK_TYPES = Object.keys(
  BACKLOG_WORK_TYPE_META,
) as SprintBacklogWorkType[];

/**
 * Jira style "+ Create" row shown BELOW a backlog box (outside its border).
 * <p>
 * Clicking it expands an inline create bar - no modal box - holding exactly the
 * fields needed to file a work item: the work type (shown as its icon only), the
 * summary, a due date that defaults to today, an assignee and the Create button.
 * Enter submits, Escape cancels. Everything else (description, priority,
 * estimate) is edited afterwards in the work item detail panel.
 */
export function SprintCreateRow({
  canEdit,
  hint,
  creating,
  assigneeOptions = [],
  onCreate,
}: SprintCreateRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [workType, setWorkType] = useState<SprintBacklogWorkType>("TASK");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayValue);
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement | null>(null);

  /** The bar focuses its summary field as soon as it opens, like Jira. */
  useEffect(() => {
    if (expanded) {
      titleRef.current?.focus();
    }
  }, [expanded]);

  const workTypeMeta = BACKLOG_WORK_TYPE_META[workType];
  const WorkTypeIcon = workTypeMeta.icon;

  const reset = () => {
    setTitle("");
    setWorkType("TASK");
    setDueDate(todayValue());
    setAssignee("");
    setError(null);
  };

  const submit = async () => {
    if (creating) return;

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Describe what needs to be done before creating it.");
      titleRef.current?.focus();
      return;
    }

    const parsedAssignee = assignee.trim() === "" ? null : Number(assignee);

    if (
      parsedAssignee !== null &&
      (!Number.isFinite(parsedAssignee) || parsedAssignee <= 0)
    ) {
      setError("The assignee must be a positive project member id.");
      return;
    }

    setError(null);

    const created = await onCreate({
      workType,
      title: trimmedTitle,
      dueDate: dueDate || null,
      assigneeProjectMemberId: parsedAssignee,
    });

    if (created) {
      reset();
      setExpanded(false);
    }
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
      <div className="flex items-center gap-1 rounded-md border border-primary/70 bg-card px-1.5 py-1 shadow-xs ring-1 ring-primary/10 focus-within:ring-2 focus-within:ring-primary/25">
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
          maxLength={200}
          placeholder="Describe what needs to be done…"
          aria-label="Work item summary"
          className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setTitle(event.target.value);
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

        {/* Assignee: project member id until the member module exists. */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn(
                "h-7 w-7 rounded-full border text-[10px] font-semibold",
                assignee
                  ? "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                  : "border-transparent text-muted-foreground",
              )}
              title={assignee ? `Assignee #${assignee}` : "Unassigned"}
            >
              {assignee || <UserRound className="size-3.5" />}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-56 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Assignee
            </p>

            <input
              type="number"
              min={1}
              value={assignee}
              placeholder="Member id"
              aria-label="Assignee member id"
              className={compactInputClass}
              onChange={(event) => {
                setAssignee(event.target.value);
                if (error) setError(null);
              }}
            />

            {assigneeOptions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {assigneeOptions.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant={String(id) === assignee ? "secondary" : "outline"}
                    size="icon-xs"
                    className="h-6 w-6 rounded-full p-0 text-[10px] font-semibold"
                    onClick={() => setAssignee(String(id))}
                  >
                    {id}
                  </Button>
                ))}
              </div>
            )}

            <div className="mt-2 flex justify-end">
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
          className="h-7"
          disabled={creating}
          onClick={() => void submit()}
        >
          {creating && <Loader2 className="size-3.5 animate-spin" />}
          Create
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

      <span
        className={cn(
          "px-1 text-[11px]",
          error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {error ?? hint}
      </span>
    </div>
  );
}
