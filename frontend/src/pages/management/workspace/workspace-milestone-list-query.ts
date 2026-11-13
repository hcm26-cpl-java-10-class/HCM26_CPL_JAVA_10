import type { LatePolicyType, MilestoneLifecycleStatus } from "@/types";

export type WorkspaceMilestoneSort = "smart" | "deadline:asc" | "deadline:desc" | "title:asc" | "title:desc" | "createdAt:desc";
export type WorkspaceMilestoneGroup = "attention" | "active" | "review" | "done" | "all";
export type WorkspaceMilestoneStatus = MilestoneLifecycleStatus | "ALL";
export type WorkspaceMilestoneMandatory = "ALL" | "true" | "false";
export type WorkspaceMilestoneLatePolicy = LatePolicyType | "ALL";

export interface WorkspaceMilestoneListState {
  /** null = choose automatically (Needs attention when it has items, otherwise Active, otherwise All). */
  group: WorkspaceMilestoneGroup | null;
  /** A specific lifecycle status; when set it replaces the group filter. */
  status: WorkspaceMilestoneStatus;
  search: string;
  sort: WorkspaceMilestoneSort;
  mandatory: WorkspaceMilestoneMandatory;
  latePolicy: WorkspaceMilestoneLatePolicy;
  from: string;
  to: string;
}

export const DEFAULT_WORKSPACE_MILESTONE_LIST: WorkspaceMilestoneListState = {
  group: null, status: "ALL", search: "", sort: "smart",
  mandatory: "ALL", latePolicy: "ALL", from: "", to: "",
};

// msPage / msSize are legacy keys from the server-paginated list; they are cleared on the next write.
const keys = ["msGroup", "msStatus", "msSearch", "msSort", "msMandatory", "msLatePolicy", "msFrom", "msTo", "msPage", "msSize"];
const groups = new Set<WorkspaceMilestoneGroup>(["attention", "active", "review", "done", "all"]);
const statuses = new Set<WorkspaceMilestoneStatus>(["ALL", "PLANNED", "IN_PROGRESS", "SUBMITTED", "CHANGES_REQUESTED", "ACCEPTED", "REJECTED"]);
const sorts = new Set<WorkspaceMilestoneSort>(["smart", "deadline:asc", "deadline:desc", "title:asc", "title:desc", "createdAt:desc"]);

function validDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

export function parseWorkspaceMilestoneList(searchParams: URLSearchParams): WorkspaceMilestoneListState {
  const rawGroup = searchParams.get("msGroup") as WorkspaceMilestoneGroup;
  const rawStatus = searchParams.get("msStatus") as WorkspaceMilestoneStatus;
  const rawSort = searchParams.get("msSort") as WorkspaceMilestoneSort;
  const rawMandatory = searchParams.get("msMandatory");
  const rawLate = searchParams.get("msLatePolicy");
  let from = validDate(searchParams.get("msFrom"));
  let to = validDate(searchParams.get("msTo"));
  if (from && to && from > to) [from, to] = [to, from];
  return {
    group: groups.has(rawGroup) ? rawGroup : null,
    status: statuses.has(rawStatus) ? rawStatus : "ALL",
    search: (searchParams.get("msSearch") ?? "").slice(0, 120),
    sort: sorts.has(rawSort) ? rawSort : "smart",
    mandatory: rawMandatory === "true" || rawMandatory === "false" ? rawMandatory : "ALL",
    latePolicy: rawLate === "NO_LATE" || rawLate === "ALLOW_LATE" ? rawLate : "ALL",
    from,
    to,
  };
}

export function writeWorkspaceMilestoneList(current: URLSearchParams, state: WorkspaceMilestoneListState): URLSearchParams {
  const next = new URLSearchParams(current);
  keys.forEach((key) => next.delete(key));
  if (state.group) next.set("msGroup", state.group);
  if (state.status !== "ALL") next.set("msStatus", state.status);
  if (state.search) next.set("msSearch", state.search);
  if (state.sort !== "smart") next.set("msSort", state.sort);
  if (state.mandatory !== "ALL") next.set("msMandatory", state.mandatory);
  if (state.latePolicy !== "ALL") next.set("msLatePolicy", state.latePolicy);
  if (state.from) next.set("msFrom", state.from);
  if (state.to) next.set("msTo", state.to);
  return next;
}

/** Number of filters hidden inside the View menu (status, requirement, late policy, deadline range). */
export function countWorkspaceMilestoneFilters(state: WorkspaceMilestoneListState): number {
  return Number(state.status !== "ALL") + Number(state.mandatory !== "ALL") + Number(state.latePolicy !== "ALL") + Number(Boolean(state.from || state.to));
}

export function hasWorkspaceMilestoneQuery(state: WorkspaceMilestoneListState): boolean {
  return Boolean(state.search || countWorkspaceMilestoneFilters(state));
}
