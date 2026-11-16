import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Search, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { gitIntegrationErrorBody } from "@/api/features/git-integration.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { GitInstallation, GitRepositoryFilter } from "@/types/features/git-integration";
import { formatDateTime, formatRelative, installationManageUrl } from "../git-integration.format";
import { gitIntegrationKeys, useInstallationRepositories } from "../useGitIntegration";
import { GitHubTile } from "./GitIntegrationHeader";
import { InstallationSwitcher } from "./InstallationSwitcher";
import {
  GitHubErrorState,
  InstallationNotActiveState,
  NoMatchState,
  NoRepositoriesState,
  RateLimitState,
  RepositoryListSkeleton,
} from "./RepositoryListStates";
import { RepositoryRow } from "./RepositoryRow";

const PAGE_SIZE = 20;
const REFRESH_COOLDOWN_MS = 10_000;

const FILTERS: Array<{ id: GitRepositoryFilter; label: string; count: "all" | "available" | "linked" }> = [
  { id: "all", label: "All", count: "all" },
  { id: "available", label: "Available", count: "available" },
  { id: "linked", label: "Linked", count: "linked" },
];

/**
 * US-GI-03: repositories a GitHub App installation can access, with server-side
 * search, filter and paging. Read-only here; GI-04 reuses it to pick a repository
 * for a project (pass `projectId` so "linked to this project" is recognised).
 */
export function RepositoryBrowserSheet({ open, onOpenChange, installations, installationId, onInstallationChange, projectId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Connected installations the user can switch between. */
  installations: GitInstallation[];
  installationId: number;
  onInstallationChange: (id: number) => void;
  projectId?: number;
}) {
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filter, setFilter] = useState<GitRepositoryFilter>("all");
  const [coolingDown, setCoolingDown] = useState(false);

  // Paging belongs to one result set: a new search, filter or installation starts again at page 0.
  const resultKey = `${installationId}|${filter}|${debouncedSearch}`;
  const [paging, setPaging] = useState({ key: resultKey, page: 0 });
  const page = paging.key === resultKey ? paging.page : 0;
  const setPage = (next: number) => setPaging({ key: resultKey, page: next });

  const installation = installations.find(item => item.id === installationId);
  const query = useInstallationRepositories(open ? installationId : undefined,
    { q: debouncedSearch, filter, page, size: PAGE_SIZE, projectId });
  const data = query.data;
  const errorBody = query.isError ? gitIntegrationErrorBody(query.error) : undefined;
  const manageUrl = installation ? installationManageUrl(installation) : "https://github.com/settings/installations";

  // The server found the installation suspended/uninstalled: refresh the cards behind the panel.
  useEffect(() => {
    if (errorBody?.code === "GIT_INSTALLATION_NOT_ACTIVE") {
      void queryClient.invalidateQueries({ queryKey: gitIntegrationKeys.installations().slice(0, 2) });
    }
  }, [errorBody?.code, queryClient]);

  // "/" focuses the search box while the panel is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === "/" && target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Matches the server's 10-second throttle on forced refreshes.
  function refresh() {
    if (coolingDown || query.refreshing) return;
    setCoolingDown(true);
    window.setTimeout(() => setCoolingDown(false), REFRESH_COOLDOWN_MS);
    void query.refresh();
  }

  const busy = query.isFetching && !query.isPending;
  const from = data && data.totalElements > 0 ? data.page * data.size + 1 : 0;
  const to = data ? Math.min((data.page + 1) * data.size, data.totalElements) : 0;

  let body;
  if (query.isPending) {
    body = <RepositoryListSkeleton />;
  } else if (query.isError) {
    if (errorBody?.code === "GIT_RATE_LIMITED") {
      body = <RateLimitState key={String(query.errorUpdatedAt)} retryAfterSeconds={errorBody.retryAfterSeconds ?? 60}
        onRetry={() => void query.refetch()} />;
    } else if (errorBody?.code === "GIT_INSTALLATION_NOT_ACTIVE") {
      body = <InstallationNotActiveState status={errorBody.installationStatus} manageUrl={manageUrl} />;
    } else {
      body = <GitHubErrorState retrying={query.isFetching} onRetry={() => void query.refetch()} />;
    }
  } else if (data && data.counts.all === 0 && !debouncedSearch) {
    body = <NoRepositoriesState manageUrl={manageUrl} refreshing={query.refreshing} onRefresh={refresh} />;
  } else if (data && data.items.length === 0 && debouncedSearch) {
    body = <NoMatchState query={debouncedSearch} onClear={() => setSearch("")} />;
  } else if (data && data.items.length === 0) {
    body = <p className="px-6 py-12 text-center text-sm text-muted-foreground">No repositories in this tab.</p>;
  } else if (data) {
    body = <ul aria-label="Repositories" className={cn("divide-y transition-opacity", busy && "opacity-70")}>
      {data.items.map(item => <RepositoryRow key={item.externalId} repository={item} />)}
    </ul>;
  }

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
      <SheetHeader className="gap-3 border-b px-5 pb-4 pt-5">
        <div className="flex items-center gap-3 pr-8">
          <GitHubTile size="sm" />
          <div className="min-w-0">
            <SheetTitle className="text-base">Repositories</SheetTitle>
            <SheetDescription className="text-xs">Repositories the GitHub App can access, public and private.</SheetDescription>
          </div>
        </div>
        <InstallationSwitcher installations={installations} selectedId={installationId} onSelect={onInstallationChange} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)}
              onKeyDown={event => {
                // First Esc clears the search; the next one closes the panel.
                if (event.key === "Escape" && search) { event.preventDefault(); event.stopPropagation(); setSearch(""); }
              }}
              placeholder="Search by repository or owner" aria-label="Search repositories" maxLength={100} className="h-9 pl-8 pr-8" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>}
          </div>
          <div role="group" aria-label="Filter repositories" className="inline-flex rounded-lg border bg-card p-0.5">
            {FILTERS.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === item.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-muted-foreground hover:text-foreground")}>
              {item.label}{data && <span className="ml-1 tabular-nums opacity-70">{data.counts[item.count]}</span>}
            </button>)}
          </div>
        </div>
      </SheetHeader>

      {/* Thin progress bar while a new page/search loads over the previous one. */}
      <div className="h-0.5 w-full overflow-hidden bg-transparent">
        {busy && <div className="h-full w-1/3 animate-pulse bg-blue-500/70" />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {data?.truncated && <p className="flex items-center gap-1.5 border-b bg-amber-50 px-4 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert className="size-3.5" aria-hidden="true" />Showing the first repositories only. Use search to narrow the list.
        </p>}
        {body}
      </div>

      <footer className="space-y-2 border-t px-5 py-3">
        {data && data.totalElements > 0 && <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing <span className="tabular-nums">{from}–{to}</span> of <span className="tabular-nums">{data.totalElements}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>
              <ChevronLeft />Prev
            </Button>
            <Button variant="outline" size="sm" className="h-8" disabled={page + 1 >= data.totalPages || busy} onClick={() => setPage(page + 1)}>
              Next<ChevronRight />
            </Button>
          </div>
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {data && <time dateTime={data.fetchedAt} title={formatDateTime(data.fetchedAt)}>Updated {formatRelative(data.fetchedAt)}</time>}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" disabled={coolingDown || query.refreshing || query.isPending}
              onClick={refresh} aria-label="Refresh repositories from GitHub">
              <RefreshCw className={cn("size-3.5", query.refreshing && "animate-spin")} />Refresh
            </Button>
          </span>
          <a href={manageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
            Missing a repository? Manage access<ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      </footer>
    </SheetContent>
  </Sheet>;
}
