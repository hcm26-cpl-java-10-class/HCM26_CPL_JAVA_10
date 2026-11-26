export type SlotNumber = 1 | 2;

export interface SlotDefinition {
    slot: SlotNumber;
    start: string;
    end: string;
}

export interface ScheduleConfig {
    slotHours: number;
    slots: SlotDefinition[];
    /** ISO weekday numbers: 1 = Monday ... 5 = Friday, 6 = Saturday, 7 = Sunday */
    workingDays: number[];
    /** ISO dates YYYY-MM-DD */
    holidays: string[];
}

export interface ScheduleCourse {
    id: number;
    code: string;
    name: string;
    version?: string;
    durationHours: number;
    orderIndex: number;
    slotsNeeded?: number;
}

export interface ScheduleProgram {
    id: number;
    code: string;
    name: string;
    version?: string;
    totalDurationHours?: number;
    courses: ScheduleCourse[];
}

export interface ScheduleClassInfo {
    id: number;
    code: string;
    name?: string;
    startDate?: string;
    endDate?: string;
    actualStartDate?: string;
    actualEndDate?: string;
    status?: string;
    programCode?: string;
    masterTrainer?: string;
    location?: string;
}

export interface ScheduleEntry {
    id: string;
    classId: number;
    courseId: number;
    courseCode?: string;
    courseName?: string;
    /** Planned date YYYY-MM-DD */
    date: string;
    /** Optional actual teaching date YYYY-MM-DD (Actual Day) */
    actualDate?: string;
    slot: SlotNumber;
    startTime: string;
    endTime: string;
    /** 1..n chronological order within the course */
    order: number;
    /** true if manually added, moved, or edited by the user */
    isManual: boolean;
    note?: string;
}

export type ScheduleIssueType =
    | "BEFORE_START_DATE"
    | "DUPLICATE_SLOT"
    | "SLOT_COUNT_MISMATCH"
    | "NON_WORKING_DAY"
    | "COURSE_ORDER_VIOLATION"
    | "SCHEDULE_GAP";

export type ScheduleIssueSeverity = "error" | "warning" | "info";

export interface ScheduleValidationIssue {
    id: string;
    type: ScheduleIssueType;
    severity: ScheduleIssueSeverity;
    entryId?: string;
    courseId?: number;
    date?: string;
    slot?: SlotNumber;
    message: string;
}

/**
 * Centralized default schedule configuration (no scattered magic numbers).
 * Slot 1 = 08:00–12:00 (4h), Slot 2 = 13:00–17:00 (4h), Monday–Friday.
 */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
    slotHours: 4,
    slots: [
        { slot: 1, start: "08:00", end: "12:00" },
        { slot: 2, start: "13:00", end: "17:00" },
    ],
    workingDays: [1, 2, 3, 4, 5],
    holidays: [],
};

export interface CourseColorTheme {
    bg: string;
    border: string;
    text: string;
    badge: string;
    progress: string;
    dot: string;
}

export const COURSE_COLOR_THEMES: CourseColorTheme[] = [
    {
        bg: "bg-blue-50/90 dark:bg-blue-950/40",
        border: "border-blue-300 border-l-blue-600 dark:border-blue-800 dark:border-l-blue-400",
        text: "text-blue-950 dark:text-blue-100",
        badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200",
        progress: "bg-blue-600",
        dot: "#2563eb",
    },
    {
        bg: "bg-emerald-50/90 dark:bg-emerald-950/40",
        border: "border-emerald-300 border-l-emerald-600 dark:border-emerald-800 dark:border-l-emerald-400",
        text: "text-emerald-950 dark:text-emerald-100",
        badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200",
        progress: "bg-emerald-600",
        dot: "#059669",
    },
    {
        bg: "bg-violet-50/90 dark:bg-violet-950/40",
        border: "border-violet-300 border-l-violet-600 dark:border-violet-800 dark:border-l-violet-400",
        text: "text-violet-950 dark:text-violet-100",
        badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/70 dark:text-violet-200",
        progress: "bg-violet-600",
        dot: "#7c3aed",
    },
    {
        bg: "bg-amber-50/90 dark:bg-amber-950/40",
        border: "border-amber-300 border-l-amber-600 dark:border-amber-800 dark:border-l-amber-400",
        text: "text-amber-950 dark:text-amber-100",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200",
        progress: "bg-amber-500",
        dot: "#d97706",
    },
    {
        bg: "bg-rose-50/90 dark:bg-rose-950/40",
        border: "border-rose-300 border-l-rose-600 dark:border-rose-800 dark:border-l-rose-400",
        text: "text-rose-950 dark:text-rose-100",
        badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/70 dark:text-rose-200",
        progress: "bg-rose-600",
        dot: "#e11d48",
    },
    {
        bg: "bg-cyan-50/90 dark:bg-cyan-950/40",
        border: "border-cyan-300 border-l-cyan-600 dark:border-cyan-800 dark:border-l-cyan-400",
        text: "text-cyan-950 dark:text-cyan-100",
        badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/70 dark:text-cyan-200",
        progress: "bg-cyan-600",
        dot: "#0891b2",
    },
    {
        bg: "bg-fuchsia-50/90 dark:bg-fuchsia-950/40",
        border: "border-fuchsia-300 border-l-fuchsia-600 dark:border-fuchsia-800 dark:border-l-fuchsia-400",
        text: "text-fuchsia-950 dark:text-fuchsia-100",
        badge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/70 dark:text-fuchsia-200",
        progress: "bg-fuchsia-600",
        dot: "#c026d3",
    },
    {
        bg: "bg-teal-50/90 dark:bg-teal-950/40",
        border: "border-teal-300 border-l-teal-600 dark:border-teal-800 dark:border-l-teal-400",
        text: "text-teal-950 dark:text-teal-100",
        badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/70 dark:text-teal-200",
        progress: "bg-teal-600",
        dot: "#0d9488",
    },
];

export function getCourseColorTheme(courseIndex: number): CourseColorTheme {
    const safeIdx = Math.abs(courseIndex) % COURSE_COLOR_THEMES.length;
    return COURSE_COLOR_THEMES[safeIdx];
}
