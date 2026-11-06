import type { LatePolicyType, MilestoneLifecycleStatus } from "@/types";

export type WorkspaceMilestoneSort = "deadline:asc" | "deadline:desc" | "title:asc" | "title:desc" | "createdAt:desc";
export type WorkspaceMilestoneStatus = MilestoneLifecycleStatus | "ALL";
export type WorkspaceMilestoneMandatory = "ALL" | "true" | "false";
export type WorkspaceMilestoneLatePolicy = LatePolicyType | "ALL";

export interface WorkspaceMilestoneListState {
  page: number;
  size: 10 | 20 | 50;
  search: string;
  status: WorkspaceMilestoneStatus;
  sort: WorkspaceMilestoneSort;
  mandatory: WorkspaceMilestoneMandatory;
  latePolicy: WorkspaceMilestoneLatePolicy;
  from: string;
  to: string;
}

export const DEFAULT_WORKSPACE_MILESTONE_LIST: WorkspaceMilestoneListState = {
  page: 0, size: 10, search: "", status: "ALL", sort: "deadline:asc",
  mandatory: "ALL", latePolicy: "ALL", from: "", to: "",
};

const keys = ["msPage", "msSize", "msSearch", "msStatus", "msSort", "msMandatory", "msLatePolicy", "msFrom", "msTo"];
const statuses = new Set<WorkspaceMilestoneStatus>(["ALL", "PLANNED", "IN_PROGRESS", "SUBMITTED", "CHANGES_REQUESTED", "ACCEPTED", "REJECTED"]);
const sorts = new Set<WorkspaceMilestoneSort>(["deadline:asc", "deadline:desc", "title:asc", "title:desc", "createdAt:desc"]);

function validDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

export function parseWorkspaceMilestoneList(searchParams: URLSearchParams): WorkspaceMilestoneListState {
  const page = Number(searchParams.get("msPage"));
  const size = Number(searchParams.get("msSize"));
  const rawStatus = searchParams.get("msStatus") as WorkspaceMilestoneStatus;
  const rawSort = searchParams.get("msSort") as WorkspaceMilestoneSort;
  const rawMandatory = searchParams.get("msMandatory");
  const rawLate = searchParams.get("msLatePolicy");
  let from = validDate(searchParams.get("msFrom"));
  let to = validDate(searchParams.get("msTo"));
  if (from && to && from > to) [from, to] = [to, from];
  return {
    page: Number.isSafeInteger(page) && page >= 0 ? page : 0,
    size: size === 20 || size === 50 ? size : 10,
    search: (searchParams.get("msSearch") ?? "").slice(0, 120),
    status: statuses.has(rawStatus) ? rawStatus : "ALL",
    sort: sorts.has(rawSort) ? rawSort : "deadline:asc",
    mandatory: rawMandatory === "true" || rawMandatory === "false" ? rawMandatory : "ALL",
    latePolicy: rawLate === "NO_LATE" || rawLate === "ALLOW_LATE" ? rawLate : "ALL",
    from,
    to,
  };
}

export function writeWorkspaceMilestoneList(current: URLSearchParams, state: WorkspaceMilestoneListState): URLSearchParams {
  const next = new URLSearchParams(current);
  keys.forEach((key) => next.delete(key));
  if (state.page) next.set("msPage", String(state.page));
  if (state.size !== 10) next.set("msSize", String(state.size));
  if (state.search) next.set("msSearch", state.search);
  if (state.status !== "ALL") next.set("msStatus", state.status);
  if (state.sort !== "deadline:asc") next.set("msSort", state.sort);
  if (state.mandatory !== "ALL") next.set("msMandatory", state.mandatory);
  if (state.latePolicy !== "ALL") next.set("msLatePolicy", state.latePolicy);
  if (state.from) next.set("msFrom", state.from);
  if (state.to) next.set("msTo", state.to);
  return next;
}

export function countWorkspaceMilestoneFilters(state: WorkspaceMilestoneListState): number {
  return Number(state.mandatory !== "ALL") + Number(state.latePolicy !== "ALL") + Number(Boolean(state.from || state.to));
}

export function hasWorkspaceMilestoneQuery(state: WorkspaceMilestoneListState): boolean {
  return Boolean(state.search || state.status !== "ALL" || countWorkspaceMilestoneFilters(state));
}
