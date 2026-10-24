import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SprintPlanningItem } from "@/types";
import { ChevronUp, Loader2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { backlogItemKey, backlogStatusMeta, backlogPriorityMeta } from "../backlog.constants";

interface SprintCreateRowProps {
  /** Work items that are still waiting in the product backlog. */
  availableItems: SprintPlanningItem[];
  itemKeyPrefix: string;
  /** False when the sprint scope is locked or the user may not edit. */
  canEdit: boolean;
  busy?: boolean;
  onAddExisting: (ids: number[]) => void;
  onCreateNew: () => void;
}

/**
 * Jira style "+ Create" row shown under the sprint work items.
 * <p>
 * Expanding it lists the work items that are already in the product backlog
 * (one click assigns them to the sprint) and offers creating a brand new work
 * item straight inside the sprint. The product backlog itself is no longer
 * rendered as a separate section.
 */
export function SprintCreateRow({
  availableItems,
  itemKeyPrefix,
  canEdit,
  busy = false,
  onAddExisting,
  onCreateNew,
}: SprintCreateRowProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  const visibleItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return availableItems;
    }

    return availableItems.filter(
      (item) =>
        (item.title ?? "").toLowerCase().includes(normalized) ||
        backlogItemKey(itemKeyPrefix, item).toLowerCase().includes(normalized),
    );
  }, [availableItems, itemKeyPrefix, keyword]);

  return (
    <div className="bg-card">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          disabled={!canEdit || busy}
          aria-expanded={open}
          onClick={() => setOpen((previous) => !previous)}
        >
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Create
        </Button>

        {busy ? (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </span>
        ) : (
          !open && (
            <span className="truncate text-[11px] text-muted-foreground">
              {canEdit
                ? "Pick an existing backlog item, or create a new work item."
                : "The sprint scope is locked."}
            </span>
          )
        )}
      </div>

      {open && canEdit && (
        <div className="border-t bg-muted/20 px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search the product backlog"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="mt-2 max-h-56 overflow-y-auto rounded-md border bg-card">
            {visibleItems.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                {availableItems.length === 0
                  ? "The product backlog is empty — create a new work item below."
                  : "No backlog item matches this search."}
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border/70">
                {visibleItems.map((item) => {
                  const status = backlogStatusMeta(item.status);
                  const priority = backlogPriorityMeta(item.priority);
                  const estimate =
                    typeof item.estimatedHours === "number"
                      ? `${item.estimatedHours}h`
                      : "-";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={busy}
                      onClick={() => onAddExisting([item.id])}
                      className="flex items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

                      <span className="w-20 shrink-0 truncate font-mono text-[11px] font-semibold text-muted-foreground">
                        {backlogItemKey(itemKeyPrefix, item)}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {item.title ?? "Untitled work item"}
                      </span>

                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          priority.pill,
                        )}
                        title={`Priority: ${priority.label}`}
                      >
                        {priority.label}
                      </span>

                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          status.pill,
                        )}
                      >
                        {status.label}
                      </span>

                      <span className="w-8 shrink-0 text-center text-[11px] text-muted-foreground">
                        {estimate}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {availableItems.length} work item
              {availableItems.length === 1 ? "" : "s"} in the product backlog
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 text-[11px]"
                disabled={busy}
                onClick={onCreateNew}
              >
                <Plus className="h-3.5 w-3.5" />
                Create new work item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
