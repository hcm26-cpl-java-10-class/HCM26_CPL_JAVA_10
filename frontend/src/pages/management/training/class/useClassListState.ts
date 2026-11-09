import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
    EMPTY_CLASS_FILTERS,
    type ClassFilters,
    type ClassSortKey,
    type SortDirection,
} from "@/utils/class.utils";
import type { ClassKpi } from "@/hooks/useClassInsights";

export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

const SORT_KEYS: readonly ClassSortKey[] = ["code", "program", "trainees", "startDate", "status"];
const DEFAULT_SORT_KEY: ClassSortKey = "code";

export interface ClassListState {
    kpi: ClassKpi;
    filters: ClassFilters;
    sortKey: ClassSortKey;
    sortDirection: SortDirection;
    /** 0-based */
    page: number;
    pageSize: number;
}

type ParamChanges = Record<string, string | undefined>;

const positiveInt = (value: string | null): number | undefined => {
    if (!value || !/^\d{1,6}$/.test(value)) return undefined;
    const parsed = Number(value);
    return parsed > 0 ? parsed : undefined;
};

/**
 * The state of the class list lives in the URL (?q=&status=&program=&from=&to=&sort=&dir=&page=&size=),
 * so a filtered / sorted / paged view survives a refresh and the "Back to Class List" link of the detail page.
 */
export function useClassListState() {
    const [params, setParams] = useSearchParams();

    const state = useMemo<ClassListState>(() => {
        const sort = params.get("sort");
        const size = positiveInt(params.get("size"));

        return {
            kpi: (["inProgress", "upcoming", "completed"].includes(params.get("kpi") ?? "") ? params.get("kpi") : "all") as ClassKpi,
            filters: {
                search: params.get("q") ?? "",
                status: params.get("status") ?? "",
                programId: params.get("program") ?? "",
                startFrom: params.get("from") ?? "",
                startTo: params.get("to") ?? "",
            },
            sortKey: SORT_KEYS.find((key) => key === sort) ?? DEFAULT_SORT_KEY,
            sortDirection: params.get("dir") === "desc" ? "desc" : "asc",
            page: (positiveInt(params.get("page")) ?? 1) - 1,
            pageSize: PAGE_SIZES.find((allowed) => allowed === size) ?? DEFAULT_PAGE_SIZE,
        };
    }, [params]);

    const update = useCallback(
        (changes: ParamChanges) => {
            setParams(
                (previous) => {
                    const next = new URLSearchParams(previous);
                    for (const [key, value] of Object.entries(changes)) {
                        if (value) next.set(key, value);
                        else next.delete(key);
                    }
                    return next;
                },
                { replace: true },
            );
        },
        [setParams],
    );

    const setSearch = useCallback((value: string) => update({ q: value, page: undefined }), [update]);

    const setFilters = useCallback(
        (changes: Partial<Omit<ClassFilters, "search">>) =>
            update({
                ...(changes.status !== undefined && { status: changes.status }),
                ...(changes.programId !== undefined && { program: changes.programId }),
                ...(changes.startFrom !== undefined && { from: changes.startFrom }),
                ...(changes.startTo !== undefined && { to: changes.startTo }),
                page: undefined,
            }),
        [update],
    );

    const clearFilters = useCallback(
        () => update({ q: undefined, status: undefined, program: undefined, from: undefined, to: undefined, kpi: undefined, page: undefined }),
        [update],
    );

    /** Same column again flips the direction; a new column starts ascending. */
    const toggleSort = useCallback(
        (key: ClassSortKey) =>
            update({
                sort: key,
                dir: state.sortKey === key && state.sortDirection === "asc" ? "desc" : undefined,
                page: undefined,
            }),
        [state.sortDirection, state.sortKey, update],
    );

    const setPage = useCallback((page: number) => update({ page: page > 0 ? String(page + 1) : undefined }), [update]);

    const setPageSize = useCallback(
        (size: number) => update({ size: size === DEFAULT_PAGE_SIZE ? undefined : String(size), page: undefined }),
        [update],
    );

    return {
        setKpi: (kpi: ClassKpi) => update({ kpi: kpi === "all" ? undefined : kpi, page: undefined }),
        state,
        /** The raw query string, handed to the detail page so its "Back" link can restore this exact view. */
        queryString: params.toString(),
        setSearch,
        setFilters,
        clearFilters,
        toggleSort,
        setPage,
        setPageSize,
        emptyFilters: EMPTY_CLASS_FILTERS,
    };
}
