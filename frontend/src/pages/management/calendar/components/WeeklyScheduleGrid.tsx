import { useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowLeftRight,
    Calendar as CalendarIcon,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    Clock,
    GripVertical,
    MoreVertical,
    PenLine,
    Plus,
    Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    DEFAULT_SCHEDULE_CONFIG,
    getCourseColorTheme,
    type ScheduleConfig,
    type ScheduleCourse,
    type ScheduleEntry,
    type ScheduleValidationIssue,
    type SlotNumber,
} from "../schedule.config";
import {
    addDaysIso,
    calculateSlotsNeeded,
    getIsoWeekday,
    getMondayOfIsoDate,
    isWorkingDay,
    slotKey,
} from "../scheduleEngine";

const DAY_LABELS: Record<number, string> = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
};

function formatShortViDate(isoDate: string): string {
    const [, m, d] = isoDate.split("-");
    return `${d}/${m}`;
}

function formatFullViDate(isoDate: string): string {
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
}

function getTodayIso(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export interface WeeklyScheduleGridProps {
    entries: ScheduleEntry[];
    courses: ScheduleCourse[];
    courseOrder?: number[];
    config?: ScheduleConfig;
    classStartDate?: string;
    weekMonday: string;
    onWeekMondayChange: (nextMonday: string) => void;
    /** Enables drag-and-drop and cell mutation menus when true */
    editMode?: boolean;
    /** Shows weekend columns even when empty so user can manually drop onto Sat/Sun */
    forceShowWeekends?: boolean;
    /** Cell currently highlighted by clicking a validation warning */
    highlightedCell?: { date: string; slot: SlotNumber } | null;
    issues?: ScheduleValidationIssue[];
    selectedIds?: Set<string>;
    onToggleSelect?: (entryId: string, multi: boolean) => void;
    onDropMove?: (entryId: string, targetDate: string, targetSlot: SlotNumber) => void;
    onRequestAddAt?: (date: string, slot: SlotNumber) => void;
    onRequestMoveDialog?: (entry: ScheduleEntry) => void;
    onRequestChangeCourse?: (entry: ScheduleEntry) => void;
    onRequestInsertBefore?: (entry: ScheduleEntry) => void;
    onRequestInsertAfter?: (entry: ScheduleEntry) => void;
    onRequestEditActualDate?: (entry: ScheduleEntry) => void;
    onRequestEditNote?: (entry: ScheduleEntry) => void;
    onRequestDelete?: (entry: ScheduleEntry) => void;
    /** Whether to display slot progress bars inside course legend (true in editor, optional in read-only) */
    showProgressInLegend?: boolean;
}

export function WeeklyScheduleGrid({
    entries,
    courses,
    courseOrder,
    config = DEFAULT_SCHEDULE_CONFIG,
    classStartDate,
    weekMonday,
    onWeekMondayChange,
    editMode = false,
    forceShowWeekends = false,
    highlightedCell = null,
    issues = [],
    selectedIds,
    onToggleSelect,
    onDropMove,
    onRequestAddAt,
    onRequestMoveDialog,
    onRequestChangeCourse,
    onRequestInsertBefore,
    onRequestInsertAfter,
    onRequestEditActualDate,
    onRequestEditNote,
    onRequestDelete,
    showProgressInLegend = false,
}: WeeklyScheduleGridProps) {
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverCell, setDragOverCell] = useState<string | null>(null);
    const todayIso = getTodayIso();

    const orderedCourses = useMemo(() => {
        if (courseOrder?.length) {
            const map = new Map(courses.map((c) => [c.id, c]));
            return courseOrder.map((id) => map.get(id)).filter((c): c is ScheduleCourse => !!c);
        }
        return [...courses].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    }, [courses, courseOrder]);

    const courseIndexMap = useMemo(() => {
        const map = new Map<number, number>();
        orderedCourses.forEach((c, idx) => map.set(c.id, idx));
        return map;
    }, [orderedCourses]);

    const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

    const entryBySlot = useMemo(() => {
        const map = new Map<string, ScheduleEntry>();
        for (const e of entries) {
            map.set(slotKey(e.date, e.slot), e);
        }
        return map;
    }, [entries]);

    const issuesByCell = useMemo(() => {
        const map = new Map<string, ScheduleValidationIssue[]>();
        for (const issue of issues) {
            if (!issue.date || !issue.slot) continue;
            const key = slotKey(issue.date, issue.slot);
            const list = map.get(key) ?? [];
            list.push(issue);
            map.set(key, list);
        }
        return map;
    }, [issues]);

    // Determine visible columns for this week: Mon–Fri (1..5), plus Sat (6) / Sun (7) if week has entries on them or forceShowWeekends
    const visibleDays = useMemo(() => {
        const satDate = addDaysIso(weekMonday, 5);
        const sunDate = addDaysIso(weekMonday, 6);
        const hasSat = entries.some((e) => e.date === satDate);
        const hasSun = entries.some((e) => e.date === sunDate);

        const days = [1, 2, 3, 4, 5];
        if (forceShowWeekends || hasSat) days.push(6);
        if (forceShowWeekends || hasSun) days.push(7);

        return days.map((isoDay) => {
            const dateStr = addDaysIso(weekMonday, isoDay - 1);
            return {
                isoDay,
                label: DAY_LABELS[isoDay],
                date: dateStr,
                shortDate: formatShortViDate(dateStr),
                isToday: dateStr === todayIso,
                isNonWorking: !isWorkingDay(dateStr, config),
                isHoliday: Boolean(config.holidays?.includes(dateStr)),
            };
        });
    }, [weekMonday, entries, forceShowWeekends, todayIso, config]);

    const sortedSlots = useMemo(
        () => [...config.slots].sort((a, b) => a.slot - b.slot),
        [config.slots],
    );

    const weekEndDisplay = visibleDays[visibleDays.length - 1]?.date ?? addDaysIso(weekMonday, 4);

    // Quick week tabs across schedule span
    const scheduleWeeks = useMemo(() => {
        if (entries.length === 0) return [];
        const dates = entries.map((e) => e.date).sort();
        const firstMon = getMondayOfIsoDate(dates[0]);
        const lastMon = getMondayOfIsoDate(dates[dates.length - 1]);
        const list: string[] = [];
        let cur = firstMon;
        let guard = 0;
        while (cur <= lastMon && guard < 52) {
            list.push(cur);
            cur = addDaysIso(cur, 7);
            guard += 1;
        }
        return list;
    }, [entries]);

    const slotsCountByCourse = useMemo(() => {
        const map = new Map<number, number>();
        for (const e of entries) {
            map.set(e.courseId, (map.get(e.courseId) ?? 0) + 1);
        }
        return map;
    }, [entries]);

    const handleCellKeyDown = (
        event: React.KeyboardEvent<HTMLDivElement>,
        date: string,
        slot: SlotNumber,
        entry: ScheduleEntry | undefined,
    ) => {
        if (!editMode) return;
        if (event.key === "Enter") {
            event.preventDefault();
            if (entry) {
                onRequestMoveDialog?.(entry);
            } else {
                onRequestAddAt?.(date, slot);
            }
        } else if ((event.key === "Delete" || event.key === "Backspace") && entry) {
            event.preventDefault();
            onRequestDelete?.(entry);
        }
    };

    return (
        <div className="space-y-3">
            {/* Week Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
                        <CalendarIcon className="size-4 text-primary" />
                        Week: {formatFullViDate(weekMonday)} – {formatFullViDate(weekEndDisplay)}
                    </span>
                    {scheduleWeeks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                            {scheduleWeeks.slice(0, 12).map((mon, idx) => (
                                <button
                                    key={mon}
                                    type="button"
                                    onClick={() => onWeekMondayChange(mon)}
                                    className={`h-6 rounded px-2 text-[11px] font-semibold transition-colors ${
                                        mon === weekMonday
                                            ? "bg-primary text-primary-foreground shadow-xs"
                                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                >
                                    W{idx + 1}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs"
                        aria-label="Previous week"
                        onClick={() => onWeekMondayChange(addDaysIso(weekMonday, -7))}
                        onDragOver={(e) => {
                            if (editMode && draggedId) e.preventDefault();
                        }}
                    >
                        <ChevronLeft className="size-3.5" />
                        Prev Week
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-semibold"
                        onClick={() => onWeekMondayChange(getMondayOfIsoDate(todayIso))}
                    >
                        Today
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs"
                        aria-label="Next week"
                        onClick={() => onWeekMondayChange(addDaysIso(weekMonday, 7))}
                        onDragOver={(e) => {
                            if (editMode && draggedId) e.preventDefault();
                        }}
                    >
                        Next Week
                        <ChevronRight className="size-3.5" />
                    </Button>
                </div>
            </div>

            {/* Weekly Slot Matrix: Days (Columns) × Slots (Rows) */}
            <div className="w-full overflow-hidden rounded-xl border bg-card shadow-xs">
                <div
                    role="grid"
                    aria-label="Weekly schedule grid"
                    style={{
                        gridTemplateColumns: `${visibleDays.length > 5 ? "82px" : "96px"} repeat(${visibleDays.length}, minmax(0, 1fr))`,
                    }}
                    className="grid w-full"
                >
                    {/* Header Row */}
                    <div className="flex items-center border-b border-r bg-muted/60 px-2 py-2 text-[11px] font-semibold text-muted-foreground">
                        Slot / Day
                    </div>
                    {visibleDays.map((day, idx) => (
                        <div
                            key={day.date}
                            className={`min-w-0 border-b px-1.5 py-2 text-center ${
                                idx < visibleDays.length - 1 ? "border-r" : ""
                            } ${
                                day.isToday
                                    ? "bg-primary/10"
                                    : day.isNonWorking
                                      ? "bg-amber-50/70 dark:bg-amber-950/20"
                                      : "bg-muted/60"
                            }`}
                        >
                            <div className="flex flex-wrap items-center justify-center gap-1">
                                <span className={`text-[11px] font-bold ${day.isToday ? "text-primary" : "text-foreground"}`}>
                                    {day.label}
                                </span>
                                {day.isToday && (
                                    <span className="rounded-full bg-primary px-1.5 py-0 text-[9px] font-semibold text-primary-foreground">
                                        Today
                                    </span>
                                )}
                            </div>
                            <div className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
                                {day.shortDate}
                                {day.isHoliday && (
                                    <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">
                                        · Holiday
                                    </span>
                                )}
                                {!day.isHoliday && getIsoWeekday(day.date) >= 6 && (
                                    <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">
                                        · Weekend
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Slot Rows */}
                    {sortedSlots.map((slotDef, rowIdx) => {
                        const slotNum = slotDef.slot;
                        const isLastRow = rowIdx === sortedSlots.length - 1;
                        return (
                            <div key={slotNum} className="contents">
                                {/* Row Header */}
                                <div
                                    className={`flex flex-col justify-center border-r bg-muted/25 px-2 py-2 ${
                                        !isLastRow ? "border-b" : ""
                                    }`}
                                >
                                    <span className="text-[11px] font-bold leading-tight text-foreground">
                                        Slot {slotNum}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {slotNum === 1 ? "Morning" : "Afternoon"}
                                    </span>
                                    <span className="mt-1 inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
                                        <Clock className="size-2.5 shrink-0" />
                                        {slotDef.start}–{slotDef.end}
                                    </span>
                                </div>

                                {/* Day Cells */}
                                {visibleDays.map((day, colIdx) => {
                                    const key = slotKey(day.date, slotNum);
                                    const entry = entryBySlot.get(key);
                                    const cellIssues = issuesByCell.get(key) ?? [];
                                    const hasWarning = cellIssues.some((i) => i.severity === "warning" || i.severity === "error");
                                    const isHighlighted =
                                        highlightedCell?.date === day.date && highlightedCell?.slot === slotNum;
                                    const isBeforeClassStart = Boolean(
                                        classStartDate && day.date < classStartDate,
                                    );
                                    const isDragOver = dragOverCell === key;
                                    const isSelected = Boolean(entry && selectedIds?.has(entry.id));

                                    const course = entry ? courseById.get(entry.courseId) : undefined;
                                    const colorIdx = entry ? (courseIndexMap.get(entry.courseId) ?? entry.courseId) : 0;
                                    const theme = getCourseColorTheme(colorIdx);

                                    let dropHighlightClass = "";
                                    if (editMode && isDragOver) {
                                        if (isBeforeClassStart) {
                                            dropHighlightClass = "ring-2 ring-inset ring-red-500 bg-red-50/70 dark:bg-red-950/30";
                                        } else if (entry && entry.id !== draggedId) {
                                            dropHighlightClass = "ring-2 ring-inset ring-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30";
                                        } else {
                                            dropHighlightClass = "ring-2 ring-inset ring-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30";
                                        }
                                    }

                                    return (
                                        <div
                                            key={key}
                                            role="gridcell"
                                            tabIndex={editMode ? 0 : -1}
                                            data-testid={`schedule-cell-${day.date}-${slotNum}`}
                                            aria-label={`${day.label} ${day.date} Slot ${slotNum}`}
                                            onKeyDown={(ev) => handleCellKeyDown(ev, day.date, slotNum, entry)}
                                            onDragOver={(ev) => {
                                                if (!editMode || !draggedId) return;
                                                ev.preventDefault();
                                                if (dragOverCell !== key) setDragOverCell(key);
                                            }}
                                            onDragLeave={() => {
                                                if (dragOverCell === key) setDragOverCell(null);
                                            }}
                                            onDrop={(ev) => {
                                                if (!editMode) return;
                                                ev.preventDefault();
                                                setDragOverCell(null);
                                                const droppedId = ev.dataTransfer.getData("text/plain") || draggedId;
                                                setDraggedId(null);
                                                if (droppedId) {
                                                    onDropMove?.(droppedId, day.date, slotNum);
                                                }
                                            }}
                                            className={`relative min-h-[108px] min-w-0 p-1.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                                !isLastRow ? "border-b" : ""
                                            } ${colIdx < visibleDays.length - 1 ? "border-r" : ""} ${
                                                day.isNonWorking && !entry ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                                            } ${
                                                isHighlighted ? "ring-2 ring-inset ring-amber-500 bg-amber-50/60 dark:bg-amber-950/30" : ""
                                            } ${dropHighlightClass}`}
                                        >
                                            {entry ? (
                                                <div
                                                    draggable={editMode}
                                                    onDragStart={(ev) => {
                                                        if (!editMode) return;
                                                        ev.dataTransfer.setData("text/plain", entry.id);
                                                        ev.dataTransfer.effectAllowed = "move";
                                                        setDraggedId(entry.id);
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggedId(null);
                                                        setDragOverCell(null);
                                                    }}
                                                    onClick={(ev) => {
                                                        if (!editMode) return;
                                                        if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
                                                            ev.stopPropagation();
                                                            onToggleSelect?.(entry.id, true);
                                                        }
                                                    }}
                                                    className={`group flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-lg border border-l-4 p-2 text-left shadow-xs transition-all ${
                                                        theme.bg
                                                    } ${theme.border} ${theme.text} ${
                                                        editMode ? "cursor-grab active:cursor-grabbing hover:shadow-sm" : ""
                                                    } ${isSelected ? "ring-2 ring-primary" : ""} ${
                                                        draggedId === entry.id ? "opacity-50" : ""
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="flex items-start justify-between gap-1">
                                                            <div className="flex flex-wrap items-center gap-1 min-w-0">
                                                                {editMode && (
                                                                    <GripVertical className="size-3.5 shrink-0 opacity-50" aria-hidden />
                                                                )}
                                                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                                                                    {course?.code || entry.courseCode || `Course #${entry.courseId}`}
                                                                </span>
                                                                <span className="text-[10px] font-semibold opacity-80">
                                                                    Session {entry.order}
                                                                </span>
                                                            </div>

                                                            {editMode && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button
                                                                            type="button"
                                                                            aria-label={`Actions for ${course?.code || entry.courseCode} on ${day.date} slot ${slotNum}`}
                                                                            onClick={(ev) => ev.stopPropagation()}
                                                                            className="rounded p-0.5 opacity-75 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                                                                        >
                                                                            <MoreVertical className="size-3.5" />
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-56 text-xs">
                                                                        <DropdownMenuItem onSelect={() => onRequestMoveDialog?.(entry)}>
                                                                            <ArrowLeftRight className="size-3.5 mr-2" />
                                                                            Move to date / slot...
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onSelect={() => onRequestChangeCourse?.(entry)}>
                                                                            <PenLine className="size-3.5 mr-2" />
                                                                            Change course...
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onSelect={() => onRequestInsertBefore?.(entry)}>
                                                                            <Plus className="size-3.5 mr-2" />
                                                                            Insert before &amp; shift
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onSelect={() => onRequestInsertAfter?.(entry)}>
                                                                            <Plus className="size-3.5 mr-2" />
                                                                            Insert after &amp; shift
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onSelect={() => onRequestEditActualDate?.(entry)}>
                                                                            <CalendarClock className="size-3.5 mr-2" />
                                                                            Actual Day...
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onSelect={() => onRequestEditNote?.(entry)}>
                                                                            <PenLine className="size-3.5 mr-2" />
                                                                            Session note...
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            className="text-red-600 focus:text-red-700"
                                                                            onSelect={() => onRequestDelete?.(entry)}
                                                                        >
                                                                            <Trash2 className="size-3.5 mr-2" />
                                                                            Delete session...
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                        </div>

                                                        <p className="mt-1.5 text-xs font-semibold leading-snug line-clamp-2 break-words">
                                                            {course?.name || entry.courseName || "Course"}
                                                        </p>
                                                        {entry.actualDate && (
                                                            <div className="mt-1">
                                                                <span
                                                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                                                        entry.actualDate === entry.date
                                                                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
                                                                            : "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200"
                                                                    }`}
                                                                >
                                                                    <CalendarClock className="size-2.5 shrink-0" />
                                                                    Actual: {entry.actualDate.split("-").reverse().join("/")}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {entry.note && (
                                                            <p className="mt-1 text-[10px] italic opacity-80 line-clamp-1">
                                                                {entry.note}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-black/10 dark:border-white/10 text-[10px]">
                                                        <span className="font-medium opacity-85">
                                                            {entry.startTime} – {entry.endTime}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            {hasWarning && (
                                                                <span
                                                                    title={cellIssues.map((i) => i.message).join("\n")}
                                                                    className="inline-flex items-center text-amber-700 dark:text-amber-300"
                                                                >
                                                                    <AlertTriangle className="size-3" />
                                                                </span>
                                                            )}
                                                            {entry.isManual && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="h-4 border-current/30 bg-background/70 px-1 py-0 text-[9px] font-semibold"
                                                                >
                                                                    Edited
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {editMode && isDragOver && entry.id !== draggedId && !isBeforeClassStart && (
                                                        <div className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-lg bg-indigo-900/75 text-[11px] font-semibold text-white">
                                                            Drop to swap sessions
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => {
                                                        if (editMode && !isBeforeClassStart) {
                                                            onRequestAddAt?.(day.date, slotNum);
                                                        }
                                                    }}
                                                    className={`flex h-full min-h-[94px] flex-col items-center justify-center rounded-lg border border-dashed p-2 text-center text-[11px] transition-colors ${
                                                        editMode && !isBeforeClassStart
                                                            ? "cursor-pointer border-muted-foreground/30 text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
                                                            : "border-border/60 text-muted-foreground/50"
                                                    }`}
                                                >
                                                    {editMode && isDragOver && isBeforeClassStart ? (
                                                        <span className="text-[11px] font-semibold text-red-600">
                                                            Before class start date
                                                        </span>
                                                    ) : editMode && isDragOver ? (
                                                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                                            Drop here
                                                        </span>
                                                    ) : editMode && !isBeforeClassStart ? (
                                                        <span className="inline-flex items-center gap-1 font-medium">
                                                            <Plus className="size-3.5" /> Add session
                                                        </span>
                                                    ) : (
                                                        <span>Empty</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Course Color Legend & Progress Bars */}
            {orderedCourses.length > 0 && (
                <section
                    aria-label="Course legend"
                    className="rounded-xl border bg-card p-3 shadow-xs space-y-2"
                >
                    <h3 className="text-xs font-semibold text-muted-foreground">
                        Training Program Courses ({orderedCourses.length} {orderedCourses.length === 1 ? "course" : "courses"})
                    </h3>
                    <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
                        {orderedCourses.map((course, idx) => {
                            const theme = getCourseColorTheme(idx);
                            const scheduled = slotsCountByCourse.get(course.id) ?? 0;
                            const needed = calculateSlotsNeeded(course.durationHours, config.slotHours);
                            const pct = needed > 0 ? Math.min(100, Math.round((scheduled / needed) * 100)) : 0;
                            const isExact = scheduled === needed;

                            return (
                                <div
                                    key={course.id}
                                    className={`min-w-0 overflow-hidden rounded-lg border p-2.5 text-xs ${theme.bg} ${theme.border}`}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                                        <span className="inline-flex min-w-0 items-center gap-1.5 font-bold">
                                            <span
                                                className="inline-block size-2.5 shrink-0 rounded-full"
                                                style={{ backgroundColor: theme.dot }}
                                            />
                                            <span className="truncate" title={course.code}>
                                                {idx + 1}. {course.code}
                                            </span>
                                        </span>
                                        <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold">
                                            {course.durationHours}h ({scheduled}/{needed} slot)
                                        </span>
                                    </div>
                                    <p className="mt-1 truncate text-[11px] opacity-85" title={course.name}>
                                        {course.name}
                                    </p>
                                    {showProgressInLegend && (
                                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                                            <div
                                                className={`h-full transition-all ${
                                                    isExact ? theme.progress : "bg-amber-500"
                                                }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}
