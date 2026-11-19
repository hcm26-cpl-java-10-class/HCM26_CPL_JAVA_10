import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GitPage } from "@/types/features/git-integration";

/** Pill switcher shared by the repository activity views (selected = solid slate, like the rest of Git Integration). */
export function Segmented<T extends string>({ label, value, options, onChange, className }: {
  label: string;
  value: T;
  options: Array<{ id: T; label: ReactNode }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return <div role="group" aria-label={label} className={cn("inline-flex max-w-full overflow-x-auto rounded-lg border bg-card p-0.5", className)}>
    {options.map(option => <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}
      className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        value === option.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-muted-foreground hover:text-foreground")}>
      {option.label}
    </button>)}
  </div>;
}

const COMMIT_DELAY_MS = 300;

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Search box whose committed value lives in the URL: typing is local and is committed
 * 300 ms after the last key. `/` focuses it from anywhere on the page, `Esc` clears it.
 */
export function SearchBox({ value, onCommit, placeholder, label }: {
  value: string;
  onCommit: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  // Draft text paired with the committed value it started from; a change from outside
  // (Clear all, back button) wins over the draft without an effect.
  const [draft, setDraft] = useState({ source: value, text: value });
  const shown = draft.source === value ? draft.text : value;
  const timer = useRef<number | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      event.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function commit(text: string, delay: number) {
    window.clearTimeout(timer.current);
    const run = () => {
      const committed = text.trim().slice(0, 100);
      setDraft({ source: committed, text });
      onCommit(committed);
    };
    if (delay === 0) run(); else timer.current = window.setTimeout(run, delay);
  }

  function change(text: string) {
    setDraft({ source: value, text });
    commit(text, COMMIT_DELAY_MS);
  }

  return <div className="relative min-w-48 flex-1">
    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    <Input ref={input} value={shown} onChange={event => change(event.target.value)} placeholder={placeholder} aria-label={label} maxLength={100}
      aria-keyshortcuts="/"
      onKeyDown={event => { if (event.key === "Escape" && shown) { event.preventDefault(); event.stopPropagation(); commit("", 0); } }}
      className="h-9 pl-8 pr-8" />
    {shown ? <button type="button" onClick={() => commit("", 0)} aria-label="Clear search"
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
      : <kbd aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">/</kbd>}
  </div>;
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  onClear: () => void;
}

/** Active filters as removable chips, with "Clear all" when more than one is on. */
export function FilterChips({ filters, onClearAll }: { filters: ActiveFilter[]; onClearAll: () => void }) {
  if (filters.length === 0) return null;
  return <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2 sm:px-5">
    <span className="text-[11px] text-muted-foreground">Filtered by</span>
    {filters.map(filter => <span key={filter.key} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/60 py-0.5 pl-2 pr-0.5 text-xs">
      <span className="text-muted-foreground">{filter.label}:</span>
      <span className="truncate font-medium">{filter.value}</span>
      <button type="button" onClick={filter.onClear} aria-label={`Clear ${filter.label.toLowerCase()} filter`}
        className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"><X className="size-3" /></button>
    </span>)}
    {filters.length > 1 && <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearAll}>Clear all</Button>}
  </div>;
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return <div role="status" aria-label="Loading" className="divide-y">
    {Array.from({ length: rows }, (_, index) => <div key={index} className="space-y-2 px-4 py-3 sm:px-5">
      <Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" />
    </div>)}
  </div>;
}

export function ErrorState({ retrying, onRetry, message = "The list could not be loaded." }: { retrying: boolean; onRetry: () => void; message?: string }) {
  return <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
    {message}
    <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}><RefreshCw className={retrying ? "animate-spin" : undefined} />Try again</Button>
  </div>;
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
    <p>{children}</p>
    {action}
  </div>;
}

export function Pager<T>({ data, page, busy, onPage }: { data?: GitPage<T>; page: number; busy: boolean; onPage: (page: number) => void }) {
  if (!data || data.totalElements === 0 || data.items.length === 0) return null;
  const from = data.page * data.size + 1;
  const to = Math.min(data.page * data.size + data.items.length, data.totalElements);
  return <footer className="flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
    <p className="text-xs text-muted-foreground" aria-live="polite">
      Showing <span className="tabular-nums">{from}–{to}</span> of <span className="tabular-nums">{data.totalElements}</span>
    </p>
    {data.totalPages > 1 && <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" className="h-8" disabled={page === 0 || busy} onClick={() => onPage(page - 1)}><ChevronLeft />Prev</Button>
      <Button variant="outline" size="sm" className="h-8" disabled={page + 1 >= data.totalPages || busy} onClick={() => onPage(page + 1)}>Next<ChevronRight /></Button>
    </div>}
  </footer>;
}
