import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    CalendarCheck2,
    CalendarClock,
    ExternalLink,
    Info,
    Loader2,
    PencilRuler,
    Redo2,
    RotateCcw,
    Save,
    Sparkles,
    Trash2,
    Undo2,
    XCircle,
} from "lucide-react";
import { classScheduleApi } from "@/api/features/classSchedule.api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
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
import { usePermissions } from "@/hooks/usePermissions";
import type { ExternalClass } from "@/types";
import {
    DEFAULT_SCHEDULE_CONFIG,
    type ScheduleCourse,
    type ScheduleEntry,
    type ScheduleValidationIssue,
    type SlotNumber,
} from "../schedule.config";
import {
    ScheduleDomainError,
    addEntry,
    changeEntryCourse,
    getMondayOfIsoDate,
    hasManualEntriesInReorderRange,
    insertEntryAndShift,
    moveEntry,
    removeEntry,
    reorderCourses,
    validateSchedule,
} from "../scheduleEngine";
import { useScheduleDraft } from "../useScheduleDraft";
import { WeeklyScheduleGrid } from "./WeeklyScheduleGrid";

type DialogState =
    | { kind: "add"; date: string; slot: SlotNumber }
    | { kind: "move"; entry: ScheduleEntry }
    | { kind: "change"; entry: ScheduleEntry }
    | { kind: "insert"; entry: ScheduleEntry; position: "before" | "after" }
    | { kind: "actual-date"; entry: ScheduleEntry }
    | { kind: "note"; entry: ScheduleEntry }
    | { kind: "delete"; entry: ScheduleEntry }
    | { kind: "generate" }
    | { kind: "reorder"; from: number; to: number }
    | { kind: "discard" }
    | { kind: "save-warnings" }
    | null;

function errorMessage(err: unknown, fallback: string): string {
    if (err instanceof ScheduleDomainError) return err.message;
    const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    if (apiMsg) return apiMsg;
    return (err as { message?: string })?.message || fallback;
}

export function ClassScheduleEditor({
    classItem,
    onDirtyChange,
}: {
    classItem: ExternalClass;
    onDirtyChange?: (dirty: boolean) => void;
}) {
    const { hasPermission } = usePermissions();
    const canEdit = hasPermission("SESSION_UPDATE") || hasPermission("SESSION_CREATE");
    const queryClient = useQueryClient();
    const draft = useScheduleDraft(true);

    const [editMode, setEditMode] = useState(false);
    const [weekMonday, setWeekMonday] = useState(() => getMondayOfIsoDate(new Date().toISOString().slice(0, 10)));
    const [highlightedCell, setHighlightedCell] = useState<{ date: string; slot: SlotNumber } | null>(null);
    const [dialog, setDialog] = useState<DialogState>(null);
    const [formCourseId, setFormCourseId] = useState<string>("");
    const [formDate, setFormDate] = useState("");
    const [formSlot, setFormSlot] = useState<SlotNumber>(1);
    const [formCompact, setFormCompact] = useState(false);
    const [formActualDate, setFormActualDate] = useState("");
    const [formNote, setFormNote] = useState("");
    const [actualStartDate, setActualStartDate] = useState("");
    const [savedActualStartDate, setSavedActualStartDate] = useState("");
    const [genError, setGenError] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(true);

    const query = useQuery({
        queryKey: ["class-schedule", classItem.id],
        queryFn: () => classScheduleApi.getClassSchedule(classItem.id),
    });

    const data = query.data;
    const config = data?.config ?? DEFAULT_SCHEDULE_CONFIG;
    const classInfo = data?.classInfo;
    const classStartDate = classInfo?.startDate ?? classItem.startDate;
    const effectiveMinStartDate = useMemo(() => {
        if (!classStartDate) return actualStartDate || undefined;
        if (!actualStartDate) return classStartDate;
        return actualStartDate < classStartDate ? actualStartDate : classStartDate;
    }, [classStartDate, actualStartDate]);

    const computedActualEndDate = useMemo(() => {
        if (draft.entries.length === 0) return classInfo?.actualEndDate ?? "";
        return draft.entries.reduce((latest, e) => {
            const d = e.actualDate || e.date;
            return d > latest ? d : latest;
        }, "");
    }, [draft.entries, classInfo?.actualEndDate]);

    const actualDateChanged = actualStartDate !== savedActualStartDate;

    const courses: ScheduleCourse[] = useMemo(
        () =>
            (data?.program?.courses ?? []).map((c) => ({
                id: c.id,
                code: c.code,
                name: c.name,
                version: c.version,
                durationHours: c.durationHours ?? 0,
                orderIndex: c.orderIndex,
                slotsNeeded: c.slotsNeeded,
            })),
        [data?.program?.courses],
    );
    const defaultCourseOrder = useMemo(
        () => [...courses].sort((a, b) => a.orderIndex - b.orderIndex).map((c) => c.id),
        [courses],
    );
    const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

    // Initialize draft from server: saved entries, or an auto-generated (backend) draft when no schedule exists yet
    useEffect(() => {
        if (!data) return;
        let cancelled = false;
        setGenError(null);

        const finish = (initialDraftEntries: ScheduleEntry[]) => {
            if (cancelled) return;
            const resolvedActual =
                data.classInfo?.actualStartDate ||
                initialDraftEntries[0]?.date ||
                data.classInfo?.startDate ||
                classItem.startDate ||
                "";
            setActualStartDate(resolvedActual);
            setSavedActualStartDate(data.classInfo?.actualStartDate || resolvedActual);
            draft.initialize({
                savedEntries: data.entries,
                initialDraftEntries,
                courseOrder: defaultCourseOrder,
            });
            const anchor = initialDraftEntries[0]?.date ?? resolvedActual ?? classStartDate;
            if (anchor) setWeekMonday(getMondayOfIsoDate(anchor));
            setInitializing(false);
        };

        if (data.hasSchedule) {
            finish(data.entries);
        } else if (!data.program || courses.length === 0) {
            setGenError(
                data.program
                    ? "Training program has no courses."
                    : "This class is not linked to a valid Training Program, so a schedule cannot be auto-generated.",
            );
            finish([]);
        } else {
            setInitializing(true);
            classScheduleApi
                .generateClassSchedule(classItem.id)
                .then((generated) => finish(generated))
                .catch((err) => {
                    setGenError(errorMessage(err, "Could not auto-generate schedule."));
                    finish([]);
                });
        }
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, classItem.id]);

    const issues: ScheduleValidationIssue[] = useMemo(
        () =>
            validateSchedule(
                draft.entries,
                classInfo
                    ? { id: classInfo.id, startDate: effectiveMinStartDate ?? classInfo.startDate, endDate: classInfo.endDate }
                    : null,
                data?.program ?? null,
                courses,
                config,
                draft.courseOrder.length ? draft.courseOrder : defaultCourseOrder,
            ),
        [draft.entries, draft.courseOrder, classInfo, effectiveMinStartDate, data?.program, courses, config, defaultCourseOrder],
    );
    const errorIssues = issues.filter((i) => i.severity === "error");
    const warningIssues = issues.filter((i) => i.severity !== "error");

    const hasAnyUnsavedChanges = draft.hasUnsavedChanges || actualDateChanged;

    useEffect(() => {
        onDirtyChange?.(hasAnyUnsavedChanges);
    }, [hasAnyUnsavedChanges, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

    useEffect(() => {
        if (!hasAnyUnsavedChanges) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [hasAnyUnsavedChanges]);

    const save = useMutation({
        mutationFn: () =>
            classScheduleApi.saveClassSchedule(
                classItem.id,
                draft.entries.map((e) => ({
                    id: e.id,
                    courseId: e.courseId,
                    date: e.date,
                    actualDate: e.actualDate,
                    slot: e.slot,
                    isManual: e.isManual,
                    note: e.note,
                })),
                {
                    actualStartDate: actualStartDate || undefined,
                    actualEndDate: computedActualEndDate || undefined,
                },
            ),
        onSuccess: async (res) => {
            draft.markSaved(res.entries, draft.courseOrder);
            const persistedActual = res.classInfo?.actualStartDate || actualStartDate;
            setActualStartDate(persistedActual);
            setSavedActualStartDate(persistedActual);
            queryClient.setQueryData(["class-schedule", classItem.id], res);
            await queryClient.invalidateQueries({ queryKey: ["classes"] });
            await queryClient.invalidateQueries({ queryKey: ["calendar", "classes-directory"] });
            await queryClient.invalidateQueries({ queryKey: ["classes", "readiness", String(classItem.id)] });
            await queryClient.invalidateQueries({ queryKey: ["class-operation"] });
            toast.success(`Saved schedule for class ${classItem.code || classItem.id} (${res.entries.length} sessions).`);
        },
        onError: (err) => toast.error(errorMessage(err, "Could not save schedule. Please try again.")),
    });

    const generate = useMutation({
        mutationFn: () =>
            classScheduleApi.generateClassSchedule(classItem.id, {
                holidays: config.holidays,
                actualStartDate: actualStartDate || undefined,
            }),
        onSuccess: (generated) => {
            setGenError(null);
            draft.commitDraft(generated, defaultCourseOrder);
            if (generated[0]) setWeekMonday(getMondayOfIsoDate(generated[0].date));
            toast.success(`Generated ${generated.length} sessions from Training Program. Click "Save Schedule" to apply.`);
        },
        onError: (err) => {
            const msg = errorMessage(err, "Could not auto-generate schedule.");
            setGenError(msg);
            toast.error(msg);
        },
    });

    const runOp = (fn: () => ScheduleEntry[] | void, successMsg?: string) => {
        try {
            const result = fn();
            if (result) draft.commitDraft(result);
            if (successMsg) toast.success(successMsg);
            return true;
        } catch (err) {
            toast.error(errorMessage(err, "Invalid operation."));
            return false;
        }
    };

    const openDialog = (next: DialogState) => {
        setDialog(next);
        if (!next) return;
        if (next.kind === "add") {
            setFormCourseId(String(defaultCourseOrder[0] ?? ""));
        } else if (next.kind === "move") {
            setFormDate(next.entry.date);
            setFormSlot(next.entry.slot);
            setFormCompact(false);
        } else if (next.kind === "change" || next.kind === "insert") {
            setFormCourseId(String(next.entry.courseId));
        } else if (next.kind === "actual-date") {
            setFormActualDate(next.entry.actualDate || next.entry.date);
        } else if (next.kind === "note") {
            setFormNote(next.entry.note ?? "");
        }
    };

    const handleDropMove = (entryId: string, date: string, slot: SlotNumber) => {
        try {
            const res = moveEntry(draft.entries, entryId, date, slot, { classStartDate: effectiveMinStartDate, config });
            draft.commitDraft(res.entries);
            if (res.swapped) toast.info("Swapped the two sessions.");
        } catch (err) {
            toast.error(errorMessage(err, "Could not move session."));
        }
    };

    const requestReorder = (from: number, to: number) => {
        const order = draft.courseOrder.length ? draft.courseOrder : defaultCourseOrder;
        if (to < 0 || to >= order.length) return;
        if (hasManualEntriesInReorderRange(draft.entries, order, from, to)) {
            openDialog({ kind: "reorder", from, to });
            return;
        }
        applyReorder(from, to);
    };

    const applyReorder = (from: number, to: number) => {
        const order = draft.courseOrder.length ? draft.courseOrder : defaultCourseOrder;
        const res = reorderCourses(draft.entries, order, from, to, courses, config, {
            id: classItem.id,
            startDate: actualStartDate || classStartDate,
        });
        draft.commitDraft(res.entries, res.courseOrder);
        toast.success("Reordered courses and regenerated affected sessions.");
    };

    const focusIssue = (issue: ScheduleValidationIssue) => {
        if (!issue.date || !issue.slot) return;
        setWeekMonday(getMondayOfIsoDate(issue.date));
        setHighlightedCell({ date: issue.date, slot: issue.slot });
        window.setTimeout(() => setHighlightedCell(null), 4000);
    };

    const bulkDelete = () => {
        const ids = [...draft.selectedIds];
        if (ids.length === 0) return;
        let next = draft.entries;
        for (const id of ids) next = removeEntry(next, id, { compact: false, config });
        draft.commitDraft(next);
        draft.clearSelection();
        toast.success(`Deleted ${ids.length} selected session(s).`);
    };

    const handleSaveClick = () => {
        if (errorIssues.length > 0) {
            toast.error(`Cannot save: ${errorIssues.length} blocking error(s) must be resolved (duplicate slot / before start date).`);
            return;
        }
        if (warningIssues.length > 0) {
            openDialog({ kind: "save-warnings" });
            return;
        }
        save.mutate();
    };

    if (query.isPending || (initializing && !genError && !query.isError)) {
        return (
            <div className="space-y-3 rounded-xl border bg-card p-5" role="status" aria-label="Loading class schedule">
                <Skeleton className="h-7 w-72" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-72 w-full" />
            </div>
        );
    }

    if (query.isError) {
        return <ApiErrorState error={query.error} resource="class schedule" onRetry={() => void query.refetch()} />;
    }

    const effectiveOrder = draft.courseOrder.length ? draft.courseOrder : defaultCourseOrder;
    const isDraftUnsaved = !data?.hasSchedule && draft.entries.length > 0;

    return (
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            {/* Header */}
            <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold tracking-tight">{classInfo?.code || classItem.code}</h2>
                        {data?.hasSchedule ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                <CalendarCheck2 className="mr-1 size-3" /> Scheduled
                            </Badge>
                        ) : (
                            <Badge variant="secondary">Not scheduled</Badge>
                        )}
                        {hasAnyUnsavedChanges && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                Unsaved changes
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {classInfo?.name} · Planned Start: <strong>{classStartDate || "—"}</strong> · Program:{" "}
                        <strong>{data?.program ? `${data.program.code} (${data.program.name})` : classInfo?.programCode || "—"}</strong>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link to={`/classes/${classItem.id}?tab=calendar`}>
                            <ExternalLink className="size-3.5" /> View in Class
                        </Link>
                    </Button>
                </div>
            </header>

            {/* Actual Day Bar */}
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5 text-xs">
                <label className="flex items-center gap-2 font-medium text-foreground">
                    <CalendarClock className="size-3.5 shrink-0 text-primary" />
                    <span className="whitespace-nowrap">Actual Day:</span>
                    <Input
                        type="date"
                        aria-label="Actual Day"
                        value={actualStartDate}
                        disabled={!canEdit || save.isPending || generate.isPending}
                        onChange={(e) => setActualStartDate(e.target.value)}
                        className="h-7 w-36 bg-background px-2 text-xs"
                    />
                </label>
            </div>

            {/* Banners */}
            {isDraftUnsaved && (
                <div role="status" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>
                        This is an auto-generated <strong>draft</strong> from the Training Program and is <strong>not saved yet</strong>. Click "Save Schedule" to apply it to this class.
                    </span>
                </div>
            )}
            {data?.outdated && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{data.outdatedReason || "This schedule may be outdated compared to the current class configuration."}</span>
                </div>
            )}
            {genError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                    <XCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{genError}</span>
                </div>
            )}

            {/* Toolbar */}
            {canEdit && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                    <Button
                        type="button"
                        size="sm"
                        className="bg-blue-800 text-white hover:bg-blue-900"
                        disabled={generate.isPending || save.isPending || courses.length === 0}
                        onClick={() => {
                            if (data?.hasSchedule || draft.hasUnsavedChanges) openDialog({ kind: "generate" });
                            else generate.mutate();
                        }}
                    >
                        {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        Auto Generate
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={editMode ? "default" : "outline"}
                        aria-pressed={editMode}
                        onClick={() => {
                            setEditMode((v) => !v);
                            draft.clearSelection();
                        }}
                    >
                        <PencilRuler className="size-4" />
                        {editMode ? "Manual Edit (Active)" : "Manual Edit"}
                    </Button>
                    <div className="mx-1 h-6 w-px bg-border" />
                    <Button type="button" size="sm" variant="outline" disabled={!draft.canUndo} onClick={draft.undo} title="Undo (Ctrl+Z)">
                        <Undo2 className="size-4" /> Undo
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={!draft.canRedo} onClick={draft.redo} title="Redo (Ctrl+Y / Ctrl+Shift+Z)">
                        <Redo2 className="size-4" /> Redo
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={(!draft.canDiscard && !actualDateChanged) || save.isPending}
                        onClick={() => openDialog({ kind: "discard" })}
                    >
                        <RotateCcw className="size-4" /> Discard Changes
                    </Button>
                    {editMode && draft.selectedIds.size > 0 && (
                        <Button type="button" size="sm" variant="destructive" onClick={bulkDelete}>
                            <Trash2 className="size-4" /> Delete {draft.selectedIds.size} selected
                        </Button>
                    )}
                    <Button
                        type="button"
                        size="sm"
                        className="ml-auto bg-emerald-700 text-white hover:bg-emerald-800"
                        disabled={save.isPending || (!hasAnyUnsavedChanges && !isDraftUnsaved)}
                        onClick={handleSaveClick}
                    >
                        {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {save.isPending ? "Saving..." : "Save Schedule"}
                    </Button>
                </div>
            )}

            <div className="flex min-w-0 flex-col gap-3">
                <WeeklyScheduleGrid
                    entries={draft.entries}
                    courses={courses}
                    courseOrder={effectiveOrder}
                    config={config}
                    classStartDate={effectiveMinStartDate}
                    weekMonday={weekMonday}
                    onWeekMondayChange={setWeekMonday}
                    editMode={editMode && canEdit}
                    forceShowWeekends={editMode && canEdit}
                    highlightedCell={highlightedCell}
                    issues={issues}
                    selectedIds={draft.selectedIds}
                    onToggleSelect={draft.toggleSelection}
                    onDropMove={handleDropMove}
                    onRequestAddAt={(date, slot) => openDialog({ kind: "add", date, slot })}
                    onRequestMoveDialog={(entry) => openDialog({ kind: "move", entry })}
                    onRequestChangeCourse={(entry) => openDialog({ kind: "change", entry })}
                    onRequestInsertBefore={(entry) => openDialog({ kind: "insert", entry, position: "before" })}
                    onRequestInsertAfter={(entry) => openDialog({ kind: "insert", entry, position: "after" })}
                    onRequestEditActualDate={(entry) => openDialog({ kind: "actual-date", entry })}
                    onRequestEditNote={(entry) => openDialog({ kind: "note", entry })}
                    onRequestDelete={(entry) => openDialog({ kind: "delete", entry })}
                    showProgressInLegend
                />

                <div className="grid gap-3 md:grid-cols-2">
                    {/* Course order */}
                    <section aria-label="Course order" className="rounded-xl border bg-card p-3 shadow-xs">
                        <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Course Order</h3>
                        {effectiveOrder.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No courses available.</p>
                        ) : (
                            <ol className="space-y-1.5">
                                {effectiveOrder.map((id, idx) => {
                                    const c = courseById.get(id);
                                    if (!c) return null;
                                    return (
                                        <li key={id} className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs">
                                            <span className="w-5 shrink-0 font-bold text-muted-foreground">{idx + 1}.</span>
                                            <span className="min-w-0 flex-1 truncate font-semibold" title={c.name}>
                                                {c.code} <span className="font-normal text-muted-foreground">({c.durationHours}h)</span>
                                            </span>
                                            {editMode && canEdit && (
                                                <>
                                                    <button type="button" aria-label={`Move ${c.code} up`} disabled={idx === 0} onClick={() => requestReorder(idx, idx - 1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
                                                        <ArrowUp className="size-3.5" />
                                                    </button>
                                                    <button type="button" aria-label={`Move ${c.code} down`} disabled={idx === effectiveOrder.length - 1} onClick={() => requestReorder(idx, idx + 1)} className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
                                                        <ArrowDown className="size-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </section>

                    {/* Validation panel */}
                    <section aria-label="Schedule validation" className="rounded-xl border bg-card p-3 shadow-xs">
                        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <AlertTriangle className="size-3.5" /> Schedule Validation ({errorIssues.length} {errorIssues.length === 1 ? "error" : "errors"} · {warningIssues.length} {warningIssues.length === 1 ? "warning" : "warnings"})
                        </h3>
                        {issues.length === 0 ? (
                            <p className="text-xs text-emerald-700 dark:text-emerald-300">Schedule is valid with no warnings.</p>
                        ) : (
                            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                                {[...errorIssues, ...warningIssues].map((issue) => (
                                    <li key={issue.id}>
                                        <button
                                            type="button"
                                            onClick={() => focusIssue(issue)}
                                            className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] leading-snug hover:bg-muted/50 ${issue.severity === "error"
                                                ? "border-red-300 text-red-800 dark:text-red-300"
                                                : issue.severity === "warning"
                                                    ? "border-amber-300 text-amber-900 dark:text-amber-200"
                                                    : "border-border text-muted-foreground"
                                                }`}
                                        >
                                            {issue.message}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>

            {/* Dialogs */}
            <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent className={dialog?.kind === "delete" ? "sm:max-w-xl" : "sm:max-w-lg"}>
                    {dialog?.kind === "generate" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Regenerate schedule?</DialogTitle>
                                <DialogDescription>
                                    The current schedule (including manual edits) will be <strong>overwritten</strong> with an auto-generated schedule from the Training Program. You can still Undo before saving.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                                <Button onClick={() => { setDialog(null); generate.mutate(); }}>Overwrite &amp; Generate</Button>
                            </DialogFooter>
                        </>
                    )}

                    {dialog?.kind === "reorder" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Reorder courses?</DialogTitle>
                                <DialogDescription>
                                    Affected courses contain manually edited sessions. Their schedule will be regenerated and <strong>manual edits will be lost</strong>.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                                <Button onClick={() => { const d = dialog; setDialog(null); applyReorder(d.from, d.to); }}>Continue</Button>
                            </DialogFooter>
                        </>
                    )}

                    {(dialog?.kind === "add" || dialog?.kind === "change" || dialog?.kind === "insert") && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {dialog.kind === "add"
                                        ? `Add Session (${dialog.date} · Slot ${dialog.slot})`
                                        : dialog.kind === "change"
                                            ? "Change Session Course"
                                            : dialog.position === "before"
                                                ? "Insert Session Before & Shift"
                                                : "Insert Session After & Shift"}
                                </DialogTitle>
                                <DialogDescription>
                                    {dialog.kind === "insert"
                                        ? "Subsequent sessions will be shifted forward by 1 valid working slot (skipping weekends and holidays)."
                                        : "Select a course from this class's Training Program."}
                                </DialogDescription>
                            </DialogHeader>
                            <label className="block space-y-1 text-sm">
                                Course
                                <select
                                    aria-label="Select course"
                                    value={formCourseId}
                                    onChange={(e) => setFormCourseId(e.target.value)}
                                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                >
                                    {effectiveOrder.map((id) => {
                                        const c = courseById.get(id);
                                        return c ? <option key={id} value={id}>{c.code} · {c.name}</option> : null;
                                    })}
                                </select>
                            </label>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                                <Button
                                    disabled={!formCourseId}
                                    onClick={() => {
                                        const cid = Number(formCourseId);
                                        const c = courseById.get(cid);
                                        const d = dialog;
                                        const ok = runOp(() => {
                                            if (d.kind === "add") {
                                                return addEntry(draft.entries, cid, d.date, d.slot, {
                                                    classId: classItem.id, classStartDate: effectiveMinStartDate, courseCode: c?.code, courseName: c?.name, config,
                                                });
                                            }
                                            if (d.kind === "change") {
                                                return changeEntryCourse(draft.entries, d.entry.id, cid, { code: c?.code, name: c?.name });
                                            }
                                            return insertEntryAndShift(draft.entries, cid, d.entry.date, d.entry.slot, config, {
                                                position: d.position, classId: classItem.id, classStartDate: effectiveMinStartDate, courseCode: c?.code, courseName: c?.name,
                                            });
                                        });
                                        if (ok) setDialog(null);
                                    }}
                                >
                                    Confirm
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                    {dialog?.kind === "move" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Move Session</DialogTitle>
                                <DialogDescription>
                                    Choose the target date and slot. If the target slot is occupied, the two sessions will be swapped.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-1 text-sm">
                                    Date
                                    <Input type="date" aria-label="Target date" min={effectiveMinStartDate} value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                                </label>
                                <label className="space-y-1 text-sm">
                                    Slot
                                    <select aria-label="Target slot" value={formSlot} onChange={(e) => setFormSlot(Number(e.target.value) as SlotNumber)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                                        {config.slots.map((s) => (
                                            <option key={s.slot} value={s.slot}>Slot {s.slot} ({s.start}–{s.end})</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={formCompact}
                                    onChange={(e) => setFormCompact(e.target.checked)}
                                    className="size-4 rounded border-input accent-primary"
                                />
                                Shift subsequent sessions forward to fill the vacated slot
                            </label>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                                <Button
                                    onClick={() => {
                                        const d = dialog;
                                        try {
                                            const res = moveEntry(draft.entries, d.entry.id, formDate, formSlot, {
                                                compact: formCompact,
                                                classStartDate: effectiveMinStartDate,
                                                config,
                                            });
                                            draft.commitDraft(res.entries);
                                            setWeekMonday(getMondayOfIsoDate(formDate));
                                            toast.success(res.swapped ? "Swapped the two sessions." : "Moved session.");
                                            setDialog(null);
                                        } catch (err) {
                                            toast.error(errorMessage(err, "Could not move session."));
                                        }
                                    }}
                                >
                                    Move
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                    {dialog?.kind === "actual-date" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Actual Day</DialogTitle>
                                <DialogDescription>
                                    {courseById.get(dialog.entry.courseId)?.code ?? dialog.entry.courseCode} · Session {dialog.entry.order} · Planned: {dialog.entry.date} (Slot {dialog.entry.slot})
                                </DialogDescription>
                            </DialogHeader>
                            <label className="block space-y-1 text-sm">
                                Actual Date
                                <Input
                                    type="date"
                                    aria-label="Actual Date"
                                    value={formActualDate}
                                    onChange={(e) => setFormActualDate(e.target.value)}
                                />
                            </label>
                            <DialogFooter className="flex-wrap justify-end gap-2">
                                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                                {dialog.entry.actualDate && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            const d = dialog;
                                            draft.commitDraft(
                                                draft.entries.map((e) =>
                                                    e.id === d.entry.id ? { ...e, actualDate: undefined, isManual: true } : e,
                                                ),
                                            );
                                            setDialog(null);
                                            toast.info("Cleared actual date for this session.");
                                        }}
                                    >
                                        Clear Actual Date
                                    </Button>
                                )}
                                <Button
                                    disabled={!formActualDate}
                                    onClick={() => {
                                        const d = dialog;
                                        draft.commitDraft(
                                            draft.entries.map((e) =>
                                                e.id === d.entry.id ? { ...e, actualDate: formActualDate, isManual: true } : e,
                                            ),
                                        );
                                        setDialog(null);
                                        toast.success("Updated actual date.");
                                    }}
                                >
                                    Save Actual Date
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                    {dialog?.kind === "note" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Session Note</DialogTitle>
                                <DialogDescription>{dialog.entry.date} · Slot {dialog.entry.slot}</DialogDescription>
                            </DialogHeader>
                            <Input aria-label="Note" maxLength={255} value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="e.g. Make-up class, midterm exam..." />
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                                <Button
                                    onClick={() => {
                                        const d = dialog;
                                        draft.commitDraft(
                                            draft.entries.map((e) => (e.id === d.entry.id ? { ...e, note: formNote.trim() || undefined, isManual: true } : e)),
                                        );
                                        setDialog(null);
                                    }}
                                >
                                    Save Note
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                    {dialog?.kind === "delete" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Delete Session</DialogTitle>
                                <DialogDescription>
                                    {courseById.get(dialog.entry.courseId)?.code ?? dialog.entry.courseCode} · Session {dialog.entry.order} · {dialog.entry.date} Slot {dialog.entry.slot}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="flex-row flex-nowrap items-center justify-end gap-2">
                                <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => setDialog(null)}>Cancel</Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="whitespace-nowrap"
                                    onClick={() => {
                                        const d = dialog;
                                        runOp(() => removeEntry(draft.entries, d.entry.id, { compact: false, config }), "Deleted session (slot left empty).");
                                        setDialog(null);
                                    }}
                                >
                                    Delete &amp; Leave Empty
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="whitespace-nowrap"
                                    onClick={() => {
                                        const d = dialog;
                                        runOp(() => removeEntry(draft.entries, d.entry.id, { compact: true, config }), "Deleted session and shifted schedule up.");
                                        setDialog(null);
                                    }}
                                >
                                    Delete &amp; Shift Up
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                    {dialog?.kind === "discard" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Discard all changes?</DialogTitle>
                                <DialogDescription>
                                    All unsaved edits will be discarded and the schedule will revert to the last saved version.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Keep Editing</Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        setDialog(null);
                                        setActualStartDate(savedActualStartDate);
                                        draft.discardChanges();
                                        toast.info("Reverted to the last saved schedule.");
                                    }}
                                >
                                    Discard Changes
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                    {dialog?.kind === "save-warnings" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Schedule has {warningIssues.length} {warningIssues.length === 1 ? "warning" : "warnings"}</DialogTitle>
                                <DialogDescription>
                                    There are warnings in the current schedule. Are you sure you want to save anyway?
                                </DialogDescription>
                            </DialogHeader>
                            <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border bg-amber-50/50 p-2.5 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
                                {warningIssues.map((issue) => (
                                    <li key={issue.id} className="leading-snug">• {issue.message}</li>
                                ))}
                            </ul>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Go Back</Button>
                                <Button
                                    className="bg-emerald-700 text-white hover:bg-emerald-800"
                                    onClick={() => {
                                        setDialog(null);
                                        save.mutate();
                                    }}
                                >
                                    Save Anyway
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
