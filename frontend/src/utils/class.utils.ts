import type { ExternalClass } from "@/types";
import { parseLocalDateTime } from "@/utils/session.utils";

export type ClassStatusTone = "success" | "info" | "warning" | "danger" | "neutral";

export interface ClassStatusMeta {
    label: string;
    tone: ClassStatusTone;
}

export const CLASS_TONE_CLASSES: Record<ClassStatusTone, string> = {
    success: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    neutral: "bg-muted text-muted-foreground",
};

/** Statuses are free text owned by the master system; the ones below get a friendly label and colour. */
const KNOWN_STATUSES: Array<{ aliases: string[]; meta: ClassStatusMeta }> = [
    { aliases: ["active", "in progress", "inprogress", "ongoing", "training", "running"], meta: { label: "In progress", tone: "success" } },
    { aliases: ["completed", "training completed", "finished", "done"], meta: { label: "Training completed", tone: "info" } },
    { aliases: ["planning", "planned", "draft"], meta: { label: "Planning", tone: "warning" } },
    { aliases: ["assigned"], meta: { label: "Assigned", tone: "info" } },
    { aliases: ["pending close", "pending closure"], meta: { label: "Pending close", tone: "warning" } },
    { aliases: ["cancelled", "canceled", "rejected"], meta: { label: "Cancelled", tone: "danger" } },
];

const normalizeStatus = (raw: string) => raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

const humanize = (raw: string) => {
    const text = normalizeStatus(raw);
    return text.charAt(0).toUpperCase() + text.slice(1);
};

export function getClassStatusMeta(status?: string | null): ClassStatusMeta {
    if (!status || !status.trim()) {
        return { label: "Unknown", tone: "neutral" };
    }

    const normalized = normalizeStatus(status);
    const known = KNOWN_STATUSES.find((entry) => entry.aliases.includes(normalized));

    return known ? known.meta : { label: humanize(status), tone: "neutral" };
}

export function classTitle(item: Pick<ExternalClass, "id" | "code" | "name">): string {
    return item.code || item.name || `Class ${item.id}`;
}

export function programLabel(programId?: number | null): string {
    return programId == null ? "—" : `Program #${programId}`;
}

/* ───────────────────── list: search / filter / sort / paginate ───────────────────── */

export interface ClassFilters {
    search: string;
    status: string;
    programId: string;
    startFrom: string;
    startTo: string;
}

export const EMPTY_CLASS_FILTERS: ClassFilters = { search: "", status: "", programId: "", startFrom: "", startTo: "" };

/** How many filters (not counting the search box) are narrowing the list. */
export function countActiveFilters(filters: ClassFilters): number {
    return [filters.status, filters.programId, filters.startFrom, filters.startTo].filter(Boolean).length;
}

/** "YYYY-MM-DD" of a date-like string, or "" when it cannot be read. */
function isoDay(value?: string): string {
    const date = parseLocalDateTime(value);
    if (!date) return "";

    const pad = (part: number) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function filterClasses(classes: ExternalClass[], filters: ClassFilters): ExternalClass[] {
    const keyword = filters.search.trim().toLowerCase();

    return classes.filter((item) => {
        const statusLabel = getClassStatusMeta(item.status).label;

        if (filters.status && statusLabel !== filters.status) return false;
        if (filters.programId && String(item.programId ?? item.program ?? "") !== filters.programId) return false;

        if (filters.startFrom || filters.startTo) {
            const day = isoDay(item.startDate);
            if (!day) return false;
            if (filters.startFrom && day < filters.startFrom) return false;
            if (filters.startTo && day > filters.startTo) return false;
        }

        if (!keyword) return true;

        return [item.code, item.name, item.id, item.programId, item.program, programLabel(item.programId), item.status, statusLabel].some((value) =>
            String(value ?? "")
                .toLowerCase()
                .includes(keyword),
        );
    });
}

export type ClassSortKey = "code" | "program" | "trainees" | "startDate" | "status";
export type SortDirection = "asc" | "desc";

const sortValue = (item: ExternalClass, key: ClassSortKey): string | number | null => {
    switch (key) {
        case "code":
            return classTitle(item);
        case "program":
            return item.programId ?? item.program ?? null;
        case "trainees":
            return item.plannedSize ?? null;
        case "startDate":
            return parseLocalDateTime(item.startDate)?.getTime() ?? null;
        case "status":
            return getClassStatusMeta(item.status).label;
    }
};

/** Rows without a value for the sorted column always end up last, whatever the direction. */
export function sortClasses(classes: ExternalClass[], key: ClassSortKey, direction: SortDirection): ExternalClass[] {
    const factor = direction === "asc" ? 1 : -1;

    return [...classes].sort((a, b) => {
        const left = sortValue(a, key);
        const right = sortValue(b, key);

        if (left === null && right === null) return a.id - b.id;
        if (left === null) return 1;
        if (right === null) return -1;

        const result =
            typeof left === "number" && typeof right === "number"
                ? left - right
                : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });

        return result !== 0 ? factor * result : a.id - b.id;
    });
}

export interface PageSlice<T> {
    items: T[];
    page: number;
    totalPages: number;
    /** 1-based position of the first/last item shown, 0 when the list is empty. */
    from: number;
    to: number;
}

/** `page` is 0-based and is clamped into range, so a shrinking list never leaves the user on an empty page. */
export function paginate<T>(items: T[], page: number, pageSize: number): PageSlice<T> {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const start = safePage * pageSize;
    const slice = items.slice(start, start + pageSize);

    return {
        items: slice,
        page: safePage,
        totalPages,
        from: slice.length ? start + 1 : 0,
        to: start + slice.length,
    };
}
