import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScheduleEntry } from "./schedule.config";
import { compareDateSlot } from "./scheduleEngine";

const MAX_HISTORY_STEPS = 50; // >= 30 steps required by spec

export interface DraftSnapshot {
    entries: ScheduleEntry[];
    courseOrder: number[];
}

function serializeEntries(entries: readonly ScheduleEntry[]): string {
    const sorted = [...entries].sort(compareDateSlot);
    return JSON.stringify(
        sorted.map((e) => ({
            courseId: e.courseId,
            date: e.date,
            slot: e.slot,
            order: e.order,
            isManual: e.isManual,
            note: e.note ?? "",
        })),
    );
}

export function useScheduleDraft(enableKeyboardShortcuts = true) {
    const [savedSignature, setSavedSignature] = useState<string>("[]");
    const [baseline, setBaseline] = useState<DraftSnapshot>({ entries: [], courseOrder: [] });
    const [present, setPresent] = useState<DraftSnapshot>({ entries: [], courseOrder: [] });
    const [past, setPast] = useState<DraftSnapshot[]>([]);
    const [future, setFuture] = useState<DraftSnapshot[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    /** Initializes state from server data (or initial auto-generated draft when class had no saved schedule). */
    const initialize = useCallback(
        (options: {
            savedEntries: ScheduleEntry[];
            initialDraftEntries: ScheduleEntry[];
            courseOrder: number[];
        }) => {
            const sig = serializeEntries(options.savedEntries);
            const snap: DraftSnapshot = {
                entries: options.initialDraftEntries.map((e) => ({ ...e })),
                courseOrder: [...options.courseOrder],
            };
            setSavedSignature(sig);
            setBaseline(snap);
            setPresent(snap);
            setPast([]);
            setFuture([]);
            setSelectedIds(new Set());
        },
        [],
    );

    /** Pushes a new draft mutation onto the Undo stack (capped at MAX_HISTORY_STEPS). */
    const commitDraft = useCallback(
        (nextEntries: ScheduleEntry[], nextCourseOrder?: number[]) => {
            setPresent((current) => {
                setPast((prevPast) => {
                    const updated = [...prevPast, current];
                    return updated.length > MAX_HISTORY_STEPS
                        ? updated.slice(updated.length - MAX_HISTORY_STEPS)
                        : updated;
                });
                setFuture([]);
                return {
                    entries: nextEntries.map((e) => ({ ...e })),
                    courseOrder: nextCourseOrder ? [...nextCourseOrder] : current.courseOrder,
                };
            });
        },
        [],
    );

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    const undo = useCallback(() => {
        setPast((prevPast) => {
            if (prevPast.length === 0) return prevPast;
            const previous = prevPast[prevPast.length - 1];
            setPresent((current) => {
                setFuture((prevFuture) => [current, ...prevFuture].slice(0, MAX_HISTORY_STEPS));
                return previous;
            });
            setSelectedIds(new Set());
            return prevPast.slice(0, -1);
        });
    }, []);

    const redo = useCallback(() => {
        setFuture((prevFuture) => {
            if (prevFuture.length === 0) return prevFuture;
            const [next, ...rest] = prevFuture;
            setPresent((current) => {
                setPast((prevPast) => [...prevPast, current].slice(-MAX_HISTORY_STEPS));
                return next;
            });
            setSelectedIds(new Set());
            return rest;
        });
    }, []);

    /** Discards unsaved edits back to `baseline` (last saved or initial auto-generated snapshot). */
    const discardChanges = useCallback(() => {
        setPresent({
            entries: baseline.entries.map((e) => ({ ...e })),
            courseOrder: [...baseline.courseOrder],
        });
        setPast([]);
        setFuture([]);
        setSelectedIds(new Set());
    }, [baseline]);

    /** Resets baseline, saved signature, and Undo/Redo stacks after a successful Save. */
    const markSaved = useCallback((savedEntries: ScheduleEntry[], nextCourseOrder?: number[]) => {
        const sig = serializeEntries(savedEntries);
        setSavedSignature(sig);
        setPresent((current) => {
            const snap: DraftSnapshot = {
                entries: savedEntries.map((e) => ({ ...e })),
                courseOrder: nextCourseOrder ? [...nextCourseOrder] : current.courseOrder,
            };
            setBaseline(snap);
            return snap;
        });
        setPast([]);
        setFuture([]);
        setSelectedIds(new Set());
    }, []);

    const currentSignature = useMemo(() => serializeEntries(present.entries), [present.entries]);
    const hasUnsavedChanges = currentSignature !== savedSignature;
    const canDiscard = useMemo(
        () => serializeEntries(present.entries) !== serializeEntries(baseline.entries),
        [present.entries, baseline.entries],
    );

    const toggleSelection = useCallback((entryId: string, multi: boolean) => {
        setSelectedIds((prev) => {
            const next = multi ? new Set(prev) : new Set<string>();
            if (next.has(entryId)) {
                next.delete(entryId);
            } else {
                next.add(entryId);
            }
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    useEffect(() => {
        if (!enableKeyboardShortcuts) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable)
            ) {
                return;
            }
            const isMod = event.ctrlKey || event.metaKey;
            if (!isMod) return;

            if (event.key.toLowerCase() === "z" && !event.shiftKey) {
                if (canUndo) {
                    event.preventDefault();
                    undo();
                }
            } else if (
                (event.key.toLowerCase() === "z" && event.shiftKey) ||
                event.key.toLowerCase() === "y"
            ) {
                if (canRedo) {
                    event.preventDefault();
                    redo();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [enableKeyboardShortcuts, canUndo, canRedo, undo, redo]);

    return {
        entries: present.entries,
        courseOrder: present.courseOrder,
        hasUnsavedChanges,
        canDiscard,
        canUndo,
        canRedo,
        undoCount: past.length,
        redoCount: future.length,
        selectedIds,
        initialize,
        commitDraft,
        undo,
        redo,
        discardChanges,
        markSaved,
        toggleSelection,
        clearSelection,
    };
}
