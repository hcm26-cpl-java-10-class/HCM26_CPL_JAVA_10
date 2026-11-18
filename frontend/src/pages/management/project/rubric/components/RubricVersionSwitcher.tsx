import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { RubricVersion, RubricVersionStatus } from "@/types";
import { Check, ChevronDown, History, Search } from "lucide-react";
import { useMemo, useState } from "react";

/** Up to this many versions are shown as plain tabs; beyond it the rest move into the "All versions" popover. */
const MAX_PINNED = 4;

type StatusFilter = "ALL" | RubricVersionStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
];

const formatShortDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

const statusDot = (status: RubricVersionStatus) => (status === "PUBLISHED" ? "bg-emerald-500" : "bg-amber-500");

interface Props {
  /** Sorted newest first. */
  versions: RubricVersion[];
  selectedId: string;
  onSelect: (versionNumber: number) => void;
}

/** Short contextual tag shown next to a pinned tab, e.g. "Draft", "Latest", "Used ×3". */
function versionTag(item: RubricVersion, latestPublishedId?: string) {
  if (item.status === "DRAFT") return "Draft";
  if (item.id === latestPublishedId) return "Latest";
  if (item.milestoneUsageCount > 0) return `Used ×${item.milestoneUsageCount}`;
  return null;
}

/**
 * Picks the versions worth a one-click tab: the draft, the latest published version, versions
 * still used by milestones, and always the currently selected one.
 */
function pickPinned(versions: RubricVersion[], selectedId: string, latestPublishedId?: string) {
  if (versions.length <= MAX_PINNED) return versions;
  const pinned: RubricVersion[] = [];
  const add = (item?: RubricVersion) => {
    if (item && pinned.length < MAX_PINNED && !pinned.some((p) => p.id === item.id)) pinned.push(item);
  };
  add(versions.find((item) => item.status === "DRAFT"));
  add(versions.find((item) => item.id === latestPublishedId));
  versions.filter((item) => item.milestoneUsageCount > 0).forEach(add);
  const selected = versions.find((item) => item.id === selectedId);
  if (selected && !pinned.some((p) => p.id === selected.id)) {
    if (pinned.length >= MAX_PINNED) pinned.pop();
    pinned.push(selected);
  }
  return pinned.sort((a, b) => b.versionNumber - a.versionNumber);
}

export function RubricVersionSwitcher({ versions, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const latestPublishedId = versions.find((item) => item.status === "PUBLISHED")?.id;
  const pinned = useMemo(
    () => pickPinned(versions, selectedId, latestPublishedId),
    [versions, selectedId, latestPublishedId],
  );
  const hasOverflow = versions.length > pinned.length;

  const counts = useMemo(() => ({
    ALL: versions.length,
    PUBLISHED: versions.filter((item) => item.status === "PUBLISHED").length,
    DRAFT: versions.filter((item) => item.status === "DRAFT").length,
  }), [versions]);

  const term = search.trim().toLowerCase().replace(/^v/, "");
  const filtered = versions.filter((item) =>
    (filter === "ALL" || item.status === filter)
    && (!term || String(item.versionNumber).includes(term)));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
      setFilter("ALL");
    }
  };

  const choose = (item: RubricVersion) => {
    onSelect(item.versionNumber);
    handleOpenChange(false);
  };

  if (versions.length <= 1) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div role="tablist" aria-label="Rubric versions" className="flex min-w-0 gap-1 rounded-lg border bg-muted/40 p-1">
        {pinned.map((item) => {
          const selected = item.id === selectedId;
          const tag = versionTag(item, latestPublishedId);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={`Version ${item.versionNumber} · ${item.status}`}
              onClick={() => onSelect(item.versionNumber)}
              className={cn(
                "items-center gap-1.5 rounded-md px-2.5 py-1 text-sm whitespace-nowrap transition-colors",
                selected
                  ? "flex bg-background font-semibold shadow-sm"
                  // On phones only the selected tab stays visible when the popover can reach the rest.
                  : cn("text-muted-foreground hover:text-foreground", hasOverflow ? "hidden sm:flex" : "flex"),
              )}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", statusDot(item.status))} aria-hidden />
              v{item.versionNumber}
              {tag ? <span className="hidden text-xs font-normal text-muted-foreground md:inline">{tag}</span> : null}
              <span className="sr-only">{item.status}</span>
            </button>
          );
        })}
      </div>

      {hasOverflow ? (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5">
              <History className="size-3.5" />
              <span className="hidden sm:inline">All versions</span>
              <span className="rounded bg-muted px-1.5 text-xs tabular-nums">{versions.length}</span>
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
            <div className="grid gap-2 border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find version, e.g. 12"
                  inputMode="numeric"
                  className="h-8 pl-8 text-sm"
                  aria-label="Search versions"
                />
              </div>
              <div className="flex gap-1" role="radiogroup" aria-label="Filter by status">
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={filter === option.value}
                    disabled={counts[option.value] === 0}
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-40",
                      filter === option.value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {option.label} <span className="tabular-nums opacity-70">{counts[option.value]}</span>
                  </button>
                ))}
              </div>
            </div>

            <ul className="max-h-72 overflow-y-auto p-1" aria-label="All rubric versions">
              {filtered.length ? filtered.map((item) => {
                const selected = item.id === selectedId;
                const tag = versionTag(item, latestPublishedId);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => choose(item)}
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                        selected && "bg-muted/70",
                      )}
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", statusDot(item.status))} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium tabular-nums">v{item.versionNumber}</span>
                          {tag ? <span className="text-xs text-muted-foreground">· {tag}</span> : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.status === "PUBLISHED"
                            ? `Published ${formatShortDate(item.publishedAt)}`
                            : `Updated ${formatShortDate(item.updatedAt)}`}
                          {item.milestoneUsageCount > 0
                            ? ` · ${item.milestoneUsageCount} milestone${item.milestoneUsageCount === 1 ? "" : "s"}`
                            : ""}
                        </span>
                      </span>
                      {selected ? <Check className="size-4 shrink-0 text-primary" aria-label="Selected" /> : null}
                    </button>
                  </li>
                );
              }) : (
                <li className="px-2 py-6 text-center text-xs text-muted-foreground">No versions match.</li>
              )}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
