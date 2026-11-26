import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULE_CONFIG, type ScheduleConfig, type ScheduleCourse } from "./schedule.config";
import {
    ScheduleDomainError,
    addEntry,
    changeEntryCourse,
    generateSchedule,
    insertEntryAndShift,
    moveEntry,
    recomputeOrder,
    removeEntry,
    reorderCourses,
    validateSchedule,
} from "./scheduleEngine";

const COURSE_A: ScheduleCourse = {
    id: 101,
    code: "COURSE_A",
    name: "Java Core",
    durationHours: 20, // 5 slots
    orderIndex: 1,
};

const COURSE_B: ScheduleCourse = {
    id: 102,
    code: "COURSE_B",
    name: "Spring Boot",
    durationHours: 12, // 3 slots
    orderIndex: 2,
};

const COURSE_C: ScheduleCourse = {
    id: 103,
    code: "COURSE_C",
    name: "React SPA",
    durationHours: 10, // ceil(10/4) = 3 slots
    orderIndex: 3,
};

const PROGRAM = { id: 1, code: "JAVA_TRACK", name: "Java Track" };

describe("scheduleEngine — generateSchedule (Section 3.3)", () => {
    it("matches Section 3.3 exact example: Course A (20h = 5 slots) + Course B (12h = 3 slots) sharing Wednesday", () => {
        // 2026-10-05 is Monday
        const entries = generateSchedule(
            { id: 1, startDate: "2026-10-05" },
            PROGRAM,
            [COURSE_A, COURSE_B],
            DEFAULT_SCHEDULE_CONFIG,
        );

        expect(entries).toHaveLength(8);
        expect(entries.map((e) => [e.date, e.slot, e.courseCode, e.order])).toEqual([
            ["2026-10-05", 1, "COURSE_A", 1], // Mon S1
            ["2026-10-05", 2, "COURSE_A", 2], // Mon S2
            ["2026-10-06", 1, "COURSE_A", 3], // Tue S1
            ["2026-10-06", 2, "COURSE_A", 4], // Tue S2
            ["2026-10-07", 1, "COURSE_A", 5], // Wed S1
            ["2026-10-07", 2, "COURSE_B", 1], // Wed S2 (shares day with Course A!)
            ["2026-10-08", 1, "COURSE_B", 2], // Thu S1
            ["2026-10-08", 2, "COURSE_B", 3], // Thu S2
        ]);
        expect(entries.every((e) => e.isManual === false)).toBe(true);
    });

    it("rounds up odd course hours (10h -> 3 slots), shifts weekend startDate to Monday, and skips holidays", () => {
        const configWithHoliday: ScheduleConfig = {
            ...DEFAULT_SCHEDULE_CONFIG,
            holidays: ["2026-10-05", "2026-10-07"], // Mon Oct 5 and Wed Oct 7 are holidays
        };

        // Start on Saturday 2026-10-03 -> skips Sat/Sun and Monday holiday -> starts Tue 2026-10-06
        const entries = generateSchedule(
            { id: 2, startDate: "2026-10-03" },
            PROGRAM,
            [COURSE_C],
            configWithHoliday,
        );

        expect(entries).toHaveLength(3);
        expect(entries.map((e) => [e.date, e.slot, e.order])).toEqual([
            ["2026-10-06", 1, 1], // Tue S1
            ["2026-10-06", 2, 2], // Tue S2
            ["2026-10-08", 1, 3], // Skips Wed Oct 7 holiday -> Thu S1
        ]);
    });

    it("throws structured errors on empty program, invalid durationHours, or missing startDate", () => {
        expect(() => generateSchedule({ id: 1, startDate: "" }, PROGRAM, [COURSE_A])).toThrowError(
            ScheduleDomainError,
        );
        expect(() => generateSchedule({ id: 1, startDate: "2026-10-05" }, PROGRAM, [])).toThrow(
            /Training program has no courses/,
        );
        expect(() =>
            generateSchedule(
                { id: 1, startDate: "2026-10-05" },
                PROGRAM,
                [{ ...COURSE_A, durationHours: 0 }],
            ),
        ).toThrow(/durationHours/);
    });
});

describe("scheduleEngine — manual editing pure functions (Section 3.4)", () => {
    it("moveEntry moves to empty slot without compacting, marks isManual, and blocks dates before startDate", () => {
        const base = generateSchedule({ id: 1, startDate: "2026-10-05" }, PROGRAM, [COURSE_B]); // 3 slots: Mon S1, Mon S2, Tue S1

        expect(() =>
            moveEntry(base, base[0].id, "2026-10-04", 1, { classStartDate: "2026-10-05" }),
        ).toThrow(/before the class start date/);

        // Move Mon S1 (order 1) -> Fri S2 (2026-10-09, slot 2) without compact
        const moved = moveEntry(base, base[0].id, "2026-10-09", 2, {
            compact: false,
            classStartDate: "2026-10-05",
        });

        expect(moved.swapped).toBe(false);
        expect(moved.entries.map((e) => [e.date, e.slot, e.order, e.isManual])).toEqual([
            ["2026-10-05", 2, 1, false], // Was order 2, automatically recomputed to order 1!
            ["2026-10-06", 1, 2, false],
            ["2026-10-09", 2, 3, true],  // Moved entry is now last -> order 3, isManual = true
        ]);
    });

    it("moveEntry with compact=true compacts trailing sessions into vacated working slots", () => {
        const base = generateSchedule({ id: 1, startDate: "2026-10-05" }, PROGRAM, [COURSE_B]); // Mon S1, Mon S2, Tue S1

        // Move Mon S1 -> Wed S2 with compact=true -> Mon S2 shifts to Mon S1, Tue S1 shifts to Mon S2!
        const res = moveEntry(base, base[0].id, "2026-10-07", 2, {
            compact: true,
            classStartDate: "2026-10-05",
        });

        expect(res.entries.map((e) => [e.date, e.slot, e.order])).toEqual([
            ["2026-10-05", 1, 1],
            ["2026-10-05", 2, 2],
            ["2026-10-07", 2, 3],
        ]);
    });

    it("moveEntry onto an occupied slot swaps the two entries cleanly without duplicate slots", () => {
        const base = generateSchedule({ id: 1, startDate: "2026-10-05" }, PROGRAM, [
            { ...COURSE_A, durationHours: 4 }, // Mon S1
            { ...COURSE_B, durationHours: 4 }, // Mon S2
        ]);

        const res = moveEntry(base, base[0].id, "2026-10-05", 2);
        expect(res.swapped).toBe(true);
        expect(res.swappedWith?.courseId).toBe(COURSE_B.id);
        expect(res.entries.map((e) => [e.date, e.slot, e.courseId, e.isManual])).toEqual([
            ["2026-10-05", 1, COURSE_B.id, true],
            ["2026-10-05", 2, COURSE_A.id, true],
        ]);
    });

    it("addEntry and changeEntryCourse maintain uniqueness and recompute course order", () => {
        const base = generateSchedule({ id: 1, startDate: "2026-10-05" }, PROGRAM, [
            { ...COURSE_A, durationHours: 4 }, // Mon S1
        ]);

        // Duplicate slot rejected
        expect(() => addEntry(base, COURSE_B.id, "2026-10-05", 1)).toThrow(/already occupied/);

        // Add on Saturday (allowed manually!)
        const withSat = addEntry(base, COURSE_A.id, "2026-10-10", 1, {
            classId: 1,
            classStartDate: "2026-10-05",
            courseCode: "COURSE_A",
            courseName: "Java Core",
        });
        expect(withSat).toHaveLength(2);
        expect(withSat[1]).toMatchObject({ date: "2026-10-10", slot: 1, order: 2, isManual: true });

        // Change Saturday entry to COURSE_B -> orders reset to 1 for A and 1 for B
        const changed = changeEntryCourse(withSat, withSat[1].id, COURSE_B.id, {
            code: "COURSE_B",
            name: "Spring Boot",
        });
        expect(changed.map((e) => [e.courseId, e.order, e.isManual])).toEqual([
            [COURSE_A.id, 1, false],
            [COURSE_B.id, 1, true],
        ]);
    });

    it("removeEntry supports both leave-empty (compact=false) and shift-forward across weekends/holidays (compact=true)", () => {
        const config: ScheduleConfig = {
            ...DEFAULT_SCHEDULE_CONFIG,
            holidays: ["2026-10-12"], // Monday Oct 12 is holiday
        };
        // Start Friday 2026-10-09: Fri S1, Fri S2, Tue Oct 13 S1 (skips Sat, Sun, Mon holiday)
        const base = generateSchedule({ id: 1, startDate: "2026-10-09" }, PROGRAM, [COURSE_B], config);
        expect(base.map((e) => [e.date, e.slot])).toEqual([
            ["2026-10-09", 1],
            ["2026-10-09", 2],
            ["2026-10-13", 1],
        ]);

        // Leave empty
        const leftEmpty = removeEntry(base, base[1].id, { compact: false, config });
        expect(leftEmpty.map((e) => [e.date, e.slot, e.order])).toEqual([
            ["2026-10-09", 1, 1],
            ["2026-10-13", 1, 2],
        ]);

        // Compact: removing Fri S2 pulls Tue Oct 13 S1 back across the holiday+weekend into Fri S2!
        const compacted = removeEntry(base, base[1].id, { compact: true, config });
        expect(compacted.map((e) => [e.date, e.slot, e.order])).toEqual([
            ["2026-10-09", 1, 1],
            ["2026-10-09", 2, 2],
        ]);
    });

    it("insertEntryAndShift pushes subsequent sessions forward 1 working slot while skipping weekends and holidays", () => {
        const config: ScheduleConfig = {
            ...DEFAULT_SCHEDULE_CONFIG,
            holidays: ["2026-10-12"], // Monday Oct 12 is holiday
        };
        // Fri Oct 9 S1, Fri Oct 9 S2
        const base = generateSchedule(
            { id: 1, startDate: "2026-10-09" },
            PROGRAM,
            [{ ...COURSE_A, durationHours: 8 }],
            config,
        );

        // Insert BEFORE Fri S2 -> Fri S2 shifts across Sat, Sun, and Mon holiday to Tue Oct 13 S1!
        const shifted = insertEntryAndShift(base, COURSE_B.id, "2026-10-09", 2, config, {
            position: "before",
            classId: 1,
            classStartDate: "2026-10-09",
            courseCode: "COURSE_B",
        });

        expect(shifted.map((e) => [e.date, e.slot, e.courseId, e.order, e.isManual])).toEqual([
            ["2026-10-09", 1, COURSE_A.id, 1, false],
            ["2026-10-09", 2, COURSE_B.id, 1, true],
            ["2026-10-13", 1, COURSE_A.id, 2, false],
        ]);
    });

    it("reorderCourses preserves unaffected leading courses, regenerates from affected index onwards, and flags manual overrides", () => {
        const courses = [
            { ...COURSE_A, durationHours: 8, orderIndex: 1 }, // 2 slots: Mon S1, Mon S2
            { ...COURSE_B, durationHours: 8, orderIndex: 2 }, // 2 slots: Tue S1, Tue S2
            { ...COURSE_C, durationHours: 4, orderIndex: 3 }, // 1 slot:  Wed S1
        ];
        const initial = generateSchedule({ id: 1, startDate: "2026-10-05" }, PROGRAM, courses);
        // Mark one entry in COURSE_C as manual
        const withManual = initial.map((e) => (e.courseId === COURSE_C.id ? { ...e, isManual: true } : e));

        // Swap index 1 (COURSE_B) and index 2 (COURSE_C) -> COURSE_A (index 0) MUST stay untouched!
        const res = reorderCourses(
            withManual,
            [COURSE_A.id, COURSE_B.id, COURSE_C.id],
            2,
            1,
            courses,
            DEFAULT_SCHEDULE_CONFIG,
            { id: 1, startDate: "2026-10-05" },
        );

        expect(res.hadManualOverrides).toBe(true);
        expect(res.courseOrder).toEqual([COURSE_A.id, COURSE_C.id, COURSE_B.id]);
        // COURSE_A ids are untouched, followed by COURSE_C (Tue S1) and COURSE_B (Tue S2, Wed S1)
        expect(res.entries[0].id).toBe(initial[0].id);
        expect(res.entries[1].id).toBe(initial[1].id);
        expect(res.entries.slice(2).map((e) => [e.date, e.slot, e.courseId, e.order])).toEqual([
            ["2026-10-06", 1, COURSE_C.id, 1],
            ["2026-10-06", 2, COURSE_B.id, 1],
            ["2026-10-07", 1, COURSE_B.id, 2],
        ]);
    });

    it("recomputeOrder sorts chronologically and numbers 1..n per course independently", () => {
        const unordered = recomputeOrder([
            { id: "2", classId: 1, courseId: 101, date: "2026-10-06", slot: 1, startTime: "08:00", endTime: "12:00", order: 99, isManual: true },
            { id: "1", classId: 1, courseId: 101, date: "2026-10-05", slot: 2, startTime: "13:00", endTime: "17:00", order: 88, isManual: true },
            { id: "3", classId: 1, courseId: 102, date: "2026-10-05", slot: 1, startTime: "08:00", endTime: "12:00", order: 77, isManual: true },
        ]);

        expect(unordered.map((e) => [e.id, e.order])).toEqual([
            ["3", 1],
            ["1", 1],
            ["2", 2],
        ]);
    });

    it("validateSchedule detects slot count mismatch, weekend/holiday placement, course order violation, and schedule gaps", () => {
        const courses = [
            { ...COURSE_A, durationHours: 8, orderIndex: 1 }, // needs 2 slots
            { ...COURSE_B, durationHours: 4, orderIndex: 2 }, // needs 1 slot
        ];

        // Place COURSE_B on Mon S1, leave Mon S2 empty (gap!), place only 1 slot of COURSE_A on Saturday Oct 10 S1!
        const entries = recomputeOrder([
            { id: "b1", classId: 1, courseId: COURSE_B.id, courseCode: "COURSE_B", date: "2026-10-05", slot: 1, startTime: "08:00", endTime: "12:00", order: 1, isManual: true },
            { id: "a1", classId: 1, courseId: COURSE_A.id, courseCode: "COURSE_A", date: "2026-10-10", slot: 1, startTime: "08:00", endTime: "12:00", order: 1, isManual: true },
        ]);

        const issues = validateSchedule(
            entries,
            { id: 1, startDate: "2026-10-05", endDate: "2026-10-30" },
            PROGRAM,
            courses,
            DEFAULT_SCHEDULE_CONFIG,
        );

        const types = new Set(issues.map((i) => i.type));
        expect(types.has("NON_WORKING_DAY")).toBe(true);
        expect(types.has("SLOT_COUNT_MISMATCH")).toBe(true);
        expect(types.has("COURSE_ORDER_VIOLATION")).toBe(true);
        expect(types.has("SCHEDULE_GAP")).toBe(true);
    });
});
