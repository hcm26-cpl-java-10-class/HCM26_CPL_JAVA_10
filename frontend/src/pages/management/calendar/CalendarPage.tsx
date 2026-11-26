import { useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    CalendarCheck2,
    CalendarDays,
    CalendarRange,
    ChevronRight,
    GraduationCap,
    Search,
} from "lucide-react";
import { clsApi } from "@/api/features/cls.api";
import { ALL_STATUSES, externalApi } from "@/api/features/external.api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import type { ExternalClass } from "@/types";
import { ClassStatusBadge } from "@/pages/management/training/class/components/ClassStatusBadge";
import { ClassScheduleEditor } from "./components/ClassScheduleEditor";
import WeeklyCalendarPage from "./WeeklyCalendarPage";

type CalendarMainTab = "schedule" | "timetable";

type PendingCalendarSwitch =
    | { kind: "tab"; tab: CalendarMainTab }
    | { kind: "class"; classId: string }
    | null;

export default function CalendarPage() {
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { hasPermission } = usePermissions();

    const canReadClasses = hasPermission("CLASS_READ");
    const requestedTab = searchParams.get("tab");
    const isPreviewPath = location.pathname.endsWith("/preview");
    const hasTimetableQuery = Boolean(
        searchParams.get("view") || searchParams.get("scope") || searchParams.get("date"),
    );

    const activeTab: CalendarMainTab =
        requestedTab === "timetable"
            ? "timetable"
            : requestedTab === "schedule"
              ? "schedule"
              : isPreviewPath || (!searchParams.get("classId") && (hasTimetableQuery || !canReadClasses))
                ? "timetable"
                : "schedule";

    const selectedClassIdParam = searchParams.get("classId") ?? "";
    const [classSearch, setClassSearch] = useState("");
    const [programFilter, setProgramFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [workspaceDirty, setWorkspaceDirty] = useState(false);
    const [pendingSwitch, setPendingSwitch] = useState<PendingCalendarSwitch>(null);

    const classesQuery = useQuery({
        queryKey: ["calendar", "classes-directory", canReadClasses],
        queryFn: async (): Promise<ExternalClass[]> => {
            if (canReadClasses) {
                return (await clsApi.getAllClasses()) as unknown as ExternalClass[];
            }
            return externalApi.getClasses(ALL_STATUSES);
        },
        enabled: activeTab === "schedule",
    });

    const classes = classesQuery.data ?? [];

    const programOptions = useMemo(() => {
        const set = new Set<string>();
        for (const cls of classes) {
            const p = (cls.program || cls.trainingProgram || "").trim();
            if (p) set.add(p);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [classes]);

    const filteredClasses = useMemo(() => {
        const q = classSearch.trim().toLowerCase();
        return classes.filter((cls) => {
            if (statusFilter !== "ALL" && (cls.status ?? "").toLowerCase() !== statusFilter.toLowerCase()) {
                return false;
            }
            if (programFilter !== "ALL") {
                const p = (cls.program || cls.trainingProgram || "").trim();
                if (p !== programFilter) return false;
            }
            if (!q) return true;
            return (
                (cls.code ?? "").toLowerCase().includes(q) ||
                (cls.name ?? "").toLowerCase().includes(q) ||
                (cls.program ?? "").toLowerCase().includes(q) ||
                (cls.masterTrainer ?? "").toLowerCase().includes(q) ||
                String(cls.id).includes(q)
            );
        });
    }, [classes, classSearch, programFilter, statusFilter]);

    const selectedClass = useMemo(() => {
        if (!selectedClassIdParam) return null;
        return classes.find((c) => String(c.id) === selectedClassIdParam || c.code === selectedClassIdParam) ?? null;
    }, [classes, selectedClassIdParam]);

    const applyTabChange = (nextTab: CalendarMainTab) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", nextTab);
        setSearchParams(nextParams);
    };

    const applyClassSelect = (classId: string) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", "schedule");
        if (classId) {
            nextParams.set("classId", classId);
        } else {
            nextParams.delete("classId");
        }
        setSearchParams(nextParams);
    };

    const handleTabChange = (value: string) => {
        const nextTab = value as CalendarMainTab;
        if (nextTab === activeTab) return;
        if (activeTab === "schedule" && workspaceDirty) {
            setPendingSwitch({ kind: "tab", tab: nextTab });
            return;
        }
        applyTabChange(nextTab);
    };

    const handleSelectClass = (classId: number) => {
        const nextId = String(classId);
        if (nextId === String(selectedClass?.id ?? "")) return;
        if (workspaceDirty) {
            setPendingSwitch({ kind: "class", classId: nextId });
            return;
        }
        applyClassSelect(nextId);
    };

    const handleBackToClassList = () => {
        if (workspaceDirty) {
            setPendingSwitch({ kind: "class", classId: "" });
            return;
        }
        applyClassSelect("");
    };

    const confirmPendingSwitch = () => {
        if (!pendingSwitch) return;
        const target = pendingSwitch;
        setPendingSwitch(null);
        setWorkspaceDirty(false);
        if (target.kind === "tab") {
            applyTabChange(target.tab);
        } else {
            applyClassSelect(target.classId);
        }
    };

    return (
        <MainLayout
            dense
            mainClassName="overflow-y-hidden pt-1 pb-1.5"
            pathName={{ calendar: "Calendar" }}
        >
            <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-2">
                {/* Top Mode Switcher Tabs */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {activeTab === "schedule" && selectedClassIdParam && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 px-3 text-xs sm:text-sm"
                                onClick={handleBackToClassList}
                            >
                                <ArrowLeft className="size-4" />
                                Back to Class List
                            </Button>
                        )}
                        <Tabs value={activeTab} onValueChange={handleTabChange}>
                            <TabsList className="h-9">
                                <TabsTrigger value="schedule" className="gap-1.5 px-3 text-xs sm:text-sm">
                                    <CalendarRange className="size-4" />
                                    Class Schedule
                                </TabsTrigger>
                                <TabsTrigger value="timetable" className="gap-1.5 px-3 text-xs sm:text-sm">
                                    <CalendarDays className="size-4" />
                                    Weekly Timetable
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                {/* TAB 1: FULL-SCREEN CLASS LIST OR FULL-SCREEN CLASS SCHEDULE EDITOR */}
                {activeTab === "schedule" && (
                    !canReadClasses ? (
                        <div className="flex-1 overflow-y-auto">
                            <ApiErrorState error={undefined} kind="forbidden" resource="class calendar generator" />
                        </div>
                    ) : selectedClassIdParam ? (
                        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                            {selectedClass ? (
                                <ClassScheduleEditor
                                    key={selectedClass.id}
                                    classItem={selectedClass}
                                    onDirtyChange={setWorkspaceDirty}
                                />
                            ) : classesQuery.isPending ? (
                                <div className="space-y-4 rounded-xl border bg-card p-6">
                                    <Skeleton className="h-7 w-64" />
                                    <Skeleton className="h-4 w-96" />
                                    <Skeleton className="h-64 w-full" />
                                </div>
                            ) : (
                                <ApiErrorState
                                    error={undefined}
                                    kind="notFound"
                                    resource="class"
                                />
                            )}
                        </div>
                    ) : (
                        <section
                            aria-label="Class List"
                            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-xs"
                        >
                            {/* Full-width Class List Header & Filters */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                                            <GraduationCap className="size-5 text-primary" />
                                            Class List
                                        </h2>
                                        <Badge variant="secondary" className="text-xs">
                                            {filteredClasses.length} {filteredClasses.length === 1 ? "class" : "classes"}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Select a class to open its full-screen weekly schedule, auto-generate from the Training Program, and edit manually.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative w-64">
                                        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            aria-label="Search classes"
                                            placeholder="Search class code, name, program..."
                                            value={classSearch}
                                            onChange={(e) => setClassSearch(e.target.value)}
                                            className="h-9 pl-8 text-xs"
                                        />
                                    </div>

                                    <select
                                        aria-label="Filter by Training Program"
                                        value={programFilter}
                                        onChange={(e) => setProgramFilter(e.target.value)}
                                        className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                                    >
                                        <option value="ALL">All Programs</option>
                                        {programOptions.map((prog) => (
                                            <option key={prog} value={prog}>
                                                {prog}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        aria-label="Filter by class status"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="planning">Planning</option>
                                        <option value="assigned">Assigned</option>
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                        <option value="closed">Closed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            {/* Full-width Horizontal Class Rows with No. */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {classesQuery.isPending ? (
                                    <div className="space-y-2">
                                        {Array.from({ length: 6 }, (_, idx) => (
                                            <Skeleton key={idx} className="h-14 w-full rounded-lg" />
                                        ))}
                                    </div>
                                ) : classesQuery.isError ? (
                                    <ApiErrorState
                                        error={classesQuery.error}
                                        resource="classes"
                                        onRetry={() => void classesQuery.refetch()}
                                    />
                                ) : filteredClasses.length === 0 ? (
                                    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                        No classes match the current filters.
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-xl border bg-background">
                                        {/* Table Header */}
                                        <div className="hidden md:grid md:grid-cols-[56px_minmax(200px,2fr)_minmax(130px,1fr)_190px_120px_135px_32px] items-center gap-3 border-b bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                                            <span className="text-center">#</span>
                                            <span>Class</span>
                                            <span>Training Program</span>
                                            <span>Duration</span>
                                            <span>Status</span>
                                            <span>Schedule</span>
                                            <span />
                                        </div>

                                        {/* Horizontal Class Rows */}
                                        <div className="divide-y">
                                            {filteredClasses.map((cls, index) => (
                                                <button
                                                    key={cls.id}
                                                    type="button"
                                                    onClick={() => handleSelectClass(cls.id)}
                                                    className="group grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 md:grid-cols-[56px_minmax(200px,2fr)_minmax(130px,1fr)_190px_120px_135px_32px]"
                                                >
                                                    {/* Index */}
                                                    <span className="text-center text-xs font-bold text-muted-foreground">
                                                        {index + 1}
                                                    </span>

                                                    {/* Code & Name */}
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-bold text-foreground group-hover:text-primary">
                                                            {cls.code || `Class #${cls.id}`}
                                                        </div>
                                                        {cls.name && cls.name !== cls.code && (
                                                            <div className="truncate text-xs text-muted-foreground">
                                                                {cls.name}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Program */}
                                                    <div className="hidden min-w-0 md:block">
                                                        {cls.program ? (
                                                            <span className="inline-block max-w-full truncate rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                                                                {cls.program}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </div>

                                                    {/* Date Range */}
                                                    <div className="hidden whitespace-nowrap text-xs text-muted-foreground md:block">
                                                        {cls.startDate || "—"} → {cls.endDate || "—"}
                                                    </div>

                                                    {/* Class Status */}
                                                    <div className="hidden md:block">
                                                        <ClassStatusBadge status={cls.status} />
                                                    </div>

                                                    {/* Schedule Status */}
                                                    <div className="flex items-center justify-end md:justify-start">
                                                        {cls.hasSchedule ? (
                                                            <Badge className="h-5 whitespace-nowrap bg-emerald-100 px-2 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200">
                                                                <CalendarCheck2 className="mr-1 size-3" />
                                                                Scheduled
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="h-5 whitespace-nowrap px-2 text-[11px] font-normal text-muted-foreground">
                                                                Not scheduled
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="hidden justify-end md:flex">
                                                        <ChevronRight className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )
                )}

                {/* TAB 2: WEEKLY / MONTHLY TIMETABLE */}
                {activeTab === "timetable" && (
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <WeeklyCalendarPage embedded />
                    </div>
                )}

                {/* Unsaved Changes Guard Dialog */}
                <Dialog open={pendingSwitch !== null} onOpenChange={(open) => !open && setPendingSwitch(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Unsaved Changes</DialogTitle>
                            <DialogDescription>
                                You have unsaved schedule changes for the current class. Leave and discard them?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPendingSwitch(null)}>
                                Stay
                            </Button>
                            <Button type="button" variant="destructive" onClick={confirmPendingSwitch}>
                                Leave
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
