import type { GitPullRequestState, GitTaskLinkFilter } from "@/types/features/git-integration";

/**
 * WS-GH-01: the workspace GitHub tab keeps its whole state in the URL
 * (`?tab=github&view=pulls&state=OPEN&pr=12`), so reloads, the back button and
 * shared links land on the same screen even though the layout remounts.
 */
export type GitHubView = "insights" | "commits" | "pulls";
export type GitHubLinkFilter = Extract<GitTaskLinkFilter, "LINKED" | "NEEDS_ATTENTION">;

export interface GitHubTabState {
  view: GitHubView;
  q: string;
  author?: string;
  branch?: string;
  link?: GitHubLinkFilter;
  state?: GitPullRequestState;
  pr?: number;
  page: number;
}

/** A place in the tab to open; omitted fields are cleared. */
export type GitHubTabTarget = Partial<Omit<GitHubTabState, "view">> & { view: GitHubView };
/** A change of the current state; `undefined` clears a field, and any change except `page`/`pr` resets paging. */
export type GitHubTabPatch = Partial<Omit<GitHubTabState, "view">> & { view?: GitHubView };

export const GITHUB_TAB = "github";
export const GITHUB_TAB_PARAMS = ["view", "q", "author", "branch", "link", "state", "pr", "page"] as const;

const VIEWS: readonly GitHubView[] = ["insights", "commits", "pulls"];
const LINKS: readonly GitHubLinkFilter[] = ["LINKED", "NEEDS_ATTENTION"];
const STATES: readonly GitPullRequestState[] = ["OPEN", "MERGED", "CLOSED"];
const MAX_TEXT = 100;

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | undefined {
  return values.find(value => value === raw);
}

function text(raw: string | null): string | undefined {
  const value = raw?.trim().slice(0, MAX_TEXT);
  return value || undefined;
}

function positiveInt(raw: string | null): number | undefined {
  if (!raw || !/^\d{1,9}$/.test(raw)) return undefined;
  return Number(raw);
}

/** Reads the tab state; unknown or malformed values fall back to the defaults instead of failing. */
export function parseGitHubTabParams(params: URLSearchParams): GitHubTabState {
  return {
    view: oneOf(VIEWS, params.get("view")) ?? "insights",
    q: text(params.get("q")) ?? "",
    author: text(params.get("author")),
    branch: text(params.get("branch")),
    link: oneOf(LINKS, params.get("link")),
    state: oneOf(STATES, params.get("state")),
    pr: positiveInt(params.get("pr")),
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
  if (state.q) next.set("q", state.q);
  if (state.author) next.set("author", state.author);
  if (state.branch) next.set("branch", state.branch);
  if (state.link) next.set("link", state.link);
  if (state.state) next.set("state", state.state);
  if (state.pr !== undefined) next.set("pr", String(state.pr));
  if (state.page > 0) next.set("page", String(state.page));
  return next;
}

/** Opens the GitHub tab at `target` (other GitHub parameters are cleared, `project` is kept). */
export function openGitHubTabParams(params: URLSearchParams, target: GitHubTabTarget): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set("tab", GITHUB_TAB);
  return write(next, { q: "", page: 0, ...target });
}

/** Applies a change to the current tab state. */
export function patchGitHubTabParams(params: URLSearchParams, patch: GitHubTabPatch): URLSearchParams {
  const current = parseGitHubTabParams(params);
  const keepsPaging = Object.keys(patch).every(key => key === "page" || key === "pr");
  const merged: GitHubTabState = { ...current, ...patch, q: patch.q ?? ("q" in patch ? "" : current.q) };
  if (!keepsPaging && !("page" in patch)) merged.page = 0;
  return write(new URLSearchParams(params), merged);
}
