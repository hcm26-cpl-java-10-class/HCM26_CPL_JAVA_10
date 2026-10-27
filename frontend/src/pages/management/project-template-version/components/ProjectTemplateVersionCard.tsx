import type { EntityCardRendererProps } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { statusMeta } from "../workspace/version.constants";
import { CalendarClock, FileJson, FolderGit2, GitBranch, Hash } from "lucide-react";

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

/** Human friendly summary of the JSON payload (falls back to a truncated dump). */
const describeContent = (contentJson?: string | null) => {
  if (!contentJson) return "—";

  try {
    const parsed = JSON.parse(contentJson) as Record<string, unknown>;

    if (typeof parsed?.description === "string" && parsed.description.trim()) {
      return parsed.description;
    }

    if (typeof parsed?.name === "string" && parsed.name.trim()) {
      return parsed.name;
    }

    return JSON.stringify(parsed).slice(0, 140);
  } catch {
    return contentJson.slice(0, 140);
  }
};

interface HighlightBoxProps {
  label: string;
  value: string;
  tone: "template" | "project";
}

/** Bordered, tinted box used for the template / project identifiers. */
function HighlightBox({ label, value, tone }: HighlightBoxProps) {
  const toneClass =
    tone === "template"
      ? "border-violet-200 bg-violet-50/70 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300"
      : "border-sky-200 bg-sky-50/70 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300";

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-1.5",
        toneClass,
      )}
    >
      <Hash className="h-4 w-4 shrink-0" />
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

/**
 * Card view row of a project template version: version label + JSON summary,
 * template / project identifiers, creation time and the active toggle.
 */
export function ProjectTemplateVersionCard({
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
  const id = row[idField];
  const isClickable = typeof onRowClick === "function";
  const accent = row.isActive ? "bg-emerald-500" : "bg-muted-foreground/40";
  const status = statusMeta(row.status);

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
      {/* Active accent bar */}
      <span className={cn("absolute inset-y-0 left-0 w-1", accent)} />

      <CardContent className="flex flex-col gap-3 py-3 pl-5 pr-4 lg:grid lg:grid-cols-[minmax(0,1fr)_126px_148px_178px_auto] lg:items-center lg:gap-4">
        {/* Version + content summary */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">
              {row.version || "Untitled version"}
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                status.badge,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <FileJson className="h-3 w-3 shrink-0" />
            <span className="truncate">{describeContent(row.contentJson)}</span>
          </p>
          {row.parentTemplateId != null && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <GitBranch className="h-3 w-3 shrink-0" />
              <span className="truncate">
                Derived from version #{row.parentTemplateId}
              </span>
            </p>
          )}
        </div>

        {/* Template badge */}
        <div className="flex min-w-0 items-center gap-2">
          <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="inline-flex items-center justify-center rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
            TPL-{row.templateId ?? "—"}
          </span>
        </div>

        {/* Template / project identifiers */}
        <HighlightBox
          label="Template"
          value={row.templateId != null ? `#${row.templateId}` : "—"}
          tone="template"
        />
        <div className="flex flex-col gap-1.5">
          <HighlightBox
            label="Project"
            value={row.projectId != null ? `#${row.projectId}` : "—"}
            tone="project"
          />
          <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatDateTime(row.createdAt)}</span>
          </div>
        </div>

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
