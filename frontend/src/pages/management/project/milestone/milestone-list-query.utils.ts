import type { LatePolicyType, MilestoneListParams, MilestoneStatus } from "@/types";

export const DEFAULT_MILESTONE_PAGE = 0;
export const DEFAULT_MILESTONE_PAGE_SIZE = 20;
const STATUSES = new Set<MilestoneStatus>(["PLANNED", "OPEN", "CLOSED", "CANCELLED"]);
const LATE_POLICY_TYPES = new Set<LatePolicyType>(["NO_LATE", "ALLOW_LATE"]);

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_MILESTONE_PAGE;
}

function parseSize(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100
    ? parsed
    : DEFAULT_MILESTONE_PAGE_SIZE;
}

function parseDate(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? value
    : undefined;
}

function uniqueAllowed<T extends string>(values: string[], allowed: Set<T>): T[] | undefined {
  const result = [...new Set(values.filter((value): value is T => allowed.has(value as T)))];
  return result.length > 0 ? result : undefined;
}

export function parseMilestoneListParams(searchParams: URLSearchParams): MilestoneListParams {
  const search = searchParams.get("search")?.slice(0, 120);
  const mandatoryValue = searchParams.get("mandatory");
  const teamIdValue = Number(searchParams.get("teamId"));

  return {
    page: parsePage(searchParams.get("page")),
    size: parseSize(searchParams.get("size")),
    teamId: Number.isSafeInteger(teamIdValue) && teamIdValue > 0 ? teamIdValue : undefined,
    search: search || undefined,
    status: uniqueAllowed(searchParams.getAll("status"), STATUSES),
    mandatory: mandatoryValue === "true" ? true : mandatoryValue === "false" ? false : undefined,
    latePolicyType: uniqueAllowed(searchParams.getAll("latePolicyType"), LATE_POLICY_TYPES),
    deadlineFrom: parseDate(searchParams.get("deadlineFrom")),
    deadlineTo: parseDate(searchParams.get("deadlineTo")),
  };
}

export function serializeMilestoneListParams(params: MilestoneListParams): URLSearchParams {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    size: String(params.size),
  });
  if (params.teamId !== undefined) searchParams.set("teamId", String(params.teamId));
  if (params.search) searchParams.set("search", params.search);
  params.status?.forEach((status) => searchParams.append("status", status));
  if (params.mandatory !== undefined) searchParams.set("mandatory", String(params.mandatory));
  params.latePolicyType?.forEach((type) => searchParams.append("latePolicyType", type));
  if (params.deadlineFrom) searchParams.set("deadlineFrom", params.deadlineFrom);
  if (params.deadlineTo) searchParams.set("deadlineTo", params.deadlineTo);
  return searchParams;
}

export function countMilestoneFilters(params: MilestoneListParams): number {
  return Number(Boolean(params.status?.length))
    + Number(params.mandatory !== undefined)
    + Number(Boolean(params.latePolicyType?.length))
    + Number(Boolean(params.deadlineFrom || params.deadlineTo));
}

export function hasMilestoneQuery(params: MilestoneListParams): boolean {
  return Boolean(params.search || countMilestoneFilters(params));
}
