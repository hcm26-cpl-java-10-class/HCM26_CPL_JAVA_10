import {
    AlertTriangle,
    ArrowLeft,
    CalendarCheck,
    CheckCircle2,
    ClipboardCheck,
    Clock,
    History,
    Pencil,
    Save,
    Search,
    ShieldAlert,
    Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { formatFptStudentIdForSite } from "./TraineeModal";

export type SessionAttendanceMark = "Present" | "Excused" | "Unexcused" | "Late";

export interface TraineeAttendanceLogItem {
    sessionNumber: number;
    date: string;
    topic: string;
    status: SessionAttendanceMark;
    note?: string;
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

const SESSION_DATES: string[] = [
    "2026-05-25",
    "2026-05-27",
    "2026-05-29",
    "2026-06-01",
    "2026-06-03",
    "2026-06-05",
    "2026-06-08",
    "2026-06-10",
    "2026-06-12",
    "2026-06-15",
    "2026-06-17",
    "2026-06-19",
    "2026-06-22",
    "2026-06-24",
    "2026-06-26",
    "2026-06-29",
    "2026-07-01",
    "2026-07-03",
    "2026-07-06",
    "2026-07-08",
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

function buildInitialLogs(
    totalSessions: number,
    excused: number,
    unexcused: number,
    late: number,
): TraineeAttendanceLogItem[] {
    const logs: TraineeAttendanceLogItem[] = [];
    let remExcused = excused;
    let remUnexcused = unexcused;
    let remLate = late;

    for (let i = 0; i < totalSessions; i++) {
        const sessionNumber = i + 1;
        const date = SESSION_DATES[i] ?? `2026-07-${String(10 + i).padStart(2, "0")}`;
        const topic = SESSION_TOPICS[i] ?? `Session ${String(sessionNumber).padStart(2, "0")}: Training Session`;

        let status: SessionAttendanceMark = "Present";
        let note = "Attended on time";

        if (remUnexcused > 0 && i >= 3 && i % 4 === 3) {
            status = "Unexcused";
            note = "Absent without prior notice (Không phép)";
            remUnexcused--;
        } else if (remExcused > 0 && i >= 5 && i % 5 === 0) {
            status = "Excused";
            note = "Approved leave request (Có phép)";
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
            logs[i].note = "Absent without prior notice (Không phép)";
            remUnexcused--;
        } else if (remExcused > 0) {
            logs[i].status = "Excused";
            logs[i].note = "Approved leave request (Có phép)";
            remExcused--;
        } else if (remLate > 0) {
            logs[i].status = "Late";
            logs[i].note = "Arrived 15 minutes late";
            remLate--;
        }
    }

    return logs;
}

const classAttendanceStore = new Map<string, ClassAttendanceState>();

export function resetClassAttendanceStoreForTest() {
    classAttendanceStore.clear();
}

function getOrInitClassAttendanceState(classId: string, trainees: Trainee[]): ClassAttendanceState {
    const existing = classAttendanceStore.get(classId);
    const conductedSessions = existing?.conductedSessions ?? 20;
    const plannedSessions = existing?.plannedSessions ?? 40;
    const recordsByTraineeId: Record<number, TraineeAttendanceRecord> = {
        ...(existing?.recordsByTraineeId ?? {}),
    };

    trainees.forEach((trainee, index) => {
        if (!recordsByTraineeId[trainee.id]) {
            const preset = PRESET_ABSENCE_PROFILES[index % PRESET_ABSENCE_PROFILES.length];
            recordsByTraineeId[trainee.id] = {
                traineeId: trainee.id,
                excusedAbsent: preset.excused,
                unexcusedAbsent: preset.unexcused,
                lateCount: preset.late,
                logs: buildInitialLogs(conductedSessions, preset.excused, preset.unexcused, preset.late),
            };
        }
    });

    const nextState: ClassAttendanceState = {
        conductedSessions,
        plannedSessions,
        recordsByTraineeId,
    };
    classAttendanceStore.set(classId, nextState);
    return nextState;
}

export function getAbsentRateMeta(absentRate: number): {
    statusLabel: "Eligible" | "Warning" | "Disqualified";
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
            statusLabel: "Warning",
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

    const [attendanceState, setAttendanceState] = useState<ClassAttendanceState>(() =>
        getOrInitClassAttendanceState(classId, trainees),
    );
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"" | "Eligible" | "Warning" | "Disqualified">("");

    // Take Daily Attendance modal state
    const [takeAttendanceOpen, setTakeAttendanceOpen] = useState(false);
    const [sessionDate, setSessionDate] = useState("2026-07-10");
    const [sessionTopic, setSessionTopic] = useState("");
    const [dailyMarks, setDailyMarks] = useState<Record<number, SessionAttendanceMark>>({});
    const [dailyNotes, setDailyNotes] = useState<Record<number, string>>({});

    // View Logs & Quick Edit modal state
    const [activeLogTrainee, setActiveLogTrainee] = useState<Trainee | null>(null);
    const [quickEditValues, setQuickEditValues] = useState<{
        excusedAbsent: number;
        unexcusedAbsent: number;
        lateCount: number;
    }>({ excusedAbsent: 0, unexcusedAbsent: 0, lateCount: 0 });

    useEffect(() => {
        const synced = getOrInitClassAttendanceState(classId, trainees);
        setAttendanceState(synced);
    }, [classId, trainees]);

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

    const handleOpenTakeAttendance = () => {
        const nextSessionNum = attendanceState.conductedSessions + 1;
        const initialMarks: Record<number, SessionAttendanceMark> = {};
        const initialNotes: Record<number, string> = {};
        for (const trainee of trainees) {
            initialMarks[trainee.id] = "Present";
            initialNotes[trainee.id] = "";
        }
        setDailyMarks(initialMarks);
        setDailyNotes(initialNotes);
        setSessionTopic(
            `Session ${String(nextSessionNum).padStart(2, "0")}: Practical Lab & Code Review`,
        );
        setTakeAttendanceOpen(true);
    };

    const handleMarkAllPresent = () => {
        const nextMarks: Record<number, SessionAttendanceMark> = {};
        for (const trainee of trainees) {
            nextMarks[trainee.id] = "Present";
        }
        setDailyMarks(nextMarks);
        toast.info("Marked all trainees as Present.");
    };

    const handleSaveDailyAttendance = () => {
        if (!sessionDate.trim()) {
            toast.error("Please select an attendance date.");
            return;
        }

        const nextSessionNumber = attendanceState.conductedSessions + 1;
        const topicLabel =
            sessionTopic.trim() ||
            `Session ${String(nextSessionNumber).padStart(2, "0")}: Daily Class Session`;

        updateAttendanceState((prev) => {
            const nextRecords: Record<number, TraineeAttendanceRecord> = { ...prev.recordsByTraineeId };

            for (const trainee of trainees) {
                const current = nextRecords[trainee.id] ?? {
                    traineeId: trainee.id,
                    excusedAbsent: 0,
                    unexcusedAbsent: 0,
                    lateCount: 0,
                    logs: [],
                };
                const mark: SessionAttendanceMark = dailyMarks[trainee.id] ?? "Present";
                const customNote = (dailyNotes[trainee.id] ?? "").trim();

                const defaultNote =
                    mark === "Present"
                        ? "Attended on time"
                        : mark === "Excused"
                          ? "Approved leave request (Có phép)"
                          : mark === "Unexcused"
                            ? "Absent without prior notice (Không phép)"
                            : "Arrived late";

                const newLog: TraineeAttendanceLogItem = {
                    sessionNumber: nextSessionNumber,
                    date: sessionDate,
                    topic: topicLabel,
                    status: mark,
                    note: customNote || defaultNote,
                };

                nextRecords[trainee.id] = {
                    traineeId: trainee.id,
                    excusedAbsent: current.excusedAbsent + (mark === "Excused" ? 1 : 0),
                    unexcusedAbsent: current.unexcusedAbsent + (mark === "Unexcused" ? 1 : 0),
                    lateCount: current.lateCount + (mark === "Late" ? 1 : 0),
                    logs: [newLog, ...current.logs],
                };
            }

            return {
                ...prev,
                conductedSessions: nextSessionNumber,
                plannedSessions: Math.max(prev.plannedSessions, nextSessionNumber),
                recordsByTraineeId: nextRecords,
            };
        });

        setTakeAttendanceOpen(false);
        toast.success(
            `Saved attendance for Session #${nextSessionNumber} (${sessionDate}). Statistics updated!`,
        );
    };

    const handleOpenLogsModal = (trainee: Trainee) => {
        const record = attendanceState.recordsByTraineeId[trainee.id];
        setQuickEditValues({
            excusedAbsent: record?.excusedAbsent ?? 0,
            unexcusedAbsent: record?.unexcusedAbsent ?? 0,
            lateCount: record?.lateCount ?? 0,
        });
        setActiveLogTrainee(trainee);
    };

    const handleSaveQuickEdit = () => {
        if (!activeLogTrainee) return;
        const maxSessions = attendanceState.conductedSessions;
        const excused = Math.max(0, Math.min(maxSessions, Number(quickEditValues.excusedAbsent) || 0));
        const unexcused = Math.max(
            0,
            Math.min(maxSessions - excused, Number(quickEditValues.unexcusedAbsent) || 0),
        );
        const late = Math.max(
            0,
            Math.min(maxSessions - excused - unexcused, Number(quickEditValues.lateCount) || 0),
        );

        updateAttendanceState((prev) => ({
            ...prev,
            recordsByTraineeId: {
                ...prev.recordsByTraineeId,
                [activeLogTrainee.id]: {
                    traineeId: activeLogTrainee.id,
                    excusedAbsent: excused,
                    unexcusedAbsent: unexcused,
                    lateCount: late,
                    logs: buildInitialLogs(prev.conductedSessions, excused, unexcused, late),
                },
            },
        }));

        toast.success(`Updated attendance summary for ${activeLogTrainee.fullName}.`);
        setActiveLogTrainee(null);
    };

    const activeLogRow = useMemo(() => {
        if (!activeLogTrainee) return null;
        return computedRows.find((r) => r.trainee.id === activeLogTrainee.id) ?? null;
    }, [activeLogTrainee, computedRows]);

    return (
        <div className="space-y-5" data-testid="attendance-tracker-view">
            {/* Header & Navigation Bar */}
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
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
                        <Badge
                            variant="secondary"
                            className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                        >
                            Attendance Tracker
                        </Badge>
                    </div>
                    <h2 className="pt-1 text-lg font-semibold text-foreground">
                        Attendance &amp; Absence Statistics — {classItem.code ?? classItem.name}
                    </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                        type="button"
                        onClick={handleOpenTakeAttendance}
                        className="bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                        <ClipboardCheck className="size-4" aria-hidden />
                        <span>Take Attendance</span>
                    </Button>
                </div>
            </div>

            {/* 4 Top Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Sessions Conducted */}
                <div className="rounded-lg border bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Sessions Conducted
                        </span>
                        <div className="rounded-md bg-blue-100 p-2 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            <CalendarCheck className="size-4" aria-hidden />
                        </div>
                    </div>
                    <p
                        className="mt-2 text-2xl font-bold text-foreground"
                        data-testid="summary-sessions-conducted"
                    >
                        {summaryStats.conductedSessions} / {summaryStats.plannedSessions} Sessions
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {Math.round((summaryStats.conductedSessions / summaryStats.plannedSessions) * 100)}% of
                        curriculum completed
                    </p>
                </div>

                {/* 2. Class Attendance Rate */}
                <div className="rounded-lg border bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Class Attendance Rate
                        </span>
                        <div className="rounded-md bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="size-4" aria-hidden />
                        </div>
                    </div>
                    <p
                        className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400"
                        data-testid="summary-attendance-rate"
                    >
                        {summaryStats.classAttendanceRate}%
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Average attendance across {trainees.length} trainees
                    </p>
                </div>

                {/* 3. At Risk (10% - 19% Absent) */}
                <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            At Risk (10% - 19% Absent)
                        </span>
                        <div className="rounded-md bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                            <AlertTriangle className="size-4" aria-hidden />
                        </div>
                    </div>
                    <p
                        className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400"
                        data-testid="summary-at-risk"
                    >
                        {summaryStats.atRiskCount} {summaryStats.atRiskCount === 1 ? "Trainee" : "Trainees"}
                    </p>
                    <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
                        Approaching maximum absence threshold
                    </p>
                </div>

                {/* 4. Critical (>= 20% Absent) */}
                <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/25">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                            Critical (&gt;= 20% Absent)
                        </span>
                        <div className="rounded-md bg-rose-100 p-2 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                            <ShieldAlert className="size-4" aria-hidden />
                        </div>
                    </div>
                    <p
                        className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400"
                        data-testid="summary-critical"
                    >
                        {summaryStats.criticalCount} {summaryStats.criticalCount === 1 ? "Trainee" : "Trainees"}
                    </p>
                    <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">
                        Exceeded allowed absence limit (Disqualified)
                    </p>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
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
                            className="pl-9"
                        />
                    </div>

                    <div className="w-full sm:w-48">
                        <NativeSelect
                            aria-label="Filter by Attendance Status"
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(
                                    e.target.value as "" | "Eligible" | "Warning" | "Disqualified",
                                )
                            }
                            className="h-9"
                        >
                            <option value="">All Attendance Statuses</option>
                            <option value="Eligible">Eligible (&lt; 10% Absent)</option>
                            <option value="Warning">Warning (10% - 19% Absent)</option>
                            <option value="Disqualified">Disqualified (&gt;= 20% Absent)</option>
                        </NativeSelect>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-emerald-500" />
                        <span>&lt; 10%: Good (Eligible)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-amber-500" />
                        <span>10% - 19%: Warning</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-rose-600" />
                        <span>&gt;= 20%: Critical (Disqualified)</span>
                    </span>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="max-h-[540px] overflow-auto rounded-md border">
                <Table
                    aria-label="Trainee Attendance Table"
                    className="min-w-[960px] border-collapse [&_td]:border-r [&_td:last-child]:border-r-0 [&_th]:border-r [&_th:last-child]:border-r-0"
                >
                    <TableHeader className="sticky top-0 z-10 bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 px-3 text-center font-semibold text-foreground">
                                No.
                            </TableHead>
                            <TableHead className="px-3 font-semibold text-foreground">
                                Full Name &amp; FPT Student ID
                            </TableHead>
                            <TableHead className="px-3 text-center font-semibold text-foreground">
                                Attended / Total
                            </TableHead>
                            <TableHead className="px-3 text-center font-semibold text-foreground">
                                Absent (Excused / Unexcused)
                            </TableHead>
                            <TableHead className="px-3 text-center font-semibold text-foreground">
                                Late
                            </TableHead>
                            <TableHead className="w-52 px-3 font-semibold text-foreground">
                                Absent Rate (%)
                            </TableHead>
                            <TableHead className="px-3 text-center font-semibold text-foreground">
                                Attendance Status
                            </TableHead>
                            <TableHead className="w-36 px-3 text-center font-semibold text-foreground">
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {filteredRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users className="size-7 text-muted-foreground/70" aria-hidden />
                                        <p className="text-sm">No trainees match your filter criteria.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRows.map((row, index) => {
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
                                        <TableCell className="px-3 py-3 text-center text-sm text-foreground">
                                            {index + 1}
                                        </TableCell>

                                        <TableCell className="px-3 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-[#3b4cb8] dark:text-blue-300">
                                                    {trainee.fullName}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {studentId} • {trainee.personalEmail || trainee.email || "—"}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="px-3 py-3 text-center text-sm font-semibold text-foreground">
                                            {attended} / {totalConducted}
                                        </TableCell>

                                        <TableCell className="px-3 py-3 text-center text-sm">
                                            <span className="font-semibold text-foreground">{totalAbsent}</span>{" "}
                                            <span className="text-xs text-muted-foreground">
                                                ({record.excusedAbsent}P / {record.unexcusedAbsent}K)
                                            </span>
                                        </TableCell>

                                        <TableCell className="px-3 py-3 text-center text-sm">
                                            {record.lateCount > 0 ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                    <Clock className="size-3" aria-hidden />
                                                    {record.lateCount}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </TableCell>

                                        <TableCell className="px-3 py-3">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className={meta.textClassName}>{absentRate}%</span>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        Max: 20%
                                                    </span>
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

                                        <TableCell className="px-3 py-3 text-center">
                                            <Badge
                                                variant="secondary"
                                                className={cn(
                                                    "rounded-full px-3 py-0.5 text-xs font-medium",
                                                    meta.badgeClassName,
                                                )}
                                            >
                                                {meta.statusLabel}
                                            </Badge>
                                        </TableCell>

                                        <TableCell className="px-3 py-3 text-center">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                aria-label={`View Logs for ${trainee.fullName}`}
                                                onClick={() => handleOpenLogsModal(trainee)}
                                                className="h-8 gap-1.5 text-xs"
                                            >
                                                <History className="size-3.5" aria-hidden />
                                                <span>View Logs</span>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Take Daily Attendance Modal */}
            <Dialog open={takeAttendanceOpen} onOpenChange={setTakeAttendanceOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardCheck className="size-5 text-blue-600" aria-hidden />
                            Take Daily Attendance — Session #{attendanceState.conductedSessions + 1}
                        </DialogTitle>
                        <DialogDescription>
                            Select the session date and mark attendance status for each trainee in{" "}
                            <strong>{classItem.code ?? classItem.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="attendance-session-date">
                                    Session Date <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="attendance-session-date"
                                    aria-label="Session Date"
                                    type="date"
                                    value={sessionDate}
                                    onChange={(e) => setSessionDate(e.target.value)}
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

                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                            <span className="text-xs text-muted-foreground">
                                Quick Action: Mark all {trainees.length} trainees as Present with one click.
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleMarkAllPresent}
                                className="h-8 border-emerald-600 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300"
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
                                        <TableHead className="px-2.5">Trainee</TableHead>
                                        <TableHead className="w-52 px-2.5">Attendance Status</TableHead>
                                        <TableHead className="px-2.5">Remark / Note</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {trainees.map((trainee, idx) => {
                                        const currentMark = dailyMarks[trainee.id] ?? "Present";
                                        const studentId = formatFptStudentIdForSite(
                                            trainee.fptAccount || trainee.code,
                                            classSite,
                                            trainee.id,
                                        );
                                        return (
                                            <TableRow key={trainee.id}>
                                                <TableCell className="px-2.5 py-2 text-center text-xs">
                                                    {idx + 1}
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2">
                                                    <div className="text-xs font-medium text-foreground">
                                                        {trainee.fullName}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {studentId}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2">
                                                    <NativeSelect
                                                        aria-label={`Attendance status for ${trainee.fullName}`}
                                                        value={currentMark}
                                                        onChange={(e) =>
                                                            setDailyMarks((prev) => ({
                                                                ...prev,
                                                                [trainee.id]: e.target
                                                                    .value as SessionAttendanceMark,
                                                            }))
                                                        }
                                                        className="h-8 text-xs"
                                                    >
                                                        <option value="Present">Present (Có mặt)</option>
                                                        <option value="Unexcused">
                                                            Absent - Unexcused (Vắng K)
                                                        </option>
                                                        <option value="Excused">
                                                            Excused (Vắng có phép P)
                                                        </option>
                                                        <option value="Late">Late (Đi muộn)</option>
                                                    </NativeSelect>
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2">
                                                    <Input
                                                        aria-label={`Attendance note for ${trainee.fullName}`}
                                                        placeholder="Optional note..."
                                                        value={dailyNotes[trainee.id] ?? ""}
                                                        onChange={(e) =>
                                                            setDailyNotes((prev) => ({
                                                                ...prev,
                                                                [trainee.id]: e.target.value,
                                                            }))
                                                        }
                                                        className="h-8 text-xs"
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
                            onClick={handleSaveDailyAttendance}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        >
                            <Save className="mr-1.5 size-4" aria-hidden />
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Logs & Quick Edit Modal */}
            <Dialog open={Boolean(activeLogTrainee)} onOpenChange={(open) => !open && setActiveLogTrainee(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="size-5 text-blue-600" aria-hidden />
                            Attendance Logs — {activeLogTrainee?.fullName}
                        </DialogTitle>
                        <DialogDescription>
                            Session attendance history and quick adjustment for{" "}
                            <strong>{activeLogRow?.studentId}</strong> ({activeLogRow?.attended} /{" "}
                            {activeLogRow?.totalConducted} sessions attended •{" "}
                            <strong>{activeLogRow?.absentRate}%</strong> absent).
                        </DialogDescription>
                    </DialogHeader>

                    {activeLogRow ? (
                        <div className="space-y-4 py-2">
                            {/* Quick Edit Summary Box */}
                            <div className="rounded-md border bg-muted/25 p-3">
                                <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    <Pencil className="size-3.5" aria-hidden />
                                    <span>Quick Edit Attendance Counts</span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="quick-edit-excused" className="text-xs">
                                            Excused Absent (P)
                                        </Label>
                                        <Input
                                            id="quick-edit-excused"
                                            aria-label="Excused Absent (P)"
                                            type="number"
                                            min={0}
                                            max={attendanceState.conductedSessions}
                                            value={quickEditValues.excusedAbsent}
                                            onChange={(e) =>
                                                setQuickEditValues((prev) => ({
                                                    ...prev,
                                                    excusedAbsent: Number(e.target.value),
                                                }))
                                            }
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="quick-edit-unexcused" className="text-xs">
                                            Unexcused Absent (K)
                                        </Label>
                                        <Input
                                            id="quick-edit-unexcused"
                                            aria-label="Unexcused Absent (K)"
                                            type="number"
                                            min={0}
                                            max={attendanceState.conductedSessions}
                                            value={quickEditValues.unexcusedAbsent}
                                            onChange={(e) =>
                                                setQuickEditValues((prev) => ({
                                                    ...prev,
                                                    unexcusedAbsent: Number(e.target.value),
                                                }))
                                            }
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="quick-edit-late" className="text-xs">
                                            Late Sessions
                                        </Label>
                                        <Input
                                            id="quick-edit-late"
                                            aria-label="Late Sessions"
                                            type="number"
                                            min={0}
                                            max={attendanceState.conductedSessions}
                                            value={quickEditValues.lateCount}
                                            onChange={(e) =>
                                                setQuickEditValues((prev) => ({
                                                    ...prev,
                                                    lateCount: Number(e.target.value),
                                                }))
                                            }
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Session History Logs Table */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Session History ({activeLogRow.record.logs.length} Sessions)
                                </Label>
                                <div className="max-h-64 overflow-y-auto rounded-md border">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-24 px-2.5 text-xs">Date</TableHead>
                                                <TableHead className="px-2.5 text-xs">Session Topic</TableHead>
                                                <TableHead className="w-28 px-2.5 text-center text-xs">
                                                    Status
                                                </TableHead>
                                                <TableHead className="px-2.5 text-xs">Note</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activeLogRow.record.logs.map((log) => (
                                                <TableRow key={`${log.sessionNumber}-${log.date}`}>
                                                    <TableCell className="px-2.5 py-2 text-xs whitespace-nowrap">
                                                        {log.date}
                                                    </TableCell>
                                                    <TableCell className="px-2.5 py-2 text-xs font-medium">
                                                        {log.topic}
                                                    </TableCell>
                                                    <TableCell className="px-2.5 py-2 text-center">
                                                        <Badge
                                                            variant="secondary"
                                                            className={cn(
                                                                "text-[11px]",
                                                                log.status === "Present" &&
                                                                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
                                                                log.status === "Excused" &&
                                                                    "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
                                                                log.status === "Unexcused" &&
                                                                    "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
                                                                log.status === "Late" &&
                                                                    "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                                                            )}
                                                        >
                                                            {log.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="px-2.5 py-2 text-xs text-muted-foreground">
                                                        {log.note}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
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
                            onClick={handleSaveQuickEdit}
                            className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                            <Save className="mr-1.5 size-4" aria-hidden />
                            Save Quick Edit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

