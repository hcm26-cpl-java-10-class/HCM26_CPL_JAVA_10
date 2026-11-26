import {
    DEFAULT_SCHEDULE_CONFIG,
    type ScheduleClassInfo,
    type ScheduleConfig,
    type ScheduleCourse,
    type ScheduleEntry,
    type ScheduleProgram,
    type ScheduleValidationIssue,
    type SlotDefinition,
    type SlotNumber,
} from "./schedule.config";

export class ScheduleDomainError extends Error {
    code: string;
    courseId?: number;

    constructor(code: string, message: string, courseId?: number) {
        super(message);
        this.name = "ScheduleDomainError";
        this.code = code;
        this.courseId = courseId;
    }
}

// ======================== PURE DATE & SLOT HELPERS ========================

export function isValidIsoDate(value?: string | null): value is string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
        !Number.isNaN(dt.getTime()) &&
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
    );
}

export function addDaysIso(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

/** Returns ISO weekday: 1 = Monday ... 6 = Saturday, 7 = Sunday. */
export function getIsoWeekday(dateStr: string): number {
    const [y, m, d] = dateStr.split("-").map(Number);
    const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun .. 6 = Sat
    return jsDay === 0 ? 7 : jsDay;
}

export function getMondayOfIsoDate(dateStr: string): string {
    const isoDay = getIsoWeekday(dateStr);
    return addDaysIso(dateStr, -(isoDay - 1));
}

export function isWorkingDay(dateStr: string, config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG): boolean {
    const isoDay = getIsoWeekday(dateStr);
    const workingDays = config.workingDays?.length ? config.workingDays : [1, 2, 3, 4, 5];
    if (!workingDays.includes(isoDay)) return false;
    if (config.holidays?.includes(dateStr)) return false;
    return true;
}

export function nextWorkingDay(fromDate: string, config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG): string {
    let cursor = fromDate;
    for (let guard = 0; guard < 400; guard++) {
        if (isWorkingDay(cursor, config)) return cursor;
        cursor = addDaysIso(cursor, 1);
    }
    throw new ScheduleDomainError(
        "NO_WORKING_DAY",
        "No valid working day found in the schedule configuration (check working days / holidays).",
    );
}

export function getSlotDef(slot: SlotNumber, config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG): SlotDefinition {
    const found = config.slots.find((s) => s.slot === slot);
    if (found) return found;
    return slot === 1
        ? { slot: 1, start: "08:00", end: "12:00" }
        : { slot: 2, start: "13:00", end: "17:00" };
}

export function compareDateSlot(a: { date: string; slot: number }, b: { date: string; slot: number }): number {
    return a.date.localeCompare(b.date) || a.slot - b.slot;
}

export function slotKey(date: string, slot: number): string {
    return `${date}#${slot}`;
}

export function nextWorkingSlot(
    date: string,
    slot: SlotNumber,
    config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG,
    inclusive = false,
): { date: string; slot: SlotNumber } {
    const sortedSlots = [...config.slots].sort((a, b) => a.slot - b.slot);
    let curDate = date;
    let curSlotIdx = sortedSlots.findIndex((s) => s.slot === slot);
    if (curSlotIdx < 0) curSlotIdx = 0;

    if (inclusive && isWorkingDay(curDate, config)) {
        return { date: curDate, slot: sortedSlots[curSlotIdx].slot };
    }

    if (!isWorkingDay(curDate, config)) {
        const validDay = nextWorkingDay(inclusive ? curDate : addDaysIso(curDate, 1), config);
        return { date: validDay, slot: sortedSlots[0].slot };
    }

    if (curSlotIdx + 1 < sortedSlots.length) {
        return { date: curDate, slot: sortedSlots[curSlotIdx + 1].slot };
    }

    const nextDay = nextWorkingDay(addDaysIso(curDate, 1), config);
    return { date: nextDay, slot: sortedSlots[0].slot };
}

export function calculateSlotsNeeded(durationHours: number, slotHours = 4): number {
    return Math.ceil(durationHours / Math.max(1, slotHours));
}

function makeEntryId(prefix: string, classId: number, courseId: number, date: string, slot: number): string {
    const rand = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${classId}-${courseId}-${date}-s${slot}-${rand}`;
}

// ======================== CORE PURE ENGINE FUNCTIONS ========================

/**
 * Recomputes `order` (1..n) chronologically within each course without mutating the input array.
 */
export function recomputeOrder(entries: readonly ScheduleEntry[]): ScheduleEntry[] {
    const sorted = [...entries].sort(compareDateSlot);
    const counters = new Map<number, number>();
    return sorted.map((entry) => {
        const nextOrder = (counters.get(entry.courseId) ?? 0) + 1;
        counters.set(entry.courseId, nextOrder);
        return {
            ...entry,
            order: nextOrder,
        };
    });
}

/**
 * Pure schedule generator following Section 3.3:
 * - Slots needed per course = ceil(durationHours / config.slotHours)
 * - Starts at class.startDate (advancing to next working day if weekend/holiday)
 * - Sequentially fills Slot 1 -> Slot 2 -> next working day; courses can share the same day.
 */
export function generateSchedule(
    cls: Pick<ScheduleClassInfo, "id" | "startDate">,
    _program: Pick<ScheduleProgram, "id" | "code" | "name"> | null | undefined,
    courses: readonly ScheduleCourse[],
    config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG,
): ScheduleEntry[] {
    if (!cls?.startDate || !isValidIsoDate(cls.startDate)) {
        throw new ScheduleDomainError(
            "MISSING_START_DATE",
            "Class is missing a start date (startDate). Please set it before generating.",
        );
    }
    if (!courses || courses.length === 0) {
        throw new ScheduleDomainError("EMPTY_PROGRAM", "Training program has no courses.");
    }

    for (const course of courses) {
        if (course.durationHours === undefined || course.durationHours === null || course.durationHours <= 0) {
            throw new ScheduleDomainError(
                "INVALID_DURATION",
                `Course "${course.code || course.name || `#${course.id}`}" is missing durationHours or <= 0.`,
                course.id,
            );
        }
    }

    const sortedSlots = [...config.slots].sort((a, b) => a.slot - b.slot);
    if (sortedSlots.length === 0 || config.slotHours <= 0) {
        throw new ScheduleDomainError("INVALID_CONFIG", "Invalid schedule slot configuration (ScheduleConfig).");
    }

    const orderedCourses = [...courses].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    const entries: ScheduleEntry[] = [];

    let currentDate = nextWorkingDay(cls.startDate, config);
    let slotIdx = 0;

    for (const course of orderedCourses) {
        const slotsNeeded = calculateSlotsNeeded(course.durationHours, config.slotHours);
        for (let order = 1; order <= slotsNeeded; order++) {
            const slotDef = sortedSlots[slotIdx];
            entries.push({
                id: `gen-${cls.id}-${course.id}-${currentDate}-s${slotDef.slot}`,
                classId: cls.id,
                courseId: course.id,
                courseCode: course.code,
                courseName: course.name,
                date: currentDate,
                slot: slotDef.slot,
                startTime: slotDef.start,
                endTime: slotDef.end,
                order,
                isManual: false,
            });

            slotIdx += 1;
            if (slotIdx >= sortedSlots.length) {
                slotIdx = 0;
                currentDate = nextWorkingDay(addDaysIso(currentDate, 1), config);
            }
        }
    }

    return entries;
}

export interface MoveEntryOptions {
    compact?: boolean;
    classStartDate?: string;
    config?: ScheduleConfig;
}

export interface MoveEntryResult {
    entries: ScheduleEntry[];
    swapped: boolean;
    swappedWith?: ScheduleEntry;
}

/**
 * Moves an entry to `(targetDate, targetSlot)`:
 * - Blocks moving before `classStartDate`.
 * - If `(targetDate, targetSlot)` is occupied -> swaps the two entries (`swapped: true`).
 * - If `(targetDate, targetSlot)` is empty:
 *   - `compact: false` (default): moves only this entry.
 *   - `compact: true`: compacts entries that were after the vacated slot forward across working slots.
 */
export function moveEntry(
    entries: readonly ScheduleEntry[],
    entryId: string,
    targetDate: string,
    targetSlot: SlotNumber,
    options: MoveEntryOptions = {},
): MoveEntryResult {
    const config = options.config ?? DEFAULT_SCHEDULE_CONFIG;
    if (!isValidIsoDate(targetDate)) {
        throw new ScheduleDomainError("INVALID_DATE", "Invalid target date.");
    }
    if (options.classStartDate && isValidIsoDate(options.classStartDate) && targetDate < options.classStartDate) {
        throw new ScheduleDomainError(
            "BEFORE_START_DATE",
            `Cannot schedule a session before the class start date (${options.classStartDate}).`,
        );
    }

    const source = entries.find((e) => e.id === entryId);
    if (!source) {
        throw new ScheduleDomainError("NOT_FOUND", "Session to move was not found.");
    }

    if (source.date === targetDate && source.slot === targetSlot) {
        return { entries: recomputeOrder(entries), swapped: false };
    }

    const targetDef = getSlotDef(targetSlot, config);
    const occupant = entries.find((e) => e.id !== entryId && e.date === targetDate && e.slot === targetSlot);

    if (occupant) {
        const sourceDef = getSlotDef(source.slot, config);
        const swappedEntries = entries.map((e) => {
            if (e.id === source.id) {
                return {
                    ...e,
                    date: targetDate,
                    slot: targetSlot,
                    startTime: targetDef.start,
                    endTime: targetDef.end,
                    isManual: true,
                };
            }
            if (e.id === occupant.id) {
                return {
                    ...e,
                    date: source.date,
                    slot: source.slot,
                    startTime: sourceDef.start,
                    endTime: sourceDef.end,
                    isManual: true,
                };
            }
            return { ...e };
        });
        return {
            entries: recomputeOrder(swappedEntries),
            swapped: true,
            swappedWith: occupant,
        };
    }

    const movedSource: ScheduleEntry = {
        ...source,
        date: targetDate,
        slot: targetSlot,
        startTime: targetDef.start,
        endTime: targetDef.end,
        isManual: true,
    };

    if (!options.compact) {
        const updated = entries.map((e) => (e.id === source.id ? movedSource : { ...e }));
        return { entries: recomputeOrder(updated), swapped: false };
    }

    // Compact trailing entries into the vacated slot stream while preserving fixed earlier entries & movedSource
    const remaining = entries.filter((e) => e.id !== source.id).sort(compareDateSlot);
    const fixedBefore = remaining.filter((e) => compareDateSlot(e, source) < 0);
    const trailingAfter = remaining.filter((e) => compareDateSlot(e, source) > 0);

    const occupied = new Set<string>([
        slotKey(movedSource.date, movedSource.slot),
        ...fixedBefore.map((e) => slotKey(e.date, e.slot)),
    ]);

    let cursor = nextWorkingSlot(source.date, source.slot, config, true);
    const compactedTrailing: ScheduleEntry[] = [];

    for (const item of trailingAfter) {
        while (occupied.has(slotKey(cursor.date, cursor.slot))) {
            cursor = nextWorkingSlot(cursor.date, cursor.slot, config, false);
        }
        const def = getSlotDef(cursor.slot, config);
        occupied.add(slotKey(cursor.date, cursor.slot));
        compactedTrailing.push({
            ...item,
            date: cursor.date,
            slot: cursor.slot,
            startTime: def.start,
            endTime: def.end,
        });
        cursor = nextWorkingSlot(cursor.date, cursor.slot, config, false);
    }

    return {
        entries: recomputeOrder([...fixedBefore, movedSource, ...compactedTrailing]),
        swapped: false,
    };
}

export interface AddEntryOptions {
    classId?: number;
    classStartDate?: string;
    courseCode?: string;
    courseName?: string;
    note?: string;
    config?: ScheduleConfig;
}

/**
 * Adds a manual entry into an empty `(date, slot)` cell.
 */
export function addEntry(
    entries: readonly ScheduleEntry[],
    courseId: number,
    date: string,
    slot: SlotNumber,
    options: AddEntryOptions = {},
): ScheduleEntry[] {
    const config = options.config ?? DEFAULT_SCHEDULE_CONFIG;
    if (!isValidIsoDate(date)) {
        throw new ScheduleDomainError("INVALID_DATE", "Invalid session date.");
    }
    if (options.classStartDate && isValidIsoDate(options.classStartDate) && date < options.classStartDate) {
        throw new ScheduleDomainError(
            "BEFORE_START_DATE",
            `Cannot schedule a session before the class start date (${options.classStartDate}).`,
        );
    }
    if (entries.some((e) => e.date === date && e.slot === slot)) {
        throw new ScheduleDomainError("DUPLICATE_SLOT", `Slot ${slot} on ${date} is already occupied.`);
    }

    const classId = options.classId ?? entries[0]?.classId ?? 0;
    const slotDef = getSlotDef(slot, config);
    const newEntry: ScheduleEntry = {
        id: makeEntryId("manual", classId, courseId, date, slot),
        classId,
        courseId,
        courseCode: options.courseCode,
        courseName: options.courseName,
        date,
        slot,
        startTime: slotDef.start,
        endTime: slotDef.end,
        order: 1,
        isManual: true,
        note: options.note,
    };

    return recomputeOrder([...entries, newEntry]);
}

/**
 * Changes the assigned `courseId` of an existing entry and marks it `isManual = true`.
 */
export function changeEntryCourse(
    entries: readonly ScheduleEntry[],
    entryId: string,
    courseId: number,
    courseMeta?: { code?: string; name?: string },
): ScheduleEntry[] {
    let found = false;
    const next = entries.map((e) => {
        if (e.id !== entryId) return { ...e };
        found = true;
        return {
            ...e,
            courseId,
            courseCode: courseMeta?.code ?? e.courseCode,
            courseName: courseMeta?.name ?? e.courseName,
            isManual: true,
        };
    });
    if (!found) {
        throw new ScheduleDomainError("NOT_FOUND", "Session to change course was not found.");
    }
    return recomputeOrder(next);
}

export interface RemoveEntryOptions {
    compact?: boolean;
    config?: ScheduleConfig;
}

/**
 * Removes an entry:
 * - `compact: false` ("Delete & Leave Empty"): leaves the slot vacant.
 * - `compact: true` ("Delete & Shift Up"): shifts subsequent entries forward across working slots.
 */
export function removeEntry(
    entries: readonly ScheduleEntry[],
    entryId: string,
    options: RemoveEntryOptions = {},
): ScheduleEntry[] {
    const config = options.config ?? DEFAULT_SCHEDULE_CONFIG;
    const target = entries.find((e) => e.id === entryId);
    if (!target) {
        return recomputeOrder(entries);
    }

    const remaining = entries.filter((e) => e.id !== entryId).sort(compareDateSlot);
    if (!options.compact) {
        return recomputeOrder(remaining);
    }

    const fixedBefore = remaining.filter((e) => compareDateSlot(e, target) < 0);
    const trailingAfter = remaining.filter((e) => compareDateSlot(e, target) > 0);
    const occupied = new Set<string>(fixedBefore.map((e) => slotKey(e.date, e.slot)));

    let cursor = nextWorkingSlot(target.date, target.slot, config, true);
    const compacted: ScheduleEntry[] = [];

    for (const item of trailingAfter) {
        while (occupied.has(slotKey(cursor.date, cursor.slot))) {
            cursor = nextWorkingSlot(cursor.date, cursor.slot, config, false);
        }
        const def = getSlotDef(cursor.slot, config);
        occupied.add(slotKey(cursor.date, cursor.slot));
        compacted.push({
            ...item,
            date: cursor.date,
            slot: cursor.slot,
            startTime: def.start,
            endTime: def.end,
        });
        cursor = nextWorkingSlot(cursor.date, cursor.slot, config, false);
    }

    return recomputeOrder([...fixedBefore, ...compacted]);
}

export interface InsertAndShiftOptions {
    position?: "before" | "after";
    classId?: number;
    classStartDate?: string;
    courseCode?: string;
    courseName?: string;
    note?: string;
}

/**
 * Inserts a new entry ("before" = right at `(date, slot)`, "after" = next working slot after `(date, slot)`)
 * and pushes all entries at/after the insertion slot forward by 1 valid working slot (skipping weekends/holidays).
 */
export function insertEntryAndShift(
    entries: readonly ScheduleEntry[],
    courseId: number,
    date: string,
    slot: SlotNumber,
    config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG,
    options: InsertAndShiftOptions = {},
): ScheduleEntry[] {
    if (!isValidIsoDate(date)) {
        throw new ScheduleDomainError("INVALID_DATE", "Invalid insertion date.");
    }

    const position = options.position ?? "before";
    const insertionPoint =
        position === "after"
            ? nextWorkingSlot(date, slot, config, false)
            : { date, slot };

    if (
        options.classStartDate &&
        isValidIsoDate(options.classStartDate) &&
        insertionPoint.date < options.classStartDate
    ) {
        throw new ScheduleDomainError(
            "BEFORE_START_DATE",
            `Cannot insert a session before the class start date (${options.classStartDate}).`,
        );
    }

    const sorted = [...entries].sort(compareDateSlot);
    const beforeEntries = sorted.filter((e) => compareDateSlot(e, insertionPoint) < 0);
    const atOrAfterEntries = sorted.filter((e) => compareDateSlot(e, insertionPoint) >= 0);

    const classId = options.classId ?? entries[0]?.classId ?? 0;
    const insertDef = getSlotDef(insertionPoint.slot, config);
    const insertedEntry: ScheduleEntry = {
        id: makeEntryId("insert", classId, courseId, insertionPoint.date, insertionPoint.slot),
        classId,
        courseId,
        courseCode: options.courseCode,
        courseName: options.courseName,
        date: insertionPoint.date,
        slot: insertionPoint.slot,
        startTime: insertDef.start,
        endTime: insertDef.end,
        order: 1,
        isManual: true,
        note: options.note,
    };

    const occupied = new Set<string>([
        ...beforeEntries.map((e) => slotKey(e.date, e.slot)),
        slotKey(insertedEntry.date, insertedEntry.slot),
    ]);

    const shiftedEntries: ScheduleEntry[] = [];
    let minCursor = nextWorkingSlot(insertionPoint.date, insertionPoint.slot, config, false);

    for (const item of atOrAfterEntries) {
        // Push each subsequent entry forward by 1 working slot from its current slot (or past minCursor if collided)
        let nextSlot = nextWorkingSlot(item.date, item.slot, config, false);
        if (compareDateSlot(nextSlot, minCursor) < 0) {
            nextSlot = minCursor;
        }
        while (occupied.has(slotKey(nextSlot.date, nextSlot.slot))) {
            nextSlot = nextWorkingSlot(nextSlot.date, nextSlot.slot, config, false);
        }
        const def = getSlotDef(nextSlot.slot, config);
        occupied.add(slotKey(nextSlot.date, nextSlot.slot));
        shiftedEntries.push({
            ...item,
            date: nextSlot.date,
            slot: nextSlot.slot,
            startTime: def.start,
            endTime: def.end,
        });
        minCursor = nextWorkingSlot(nextSlot.date, nextSlot.slot, config, false);
    }

    return recomputeOrder([...beforeEntries, insertedEntry, ...shiftedEntries]);
}

export interface ReorderCoursesResult {
    entries: ScheduleEntry[];
    courseOrder: number[];
    hadManualOverrides: boolean;
}

/**
 * Reorders `courseOrder` by moving `fromIndex` -> `toIndex`, keeping all courses strictly before
 * `min(fromIndex, toIndex)` untouched, and regenerating courses from `min(fromIndex, toIndex)` onwards.
 */
export function reorderCourses(
    entries: readonly ScheduleEntry[],
    courseOrder: readonly number[],
    fromIndex: number,
    toIndex: number,
    courses: readonly ScheduleCourse[],
    config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG,
    classInfo?: Pick<ScheduleClassInfo, "id" | "startDate">,
): ReorderCoursesResult {
    if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= courseOrder.length ||
        toIndex >= courseOrder.length ||
        fromIndex === toIndex
    ) {
        return {
            entries: recomputeOrder(entries),
            courseOrder: [...courseOrder],
            hadManualOverrides: false,
        };
    }

    const nextCourseOrder = [...courseOrder];
    const [movedId] = nextCourseOrder.splice(fromIndex, 1);
    nextCourseOrder.splice(toIndex, 0, movedId);

    const affectedStartIdx = Math.min(fromIndex, toIndex);
    const untouchedIds = new Set(nextCourseOrder.slice(0, affectedStartIdx));
    const affectedIds = nextCourseOrder.slice(affectedStartIdx);

    const keptEntries = entries
        .filter((e) => untouchedIds.has(e.courseId))
        .map((e) => ({ ...e }))
        .sort(compareDateSlot);

    const hadManualOverrides = entries.some((e) => !untouchedIds.has(e.courseId) && e.isManual);
    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const classId = classInfo?.id ?? entries[0]?.classId ?? 0;

    let startCursor: { date: string; slot: SlotNumber };
    if (keptEntries.length > 0) {
        const lastKept = keptEntries[keptEntries.length - 1];
        startCursor = nextWorkingSlot(lastKept.date, lastKept.slot, config, false);
    } else {
        const fallbackStart =
            classInfo?.startDate && isValidIsoDate(classInfo.startDate)
                ? classInfo.startDate
                : [...entries].sort(compareDateSlot)[0]?.date;
        if (!fallbackStart) {
            return {
                entries: recomputeOrder(keptEntries),
                courseOrder: nextCourseOrder,
                hadManualOverrides,
            };
        }
        startCursor = nextWorkingSlot(fallbackStart, 1, config, true);
    }

    const occupied = new Set(keptEntries.map((e) => slotKey(e.date, e.slot)));
    const regenerated: ScheduleEntry[] = [];
    let cursor = startCursor;

    for (const cId of affectedIds) {
        const course = courseMap.get(cId);
        if (!course || !course.durationHours || course.durationHours <= 0) continue;
        const slotsNeeded = calculateSlotsNeeded(course.durationHours, config.slotHours);
        for (let order = 1; order <= slotsNeeded; order++) {
            while (occupied.has(slotKey(cursor.date, cursor.slot))) {
                cursor = nextWorkingSlot(cursor.date, cursor.slot, config, false);
            }
            const def = getSlotDef(cursor.slot, config);
            occupied.add(slotKey(cursor.date, cursor.slot));
            regenerated.push({
                id: `regen-${classId}-${course.id}-${cursor.date}-s${cursor.slot}`,
                classId,
                courseId: course.id,
                courseCode: course.code,
                courseName: course.name,
                date: cursor.date,
                slot: cursor.slot,
                startTime: def.start,
                endTime: def.end,
                order,
                isManual: false,
            });
            cursor = nextWorkingSlot(cursor.date, cursor.slot, config, false);
        }
    }

    return {
        entries: recomputeOrder([...keptEntries, ...regenerated]),
        courseOrder: nextCourseOrder,
        hadManualOverrides,
    };
}

/**
 * Checks whether any manual entries in courses at/after `min(fromIndex, toIndex)` would be overwritten by `reorderCourses`.
 */
export function hasManualEntriesInReorderRange(
    entries: readonly ScheduleEntry[],
    courseOrder: readonly number[],
    fromIndex: number,
    toIndex: number,
): boolean {
    if (fromIndex === toIndex) return false;
    const affectedStartIdx = Math.min(fromIndex, toIndex);
    const untouchedIds = new Set(courseOrder.slice(0, affectedStartIdx));
    return entries.some((e) => !untouchedIds.has(e.courseId) && e.isManual);
}

/**
 * Realtime validation returning structured warnings/errors (non-blocking for warnings/info, blocking for errors).
 */
export function validateSchedule(
    entries: readonly ScheduleEntry[],
    cls: Pick<ScheduleClassInfo, "id" | "startDate" | "endDate"> | null | undefined,
    _program: Pick<ScheduleProgram, "id" | "code" | "name"> | null | undefined,
    courses: readonly ScheduleCourse[],
    config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG,
    customCourseOrder?: readonly number[],
): ScheduleValidationIssue[] {
    const issues: ScheduleValidationIssue[] = [];
    const sorted = [...entries].sort(compareDateSlot);
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    // 1. Duplicate (date, slot) check & before startDate check & non-working day check
    const seenSlots = new Map<string, ScheduleEntry>();
    for (const entry of sorted) {
        const key = slotKey(entry.date, entry.slot);
        if (seenSlots.has(key)) {
            issues.push({
                id: `dup-${entry.id}`,
                type: "DUPLICATE_SLOT",
                severity: "error",
                entryId: entry.id,
                courseId: entry.courseId,
                date: entry.date,
                slot: entry.slot,
                message: `Duplicate session on ${entry.date} Slot ${entry.slot}.`,
            });
        } else {
            seenSlots.set(key, entry);
        }

        if (cls?.startDate && isValidIsoDate(cls.startDate) && entry.date < cls.startDate) {
            issues.push({
                id: `before-start-${entry.id}`,
                type: "BEFORE_START_DATE",
                severity: "error",
                entryId: entry.id,
                courseId: entry.courseId,
                date: entry.date,
                slot: entry.slot,
                message: `Session on ${entry.date} (Slot ${entry.slot}) is before the class start date (${cls.startDate}).`,
            });
        }

        if (!isWorkingDay(entry.date, config)) {
            const isHoliday = config.holidays?.includes(entry.date);
            const isoDay = getIsoWeekday(entry.date);
            const dayName = isoDay === 6 ? "Saturday" : isoDay === 7 ? "Sunday" : "non-working day";
            const cLabel = courseMap.get(entry.courseId)?.code ?? entry.courseCode ?? `#${entry.courseId}`;
            issues.push({
                id: `non-working-${entry.id}`,
                type: "NON_WORKING_DAY",
                severity: "warning",
                entryId: entry.id,
                courseId: entry.courseId,
                date: entry.date,
                slot: entry.slot,
                message: isHoliday
                    ? `Session ${cLabel} (${entry.date} · Slot ${entry.slot}) falls on a holiday.`
                    : `Session ${cLabel} (${entry.date} · Slot ${entry.slot}) falls on a weekend (${dayName}).`,
            });
        }
    }

    // 2. Slot count mismatch per course (under-scheduled or over-scheduled)
    const entriesByCourse = new Map<number, ScheduleEntry[]>();
    for (const entry of sorted) {
        const list = entriesByCourse.get(entry.courseId) ?? [];
        list.push(entry);
        entriesByCourse.set(entry.courseId, list);
    }

    const orderedCourses = customCourseOrder?.length
        ? customCourseOrder.map((id) => courseMap.get(id)).filter((c): c is ScheduleCourse => !!c)
        : [...courses].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    for (const course of orderedCourses) {
        if (!course.durationHours || course.durationHours <= 0) continue;
        const needed = calculateSlotsNeeded(course.durationHours, config.slotHours);
        const list = entriesByCourse.get(course.id) ?? [];
        if (list.length !== needed) {
            const anchor = list[list.length - 1];
            const diff = Math.abs(needed - list.length);
            const fallbackDate = cls?.startDate && isValidIsoDate(cls.startDate) ? cls.startDate : sorted[0]?.date;
            issues.push({
                id: `slot-count-${course.id}`,
                type: "SLOT_COUNT_MISMATCH",
                severity: "warning",
                entryId: anchor?.id,
                courseId: course.id,
                date: anchor?.date ?? fallbackDate,
                slot: anchor?.slot ?? 1,
                message:
                    list.length < needed
                        ? `Course ${course.code} (${course.name}) is short by ${diff} slot(s) (${list.length}/${needed} slots for ${course.durationHours}h).`
                        : `Course ${course.code} (${course.name}) has ${diff} extra slot(s) (${list.length}/${needed} slots for ${course.durationHours}h).`,
            });
        }
    }

    // 3. Course order violation: later course starts before earlier course finishes
    for (let i = 0; i < orderedCourses.length; i++) {
        const earlier = orderedCourses[i];
        const earlierEntries = entriesByCourse.get(earlier.id);
        if (!earlierEntries || earlierEntries.length === 0) continue;
        const lastOfEarlier = earlierEntries[earlierEntries.length - 1];

        for (let j = i + 1; j < orderedCourses.length; j++) {
            const later = orderedCourses[j];
            const laterEntries = entriesByCourse.get(later.id);
            if (!laterEntries || laterEntries.length === 0) continue;
            const firstOfLater = laterEntries[0];

            if (compareDateSlot(firstOfLater, lastOfEarlier) < 0) {
                issues.push({
                    id: `order-violation-${earlier.id}-${later.id}`,
                    type: "COURSE_ORDER_VIOLATION",
                    severity: "warning",
                    entryId: firstOfLater.id,
                    courseId: later.id,
                    date: firstOfLater.date,
                    slot: firstOfLater.slot,
                    message: `Course order mismatch: ${later.code} starts (${firstOfLater.date} Slot ${firstOfLater.slot}) before ${earlier.code} finishes (${lastOfEarlier.date} Slot ${lastOfEarlier.slot}).`,
                });
            }
        }
    }

    // 4. Empty working-day gaps strictly between first and last scheduled slots (info level)
    if (sorted.length >= 2) {
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        let cursor = nextWorkingSlot(first.date, first.slot, config, false);
        let gapGuard = 0;
        while (compareDateSlot(cursor, last) < 0 && gapGuard < 600) {
            gapGuard += 1;
            if (!seenSlots.has(slotKey(cursor.date, cursor.slot))) {
                issues.push({
                    id: `gap-${cursor.date}-s${cursor.slot}`,
                    type: "SCHEDULE_GAP",
                    severity: "info",
                    date: cursor.date,
                    slot: cursor.slot,
                    message: `Unscheduled gap on ${cursor.date} (Slot ${cursor.slot}).`,
                });
            }
            cursor = nextWorkingSlot(cursor.date, cursor.slot, config, false);
        }
    }

    return issues;
}
