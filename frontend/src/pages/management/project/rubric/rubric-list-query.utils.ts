import type { RubricListParams, RubricVersionStatus } from "@/types";

export const DEFAULT_RUBRIC_PAGE = 0;
export const DEFAULT_RUBRIC_PAGE_SIZE = 20;

const STATUSES = new Set<RubricVersionStatus>(["DRAFT", "PUBLISHED"]);

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_RUBRIC_PAGE;
}

function parseSize(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100
    ? parsed
    : DEFAULT_RUBRIC_PAGE_SIZE;
}

export function parseRubricListParams(searchParams: URLSearchParams): RubricListParams {
  const rawStatus = searchParams.get("status") as RubricVersionStatus | null;
  const search = searchParams.get("search")?.slice(0, 150);

  return {
    page: parsePage(searchParams.get("page")),
    size: parseSize(searchParams.get("size")),
    search: search || undefined,
    status: rawStatus && STATUSES.has(rawStatus) ? rawStatus : undefined,
  };
}

export function serializeRubricListParams(params: RubricListParams): URLSearchParams {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    size: String(params.size),
  });
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  return searchParams;
}

export function hasRubricQuery(params: RubricListParams): boolean {
  return Boolean(params.search?.trim() || params.status);
}
