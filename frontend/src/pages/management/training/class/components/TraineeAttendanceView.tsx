import {
    AlertTriangle,
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    ArrowUpDown,
    CheckCircle2,
    ClipboardCheck,
    Clock,
    Download,
    History,
    Save,
    Search,
    ShieldAlert,
    Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { utils, writeFile } from "xlsx";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { NativeSelect } from "@/components/common/NativeSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ExternalClass, Trainee } from "@/types";
import { autoFitWorksheetColumns } from "@/utils/trainee-import.utils";
import { formatFptStudentIdForSite, normalizeTraineeStatus } from "./TraineeModal";

export type SessionAttendanceMark = "Present" | "Excused" | "Unexcused" | "Late";

export interface AttendanceAuditEntry {
    previousStatus: SessionAttendanceMark;
    newStatus: SessionAttendanceMark;
    modifiedBy: string;
    modifiedAt: string;
    reason: string;
}

export interface TraineeAttendanceLogItem {
    sessionNumber: number;
    date: string;
    topic: string;
    status: SessionAttendanceMark;
    note?: string;
    auditTrail?: AttendanceAuditEntry[];
}

export interface TraineeAttendanceRecord {
    traineeId: number;
    excusedAbsent: number;
    unexcusedAbsent: number;
    lateCount: number;
    logs: TraineeAttendanceLogItem[];
}

export interface ClassAttendanceState {
    conductedSessions: number;
    plannedSessions: number;
    expectedStartDate: string;
    expectedEndDate: string;
    scheduleDates: string[];
    recordsByTraineeId: Record<number, TraineeAttendanceRecord>;
}

const SESSION_TOPICS: string[] = [
    "Session 01: Course Orientation & Java Environment Setup",
    "Session 02: Java Syntax, Data Types & Control Flow",
    "Session 03: Object-Oriented Programming - Classes & Objects",
    "Session 04: Inheritance, Polymorphism & Abstraction",
    "Session 05: Interfaces, Packages & Access Modifiers",
    "Session 06: Exception Handling & Debugging in Java",
    "Session 07: Java Collections Framework - List & Set",
    "Session 08: Java Collections Framework - Map & Generics",
    "Session 09: Java Streams API & Lambda Expressions",
    "Session 10: File I/O & Serialization",
    "Session 11: Multithreading & Concurrency Basics",
    "Session 12: JDBC & Relational Database Connectivity",
    "Session 13: Maven Build Tool & Unit Testing with JUnit 5",
    "Session 14: Spring Core & Dependency Injection",
    "Session 15: Spring Boot Auto-Configuration & Profiles",
    "Session 16: Building RESTful APIs with Spring Web MVC",
    "Session 17: Spring Data JPA & Hibernate ORM",
    "Session 18: Bean Validation & Global Exception Handling",
    "Session 19: Spring Security & JWT Authentication",
    "Session 20: Midterm Project Review & Code Assessment",
];

/**
 * Preset distribution across trainee indices (based on 20 conducted sessions):
 * - Eligible (< 10% absent): 0% (0/20), 5% (1/20)
 * - Warning (10% - 19% absent): 10% (2/20), 15% (3/20)
 * - Disqualified (>= 20% absent): 20% (4/20), 25% (5/20)
 */
const PRESET_ABSENCE_PROFILES: Array<{
    excused: number;
    unexcused: number;
    late: number;
}> = [
    { excused: 0, unexcused: 0, late: 0 }, // #1: 0/20 absent (0%) -> Eligible
    { excused: 1, unexcused: 0, late: 1 }, // #2: 1/20 absent (5%) -> Eligible
    { excused: 1, unexcused: 2, late: 1 }, // #3: 3/20 absent (15%) -> Warning
    { excused: 0, unexcused: 0, late: 0 }, // #4: 0/20 absent (0%) -> Eligible
    { excused: 1, unexcused: 1, late: 2 }, // #5: 2/20 absent (10%) -> Warning
    { excused: 1, unexcused: 3, late: 1 }, // #6: 4/20 absent (20%) -> Disqualified
    { excused: 1, unexcused: 0, late: 0 }, // #7: 1/20 absent (5%) -> Eligible
    { excused: 1, unexcused: 2, late: 2 }, // #8: 3/20 absent (15%) -> Warning
    { excused: 1, unexcused: 4, late: 1 }, // #9: 5/20 absent (25%) -> Disqualified
    { excused: 0, unexcused: 0, late: 1 }, // #10: 0/20 absent (0%) -> Eligible
];

export function getTodayLocalIsoDate(now: Date = new Date()): string {
    const yyyy = String(now.getFullYear()).padStart(4, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export function addDaysToIsoDate(isoDate: string, daysToAdd: number): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
    const base = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : new Date();
    base.setDate(base.getDate() + daysToAdd);
    return getTodayLocalIsoDate(base);
}

export function parseClassIsoDate(raw?: string, fallback = "2026-10-01"): string {
    if (!raw || !raw.trim()) return fallback;
    const trimmed = raw.trim();
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
        return getTodayLocalIsoDate(parsed);
    }
    return fallback;
}

export function resolveClassExpectedDates(
    classItem: ExternalClass,
    todayIso: string = getTodayLocalIsoDate(),
): {
    expectedStartDate: string;
    expectedEndDate: string;
    maxSelectableDate: string;
} {
    const rawStart =
        (classItem as { expectedStartDate?: string }).expectedStartDate ?? classItem.startDate;
    const rawEnd =
        (classItem as { expectedEndDate?: string }).expectedEndDate ?? classItem.endDate;
    const startIso = parseClassIsoDate(rawStart, "2026-10-01");
    const endIso = parseClassIsoDate(rawEnd, "2027-01-31");
    const expectedStartDate = startIso <= endIso ? startIso : endIso;
    const expectedEndDate = startIso <= endIso ? endIso : startIso;
    const maxSelectableDate = expectedEndDate < todayIso ? expectedEndDate : todayIso;
    return {
        expectedStartDate,
        expectedEndDate,
        maxSelectableDate,
    };
}

function diffDaysBetweenIso(startIso: string, endIso: string): number {
    const sMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso.trim());
    const eMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endIso.trim());
    if (!sMatch || !eMatch) return 0;
    const startUtc = Date.UTC(Number(sMatch[1]), Number(sMatch[2]) - 1, Number(sMatch[3]));
    const endUtc = Date.UTC(Number(eMatch[1]), Number(eMatch[2]) - 1, Number(eMatch[3]));
    return Math.round((endUtc - startUtc) / 86_400_000);
}

function distributeDatesChronologically(
    rangeStartIso: string,
    rangeEndIso: string,
    count: number,
): string[] {
    if (count <= 0) return [];
    if (count === 1) return [rangeStartIso];
    const totalDays = Math.max(0, diffDaysBetweenIso(rangeStartIso, rangeEndIso));
    const dates: string[] = [];
    for (let i = 0; i < count; i++) {
        const offset = Math.round((i * totalDays) / (count - 1));
        dates.push(addDaysToIsoDate(rangeStartIso, offset));
    }
    return dates;
}

/**
 * Generates chronological session dates strictly bounded within [expectedStartDate, expectedEndDate]:
 * - Past sessions (#1..#20): expectedStartDate <= sessionDate < today
 * - Current / Today session (#21): sessionDate === today (or latest active session <= today)
 * - Future sessions (#22..#40): today < sessionDate <= expectedEndDate
 */
export function buildClassSessionSchedule(
    expectedStartDate: string,
    expectedEndDate: string,
    todayIso: string = getTodayLocalIsoDate(),
    plannedSessions = 40,
    basePastSessions = 20,
): string[] {
    if (expectedStartDate < todayIso && todayIso <= expectedEndDate) {
        const rawYesterday = addDaysToIsoDate(todayIso, -1);
        const pastEndIso = rawYesterday >= expectedStartDate ? rawYesterday : expectedStartDate;
        const pastDates = distributeDatesChronologically(
            expectedStartDate,
            pastEndIso,
            basePastSessions,
        );

        const futureCount = Math.max(0, plannedSessions - basePastSessions - 1);
        const twoDaysAhead = addDaysToIsoDate(todayIso, 2);
        const oneDayAhead = addDaysToIsoDate(todayIso, 1);
        const futureStartIso =
            twoDaysAhead <= expectedEndDate
                ? twoDaysAhead
                : oneDayAhead <= expectedEndDate
                  ? oneDayAhead
                  : expectedEndDate;
        const futureDates = distributeDatesChronologically(
            futureStartIso,
            expectedEndDate,
            futureCount,
        );

        return [...pastDates, todayIso, ...futureDates];
    }

    return distributeDatesChronologically(expectedStartDate, expectedEndDate, plannedSessions);
}

function buildInitialLogs(
    totalSessions: number,
    excused: number,
    unexcused: number,
    late: number,
    scheduleDates: string[],
): TraineeAttendanceLogItem[] {
    const logs: TraineeAttendanceLogItem[] = [];
    let remExcused = excused;
    let remUnexcused = unexcused;
    let remLate = late;

    for (let i = 0; i < totalSessions; i++) {
        const sessionNumber = i + 1;
        const date = scheduleDates[i] ?? scheduleDates[scheduleDates.length - 1] ?? "2026-10-01";
        const topic = SESSION_TOPICS[i] ?? `Session ${String(sessionNumber).padStart(2, "0")}: Training Session`;

        let status: SessionAttendanceMark = "Present";
        let note = "Attended on time";

        if (remUnexcused > 0 && i >= 3 && i % 4 === 3) {
            status = "Unexcused";
            note = "Absent without prior notice (Unexcused)";
            remUnexcused--;
        } else if (remExcused > 0 && i >= 5 && i % 5 === 0) {
            status = "Excused";
            note = "Approved leave request (Excused)";
            remExcused--;
        } else if (remLate > 0 && i >= 2 && i % 6 === 2) {
            status = "Late";
            note = "Arrived 15 minutes late";
            remLate--;
        }

        logs.push({ sessionNumber, date, topic, status, note });
    }

    for (let i = logs.length - 1; i >= 0 && (remUnexcused > 0 || remExcused > 0 || remLate > 0); i--) {
        if (logs[i].status !== "Present") continue;
        if (remUnexcused > 0) {
            logs[i].status = "Unexcused";
            logs[i].note = "Absent without prior notice (Unexcused)";
            remUnexcused--;
        } else if (remExcused > 0) {
            logs[i].status = "Excused";
            logs[i].note = "Approved leave request (Excused)";
            remExcused--;
        } else if (remLate > 0) {
            logs[i].status = "Late";
            logs[i].note = "Arrived 15 minutes late";
            remLate--;
        }
    }

    return logs;
}

const AUTO_DEFAULT_NOTES = new Set([
    "Attended on time",
    "Absent without prior notice (Unexcused)",
    "Arrived 15 minutes late",
    "Arrived late",
]);

function recalculateRecordFromLogs(
    traineeId: number,
    logs: TraineeAttendanceLogItem[],
    todayIso: string = getTodayLocalIsoDate(),
): TraineeAttendanceRecord {
    // Strictly clean up/exclude any erroneously recorded future session logs (date > today)
    const validLogs = logs.filter((log) => !log.date || log.date <= todayIso);

    let excusedAbsent = 0;
    let unexcusedAbsent = 0;
    let lateCount = 0;

    for (const log of validLogs) {
        if (log.status === "Excused") excusedAbsent += 1;
        else if (log.status === "Unexcused") unexcusedAbsent += 1;
        else if (log.status === "Late") lateCount += 1;
    }

    const sortedLogs = [...validLogs].sort((a, b) => a.sessionNumber - b.sessionNumber);
    return {
        traineeId,
        excusedAbsent,
        unexcusedAbsent,
        lateCount,
        logs: sortedLogs,
    };
}

const classAttendanceStore = new Map<string, ClassAttendanceState>();

export function resetClassAttendanceStoreForTest() {
    classAttendanceStore.clear();
}

function getOrInitClassAttendanceState(
    classId: string,
    trainees: Trainee[],
    expectedStartDate = "2026-10-01",
    expectedEndDate = "2027-01-31",
): ClassAttendanceState {
    const todayIso = getTodayLocalIsoDate();
    const existing = classAttendanceStore.get(classId);
    const plannedSessions = existing?.plannedSessions ?? 40;
    const scheduleDates = buildClassSessionSchedule(
        expectedStartDate,
        expectedEndDate,
        todayIso,
        plannedSessions,
        20,
    );
    const datesChanged =
        existing !== undefined &&
        (existing.expectedStartDate !== expectedStartDate ||
            existing.expectedEndDate !== expectedEndDate);

    const recordsByTraineeId: Record<number, TraineeAttendanceRecord> = {};

    let maxValidConducted = 20;

    trainees.forEach((trainee, index) => {
        const existingRecord = existing?.recordsByTraineeId?.[trainee.id];
        if (existingRecord) {
            const alignedLogs = existingRecord.logs.map((log) => {
                const scheduledDate = scheduleDates[log.sessionNumber - 1];
                const outOfBounds =
                    !log.date ||
                    log.date < expectedStartDate ||
                    log.date > expectedEndDate ||
                    datesChanged;
                return {
                    ...log,
                    date: outOfBounds && scheduledDate ? scheduledDate : log.date,
                };
            });
            const sanitized = recalculateRecordFromLogs(trainee.id, alignedLogs, todayIso);
            recordsByTraineeId[trainee.id] = sanitized;
            if (sanitized.logs.length > 0) {
                const maxSessionInLogs = sanitized.logs.reduce(
                    (max, l) => Math.max(max, l.sessionNumber),
                    0,
                );
                maxValidConducted = Math.max(maxValidConducted, maxSessionInLogs);
            }
        } else {
            const preset = PRESET_ABSENCE_PROFILES[index % PRESET_ABSENCE_PROFILES.length];
            const initialLogs = buildInitialLogs(
                20,
                preset.excused,
                preset.unexcused,
                preset.late,
                scheduleDates,
            );
            recordsByTraineeId[trainee.id] = recalculateRecordFromLogs(
                trainee.id,
                initialLogs,
                todayIso,
            );
        }
    });

    // Ensure conductedSessions only reflects sessions with date <= todayIso
    const pastScheduleCount = scheduleDates.filter((d) => d < todayIso).length;
    const baseConducted = pastScheduleCount > 0 ? pastScheduleCount : 0;
    const sampleTraineeId = trainees[0]?.id;
    const sampleLogsCount = sampleTraineeId
        ? (recordsByTraineeId[sampleTraineeId]?.logs.length ?? baseConducted)
        : Math.min(existing?.conductedSessions ?? baseConducted, maxValidConducted);
    const conductedSessions = Math.max(baseConducted, sampleLogsCount);

    const nextState: ClassAttendanceState = {
        conductedSessions,
        plannedSessions,
        expectedStartDate,
        expectedEndDate,
        scheduleDates,
        recordsByTraineeId,
    };
    classAttendanceStore.set(classId, nextState);
    return nextState;
}

export type AttendanceStatusLabel = "Eligible" | "At Risk" | "Disqualified";
export type AttendanceSortKey = "attended" | "absent" | "late" | "absentRate";

const ATTENDANCE_STICKY_HEADER_CLASS =
    "sticky top-0 z-20 bg-slate-50 px-3 font-semibold text-foreground shadow-[inset_0_-1px_0_#e2e8f0] dark:bg-slate-900 dark:shadow-[inset_0_-1px_0_#334155]";

function SortableHeaderButton({
    label,
    columnKey,
    sortKey,
    sortDir,
    onSort,
}: {
    label: string;
    columnKey: AttendanceSortKey;
    sortKey: AttendanceSortKey | null;
    sortDir: "asc" | "desc";
    onSort: (key: AttendanceSortKey) => void;
}) {
    const isActive = sortKey === columnKey;
    const Icon = !isActive ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
        <button
            type="button"
            onClick={() => onSort(columnKey)}
            className="inline-flex cursor-pointer items-center gap-1 font-semibold text-foreground transition-colors hover:text-[#283593] dark:hover:text-blue-300"
        >
            <span>{label}</span>
            <Icon
                className={cn(
                    "size-3.5 shrink-0",
                    isActive ? "text-[#283593] dark:text-blue-300" : "opacity-50",
                )}
                aria-hidden
            />
        </button>
    );
}

export function getAbsentRateMeta(absentRate: number): {
    statusLabel: AttendanceStatusLabel;
    badgeClassName: string;
    barClassName: string;
    textClassName: string;
} {
    if (absentRate >= 20) {
        return {
            statusLabel: "Disqualified",
            badgeClassName:
                "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
            barClassName: "bg-rose-600 dark:bg-rose-500",
            textClassName: "text-rose-600 dark:text-rose-400 font-semibold",
        };
    }
    if (absentRate >= 10) {
        return {
            statusLabel: "At Risk",
            badgeClassName:
                "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
            barClassName: "bg-amber-500 dark:bg-amber-400",
            textClassName: "text-amber-600 dark:text-amber-400 font-semibold",
        };
    }
    return {
        statusLabel: "Eligible",
        badgeClassName:
            "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
        barClassName: "bg-emerald-500 dark:bg-emerald-400",
        textClassName: "text-emerald-600 dark:text-emerald-400 font-semibold",
    };
}

export interface TraineeAttendanceViewProps {
    classItem: ExternalClass;
    trainees: Trainee[];
    onBack: () => void;
}

export function TraineeAttendanceView({ classItem, trainees, onBack }: TraineeAttendanceViewProps) {
    const classId = String(classItem.id);
    const classSite = classItem.site;
    const todayIso = getTodayLocalIsoDate();
    const { expectedStartDate, expectedEndDate, maxSelectableDate } = useMemo(
        () => resolveClassExpectedDates(classItem, todayIso),
        [classItem, todayIso],
    );

    const [attendanceState, setAttendanceState] = useState<ClassAttendanceState>(() =>
        getOrInitClassAttendanceState(classId, trainees, expectedStartDate, expectedEndDate),
    );
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"" | AttendanceStatusLabel>("");
    const [sortKey, setSortKey] = useState<AttendanceSortKey | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // Take Daily Attendance modal state
    const [takeAttendanceOpen, setTakeAttendanceOpen] = useState(false);
    const [selectedSessionNumber, setSelectedSessionNumber] = useState(
        () => attendanceState.conductedSessions + 1,
    );
    const [sessionDate, setSessionDate] = useState(() => maxSelectableDate);
    const [sessionTopic, setSessionTopic] = useState("");
    const [dailyMarks, setDailyMarks] = useState<Record<number, SessionAttendanceMark>>({});
    const [dailyNotes, setDailyNotes] = useState<Record<number, string>>({});
    const [auditReason, setAuditReason] = useState("");
    const [attendanceFormError, setAttendanceFormError] = useState("");

    // View Logs & Session-Level Edit modal state
    const [activeLogTrainee, setActiveLogTrainee] = useState<Trainee | null>(null);
    const [logDraftMarks, setLogDraftMarks] = useState<Record<number, SessionAttendanceMark>>({});
    const [logDraftNotes, setLogDraftNotes] = useState<Record<number, string>>({});
    const [logEditReason, setLogEditReason] = useState("");
    const [logModalError, setLogModalError] = useState("");

    useEffect(() => {
        const synced = getOrInitClassAttendanceState(
            classId,
            trainees,
            expectedStartDate,
            expectedEndDate,
        );
        setAttendanceState(synced);
    }, [classId, expectedEndDate, expectedStartDate, trainees]);

    const updateAttendanceState = (updater: (prev: ClassAttendanceState) => ClassAttendanceState) => {
        setAttendanceState((prev) => {
            const next = updater(prev);
            classAttendanceStore.set(classId, next);
            return next;
        });
    };

    const computedRows = useMemo(() => {
        const totalConducted = Math.max(1, attendanceState.conductedSessions);

        return trainees.map((trainee) => {
            const record = attendanceState.recordsByTraineeId[trainee.id] ?? {
                traineeId: trainee.id,
                excusedAbsent: 0,
                unexcusedAbsent: 0,
                lateCount: 0,
                logs: [],
            };
            const totalAbsent = record.excusedAbsent + record.unexcusedAbsent;
            const attended = Math.max(0, totalConducted - totalAbsent);
            const rawAbsentRate = (totalAbsent / totalConducted) * 100;
            const absentRate = Math.round(rawAbsentRate * 10) / 10;
            const meta = getAbsentRateMeta(absentRate);
            const studentId = formatFptStudentIdForSite(
                trainee.fptAccount || trainee.code,
                classSite,
                trainee.id,
            );

            return {
                trainee,
                studentId,
                record,
                attended,
                totalConducted,
                totalAbsent,
                absentRate,
                meta,
            };
        });
    }, [attendanceState, classSite, trainees]);

    const summaryStats = useMemo(() => {
        const count = computedRows.length;
        if (count === 0) {
            return {
                conductedSessions: attendanceState.conductedSessions,
                plannedSessions: attendanceState.plannedSessions,
                classAttendanceRate: 100,
                atRiskCount: 0,
                criticalCount: 0,
            };
        }

        const totalAbsentRate = computedRows.reduce((sum, row) => sum + row.absentRate, 0);
        const avgAttendanceRate = Math.max(0, Math.round(100 - totalAbsentRate / count));
        const atRiskCount = computedRows.filter(
            (row) => row.absentRate >= 10 && row.absentRate < 20,
        ).length;
        const criticalCount = computedRows.filter((row) => row.absentRate >= 20).length;

        return {
            conductedSessions: attendanceState.conductedSessions,
            plannedSessions: attendanceState.plannedSessions,
            classAttendanceRate: avgAttendanceRate,
            atRiskCount,
            criticalCount,
        };
    }, [attendanceState.conductedSessions, attendanceState.plannedSessions, computedRows]);

    const filteredRows = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return computedRows.filter((row) => {
            if (statusFilter && row.meta.statusLabel !== statusFilter) {
                return false;
            }
            if (!keyword) return true;
            return [
                row.trainee.fullName,
                row.studentId,
                row.trainee.personalEmail ?? row.trainee.email,
                row.meta.statusLabel,
            ].some((val) => String(val ?? "").toLowerCase().includes(keyword));
        });
    }, [computedRows, search, statusFilter]);

    const sortedRows = useMemo(() => {
        if (!sortKey) return filteredRows;
        const factor = sortDir === "asc" ? 1 : -1;
        return [...filteredRows].sort((a, b) => {
            let diff = 0;
            if (sortKey === "attended") diff = a.attended - b.attended;
            else if (sortKey === "absent") diff = a.totalAbsent - b.totalAbsent;
            else if (sortKey === "late") diff = a.record.lateCount - b.record.lateCount;
            else if (sortKey === "absentRate") diff = a.absentRate - b.absentRate;
            if (diff !== 0) return factor * diff;
            return (a.trainee.fullName ?? "").localeCompare(b.trainee.fullName ?? "");
        });
    }, [filteredRows, sortDir, sortKey]);

    const handleToggleSort = (key: AttendanceSortKey) => {
        if (sortKey === key) {
            setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const handleExportReport = () => {
        if (sortedRows.length === 0) {
            toast.info("No attendance records to export.");
            return;
        }
        const exportRows = sortedRows.map((row, index) => ({
            "No.": index + 1,
            "Student ID": row.studentId,
            "Full Name": row.trainee.fullName ?? "",
            Email: row.trainee.personalEmail || row.trainee.email || "",
            "Attended / Total": `${row.attended} / ${row.totalConducted}`,
            "Total Absent": row.totalAbsent,
            "Excused (E)": row.record.excusedAbsent,
            "Unexcused (U)": row.record.unexcusedAbsent,
            Late: row.record.lateCount,
            "Absent Rate (%)": row.absentRate,
            "Max Absence Limit (%)": 20,
            "Attendance Status": row.meta.statusLabel,
        }));
        const worksheet = autoFitWorksheetColumns(utils.json_to_sheet(exportRows), {
            "No.": 6,
            "Student ID": 14,
            "Full Name": 25,
            Email: 30,
            "Attended / Total": 18,
            "Total Absent": 14,
            "Excused (E)": 13,
            "Unexcused (U)": 15,
            Late: 10,
            "Absent Rate (%)": 17,
            "Max Absence Limit (%)": 23,
            "Attendance Status": 18,
        });
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "Attendance Report");
        const fileName = `${classItem.code ?? `Class_${classId}`}_Attendance_Report.xlsx`;
        writeFile(workbook, fileName);
        toast.success(`Exported attendance report (${sortedRows.length} trainees) to ${fileName}`);
    };

    const getScheduledDateForSession = (sessionNum: number, state: ClassAttendanceState): string => {
        const scheduledFromRange = state.scheduleDates[sessionNum - 1];
        const sampleLog = trainees
            .map((t) => state.recordsByTraineeId[t.id]?.logs.find((l) => l.sessionNumber === sessionNum))
            .find(Boolean);
        if (
            sampleLog?.date &&
            sampleLog.date >= state.expectedStartDate &&
            sampleLog.date <= state.expectedEndDate &&
            sampleLog.date <= todayIso
        ) {
            return sampleLog.date;
        }
        if (scheduledFromRange) {
            return scheduledFromRange;
        }
        return state.expectedEndDate;
    };

    const resolveDefaultActiveSessionNumber = (state: ClassAttendanceState): number => {
        const nextUnconducted = state.conductedSessions + 1;
        if (nextUnconducted <= state.plannedSessions) {
            const nextDate = getScheduledDateForSession(nextUnconducted, state);
            if (nextDate <= todayIso) {
                return nextUnconducted;
            }
        }
        let latestActive = 1;
        for (let sNum = 1; sNum <= state.plannedSessions; sNum++) {
            const d = getScheduledDateForSession(sNum, state);
            if (d <= todayIso) {
                latestActive = sNum;
            }
        }
        return latestActive;
    };

    const loadSessionIntoModal = (sessionNum: number, state: ClassAttendanceState) => {
        setSelectedSessionNumber(sessionNum);
        setAuditReason("");
        setAttendanceFormError("");

        const isPast = sessionNum <= state.conductedSessions;
        const initialMarks: Record<number, SessionAttendanceMark> = {};
        const initialNotes: Record<number, string> = {};

        let detectedDate = getScheduledDateForSession(sessionNum, state);
        let detectedTopic =
            SESSION_TOPICS[sessionNum - 1] ??
            `Session ${String(sessionNum).padStart(2, "0")}: Practical Lab & Code Review`;

        for (const trainee of trainees) {
            if (isPast) {
                const existingLog = state.recordsByTraineeId[trainee.id]?.logs.find(
                    (l) => l.sessionNumber === sessionNum && (!l.date || l.date <= todayIso),
                );
                if (existingLog) {
                    if (
                        existingLog.date &&
                        existingLog.date >= state.expectedStartDate &&
                        existingLog.date <= state.expectedEndDate
                    ) {
                        detectedDate = existingLog.date;
                    }
                    detectedTopic = existingLog.topic || detectedTopic;
                    initialMarks[trainee.id] = existingLog.status;
                    initialNotes[trainee.id] =
                        existingLog.status !== "Excused" && AUTO_DEFAULT_NOTES.has(existingLog.note ?? "")
                            ? ""
                            : (existingLog.note ?? "");
                } else {
                    initialMarks[trainee.id] = "Present";
                    initialNotes[trainee.id] = "";
                }
            } else {
                initialMarks[trainee.id] = "Present";
                initialNotes[trainee.id] = "";
            }
        }

        setSessionDate(detectedDate);
        setSessionTopic(detectedTopic);
        setDailyMarks(initialMarks);
        setDailyNotes(initialNotes);
    };

    const handleOpenTakeAttendance = () => {
        const defaultSessionNum = resolveDefaultActiveSessionNumber(attendanceState);
        loadSessionIntoModal(defaultSessionNum, attendanceState);
        setTakeAttendanceOpen(true);
    };

    const handleSessionSelectChange = (nextSessionNum: number) => {
        const scheduledDate = getScheduledDateForSession(nextSessionNum, attendanceState);
        if (nextSessionNum > attendanceState.conductedSessions + 1 || scheduledDate > todayIso) {
            loadSessionIntoModal(nextSessionNum, attendanceState);
            toast.warning(
                `Cannot take attendance for a future date (Session scheduled for ${scheduledDate}).`,
            );
            return;
        }
        loadSessionIntoModal(nextSessionNum, attendanceState);
    };

    const isFutureSession = Boolean(
        (sessionDate.trim() && sessionDate > todayIso) ||
            selectedSessionNumber > attendanceState.conductedSessions + 1,
    );
    const isPastSession =
        !isFutureSession && selectedSessionNumber <= attendanceState.conductedSessions;

    const modifiedPastTrainees = useMemo(() => {
        if (!isPastSession) return [];
        return trainees.filter((trainee) => {
            if (normalizeTraineeStatus(trainee.status) !== "Active") return false;
            const existingLog = attendanceState.recordsByTraineeId[trainee.id]?.logs.find(
                (l) => l.sessionNumber === selectedSessionNumber,
            );
            const prevStatus = existingLog?.status ?? "Present";
            const nextStatus = dailyMarks[trainee.id] ?? prevStatus;
            return prevStatus !== nextStatus;
        });
    }, [attendanceState.recordsByTraineeId, dailyMarks, isPastSession, selectedSessionNumber, trainees]);

    const handleMarkAllPresent = () => {
        if (isFutureSession) {
            toast.error(`Cannot take attendance for a future date (Session scheduled for ${sessionDate}).`);
            return;
        }
        const nextMarks: Record<number, SessionAttendanceMark> = { ...dailyMarks };
        for (const trainee of trainees) {
            if (normalizeTraineeStatus(trainee.status) === "Active") {
                nextMarks[trainee.id] = "Present";
            }
        }
        setDailyMarks(nextMarks);
        setAttendanceFormError("");
        toast.info("Marked all active trainees as Present.");
    };

    const handleSaveDailyAttendance = () => {
        setAttendanceFormError("");

        if (!sessionDate.trim()) {
            const msg = "Please select an attendance date.";
            setAttendanceFormError(msg);
            toast.error(msg);
            return;
        }

        // Strict Date-Based Future Locking (session.date > today or outside class bounds)
        if (sessionDate > todayIso || selectedSessionNumber > attendanceState.conductedSessions + 1) {
            const msg = `Cannot take attendance for a future date (Session scheduled for ${sessionDate}).`;
            setAttendanceFormError(msg);
            toast.error(msg);
            return;
        }

        if (sessionDate < expectedStartDate || sessionDate > expectedEndDate) {
            const msg = `Session date must be within the class schedule (${expectedStartDate} to ${expectedEndDate}).`;
            setAttendanceFormError(msg);
            toast.error(msg);
            return;
        }

        // Validate mandatory Note / Reason when any active trainee is marked Excused
        const missingExcusedNoteTrainee = trainees.find((trainee) => {
            if (normalizeTraineeStatus(trainee.status) !== "Active") return false;
            const mark = dailyMarks[trainee.id] ?? "Present";
            const note = (dailyNotes[trainee.id] ?? "").trim();
            return mark === "Excused" && !note;
        });

        if (missingExcusedNoteTrainee) {
            const msg = `Note / Reason is required when marking ${missingExcusedNoteTrainee.fullName} as Excused.`;
            setAttendanceFormError(msg);
            toast.error(msg);
            return;
        }

        // Validate mandatory Audit Reason when modifying any trainee's status in a Past Session
        if (isPastSession && modifiedPastTrainees.length > 0 && !auditReason.trim()) {
            const msg = "Audit Reason for Modification is required when updating past session attendance.";
            setAttendanceFormError(msg);
            toast.error(msg);
            return;
        }

        const targetSessionNumber = selectedSessionNumber;
        const topicLabel =
            sessionTopic.trim() ||
            `Session ${String(targetSessionNumber).padStart(2, "0")}: Daily Class Session`;
        const auditDateStr = todayIso;

        updateAttendanceState((prev) => {
            const nextRecords: Record<number, TraineeAttendanceRecord> = { ...prev.recordsByTraineeId };
            const editingPast = targetSessionNumber <= prev.conductedSessions;

            for (const trainee of trainees) {
                const current = nextRecords[trainee.id] ?? {
                    traineeId: trainee.id,
                    excusedAbsent: 0,
                    unexcusedAbsent: 0,
                    lateCount: 0,
                    logs: [],
                };

                const isInactiveOrDropped = normalizeTraineeStatus(trainee.status) !== "Active";
                const existingLog = current.logs.find((l) => l.sessionNumber === targetSessionNumber);
                const prevStatus: SessionAttendanceMark = existingLog?.status ?? "Present";
                const mark: SessionAttendanceMark = isInactiveOrDropped
                    ? prevStatus
                    : (dailyMarks[trainee.id] ?? "Present");
                const customNote = (dailyNotes[trainee.id] ?? "").trim();

                const defaultNote = isInactiveOrDropped
                    ? `Excluded (${normalizeTraineeStatus(trainee.status)})`
                    : mark === "Present"
                      ? "Attended on time"
                      : mark === "Excused"
                        ? "Approved leave request (Excused)"
                        : mark === "Unexcused"
                          ? "Absent without prior notice (Unexcused)"
                          : "Arrived late";

                if (editingPast) {
                    const statusChanged = !isInactiveOrDropped && prevStatus !== mark;
                    const nextAuditTrail: AttendanceAuditEntry[] = [
                        ...(existingLog?.auditTrail ?? []),
                        ...(statusChanged
                            ? [
                                  {
                                      previousStatus: prevStatus,
                                      newStatus: mark,
                                      modifiedBy: "Admin",
                                      modifiedAt: auditDateStr,
                                      reason: auditReason.trim(),
                                  },
                              ]
                            : []),
                    ];

                    const updatedLog: TraineeAttendanceLogItem = {
                        sessionNumber: targetSessionNumber,
                        date: sessionDate,
                        topic: topicLabel,
                        status: mark,
                        note: customNote || (statusChanged ? defaultNote : (existingLog?.note ?? defaultNote)),
                        ...(nextAuditTrail.length > 0 ? { auditTrail: nextAuditTrail } : {}),
                    };

                    const otherLogs = current.logs.filter((l) => l.sessionNumber !== targetSessionNumber);
                    nextRecords[trainee.id] = recalculateRecordFromLogs(
                        trainee.id,
                        [...otherLogs, updatedLog],
                        todayIso,
                    );
                } else {
                    const newLog: TraineeAttendanceLogItem = {
                        sessionNumber: targetSessionNumber,
                        date: sessionDate,
                        topic: topicLabel,
                        status: mark,
                        note: customNote || defaultNote,
                    };

                    const otherLogs = current.logs.filter((l) => l.sessionNumber !== targetSessionNumber);
                    nextRecords[trainee.id] = recalculateRecordFromLogs(
                        trainee.id,
                        [...otherLogs, newLog],
                        todayIso,
                    );
                }
            }

            const nextConducted = editingPast
                ? prev.conductedSessions
                : Math.max(prev.conductedSessions, targetSessionNumber);

            return {
                ...prev,
                conductedSessions: nextConducted,
                plannedSessions: Math.max(prev.plannedSessions, nextConducted),
                recordsByTraineeId: nextRecords,
            };
        });

        setTakeAttendanceOpen(false);
        toast.success(
            isPastSession
                ? `Updated past attendance for Session #${targetSessionNumber} (${sessionDate}). Audit trail & KPIs updated!`
                : `Saved attendance for Session #${targetSessionNumber} (${sessionDate}). Statistics updated!`,
        );
    };

    const handleOpenLogsModal = (trainee: Trainee) => {
        const record = attendanceState.recordsByTraineeId[trainee.id];
        const validLogs = (record?.logs ?? []).filter((l) => !l.date || l.date <= todayIso);
        const initialMarks: Record<number, SessionAttendanceMark> = {};
        const initialNotes: Record<number, string> = {};
        for (const log of validLogs) {
            initialMarks[log.sessionNumber] = log.status;
            initialNotes[log.sessionNumber] = log.note ?? "";
        }
        setLogDraftMarks(initialMarks);
        setLogDraftNotes(initialNotes);
        setLogEditReason("");
        setLogModalError("");
        setActiveLogTrainee(trainee);
    };

    const activeLogRow = useMemo(() => {
        if (!activeLogTrainee) return null;
        return computedRows.find((r) => r.trainee.id === activeLogTrainee.id) ?? null;
    }, [activeLogTrainee, computedRows]);

    const validActiveLogs = useMemo(() => {
        if (!activeLogRow) return [];
        return activeLogRow.record.logs.filter((l) => !l.date || l.date <= todayIso);
    }, [activeLogRow, todayIso]);

    const changedLogSessions = useMemo(() => {
        return validActiveLogs.filter((log) => {
            const draftMark = logDraftMarks[log.sessionNumber] ?? log.status;
            return draftMark !== log.status;
        });
    }, [logDraftMarks, validActiveLogs]);

    const liveDraftSummary = useMemo(() => {
        if (!activeLogRow) return null;
        let excused = 0;
        let unexcused = 0;
        let late = 0;
        for (const log of validActiveLogs) {
            const mark = logDraftMarks[log.sessionNumber] ?? log.status;
            if (mark === "Excused") excused += 1;
            else if (mark === "Unexcused") unexcused += 1;
            else if (mark === "Late") late += 1;
        }
        const totalConducted = Math.max(1, validActiveLogs.length);
        const totalAbsent = excused + unexcused;
        const attended = Math.max(0, totalConducted - totalAbsent);
        const absentRate = Math.round((totalAbsent / totalConducted) * 1000) / 10;
        const meta = getAbsentRateMeta(absentRate);
        return {
            attended,
            totalConducted,
            excused,
            unexcused,
            late,
            totalAbsent,
            absentRate,
            meta,
        };
    }, [activeLogRow, logDraftMarks, validActiveLogs]);

    const handleSaveSessionLogsEdit = () => {
        if (!activeLogTrainee || !activeLogRow) return;
        setLogModalError("");

        if (changedLogSessions.length > 0 && !logEditReason.trim()) {
            const msg = "Reason for Edit is required when changing a past session's attendance status.";
            setLogModalError(msg);
            toast.error(msg);
            return;
        }

        const updatedLogs: TraineeAttendanceLogItem[] = validActiveLogs.map((log) => {
            const nextStatus = logDraftMarks[log.sessionNumber] ?? log.status;
            const nextNoteRaw = (logDraftNotes[log.sessionNumber] ?? "").trim();
            const statusChanged = nextStatus !== log.status;

            const defaultNote =
                nextStatus === "Present"
                    ? "Attended on time"
                    : nextStatus === "Excused"
                      ? "Approved leave request (Excused)"
                      : nextStatus === "Unexcused"
                        ? "Absent without prior notice (Unexcused)"
                        : "Arrived late";

            const nextAuditTrail: AttendanceAuditEntry[] = [
                ...(log.auditTrail ?? []),
                ...(statusChanged
                    ? [
                          {
                              previousStatus: log.status,
                              newStatus: nextStatus,
                              modifiedBy: "Admin",
                              modifiedAt: todayIso,
                              reason: logEditReason.trim(),
                          },
                      ]
                    : []),
            ];

            return {
                ...log,
                status: nextStatus,
                note:
                    nextNoteRaw && (!statusChanged || nextNoteRaw !== log.note)
                        ? nextNoteRaw
                        : statusChanged
                          ? `${defaultNote} (${logEditReason.trim()})`
                          : (log.note ?? defaultNote),
                ...(nextAuditTrail.length > 0 ? { auditTrail: nextAuditTrail } : {}),
            };
        });

        updateAttendanceState((prev) => ({
            ...prev,
            recordsByTraineeId: {
                ...prev.recordsByTraineeId,
                [activeLogTrainee.id]: recalculateRecordFromLogs(
                    activeLogTrainee.id,
                    updatedLogs,
                    todayIso,
                ),
            },
        }));

        toast.success(`Updated session attendance history for ${activeLogTrainee.fullName}.`);
        setActiveLogTrainee(null);
    };

    return (
        <div className="flex flex-1 min-h-0 flex-col gap-3" data-testid="attendance-tracker-view">
            {/* Header & Action Bar */}
            <div className="flex shrink-0 flex-col gap-2.5 rounded-lg border bg-muted/20 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-foreground sm:text-lg">
                    Attendance &amp; Absence Statistics
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportReport}
                        className="h-8"
                    >
                        <Download className="size-3.5" aria-hidden />
                        <span>Export Report</span>
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleOpenTakeAttendance}
                        className="h-8 bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                        <ClipboardCheck className="size-3.5" aria-hidden />
                        <span>Take Attendance</span>
                    </Button>
                </div>
            </div>

            {/* 3 Compact Interactive KPI Summary Cards */}
            <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
                {/* 1. Class Attendance Rate (click filters Eligible) */}
                <button
                    type="button"
                    aria-pressed={statusFilter === "Eligible"}
                    onClick={() =>
                        setStatusFilter((prev) => (prev === "Eligible" ? "" : "Eligible"))
                    }
                    className={cn(
                        "w-full cursor-pointer rounded-lg border bg-card px-4 py-2.5 text-left shadow-xs transition-all hover:border-emerald-300 hover:shadow-sm",
                        statusFilter === "Eligible" && "border-emerald-500 ring-2 ring-emerald-500/40",
                    )}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Class Attendance Rate
                            </span>
                            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                                <p
                                    className="text-lg font-bold leading-tight text-emerald-600 dark:text-emerald-400"
                                    data-testid="summary-attendance-rate"
                                >
                                    {summaryStats.classAttendanceRate}%
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                    Eligible (&lt; 10% Absent) across {trainees.length} trainees
                                </p>
                            </div>
                        </div>
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="size-3.5" aria-hidden />
                        </div>
                    </div>
                </button>

                {/* 2. At Risk (10% - 19% Absent) */}
                <button
                    type="button"
                    aria-pressed={statusFilter === "At Risk"}
                    onClick={() =>
                        setStatusFilter((prev) => (prev === "At Risk" ? "" : "At Risk"))
                    }
                    className={cn(
                        "w-full cursor-pointer rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-2.5 text-left shadow-xs transition-all hover:border-amber-400 hover:shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20",
                        statusFilter === "At Risk" && "border-amber-500 ring-2 ring-amber-500/45",
                    )}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                                At Risk (10% - 19% Absent)
                            </span>
                            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                                <p
                                    className="text-lg font-bold leading-tight text-amber-700 dark:text-amber-400"
                                    data-testid="summary-at-risk"
                                >
                                    {summaryStats.atRiskCount}{" "}
                                    {summaryStats.atRiskCount === 1 ? "Trainee" : "Trainees"}
                                </p>
                                <p className="truncate text-[11px] text-amber-700/80 dark:text-amber-300/80">
                                    Approaching maximum absence threshold
                                </p>
                            </div>
                        </div>
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                            <AlertTriangle className="size-3.5" aria-hidden />
                        </div>
                    </div>
                </button>

                {/* 3. Critical / Disqualified (>= 20% Absent) */}
                <button
                    type="button"
                    aria-pressed={statusFilter === "Disqualified"}
                    onClick={() =>
                        setStatusFilter((prev) => (prev === "Disqualified" ? "" : "Disqualified"))
                    }
                    className={cn(
                        "w-full cursor-pointer rounded-lg border border-rose-200 bg-rose-50/50 px-4 py-2.5 text-left shadow-xs transition-all hover:border-rose-400 hover:shadow-sm dark:border-rose-900/60 dark:bg-rose-950/25",
                        statusFilter === "Disqualified" && "border-rose-500 ring-2 ring-rose-500/45",
                    )}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                                Critical (&gt;= 20% Absent)
                            </span>
                            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                                <p
                                    className="text-lg font-bold leading-tight text-rose-600 dark:text-rose-400"
                                    data-testid="summary-critical"
                                >
                                    {summaryStats.criticalCount}{" "}
                                    {summaryStats.criticalCount === 1 ? "Trainee" : "Trainees"}
                                </p>
                                <p className="truncate text-[11px] text-rose-700/80 dark:text-rose-300/80">
                                    Disqualified — Exceeded allowed absence limit
                                </p>
                            </div>
                        </div>
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                            <ShieldAlert className="size-3.5" aria-hidden />
                        </div>
                    </div>
                </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                    />
                    <Input
                        aria-label="Search attendance trainees"
                        placeholder="Search by name or student ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8.5 pl-9 text-sm"
                    />
                </div>

                <div className="w-full sm:w-56">
                    <NativeSelect
                        aria-label="Filter by Attendance Status"
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(
                                e.target.value as "" | AttendanceStatusLabel,
                            )
                        }
                        className="h-8.5 text-sm"
                    >
                        <option value="">All Attendance Statuses</option>
                        <option value="Eligible">Eligible (&lt; 10% Absent)</option>
                        <option value="At Risk">At Risk (10% - 19% Absent)</option>
                        <option value="Disqualified">Disqualified (&gt;= 20% Absent)</option>
                    </NativeSelect>
                </div>
            </div>

            {/* Expanded Single-Scroll Attendance Table */}
            <div className="flex-1 min-h-0 max-h-[calc(100vh-300px)] w-full overflow-x-auto overflow-y-auto rounded-md border">
                <table
                    aria-label="Trainee Attendance Table"
                    className="w-full caption-bottom border-separate border-spacing-0 text-sm [&_td]:border-r [&_td]:border-b [&_td:last-child]:border-r-0 [&_tbody_tr:last-child_td]:border-b-0 [&_th]:border-r [&_th:last-child]:border-r-0"
                >
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={cn(ATTENDANCE_STICKY_HEADER_CLASS, "w-[5%] text-center")}>
                                No.
                            </TableHead>
                            <TableHead className={cn(ATTENDANCE_STICKY_HEADER_CLASS, "w-[16%] text-left")}>
                                Full Name
                            </TableHead>
                            <TableHead className={cn(ATTENDANCE_STICKY_HEADER_CLASS, "w-[10%] text-left")}>
                                Student ID
                            </TableHead>
                            <TableHead className={cn(ATTENDANCE_STICKY_HEADER_CLASS, "w-[20%] text-left")}>
                                Email
                            </TableHead>
                            <TableHead
                                aria-sort={sortKey === "attended" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                                className={cn(ATTENDANCE_STICKY_HEADER_CLASS, "w-[11%] text-center")}
                            >
                                <SortableHeaderButton
                                    label="Attended / Total"
                                    columnKey="attended"
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    onSort={handleToggleSort}
                                />
                            </TableHead>
                            <TableHead
                                aria-sort={sortKey === "absent" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                                className={cn(ATTENDANCE_STICKY_HEADER_CLASS, "w-[15%] text-center")}
                            >
                                <SortableHeaderButton
                                    label="Absent (Excused / Unexcused)"
                                    columnKey="absent"
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    onSort={handleToggleSort}
                                />
                            </TableHead>
                            <TableHead
                                aria-sort={sortKey === "late" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                                className={cn(ATTENDANCE_STICKY_HEADER_CLASS, "w-[7%] text-center")}
                            >
                                <SortableHeaderButton
                                    label="Late"
                                    columnKey="late"
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    onSort={handleToggleSort}
                                />
                            </TableHead>
                            <TableHead
                                aria-sort={sortKey === "absentRate" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                                className={cn(ATTENDANCE_STICKY_HEADER_CLASS, "w-[10%] text-left")}
                            >
                                <SortableHeaderButton
                                    label="Absent Rate (Max 20%)"
                                    columnKey="absentRate"
                                    sortKey={sortKey}
                                    sortDir={sortDir}
                                    onSort={handleToggleSort}
                                />
                            </TableHead>
                            <TableHead className={cn(ATTENDANCE_STICKY_HEADER_CLASS, "w-[6%] text-center")}>
                                Attendance Status
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {sortedRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users className="size-7 text-muted-foreground/70" aria-hidden />
                                        <p className="text-sm">No trainees match your filter criteria.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedRows.map((row, index) => {
                                const {
                                    trainee,
                                    studentId,
                                    record,
                                    attended,
                                    totalConducted,
                                    totalAbsent,
                                    absentRate,
                                    meta,
                                } = row;
                                const progressWidth = Math.min(100, Math.max(0, absentRate));

                                return (
                                    <TableRow
                                        key={trainee.id}
                                        className={cn(
                                            absentRate >= 20 &&
                                                "bg-rose-50/35 hover:bg-rose-50/60 dark:bg-rose-950/15",
                                            absentRate >= 10 &&
                                                absentRate < 20 &&
                                                "bg-amber-50/25 hover:bg-amber-50/50 dark:bg-amber-950/10",
                                        )}
                                    >
                                        <TableCell className="px-3 py-2 text-center text-sm text-foreground">
                                            {index + 1}
                                        </TableCell>

                                        <TableCell className="px-3 py-2 text-left">
                                            <TooltipWrapper
                                                content="Click to view attendance logs"
                                                side="bottom"
                                                portal={false}
                                                contentClassName="z-10"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenLogsModal(trainee)}
                                                    aria-label={`View Logs for ${trainee.fullName}`}
                                                    title="Click to view attendance logs"
                                                    className="w-fit cursor-pointer text-left text-sm font-medium whitespace-nowrap text-blue-600 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:text-blue-400"
                                                >
                                                    {trainee.fullName}
                                                </button>
                                            </TooltipWrapper>
                                        </TableCell>

                                        <TableCell className="px-3 py-2 text-left text-sm font-normal whitespace-nowrap text-gray-900 dark:text-slate-100">
                                            {studentId}
                                        </TableCell>

                                        <TableCell className="px-3 py-2 text-left text-sm font-normal text-gray-900 dark:text-slate-100">
                                            <span className="block truncate">
                                                {trainee.personalEmail || trainee.email || "—"}
                                            </span>
                                        </TableCell>

                                        <TableCell className="px-3 py-2 text-center text-sm font-semibold text-foreground whitespace-nowrap">
                                            {attended} / {totalConducted}
                                        </TableCell>

                                        <TableCell className="px-3 py-2 text-center text-sm whitespace-nowrap">
                                            <span className="font-semibold text-foreground">{totalAbsent}</span>{" "}
                                            <span className="text-xs text-muted-foreground">
                                                ({record.excusedAbsent}E / {record.unexcusedAbsent}U)
                                            </span>
                                        </TableCell>

                                        <TableCell className="px-3 py-2 text-center text-sm whitespace-nowrap">
                                            {record.lateCount > 0 ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                    <Clock className="size-3" aria-hidden />
                                                    {record.lateCount}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </TableCell>

                                        <TableCell className="px-3 py-2">
                                            <div className="space-y-1">
                                                <div className="text-xs">
                                                    <span className={meta.textClassName}>{absentRate}%</span>
                                                </div>
                                                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all duration-300",
                                                            meta.barClassName,
                                                        )}
                                                        style={{ width: `${progressWidth}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="px-3 py-2 text-center">
                                            <Badge
                                                variant="secondary"
                                                className={cn(
                                                    "rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                                                    meta.badgeClassName,
                                                )}
                                            >
                                                {meta.statusLabel}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </table>
            </div>

            {/* Bottom Navigation */}
            <div className="flex shrink-0 justify-end pt-0.5">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onBack}
                    className="gap-1.5 font-medium"
                >
                    <ArrowLeft className="size-4" aria-hidden />
                    <span>Back to Trainee List</span>
                </Button>
            </div>

            {/* Take Daily Attendance Modal */}
            <Dialog open={takeAttendanceOpen} onOpenChange={setTakeAttendanceOpen}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex flex-wrap items-center gap-2">
                            <ClipboardCheck className="size-5 text-blue-600" aria-hidden />
                            <span>
                                Take Daily Attendance — Session #{selectedSessionNumber}
                            </span>
                            {isFutureSession ? (
                                <Badge
                                    variant="secondary"
                                    className="border border-rose-300 bg-rose-100 text-xs font-semibold text-rose-800 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                >
                                    Upcoming - Locked
                                </Badge>
                            ) : isPastSession ? (
                                <Badge
                                    variant="secondary"
                                    className="border border-amber-300 bg-amber-100 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                >
                                    Editing Past Session
                                </Badge>
                            ) : (
                                <Badge
                                    variant="secondary"
                                    className="border border-emerald-200 bg-emerald-100 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                >
                                    Current Active Session
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Select a session and mark attendance status for active trainees in{" "}
                            <strong>{classItem.code ?? classItem.name}</strong> (Schedule:{" "}
                            {expectedStartDate} to {expectedEndDate}). Future sessions (date &gt;{" "}
                            {todayIso}) are strictly locked.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Session Selector, Date & Topic */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="attendance-session-select">
                                    Attendance Session <span className="text-destructive">*</span>
                                </Label>
                                <NativeSelect
                                    id="attendance-session-select"
                                    aria-label="Select Attendance Session"
                                    value={String(selectedSessionNumber)}
                                    onChange={(e) => handleSessionSelectChange(Number(e.target.value))}
                                >
                                    {Array.from(
                                        { length: attendanceState.plannedSessions },
                                        (_, i) => i + 1,
                                    ).map((sNum) => {
                                        const padded = String(sNum).padStart(2, "0");
                                        const schedDate = getScheduledDateForSession(sNum, attendanceState);
                                        const isFuture =
                                            sNum > attendanceState.conductedSessions + 1 ||
                                            schedDate > todayIso;
                                        const isCurrent =
                                            !isFuture &&
                                            (schedDate === todayIso ||
                                                sNum === attendanceState.conductedSessions + 1);
                                        const isCompleted = !isFuture && !isCurrent;
                                        const label = isCompleted
                                            ? `Session #${padded} (${schedDate}) — Completed (Editable with Audit Reason)`
                                            : isCurrent
                                              ? `Session #${padded} (${schedDate}) — Today (Current Session)`
                                              : `Session #${padded} (${schedDate}) — Upcoming - Locked`;
                                        return (
                                            <option key={sNum} value={sNum} disabled={isFuture}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                </NativeSelect>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="attendance-session-date">
                                    Session Date <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="attendance-session-date"
                                    aria-label="Session Date"
                                    type="date"
                                    min={expectedStartDate}
                                    max={maxSelectableDate}
                                    value={sessionDate}
                                    onChange={(e) => {
                                        setSessionDate(e.target.value);
                                        if (attendanceFormError) setAttendanceFormError("");
                                    }}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="attendance-session-topic">Session Topic / Note</Label>
                                <Input
                                    id="attendance-session-topic"
                                    aria-label="Session Topic"
                                    placeholder="e.g. Session 21: Spring Boot Security"
                                    value={sessionTopic}
                                    onChange={(e) => setSessionTopic(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Future Date Warning Banner */}
                        {isFutureSession && (
                            <div
                                role="alert"
                                data-testid="future-session-warning"
                                className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                            >
                                <AlertTriangle className="size-4 shrink-0 text-rose-600" aria-hidden />
                                <span>
                                    Cannot take attendance for a future date (Session scheduled for{" "}
                                    {sessionDate || "future date"}).
                                </span>
                            </div>
                        )}

                        {/* Mandatory Audit Reason when editing a Past Session */}
                        {isPastSession && (
                            <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/25">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Label
                                        htmlFor="attendance-audit-reason"
                                        className="text-xs font-semibold text-amber-900 dark:text-amber-200"
                                    >
                                        Audit Reason for Modification{" "}
                                        {modifiedPastTrainees.length > 0 && (
                                            <span className="text-destructive">*</span>
                                        )}
                                    </Label>
                                    <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                                        {modifiedPastTrainees.length === 0
                                            ? "No status changes staged yet"
                                            : `${modifiedPastTrainees.length} trainee status change(s) staged`}
                                    </span>
                                </div>
                                <Input
                                    id="attendance-audit-reason"
                                    aria-label="Audit Reason for Modification"
                                    placeholder="e.g. Late medical certificate submitted, Data entry correction..."
                                    value={auditReason}
                                    onChange={(e) => {
                                        setAuditReason(e.target.value);
                                        if (attendanceFormError) setAttendanceFormError("");
                                    }}
                                    className="mt-1.5 h-8 bg-background text-xs"
                                />
                            </div>
                        )}

                        {attendanceFormError && (
                            <div
                                role="alert"
                                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                            >
                                {attendanceFormError}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                            <span className="text-xs text-muted-foreground">
                                Quick Action: Reset all active trainees to Present with one click.
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isFutureSession}
                                onClick={handleMarkAllPresent}
                                className="h-8 border-emerald-600 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-300"
                            >
                                <CheckCircle2 className="mr-1.5 size-3.5" aria-hidden />
                                Mark All Present
                            </Button>
                        </div>

                        <div className="max-h-80 overflow-y-auto rounded-md border">
                            <Table aria-label="Daily Attendance Roll Call">
                                <TableHeader className="sticky top-0 z-10 bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-10 px-2.5 text-center">#</TableHead>
                                        <TableHead className="w-48 px-2.5">Trainee</TableHead>
                                        <TableHead className="w-80 px-2.5">Attendance Status</TableHead>
                                        <TableHead className="px-2.5">Note / Reason</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {trainees.map((trainee, idx) => {
                                        const enrollmentStatus = normalizeTraineeStatus(trainee.status);
                                        const isInactiveOrDropped = enrollmentStatus !== "Active";
                                        const currentMark = dailyMarks[trainee.id] ?? "Present";
                                        const currentNote = dailyNotes[trainee.id] ?? "";
                                        const isExcusedMissingNote =
                                            !isInactiveOrDropped &&
                                            currentMark === "Excused" &&
                                            !currentNote.trim();
                                        const studentId = formatFptStudentIdForSite(
                                            trainee.fptAccount || trainee.code,
                                            classSite,
                                            trainee.id,
                                        );

                                        const segmentedOptions: Array<{
                                            value: SessionAttendanceMark;
                                            shortLabel: string;
                                            activeClass: string;
                                        }> = [
                                            {
                                                value: "Present",
                                                shortLabel: "Present (P)",
                                                activeClass:
                                                    "bg-emerald-600 text-white border-emerald-600 shadow-xs",
                                            },
                                            {
                                                value: "Late",
                                                shortLabel: "Late (L)",
                                                activeClass:
                                                    "bg-amber-500 text-white border-amber-500 shadow-xs",
                                            },
                                            {
                                                value: "Excused",
                                                shortLabel: "Excused (E)",
                                                activeClass:
                                                    "bg-blue-600 text-white border-blue-600 shadow-xs",
                                            },
                                            {
                                                value: "Unexcused",
                                                shortLabel: "Unexcused (U)",
                                                activeClass:
                                                    "bg-rose-600 text-white border-rose-600 shadow-xs",
                                            },
                                        ];

                                        return (
                                            <TableRow
                                                key={trainee.id}
                                                data-testid={
                                                    isInactiveOrDropped
                                                        ? `attendance-row-disabled-${trainee.id}`
                                                        : undefined
                                                }
                                                className={cn(
                                                    (isInactiveOrDropped || isFutureSession) &&
                                                        "bg-muted/35 opacity-60",
                                                )}
                                            >
                                                <TableCell className="px-2.5 py-2 text-center text-xs">
                                                    {idx + 1}
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-xs font-medium text-foreground">
                                                            {trainee.fullName}
                                                        </span>
                                                        {isInactiveOrDropped && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="px-1.5 py-0 text-[10px]"
                                                            >
                                                                {enrollmentStatus === "Dropped"
                                                                    ? "Dropped Out"
                                                                    : "Inactive"}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {studentId}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2">
                                                    <div className="flex flex-col gap-1.5">
                                                        {/* Segmented Status Selector */}
                                                        <div
                                                            role="group"
                                                            aria-label={`Segmented status for ${trainee.fullName}`}
                                                            className="grid grid-cols-4 gap-1"
                                                        >
                                                            {segmentedOptions.map((opt) => {
                                                                const active = currentMark === opt.value;
                                                                const lockOption =
                                                                    isInactiveOrDropped ||
                                                                    (isFutureSession &&
                                                                        opt.value !== "Excused");
                                                                return (
                                                                    <button
                                                                        key={opt.value}
                                                                        type="button"
                                                                        disabled={lockOption}
                                                                        aria-pressed={active}
                                                                        aria-label={`Mark ${trainee.fullName} as ${opt.value}`}
                                                                        onClick={() => {
                                                                            setDailyMarks((prev) => ({
                                                                                ...prev,
                                                                                [trainee.id]: opt.value,
                                                                            }));
                                                                            if (attendanceFormError) {
                                                                                setAttendanceFormError("");
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            "cursor-pointer rounded border px-1.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                                                                            active
                                                                                ? opt.activeClass
                                                                                : "border-border bg-background text-muted-foreground hover:bg-muted",
                                                                        )}
                                                                    >
                                                                        {opt.shortLabel}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Accessible Select fallback synced with segmented buttons */}
                                                        <NativeSelect
                                                            aria-label={`Attendance status for ${trainee.fullName}`}
                                                            disabled={isInactiveOrDropped || isFutureSession}
                                                            value={currentMark}
                                                            onChange={(e) => {
                                                                setDailyMarks((prev) => ({
                                                                    ...prev,
                                                                    [trainee.id]: e.target
                                                                        .value as SessionAttendanceMark,
                                                                }));
                                                                if (attendanceFormError) {
                                                                    setAttendanceFormError("");
                                                                }
                                                            }}
                                                            className="sr-only"
                                                        >
                                                            <option value="Present" disabled={isFutureSession}>
                                                                Present
                                                            </option>
                                                            <option value="Late" disabled={isFutureSession}>
                                                                Late
                                                            </option>
                                                            <option value="Excused">
                                                                Absent - Excused (E)
                                                            </option>
                                                            <option value="Unexcused" disabled={isFutureSession}>
                                                                Absent - Unexcused (U)
                                                            </option>
                                                        </NativeSelect>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2">
                                                    <Input
                                                        aria-label={`Attendance note for ${trainee.fullName}`}
                                                        disabled={isInactiveOrDropped || isFutureSession}
                                                        required={!isInactiveOrDropped && currentMark === "Excused"}
                                                        placeholder={
                                                            isInactiveOrDropped
                                                                ? `Excluded (${enrollmentStatus})`
                                                                : isFutureSession
                                                                  ? "Future session locked"
                                                                  : currentMark === "Excused"
                                                                    ? "Required: Reason for excused leave..."
                                                                    : "Optional note / reason..."
                                                        }
                                                        value={currentNote}
                                                        onChange={(e) => {
                                                            setDailyNotes((prev) => ({
                                                                ...prev,
                                                                [trainee.id]: e.target.value,
                                                            }));
                                                            if (attendanceFormError) {
                                                                setAttendanceFormError("");
                                                            }
                                                        }}
                                                        className={cn(
                                                            "h-8 text-xs",
                                                            isExcusedMissingNote &&
                                                                "border-amber-500 focus-visible:ring-amber-500",
                                                        )}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setTakeAttendanceOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={isFutureSession}
                            onClick={handleSaveDailyAttendance}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        >
                            <Save className="mr-1.5 size-4" aria-hidden />
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Logs & Session-Level Edit Modal */}
            <Dialog open={Boolean(activeLogTrainee)} onOpenChange={(open) => !open && setActiveLogTrainee(null)}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="size-5 text-blue-600" aria-hidden />
                            Attendance Logs — {activeLogTrainee?.fullName}
                        </DialogTitle>
                        <DialogDescription>
                            Session-by-session attendance history for{" "}
                            <strong>{activeLogRow?.studentId}</strong> (
                            {liveDraftSummary?.attended ?? activeLogRow?.attended} /{" "}
                            {liveDraftSummary?.totalConducted ?? activeLogRow?.totalConducted} sessions attended •{" "}
                            <strong>{liveDraftSummary?.absentRate ?? activeLogRow?.absentRate}%</strong> absent).
                            Totals are automatically calculated from completed sessions (&le; {todayIso}).
                        </DialogDescription>
                    </DialogHeader>

                    {activeLogRow && liveDraftSummary ? (
                        <div className="space-y-4 py-2">
                            {/* Read-Only Calculated Attendance Summary (Synchronized with Session History) */}
                            <div className="rounded-md border bg-muted/25 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Calculated Attendance Summary (From Session History)
                                    </span>
                                    <Badge
                                        variant="secondary"
                                        className={cn(
                                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                                            liveDraftSummary.meta.badgeClassName,
                                        )}
                                    >
                                        {liveDraftSummary.meta.statusLabel} ({liveDraftSummary.absentRate}%)
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                    <div className="rounded border bg-background px-3 py-2">
                                        <div className="text-[11px] text-muted-foreground">Attended / Total</div>
                                        <div className="text-sm font-bold text-foreground">
                                            {liveDraftSummary.attended} / {liveDraftSummary.totalConducted}
                                        </div>
                                    </div>
                                    <div className="rounded border bg-background px-3 py-2">
                                        <div className="text-[11px] text-muted-foreground">Excused Absent (E)</div>
                                        <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                            {liveDraftSummary.excused}
                                        </div>
                                    </div>
                                    <div className="rounded border bg-background px-3 py-2">
                                        <div className="text-[11px] text-muted-foreground">Unexcused Absent (U)</div>
                                        <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                                            {liveDraftSummary.unexcused}
                                        </div>
                                    </div>
                                    <div className="rounded border bg-background px-3 py-2">
                                        <div className="text-[11px] text-muted-foreground">Late Sessions (L)</div>
                                        <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                                            {liveDraftSummary.late}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Reason for Edit input when modifying session status in logs */}
                            <div
                                className={cn(
                                    "rounded-md border p-3 transition-colors",
                                    changedLogSessions.length > 0
                                        ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/25"
                                        : "bg-muted/15",
                                )}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Label
                                        htmlFor="log-edit-reason"
                                        className="text-xs font-semibold text-foreground"
                                    >
                                        Reason for Edit{" "}
                                        {changedLogSessions.length > 0 && (
                                            <span className="text-destructive">*</span>
                                        )}
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground">
                                        {changedLogSessions.length === 0
                                            ? "Change any session status below to stage an edit"
                                            : `${changedLogSessions.length} session(s) modified`}
                                    </span>
                                </div>
                                <Input
                                    id="log-edit-reason"
                                    aria-label="Reason for Edit"
                                    placeholder="Required when changing a past session's status (e.g., Late medical certificate verified)..."
                                    value={logEditReason}
                                    onChange={(e) => {
                                        setLogEditReason(e.target.value);
                                        if (logModalError) setLogModalError("");
                                    }}
                                    className="mt-1.5 h-8 bg-background text-xs"
                                />
                            </div>

                            {logModalError && (
                                <div
                                    role="alert"
                                    className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                                >
                                    {logModalError}
                                </div>
                            )}

                            {/* Session History Logs Table */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Session History ({validActiveLogs.length} Sessions)
                                </Label>
                                <div className="max-h-72 overflow-y-auto rounded-md border">
                                    <Table>
                                        <TableHeader className="sticky top-0 z-10 bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-20 px-2.5 text-center text-xs">
                                                    Session #
                                                </TableHead>
                                                <TableHead className="w-24 px-2.5 text-xs">Date</TableHead>
                                                <TableHead className="px-2.5 text-xs">Session Topic</TableHead>
                                                <TableHead className="w-40 px-2.5 text-center text-xs">
                                                    Status
                                                </TableHead>
                                                <TableHead className="px-2.5 text-xs">Note &amp; Audit Trail</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {validActiveLogs.map((log) => {
                                                const draftStatus =
                                                    logDraftMarks[log.sessionNumber] ?? log.status;
                                                const draftNote =
                                                    logDraftNotes[log.sessionNumber] ?? log.note ?? "";
                                                const isRowFuture = Boolean(log.date && log.date > todayIso);

                                                return (
                                                    <TableRow key={`${log.sessionNumber}-${log.date}`}>
                                                        <TableCell className="px-2.5 py-2 text-center text-xs font-semibold text-foreground">
                                                            #{String(log.sessionNumber).padStart(2, "0")}
                                                        </TableCell>
                                                        <TableCell className="px-2.5 py-2 text-xs whitespace-nowrap">
                                                            {log.date}
                                                        </TableCell>
                                                        <TableCell className="px-2.5 py-2 text-xs font-medium">
                                                            {log.topic}
                                                        </TableCell>
                                                        <TableCell className="px-2.5 py-2 text-center">
                                                            <NativeSelect
                                                                aria-label={`Session #${log.sessionNumber} status`}
                                                                disabled={isRowFuture}
                                                                value={draftStatus}
                                                                onChange={(e) => {
                                                                    const nextVal = e.target
                                                                        .value as SessionAttendanceMark;
                                                                    setLogDraftMarks((prev) => ({
                                                                        ...prev,
                                                                        [log.sessionNumber]: nextVal,
                                                                    }));
                                                                    if (logModalError) setLogModalError("");
                                                                }}
                                                                className={cn(
                                                                    "h-7 text-xs font-medium",
                                                                    draftStatus === "Present" &&
                                                                        "border-emerald-300 bg-emerald-50/70 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
                                                                    draftStatus === "Excused" &&
                                                                        "border-blue-300 bg-blue-50/70 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
                                                                    draftStatus === "Unexcused" &&
                                                                        "border-rose-300 bg-rose-50/70 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
                                                                    draftStatus === "Late" &&
                                                                        "border-amber-300 bg-amber-50/70 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
                                                                )}
                                                            >
                                                                <option value="Present" disabled={isRowFuture}>
                                                                    Present
                                                                </option>
                                                                <option value="Late" disabled={isRowFuture}>
                                                                    Late
                                                                </option>
                                                                <option value="Excused">Excused</option>
                                                                <option value="Unexcused" disabled={isRowFuture}>
                                                                    Unexcused
                                                                </option>
                                                            </NativeSelect>
                                                        </TableCell>
                                                        <TableCell className="px-2.5 py-2 text-xs text-muted-foreground">
                                                            <Input
                                                                aria-label={`Session #${log.sessionNumber} note`}
                                                                disabled={isRowFuture}
                                                                value={draftNote}
                                                                onChange={(e) =>
                                                                    setLogDraftNotes((prev) => ({
                                                                        ...prev,
                                                                        [log.sessionNumber]: e.target.value,
                                                                    }))
                                                                }
                                                                className="h-7 text-xs"
                                                            />
                                                            {log.auditTrail?.map((audit, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    data-testid={`audit-trail-session-${log.sessionNumber}`}
                                                                    className="mt-1 rounded border border-amber-200 bg-amber-50/80 px-2 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                                                >
                                                                    Updated from{" "}
                                                                    <strong>{audit.previousStatus}</strong> to{" "}
                                                                    <strong>{audit.newStatus}</strong> by{" "}
                                                                    {audit.modifiedBy} on {audit.modifiedAt} — Reason:{" "}
                                                                    {audit.reason}
                                                                </div>
                                                            ))}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setActiveLogTrainee(null)}>
                            Close
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveSessionLogsEdit}
                            className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                            <Save className="mr-1.5 size-4" aria-hidden />
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

