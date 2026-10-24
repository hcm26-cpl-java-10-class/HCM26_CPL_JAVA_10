import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectTemplateVersionDTO } from "@/types";
import { Layers } from "lucide-react";
import type { ReactNode } from "react";
import { activeMeta, formatDate, parseContent, statusMeta } from "./version.constants";

interface VersionListPanelProps {
  title: string;
  versions: ProjectTemplateVersionDTO[];
  selectedId?: number;
  onSelect: (id: number) => void;
  emptyMessage?: string;
  /** Hide the template column when the list is already scoped to one template. */
  showTemplate?: boolean;
  action?: ReactNode;
}

const summaryOf = (version: ProjectTemplateVersionDTO) => {
  const parsed = parseContent(version.contentJson);

  if (parsed) {
    const description = parsed.description;
    if (typeof description === "string" && description.trim()) {
      return description;
    }

    const name = parsed.name;
    if (typeof name === "string" && name.trim()) {
      return name;
    }
  }

  return version.contentJson
    ? version.contentJson.replace(/\s+/g, " ").slice(0, 140)
    : "—";
};

/**
 * Compact, clickable list of template versions. Used by the overview tab
 * (versions of the selected template) and by the versions tab (full catalogue).
 */
export function VersionListPanel({
  title,
  versions,
  selectedId,
  onSelect,
  emptyMessage = "No version has been created yet.",
  showTemplate = true,
  action,
}: VersionListPanelProps) {
  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
            {versions.length}
          </Badge>
        </div>
        {action}
      </header>

      <div className="divide-y">
        {versions.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          versions.map((version, index) => {
            const meta = activeMeta(version.isActive);
            const status = statusMeta(version.status);

            return (
              <button
                key={version.id}
                type="button"
                onClick={() => version.id != null && onSelect(version.id)}
                className={cn(
                  "flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60",
                  version.id === selectedId && "bg-primary/5",
                )}
              >
                <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Row {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {version.version || `Version #${version.id}`}
                </span>
                <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block">
                  {summaryOf(version)}
                </span>
                {showTemplate && (
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                    TPL-{version.templateId ?? "—"} · PRJ-{version.projectId ?? "—"}
                  </span>
                )}
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDate(version.createdAt)}
                </span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    status.badge,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                  {status.label}
                </span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    meta.badge,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                  {meta.label}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
