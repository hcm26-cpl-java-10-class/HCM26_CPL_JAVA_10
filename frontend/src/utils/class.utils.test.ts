import { describe, expect, it } from "vitest";
import type { ExternalClass } from "@/types";
import {
    classTitle,
    countActiveFilters,
    EMPTY_CLASS_FILTERS,
    filterClasses,
    getClassStatusMeta,
    paginate,
    programLabel,
    sortClasses,
} from "./class.utils";

const make = (id: number, extra: Partial<ExternalClass> = {}): ExternalClass => ({ id, code: `C${id}`, ...extra });

describe("getClassStatusMeta", () => {
    it.each([
        ["active", "In progress", "success"],
        ["ACTIVE", "In progress", "success"],
        ["in_progress", "In progress", "success"],
        ["completed", "Training completed", "info"],
        ["Training completed", "Training completed", "info"],
        ["planning", "Planning", "warning"],
        ["assigned", "Assigned", "info"],
        ["pending_close", "Pending close", "warning"],
        ["pending close", "Pending close", "warning"],
        ["cancelled", "Cancelled", "danger"],
    ])("maps %s to %s", (status, label, tone) => {
        expect(getClassStatusMeta(status)).toEqual({ label, tone });
    });

    it("shows a status the master system invented in a neutral badge instead of hiding it", () => {
        expect(getClassStatusMeta("on_hold")).toEqual({ label: "On hold", tone: "neutral" });
    });

    it("copes with a missing status", () => {
        expect(getClassStatusMeta(undefined)).toEqual({ label: "Unknown", tone: "neutral" });
        expect(getClassStatusMeta("   ")).toEqual({ label: "Unknown", tone: "neutral" });
    });
});

describe("labels", () => {
    it("titles a class by code, then name, then id", () => {
        expect(classTitle({ id: 1, code: "FSJ_01", name: "Batch" })).toBe("FSJ_01");
        expect(classTitle({ id: 1, name: "Batch" })).toBe("Batch");
        expect(classTitle({ id: 7 })).toBe("Class 7");
    });

    it("labels the program id, or a dash when unknown", () => {
        expect(programLabel(3)).toBe("Program #3");
        expect(programLabel(null)).toBe("—");
        expect(programLabel(undefined)).toBe("—");
    });
});

describe("filterClasses", () => {
    const classes = [
        make(1, { name: "Java Batch", programId: 1, status: "active", startDate: "2026-01-10" }),
        make(2, { name: "React Batch", programId: 2, status: "completed", startDate: "2026-03-05" }),
        make(3, { name: "Spring Batch", programId: 2, status: "planning" }),
    ];

    it("returns everything when nothing is set", () => {
        expect(filterClasses(classes, EMPTY_CLASS_FILTERS)).toHaveLength(3);
    });

    it("searches code, name, program label and status text, ignoring case", () => {
        expect(filterClasses(classes, { ...EMPTY_CLASS_FILTERS, search: "c2" }).map((c) => c.id)).toEqual([2]);
        expect(filterClasses(classes, { ...EMPTY_CLASS_FILTERS, search: "REACT" }).map((c) => c.id)).toEqual([2]);
        expect(filterClasses(classes, { ...EMPTY_CLASS_FILTERS, search: "program #2" }).map((c) => c.id)).toEqual([2, 3]);
        expect(filterClasses(classes, { ...EMPTY_CLASS_FILTERS, search: "training completed" }).map((c) => c.id)).toEqual([2]);
        expect(filterClasses(classes, { ...EMPTY_CLASS_FILTERS, search: "  " })).toHaveLength(3);
    });

    it("filters by the displayed status label and by program", () => {
        expect(filterClasses(classes, { ...EMPTY_CLASS_FILTERS, status: "In progress" }).map((c) => c.id)).toEqual([1]);
        expect(filterClasses(classes, { ...EMPTY_CLASS_FILTERS, programId: "2" }).map((c) => c.id)).toEqual([2, 3]);
    });

    it("filters by start date inclusively and drops classes without a start date once a date filter is active", () => {
        const from = filterClasses(classes, { ...EMPTY_CLASS_FILTERS, startFrom: "2026-03-05" });
        expect(from.map((c) => c.id)).toEqual([2]);

        const range = filterClasses(classes, { ...EMPTY_CLASS_FILTERS, startFrom: "2026-01-10", startTo: "2026-03-05" });
        expect(range.map((c) => c.id)).toEqual([1, 2]);

        const upTo = filterClasses(classes, { ...EMPTY_CLASS_FILTERS, startTo: "2026-01-09" });
        expect(upTo).toEqual([]);
    });

    it("combines criteria with AND", () => {
        const result = filterClasses(classes, { ...EMPTY_CLASS_FILTERS, programId: "2", status: "Planning", search: "spring" });
        expect(result.map((c) => c.id)).toEqual([3]);
    });
});

describe("countActiveFilters", () => {
    it("counts the filters but not the search box", () => {
        expect(countActiveFilters(EMPTY_CLASS_FILTERS)).toBe(0);
        expect(countActiveFilters({ ...EMPTY_CLASS_FILTERS, search: "abc" })).toBe(0);
        expect(countActiveFilters({ search: "x", status: "Planning", programId: "2", startFrom: "2026-01-01", startTo: "" })).toBe(3);
    });
});

describe("sortClasses", () => {
    it("sorts codes naturally (C2 before C10) in both directions without mutating the input", () => {
        const input = [make(10), make(2), make(1)];
        const copy = [...input];

        expect(sortClasses(input, "code", "asc").map((c) => c.code)).toEqual(["C1", "C2", "C10"]);
        expect(sortClasses(input, "code", "desc").map((c) => c.code)).toEqual(["C10", "C2", "C1"]);
        expect(input).toEqual(copy);
    });

    it("puts rows without a value last whichever way the column is sorted", () => {
        const input = [make(1, { plannedSize: 30 }), make(2), make(3, { plannedSize: 10 })];

        expect(sortClasses(input, "trainees", "asc").map((c) => c.id)).toEqual([3, 1, 2]);
        expect(sortClasses(input, "trainees", "desc").map((c) => c.id)).toEqual([1, 3, 2]);
    });

    it("sorts dates chronologically and statuses by their label", () => {
        const input = [
            make(1, { startDate: "2026-12-01", status: "completed" }),
            make(2, { startDate: "2026-02-01", status: "active" }),
            make(3, { startDate: "2026-07-01", status: "planning" }),
        ];

        expect(sortClasses(input, "startDate", "asc").map((c) => c.id)).toEqual([2, 3, 1]);
        expect(sortClasses(input, "status", "asc").map((c) => c.id)).toEqual([2, 3, 1]); // In progress, Planning, Training completed
    });

    it("keeps a stable order for equal values (by id)", () => {
        const input = [make(3, { programId: 1 }), make(1, { programId: 1 }), make(2, { programId: 1 })];
        expect(sortClasses(input, "program", "asc").map((c) => c.id)).toEqual([1, 2, 3]);
    });
});

describe("paginate", () => {
    const items = Array.from({ length: 23 }, (_, index) => index + 1);

    it("slices pages and reports the visible range", () => {
        expect(paginate(items, 0, 10)).toMatchObject({ items: items.slice(0, 10), page: 0, totalPages: 3, from: 1, to: 10 });
        expect(paginate(items, 2, 10)).toMatchObject({ items: [21, 22, 23], page: 2, totalPages: 3, from: 21, to: 23 });
    });

    it("clamps an out-of-range page, e.g. after the list shrank", () => {
        expect(paginate(items, 9, 10).page).toBe(2);
        expect(paginate(items, -4, 10).page).toBe(0);
    });

    it("handles an empty list", () => {
        expect(paginate([], 0, 10)).toEqual({ items: [], page: 0, totalPages: 1, from: 0, to: 0 });
    });
});
