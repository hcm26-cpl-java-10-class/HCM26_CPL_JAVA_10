import type { EntityCardRendererProps } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PermissionGate } from "@/components/PermissionGate";
import { cn } from "@/lib/utils";
import { CalendarClock, ClipboardList, Flag, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

type SprintStatusKey = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

/** Badge + accent colours per sprint status. */
const STATUS_STYLES: Record<
  SprintStatusKey,
  { badge: string; bar: string; label: string }
> = {
  PLANNED: {
    label: "Planned",
    badge:
      "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
    bar: "bg-sky-500",
  },
  ACTIVE: {
    label: "Active",
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
    bar: "bg-emerald-500",
  },
  COMPLETED: {
    label: "Completed",
    badge:
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800",
    bar: "bg-indigo-500",
  },
  CANCELLED: {
    label: "Cancelled",
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800",
    bar: "bg-rose-500",
  },
};

const FALLBACK_STATUS = {
  label: "Unknown",
  badge: "bg-muted text-muted-foreground border-border",
  bar: "bg-muted-foreground/40",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

interface HighlightBoxProps {
  label: string;
  value: string;
  tone: "start" | "end";
}

/** Bordered, tinted box that makes the sprint start/end date stand out. */
function HighlightBox({ label, value, tone }: HighlightBoxProps) {
  const toneClass =
    tone === "start"
      ? "border-sky-200 bg-sky-50/70 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
      : "border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-1.5",
        toneClass,
      )}
    >
      <CalendarClock className="h-4 w-4 shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
          {label}
        </p>
        <p className="truncate text-xs font-semibold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

export function SprintCard({
  row,
  showActions = true,
  selectable = true,
  isSelected,
  onRowClick,
  onView,
  renderRowActions,
  onBooleanToggle,
  disableBooleanToggle = true,
  idField,
}: EntityCardRendererProps) {
  const navigate = useNavigate();
  const id = row[idField];
  const status = String(row.status ?? "").toUpperCase() as SprintStatusKey;
  const statusStyle = STATUS_STYLES[status] ?? FALLBACK_STATUS;
  const isClickable = typeof onRowClick === "function";

  const handleCardClick = () => {
    if (onRowClick) {
      onRowClick(row);
      return;
    }

    onView(row);
  };

  return (
    <Card
      className={cn(
        "group relative w-full gap-0 overflow-hidden border-border/70 py-0 transition-all hover:shadow-md",
        isClickable ? "cursor-pointer" : "cursor-default",
        selectable && isSelected ? "ring-2 ring-primary" : "",
      )}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest("button, a, input, label, [role=switch]")) return;
        handleCardClick();
      }}
    >
      {/* Status accent bar */}
      <span className={cn("absolute inset-y-0 left-0 w-1", statusStyle.bar)} />

      {/*
       * Fixed column widths keep the status chip, the start/end time boxes and
       * the toggle on the same vertical line for every row, regardless of the
       * sprint name length or the width of the status label.
       */}
      <CardContent className="flex flex-col gap-3 py-3 pl-5 pr-4 lg:grid lg:grid-cols-[minmax(0,1fr)_126px_178px_178px_auto] lg:items-center lg:gap-4">
        {/* Name + goal */}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {row.name || "Untitled sprint"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Target className="h-3 w-3 shrink-0" />
            <span className="truncate">{row.sprintGoal || "—"}</span>
          </p>
        </div>

        {/* Status badge (highlighted) */}
        <div className="flex min-w-0 items-center gap-2">
          <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              "inline-flex w-[96px] items-center justify-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
              statusStyle.badge,
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusStyle.bar)}
            />
            {statusStyle.label}
          </span>
        </div>

        {/* Start / End time (highlighted) */}
        <HighlightBox
          label="Start Time"
          value={formatDateTime(row.startDate)}
          tone="start"
        />
        <HighlightBox
          label="End Time"
          value={formatDateTime(row.endDate)}
          tone="end"
        />

        {/* Active toggle + actions */}
        <div className="flex shrink-0 items-center justify-between gap-3 lg:justify-end">
          <div className="flex items-center gap-2">
            <Switch
              checked={!!row.isActive}
              disabled={disableBooleanToggle || !onBooleanToggle}
              onCheckedChange={(checked) =>
                onBooleanToggle?.(id, "isActive", checked)
              }
              className="scale-90 data-[state=checked]:bg-primary data-[state=unchecked]:bg-primary/40"
            />
            <span className="w-14 text-xs text-muted-foreground">
              {row.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {/*
           * UFR-PRJ-003-03: entry point to the Sprint Planning board. Available
           * in every view mode (the board itself enforces the sprint status and
           * the per-action permissions).
           */}
          {id !== undefined && id !== null && (
            <PermissionGate permission="SPRINT_READ">
              <Button
                variant="outline"
                size="sm"
                title="Sprint Planning"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/sprints/${id}/planning`);
                }}
              >
                <ClipboardList className="h-4 w-4" />
                <span className="hidden xl:inline">Planning</span>
              </Button>
            </PermissionGate>
          )}

          {showActions && renderRowActions && (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {renderRowActions(row)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
