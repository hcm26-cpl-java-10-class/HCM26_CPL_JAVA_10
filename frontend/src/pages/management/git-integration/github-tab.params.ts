import type { GitInsightsRange, GitPullRequestState, GitTaskLinkFilter } from "@/types/features/git-integration";

/**
 * WS-GH-01: the workspace GitHub tab keeps its whole state in the URL
 * (`?tab=github&view=pulls&state=OPEN&pr=12`), so reloads, the back button and
 * shared links land on the same screen even though the layout remounts.
 */
export type GitHubView = "insights" | "commits" | "pulls" | "members";
export type GitHubLinkFilter = Extract<GitTaskLinkFilter, "LINKED" | "NEEDS_ATTENTION">;

export interface GitHubTabState {
  view: GitHubView;
  /** WS-GH-02: period of the Insights activity; kept when switching views. */
  range: GitInsightsRange;
  q: string;
  author?: string;
  branch?: string;
  link?: GitHubLinkFilter;
  /** WS-GH-02: commits of a day or week (`YYYY-MM-DD`, both included), set by clicking a chart column. */
  from?: string;
  to?: string;
  state?: GitPullRequestState;
  pr?: number;
  /** US-GI-06: a contributor highlighted in the Members view. */
  contributor?: number;
  page: number;
}

/** A place in the tab to open; omitted fields are cleared. */
export type GitHubTabTarget = Partial<Omit<GitHubTabState, "view">> & { view: GitHubView };
/** A change of the current state; `undefined` clears a field, and any change except `page`/`pr` resets paging. */
export type GitHubTabPatch = Partial<Omit<GitHubTabState, "view">> & { view?: GitHubView };

export const GITHUB_TAB = "github";
export const GITHUB_TAB_PARAMS = ["view", "range", "q", "author", "branch", "link", "from", "to", "state", "pr", "contributor", "page"] as const;
export const DEFAULT_INSIGHTS_RANGE: GitInsightsRange = "30d";

const VIEWS: readonly GitHubView[] = ["insights", "commits", "pulls", "members"];
const LINKS: readonly GitHubLinkFilter[] = ["LINKED", "NEEDS_ATTENTION"];
const STATES: readonly GitPullRequestState[] = ["OPEN", "MERGED", "CLOSED"];
const RANGES: readonly GitInsightsRange[] = ["7d", "30d", "90d"];
const MAX_TEXT = 100;

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | undefined {
  return values.find(value => value === raw);
}

function text(raw: string | null): string | undefined {
  const value = raw?.trim().slice(0, MAX_TEXT);
  return value || undefined;
}

/** A real calendar date `YYYY-MM-DD`, else undefined. */
function isoDate(raw: string | null): string | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? raw : undefined;
}

function positiveInt(raw: string | null): number | undefined {
  if (!raw || !/^\d{1,9}$/.test(raw)) return undefined;
  return Number(raw);
}

/** Reads the tab state; unknown or malformed values fall back to the defaults instead of failing. */
export function parseGitHubTabParams(params: URLSearchParams): GitHubTabState {
  let from = isoDate(params.get("from"));
  let to = isoDate(params.get("to"));
  if (from && !to) to = from;
  if (to && !from) from = to;
  if (from && to && to < from) [from, to] = [to, from];
  return {
    view: oneOf(VIEWS, params.get("view")) ?? "insights",
    range: oneOf(RANGES, params.get("range")) ?? DEFAULT_INSIGHTS_RANGE,
    q: text(params.get("q")) ?? "",
    author: text(params.get("author")),
    branch: text(params.get("branch")),
    link: oneOf(LINKS, params.get("link")),
    from,
    to,
    state: oneOf(STATES, params.get("state")),
    pr: positiveInt(params.get("pr")),
    contributor: positiveInt(params.get("contributor")),
    page: positiveInt(params.get("page")) ?? 0,
  };
}

/** Removes every GitHub tab parameter (used when leaving the tab). */
export function clearGitHubTabParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of GITHUB_TAB_PARAMS) next.delete(key);
  return next;
}

function write(next: URLSearchParams, state: GitHubTabState) {
  for (const key of GITHUB_TAB_PARAMS) next.delete(key);
  if (state.view !== "insights") next.set("view", state.view);
  if (state.range !== DEFAULT_INSIGHTS_RANGE) next.set("range", state.range);
  if (state.q) next.set("q", state.q);
  if (state.author) next.set("author", state.author);
  if (state.branch) next.set("branch", state.branch);
  if (state.link) next.set("link", state.link);
  if (state.from) next.set("from", state.from);
  if (state.to) next.set("to", state.to);
  if (state.state) next.set("state", state.state);
  if (state.pr !== undefined) next.set("pr", String(state.pr));
  if (state.contributor !== undefined) next.set("contributor", String(state.contributor));
  if (state.page > 0) next.set("page", String(state.page));
  return next;
}

/** Opens the GitHub tab at `target` (other GitHub parameters are cleared, `project` is kept). */
export function openGitHubTabParams(params: URLSearchParams, target: GitHubTabTarget): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set("tab", GITHUB_TAB);
  return write(next, { q: "", page: 0, ...target, range: target.range ?? DEFAULT_INSIGHTS_RANGE });
}

/** Applies a change to the current tab state. */
export function patchGitHubTabParams(params: URLSearchParams, patch: GitHubTabPatch): URLSearchParams {
  const current = parseGitHubTabParams(params);
  const keepsPaging = Object.keys(patch).every(key => key === "page" || key === "pr" || key === "range");
  const merged: GitHubTabState = { ...current, ...patch, q: patch.q ?? ("q" in patch ? "" : current.q),
    range: patch.range ?? current.range, view: patch.view ?? current.view };
  if (!keepsPaging && !("page" in patch)) merged.page = 0;
  return write(new URLSearchParams(params), merged);
}
