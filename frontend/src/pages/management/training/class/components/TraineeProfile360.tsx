import {
    Award,
    BookOpen,
    CalendarCheck2,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Download,
    ExternalLink,
    GraduationCap,
    Pencil,
    User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { utils, writeFile } from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ExternalClass, Trainee } from "@/types";
import { formatDate } from "@/utils/session.utils";
import { autoFitWorksheetColumns } from "@/utils/trainee-import.utils";
import {
    type ClassAttendanceState,
    fetchAndHydrateClassAttendance,
    getAbsentRateMeta,
    getOrInitClassAttendanceState,
    getTodayLocalIsoDate,
    resolveClassExpectedDates,
    type SessionAttendanceMark,
} from "./TraineeAttendanceView";
import {
    formatFptStudentIdForSite,
    normalizeTraineeStatus,
    resolveTraineeStatusBadge,
} from "./TraineeModal";
import {
    getTraineeTopicMarksSummary,
    resolveTraineeAccount,
    TOPIC_GPA_PASS_THRESHOLD,
} from "./TraineeTopicMarkView";

export interface TraineeProfile360Props {
    trainee: Trainee;
    existingTrainees: Trainee[];
    classItem?: ExternalClass;
    site?: string;
    membershipOnly?: boolean;
    onClose: () => void;
    onSwitchToEdit?: () => void;
    onSelectTrainee?: (trainee: Trainee) => void;
    onNavigateToAttendance?: () => void;
    onNavigateToTopicMark?: () => void;
}

type ProfileTabKey = "personal" | "attendance" | "academic";
type SessionLogFilter = "all" | "non-present" | "absent" | "late";

const SESSION_STATUS_BADGE: Record<SessionAttendanceMark, { label: string; className: string }> = {
    Present: {
        label: "Present",
        className:
            "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    },
    Excused: {
        label: "Excused",
        className:
            "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    },
    Unexcused: {
        label: "Unexcused",
        className:
            "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    },
    Late: {
        label: "Late",
        className:
            "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    },
};

function getInitials(fullName?: string): string {
    const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "TR";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function getGpaRankMeta(gpa: number): { label: string; className: string } {
    if (gpa >= 8.5) {
        return {
            label: "Distinction",
            className:
                "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
        };
    }
    if (gpa >= 7.0) {
        return {
            label: "Good",
            className:
                "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
        };
    }
    if (gpa >= TOPIC_GPA_PASS_THRESHOLD) {
        return {
            label: "Pass",
            className:
                "bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
        };
    }
    return {
        label: "At Risk",
        className:
            "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    };
}

function getGraduationReadiness(
    enrollmentStatus: string,
    absentRate: number,
    failedTopicCount: number,
): { label: "Qualified" | "At Risk" | "Not Qualified"; hint: string; className: string } {
    if (enrollmentStatus !== "Active" || absentRate >= 20 || failedTopicCount >= 2) {
        const reasons: string[] = [];
        if (enrollmentStatus !== "Active") reasons.push(`Status: ${enrollmentStatus}`);
        if (absentRate >= 20) reasons.push(`Absent ${absentRate}% (>= 20%)`);
        if (failedTopicCount >= 2) reasons.push(`${failedTopicCount} failed topics`);
        return {
            label: "Not Qualified",
            hint: reasons.join(" • ") || "Criteria not met",
            className:
                "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
        };
    }

    if (absentRate >= 10 || failedTopicCount === 1) {
        const reasons: string[] = [];
        if (absentRate >= 10) reasons.push(`Absent ${absentRate}%`);
        if (failedTopicCount === 1) reasons.push("1 failed topic");
        return {
            label: "At Risk",
            hint: reasons.join(" • "),
            className:
                "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
        };
    }

    return {
        label: "Qualified",
        hint: "Attendance & GPA on track",
        className:
            "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    };
}

export function TraineeProfile360({
    trainee,
    existingTrainees,
    classItem,
    site,
    membershipOnly,
    onClose,
    onSwitchToEdit,
    onSelectTrainee,
    onNavigateToAttendance,
    onNavigateToTopicMark,
}: TraineeProfile360Props) {
    const classId = String(classItem?.id ?? classItem?.code ?? "default");
    const todayIso = getTodayLocalIsoDate();
    const { expectedStartDate, expectedEndDate } = useMemo(
        () =>
            classItem
                ? resolveClassExpectedDates(classItem, todayIso)
                : { expectedStartDate: "2026-10-01", expectedEndDate: "2027-01-31" },
        [classItem, todayIso],
    );

    const traineesWithCurrent = useMemo(() => {
        if (existingTrainees.some((item) => item.id === trainee.id)) return existingTrainees;
        return [...existingTrainees, trainee];
    }, [existingTrainees, trainee]);

    const [activeTab, setActiveTab] = useState<ProfileTabKey>("personal");
    const [sessionFilterState, setSessionFilterState] = useState<{
        traineeId: number;
        filter: SessionLogFilter;
    }>({ traineeId: trainee.id, filter: "all" });

    const sessionFilter: SessionLogFilter =
        sessionFilterState.traineeId === trainee.id ? sessionFilterState.filter : "all";

    const setSessionFilter = (filter: SessionLogFilter) => {
        setSessionFilterState({ traineeId: trainee.id, filter });
    };

    const [attendanceState, setAttendanceState] = useState<ClassAttendanceState>(() =>
        getOrInitClassAttendanceState(classId, traineesWithCurrent, expectedStartDate, expectedEndDate),
    );

    useEffect(() => {
        const synced = getOrInitClassAttendanceState(
            classId,
            traineesWithCurrent,
            expectedStartDate,
            expectedEndDate,
        );
        setAttendanceState(synced);

        let cancelled = false;
        if (classItem?.id !== undefined) {
            void fetchAndHydrateClassAttendance(
                classId,
                traineesWithCurrent,
                expectedStartDate,
                expectedEndDate,
                todayIso,
                () => !cancelled,
            ).then((hydrated) => {
                if (!cancelled && hydrated) {
                    setAttendanceState(hydrated);
                }
            });
        }

        return () => {
            cancelled = true;
        };
    }, [classId, classItem?.id, expectedEndDate, expectedStartDate, todayIso, traineesWithCurrent]);

    const currentIndex = existingTrainees.findIndex((item) => item.id === trainee.id);
    const canSwitchPeers = Boolean(onSelectTrainee) && existingTrainees.length > 1 && currentIndex >= 0;

    const studentId = membershipOnly
        ? trainee.fptAccount || trainee.code || ""
        : formatFptStudentIdForSite(trainee.fptAccount || trainee.code, site ?? classItem?.site, trainee.id);
    const account = resolveTraineeAccount(trainee, currentIndex >= 0 ? currentIndex : 0);
    const badge = resolveTraineeStatusBadge(trainee.status);
    const enrollmentStatus = normalizeTraineeStatus(trainee.status);
    const classCodeLabel = classItem?.code || classItem?.name || "—";
    const resolvedSite = site || classItem?.site || "—";

    const attendanceRecord = attendanceState.recordsByTraineeId[trainee.id] ?? {
        traineeId: trainee.id,
        excusedAbsent: 0,
        unexcusedAbsent: 0,
        lateCount: 0,
        logs: [],
    };
    const conductedSessions = attendanceState.conductedSessions;
    const totalConductedSafe = Math.max(1, conductedSessions);
    const totalAbsent = attendanceRecord.excusedAbsent + attendanceRecord.unexcusedAbsent;
    const attendedSessions = Math.max(0, conductedSessions - totalAbsent);
    const attendanceRate = Math.min(
        100,
        Math.max(0, Math.round((attendedSessions / totalConductedSafe) * 1000) / 10),
    );
    const absentRate = Math.round((totalAbsent / totalConductedSafe) * 1000) / 10;
    const absentMeta = getAbsentRateMeta(absentRate);
    const nonPresentCount = attendanceRecord.logs.filter((log) => log.status !== "Present").length;

    const filteredLogs = useMemo(() => {
        const logs = attendanceRecord.logs;
        if (sessionFilter === "non-present") {
            return logs.filter((log) => log.status !== "Present");
        }
        if (sessionFilter === "absent") {
            return logs.filter((log) => log.status === "Excused" || log.status === "Unexcused");
        }
        if (sessionFilter === "late") {
            return logs.filter((log) => log.status === "Late");
        }
        return logs;
    }, [attendanceRecord.logs, sessionFilter]);

    const topicSummary = useMemo(
        () => getTraineeTopicMarksSummary(classId, traineesWithCurrent, trainee.id),
        [classId, traineesWithCurrent, trainee.id],
    );
    const gpaRank = getGpaRankMeta(topicSummary.overallGpa);
    const readiness = getGraduationReadiness(enrollmentStatus, absentRate, topicSummary.failedCount);

    const personalEmail = trainee.personalEmail || trainee.email || "—";
    const personalFields: Array<{ label: string; value: string }> = [
        { label: "Full Name", value: trainee.fullName || "—" },
        { label: "Student ID", value: studentId || "—" },
        { label: "Account", value: account || "—" },
        { label: "Personal Email", value: personalEmail },
        { label: "DOB", value: trainee.dob ? formatDate(trainee.dob) : "—" },
        { label: "Gender", value: trainee.gender || "—" },
        { label: "Class", value: classCodeLabel },
        { label: "Site", value: resolvedSite },
    ];

    const handleSelectPrev = () => {
        if (!canSwitchPeers || !onSelectTrainee) return;
        const prevIdx = (currentIndex - 1 + existingTrainees.length) % existingTrainees.length;
        onSelectTrainee(existingTrainees[prevIdx]);
    };

    const handleSelectNext = () => {
        if (!canSwitchPeers || !onSelectTrainee) return;
        const nextIdx = (currentIndex + 1) % existingTrainees.length;
        onSelectTrainee(existingTrainees[nextIdx]);
    };

    const handleExport360Report = () => {
        const workbook = utils.book_new();

        const overviewSheet = utils.aoa_to_sheet([
            ["Field", "Value"],
            ...personalFields.map((field) => [field.label, field.value]),
            ["Enrollment Status", badge.label],
            ["Attendance Rate", `${attendanceRate}% (${attendedSessions}/${conductedSessions} sessions)`],
            ["Absent Rate", `${absentRate}% (${attendanceRecord.excusedAbsent} Excused, ${attendanceRecord.unexcusedAbsent} Unexcused)`],
            ["Attendance Standing", absentMeta.statusLabel],
            ["Late Arrivals", attendanceRecord.lateCount],
            ["Overall GPA", topicSummary.overallGpa.toFixed(1)],
            ["Topics Passed", `${topicSummary.passedCount}/${topicSummary.topics.length}`],
            ["Graduation Readiness", `${readiness.label} (${readiness.hint})`],
        ]);
        autoFitWorksheetColumns(overviewSheet, { Field: 24, Value: 42 });
        utils.book_append_sheet(workbook, overviewSheet, "Profile Overview");

        const attendanceRows = attendanceRecord.logs.map((log) => [
            `#${String(log.sessionNumber).padStart(2, "0")}`,
            log.date ? formatDate(log.date) : "—",
            log.topic,
            log.status,
            log.note ?? "",
        ]);
        const attendanceSheet = utils.aoa_to_sheet([
            ["Session", "Date", "Topic", "Status", "Note"],
            ...attendanceRows,
        ]);
        autoFitWorksheetColumns(attendanceSheet, {
            Session: 10,
            Date: 15,
            Topic: 42,
            Status: 14,
            Note: 32,
        });
        utils.book_append_sheet(workbook, attendanceSheet, "Attendance History");

        const academicRows = topicSummary.topics.map((item) => [
            item.code,
            item.name,
            item.scores.quiz.toFixed(1),
            item.scores.assignment.toFixed(1),
            item.scores.practiceFinal.toFixed(1),
            item.scores.totalGpa.toFixed(1),
            item.isFailed ? `Failed (< ${TOPIC_GPA_PASS_THRESHOLD.toFixed(1)})` : "Passed",
        ]);
        const academicSheet = utils.aoa_to_sheet([
            ["Topic Code", "Topic Name", "Quiz (20%)", "Assignment (30%)", "Practice / Final (50%)", "Topic GPA", "Evaluation"],
            ...academicRows,
        ]);
        autoFitWorksheetColumns(academicSheet, {
            "Topic Code": 18,
            "Topic Name": 38,
            "Quiz (20%)": 12,
            "Assignment (30%)": 16,
            "Practice / Final (50%)": 22,
            "Topic GPA": 12,
            Evaluation: 18,
        });
        utils.book_append_sheet(workbook, academicSheet, "Academic Results");

        const fileBase = (studentId || trainee.fullName || "Trainee").replace(/[^a-zA-Z0-9_-]+/g, "_");
        writeFile(workbook, `${fileBase}_Profile_360.xlsx`);
        toast.success(`Exported 360° Profile Report for ${trainee.fullName || studentId}.`);
    };

    return (
        <div className="space-y-4">
            {/* Hero 360° Summary Banner (email intentionally omitted here so Personal Info <dl> stays unique) */}
            <div
                data-testid="profile-360-hero"
                className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/20"
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div
                            aria-hidden
                            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#283593] text-sm font-bold tracking-wide text-white shadow-xs dark:bg-blue-600"
                        >
                            {getInitials(trainee.fullName)}
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-base font-bold text-foreground">
                                    {trainee.fullName || "—"}
                                </p>
                                <Badge
                                    variant="secondary"
                                    className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", badge.className)}
                                >
                                    {badge.label}
                                </Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>Student ID: {studentId || "—"}</span>
                                <span aria-hidden>•</span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    @{account}
                                </span>
                            </div>
                        </div>
                    </div>

                    {canSwitchPeers ? (
                        <div className="flex items-center gap-1 rounded-lg border bg-background/80 px-1.5 py-1 shadow-2xs">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Previous trainee"
                                title="Previous trainee"
                                onClick={handleSelectPrev}
                                className="size-7"
                            >
                                <ChevronLeft className="size-4" aria-hidden />
                            </Button>
                            <span className="min-w-12 text-center text-xs font-medium text-muted-foreground">
                                {currentIndex + 1} / {existingTrainees.length}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Next trainee"
                                title="Next trainee"
                                onClick={handleSelectNext}
                                className="size-7"
                            >
                                <ChevronRight className="size-4" aria-hidden />
                            </Button>
                        </div>
                    ) : null}
                </div>

                {/* 3 Mini 360° KPI Cards */}
                <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div
                        data-testid="hero-attendance-kpi"
                        className="rounded-lg border border-slate-200/80 bg-background/90 px-3 py-2 dark:border-slate-800"
                    >
                        <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                <CalendarCheck2 className="size-3.5 text-blue-600 dark:text-blue-400" aria-hidden />
                                Attendance
                            </span>
                            <Badge variant="secondary" className={cn("px-2 py-0 text-[11px]", absentMeta.badgeClassName)}>
                                {absentMeta.statusLabel}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm font-bold text-foreground">
                            {attendanceRate}% Attended
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                ({attendedSessions}/{conductedSessions})
                            </span>
                        </p>
                    </div>

                    <div
                        data-testid="hero-gpa-kpi"
                        className="rounded-lg border border-slate-200/80 bg-background/90 px-3 py-2 dark:border-slate-800"
                    >
                        <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                <Award className="size-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden />
                                Overall GPA
                            </span>
                            <Badge variant="secondary" className={cn("px-2 py-0 text-[11px]", gpaRank.className)}>
                                {gpaRank.label}
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm font-bold text-foreground">
                            {topicSummary.overallGpa.toFixed(1)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">/ 10.0</span>
                        </p>
                    </div>

                    <div
                        data-testid="hero-readiness-kpi"
                        className="rounded-lg border border-slate-200/80 bg-background/90 px-3 py-2 dark:border-slate-800"
                    >
                        <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                <GraduationCap className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                                Readiness
                            </span>
                            <Badge variant="secondary" className={cn("px-2 py-0 text-[11px]", readiness.className)}>
                                {readiness.label}
                            </Badge>
                        </div>
                        <p className="mt-1 truncate text-xs font-medium text-muted-foreground" title={readiness.hint}>
                            {readiness.hint}
                        </p>
                    </div>
                </div>
            </div>

            {/* 3 Interactive 360° Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProfileTabKey)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="personal" className="gap-1.5">
                        <User className="size-3.5" aria-hidden />
                        <span>Personal Info</span>
                    </TabsTrigger>
                    <TabsTrigger value="attendance" className="gap-1.5">
                        <ClipboardCheck className="size-3.5" aria-hidden />
                        <span>Attendance</span>
                    </TabsTrigger>
                    <TabsTrigger value="academic" className="gap-1.5">
                        <BookOpen className="size-3.5" aria-hidden />
                        <span>Academic Results</span>
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Personal Info */}
                <TabsContent value="personal" className="mt-3 space-y-3">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
                        {personalFields.map(({ label, value }) => (
                            <div key={label} className="rounded-lg border bg-card px-3 py-2">
                                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                                <dd className="mt-0.5 text-sm font-medium text-foreground break-all">{value}</dd>
                            </div>
                        ))}
                    </dl>

                    <div className="grid grid-cols-1 gap-2.5 rounded-lg border bg-muted/25 p-3 sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-xs font-semibold text-foreground">Attendance Snapshot</p>
                                <p className="text-xs text-muted-foreground">
                                    {attendedSessions}/{conductedSessions} sessions attended • {absentRate}% absent
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setActiveTab("attendance")}
                                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                            >
                                Details
                            </Button>
                        </div>

                        <div className="flex items-center justify-between gap-2 sm:border-l sm:pl-3">
                            <div>
                                <p className="text-xs font-semibold text-foreground">Academic Snapshot</p>
                                <p className="text-xs text-muted-foreground">
                                    {topicSummary.passedCount}/{topicSummary.topics.length} topics passed • GPA{" "}
                                    {topicSummary.overallGpa.toFixed(1)}
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setActiveTab("academic")}
                                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                            >
                                Details
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                {/* Tab 2: Attendance */}
                <TabsContent value="attendance" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[11px] font-medium text-muted-foreground">Attended Sessions</p>
                            <p className="mt-1 text-base font-bold text-foreground">
                                {attendedSessions} / {conductedSessions}
                            </p>
                            <p className="text-xs text-muted-foreground">{attendanceRate}% attendance rate</p>
                        </div>

                        <div className="rounded-lg border bg-card p-2.5">
                            <div className="flex items-center justify-between gap-1">
                                <p className="text-[11px] font-medium text-muted-foreground">Absent Rate</p>
                                <span className="text-[10px] text-muted-foreground">Max 20%</span>
                            </div>
                            <p className={cn("mt-1 text-base font-bold", absentMeta.textClassName)}>{absentRate}%</p>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                    className={cn("h-full transition-all", absentMeta.barClassName)}
                                    style={{ width: `${Math.min(100, (absentRate / 20) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[11px] font-medium text-muted-foreground">Absences</p>
                            <p className="mt-1 text-base font-bold text-foreground">{totalAbsent}</p>
                            <p className="text-xs text-muted-foreground">
                                {attendanceRecord.excusedAbsent}E / {attendanceRecord.unexcusedAbsent}U
                            </p>
                        </div>

                        <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[11px] font-medium text-muted-foreground">Late Arrivals</p>
                            <p className="mt-1 text-base font-bold text-foreground">{attendanceRecord.lateCount}</p>
                            <p className="text-xs text-muted-foreground">Recorded delays</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter session logs">
                            {(
                                [
                                    { key: "all", label: `All (${attendanceRecord.logs.length})` },
                                    { key: "non-present", label: `Non-Present (${nonPresentCount})` },
                                    { key: "absent", label: `Absent (${totalAbsent})` },
                                    { key: "late", label: `Late (${attendanceRecord.lateCount})` },
                                ] as const
                            ).map((option) => (
                                <Button
                                    key={option.key}
                                    type="button"
                                    size="sm"
                                    variant={sessionFilter === option.key ? "default" : "outline"}
                                    onClick={() => setSessionFilter(option.key)}
                                    className={cn(
                                        "h-7 px-2.5 text-xs",
                                        sessionFilter === option.key &&
                                            "bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500",
                                    )}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>

                        {onNavigateToAttendance ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={onNavigateToAttendance}
                                className="h-7 gap-1 px-2.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
                            >
                                <span>Open Attendance Tracker</span>
                                <ExternalLink className="size-3" aria-hidden />
                            </Button>
                        ) : null}
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-lg border">
                        <Table aria-label="Trainee Profile Attendance History">
                            <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                                <TableRow>
                                    <TableHead className="w-20 px-2.5 py-2 text-xs">Session</TableHead>
                                    <TableHead className="w-28 px-2.5 py-2 text-xs">Date</TableHead>
                                    <TableHead className="px-2.5 py-2 text-xs">Topic</TableHead>
                                    <TableHead className="w-24 px-2.5 py-2 text-xs">Status</TableHead>
                                    <TableHead className="px-2.5 py-2 text-xs">Note</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                                            No attendance records match the selected filter.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map((log) => {
                                        const statusStyle = SESSION_STATUS_BADGE[log.status];
                                        return (
                                            <TableRow key={log.sessionNumber}>
                                                <TableCell className="px-2.5 py-2 text-xs font-semibold">
                                                    #{String(log.sessionNumber).padStart(2, "0")}
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2 text-xs whitespace-nowrap text-muted-foreground">
                                                    {log.date ? formatDate(log.date) : "—"}
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2 text-xs text-foreground">
                                                    {log.topic}
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2">
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn("px-2 py-0 text-[11px]", statusStyle.className)}
                                                    >
                                                        {statusStyle.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-2.5 py-2 text-xs text-muted-foreground">
                                                    {log.note || "—"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* Tab 3: Academic Results */}
                <TabsContent value="academic" className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[11px] font-medium text-muted-foreground">Overall GPA</p>
                            <p className="mt-1 text-base font-bold text-foreground">
                                {topicSummary.overallGpa.toFixed(1)}
                            </p>
                            <p className="text-xs text-muted-foreground">{gpaRank.label}</p>
                        </div>

                        <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[11px] font-medium text-muted-foreground">Topics Passed</p>
                            <p className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
                                {topicSummary.passedCount} / {topicSummary.topics.length}
                            </p>
                            <p className="text-xs text-muted-foreground">Threshold &gt;= {TOPIC_GPA_PASS_THRESHOLD.toFixed(1)}</p>
                        </div>

                        <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[11px] font-medium text-muted-foreground">
                                Topics Failed (&lt; 6.0)
                            </p>
                            <p
                                className={cn(
                                    "mt-1 text-base font-bold",
                                    topicSummary.failedCount > 0
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-foreground",
                                )}
                            >
                                {topicSummary.failedCount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {topicSummary.failedCount > 0 ? "Retake attention" : "Zero failures"}
                            </p>
                        </div>

                        <div className="rounded-lg border bg-card p-2.5">
                            <p className="text-[11px] font-medium text-muted-foreground">Best Topic</p>
                            <p className="mt-1 truncate text-sm font-bold text-foreground">
                                {topicSummary.highestTopic
                                    ? `${topicSummary.highestTopic.code} (${topicSummary.highestTopic.scores.totalGpa.toFixed(1)})`
                                    : "—"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {topicSummary.highestTopic?.name ?? "No topic scores"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                            Quiz 20% • Assignment 30% • Practice/Final 50% (Pass &gt;= 6.0)
                        </p>
                        {onNavigateToTopicMark ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={onNavigateToTopicMark}
                                className="h-7 gap-1 px-2.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
                            >
                                <span>Open Topic Marks</span>
                                <ExternalLink className="size-3" aria-hidden />
                            </Button>
                        ) : null}
                    </div>

                    <div className="overflow-x-auto rounded-lg border">
                        <Table aria-label="Trainee Profile Academic Results">
                            <TableHeader className="bg-slate-50 dark:bg-slate-900">
                                <TableRow>
                                    <TableHead className="px-2.5 py-2 text-xs">Topic</TableHead>
                                    <TableHead className="px-2.5 py-2 text-right text-xs">Quiz (20%)</TableHead>
                                    <TableHead className="px-2.5 py-2 text-right text-xs">Assignment (30%)</TableHead>
                                    <TableHead className="px-2.5 py-2 text-right text-xs">Practice / Final (50%)</TableHead>
                                    <TableHead className="px-2.5 py-2 text-right text-xs">Topic GPA</TableHead>
                                    <TableHead className="px-2.5 py-2 text-center text-xs">Evaluation</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {topicSummary.topics.map((item) => (
                                    <TableRow key={item.code}>
                                        <TableCell className="px-2.5 py-2">
                                            <div className="text-xs font-semibold text-foreground">{item.code}</div>
                                            <div className="text-[11px] text-muted-foreground">{item.name}</div>
                                        </TableCell>
                                        <TableCell className="px-2.5 py-2 text-right text-xs tabular-nums">
                                            {item.scores.quiz.toFixed(1)}
                                        </TableCell>
                                        <TableCell className="px-2.5 py-2 text-right text-xs tabular-nums">
                                            {item.scores.assignment.toFixed(1)}
                                        </TableCell>
                                        <TableCell className="px-2.5 py-2 text-right text-xs tabular-nums">
                                            {item.scores.practiceFinal.toFixed(1)}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                "px-2.5 py-2 text-right text-xs font-bold tabular-nums",
                                                item.isFailed
                                                    ? "text-rose-600 dark:text-rose-400"
                                                    : "text-foreground",
                                            )}
                                        >
                                            <div>{item.scores.totalGpa.toFixed(1)}</div>
                                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                                <div
                                                    className={cn(
                                                        "h-full",
                                                        item.isFailed ? "bg-rose-500" : "bg-emerald-500",
                                                    )}
                                                    style={{ width: `${Math.min(100, item.scores.totalGpa * 10)}%` }}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-2.5 py-2 text-center">
                                            <Badge
                                                variant="secondary"
                                                className={cn(
                                                    "px-2 py-0 text-[11px]",
                                                    item.isFailed
                                                        ? "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                                                        : "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
                                                )}
                                            >
                                                {item.isFailed ? "Failed" : "Passed"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="outline" onClick={handleExport360Report} className="gap-1.5">
                    <Download className="size-4" aria-hidden />
                    <span>Export 360° Report</span>
                </Button>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    {onSwitchToEdit ? (
                        <Button
                            type="button"
                            className="bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500"
                            onClick={onSwitchToEdit}
                        >
                            <Pencil className="size-4" aria-hidden /> Edit
                        </Button>
                    ) : null}
                </div>
            </DialogFooter>
        </div>
    );
}

export default TraineeProfile360;
