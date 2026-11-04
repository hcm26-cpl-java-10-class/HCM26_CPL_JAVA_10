import type { ExternalTrainer, SessionDTO, SessionStatus } from "@/types";

/** Every session-related query key starts with this, so one invalidation refreshes lists, calendars and details. */
export const SESSION_QUERY_KEY = ["session"] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The API exchanges LocalDateTime strings without a zone ("2030-03-04T09:00:00"). They are shown exactly
 * as stored, so they are parsed as local time; bare dates are parsed manually because Date reads them as UTC.
 */
export function parseLocalDateTime(value?: string | null): Date | null {
    if (!value) return null;

    const dateOnly = DATE_ONLY.exec(value);
    const date = dateOnly
        ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
        : new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

/** "04-Nov-2030"; unparseable values are returned untouched so nothing is silently hidden. */
export function formatDate(value?: string | null): string {
    if (!value) return "—";
    const date = parseLocalDateTime(value);
    return date ? `${pad(date.getDate())}-${MONTHS[date.getMonth()]}-${date.getFullYear()}` : value;
}

export function formatTime(value?: string | null): string {
    const date = parseLocalDateTime(value);
    return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "—";
}

export function formatWeekday(value?: string | null): string {
    const date = parseLocalDateTime(value);
    return date ? WEEKDAYS[date.getDay()] : "—";
}

export function splitLocalDateTime(value?: string | null): { date: string; time: string } {
    const date = parseLocalDateTime(value);
    if (!date) return { date: "", time: "" };

    return {
        date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
}

/** ("2030-03-04", "09:00") -> "2030-03-04T09:00:00", the format the backend binds to LocalDateTime. */
export function joinLocalDateTime(date: string, time: string): string {
    return `${date}T${time.length === 5 ? `${time}:00` : time}`;
}

/** Adds whole days to a "YYYY-MM-DD" string without going through UTC. */
export function addDays(date: string, days: number): string {
    const parsed = parseLocalDateTime(date);
    if (!parsed) return date;

    const shifted = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + days);
    return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

export function compareSessions(a: SessionDTO, b: SessionDTO): number {
    const byStart = (a.startTime ?? "").localeCompare(b.startTime ?? "");
    return byStart !== 0 ? byStart : (a.id ?? 0) - (b.id ?? 0);
}

/* ───────────────────────────── status ───────────────────────────── */

interface SessionStatusMeta {
    label: string;
    badgeClass: string;
}

const SESSION_STATUS_META: Record<SessionStatus, SessionStatusMeta> = {
    SCHEDULED: { label: "Scheduled", badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
    COMPLETED: { label: "Completed", badgeClass: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
    CANCELLED: { label: "Cancelled", badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
};

export function getSessionStatusMeta(status?: string | null): SessionStatusMeta {
    return (
        SESSION_STATUS_META[status as SessionStatus] ?? {
            label: status || "Unknown",
            badgeClass: "bg-muted text-muted-foreground",
        }
    );
}

/** Edit, reschedule, complete and cancel only apply to sessions that have not been closed yet. */
export function isOpenSession(session: Pick<SessionDTO, "status">): boolean {
    return session.status === "SCHEDULED";
}

export function trainerLabel(trainers: ExternalTrainer[] | undefined, trainerId?: number): string {
    if (trainerId == null) return "—";
    return trainers?.find((trainer) => trainer.id === trainerId)?.name || `Trainer #${trainerId}`;
}

/* ───────────────────────────── validation ───────────────────────────── */

export interface SlotInput {
    date: string;
    start: string;
    end: string;
}

export type SlotErrors = Partial<Record<keyof SlotInput, string>>;

export function validateSlot({ date, start, end }: SlotInput): SlotErrors {
    const errors: SlotErrors = {};

    if (!date) errors.date = "Date is required";
    if (!start) errors.start = "Start time is required";
    if (!end) errors.end = "End time is required";
    // "HH:mm" is zero-padded, so a string comparison is a time comparison
    if (start && end && end <= start) errors.end = "End time must be after start time";

    return errors;
}
