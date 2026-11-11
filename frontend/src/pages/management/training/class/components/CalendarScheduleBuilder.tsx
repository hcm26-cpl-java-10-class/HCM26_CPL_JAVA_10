import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Clock3, Loader2, Save, Send, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { externalApi } from "@/api/features/external.api";
import type { ExternalClass } from "@/types";
import type { CalendarLesson, CalendarTopic, ClassCalendarVersion, ClassSession } from "@/types/features/external";

type Period = "morning" | "afternoon";
type TimeRange = { start: string; end: string };
type PlannedLesson = CalendarLesson;
type ScheduleConfig = { weekdays: number[]; periods: Period[]; times: Record<Period, TimeRange> };

const WEEKDAYS = [
    { value: 1, short: "Mon", full: "Monday" }, { value: 2, short: "Tue", full: "Tuesday" },
    { value: 3, short: "Wed", full: "Wednesday" }, { value: 4, short: "Thu", full: "Thursday" },
    { value: 5, short: "Fri", full: "Friday" }, { value: 6, short: "Sat", full: "Saturday" },
    { value: 0, short: "Sun", full: "Sunday" },
];
const DEFAULT_CONFIG: ScheduleConfig = {
    weekdays: [1, 2, 3, 4, 5],
    periods: ["morning", "afternoon"],
    times: { morning: { start: "08:00", end: "11:30" }, afternoon: { start: "13:30", end: "17:00" } },
};

function parseDate(value?: string) {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return undefined;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.toISOString().slice(0, 10) === value ? date : undefined;
}
function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function normalized(value?: string) { return (value ?? "").replace(/^\[|\]$/g, "").trim().toLowerCase(); }
function normalizeSlot(value?: string) {
    return normalized(value).replace(/[–—]/g, "-").replace(/\b(morning|afternoon)\b/g, "")
        .replace(/\b(am|pm)\b/g, "").replace(/[()\s]/g, "");
}
function periodOf(value?: string): Period {
    const text = normalized(value);
    return text.includes("afternoon") || /\bpm\b/.test(text) ? "afternoon" : "morning";
}
function timeRange(value?: string) {
    const match = /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/.exec(value ?? "");
    if (!match) return undefined;
    const minutes = (time: string) => { const [hours, mins] = time.split(":").map(Number); return hours * 60 + mins; };
    return { start: minutes(match[1]), end: minutes(match[2]) };
}
function overlaps(left?: string, right?: string) {
    const a = timeRange(left); const b = timeRange(right);
    return a && b ? a.start < b.end && b.start < a.end : normalizeSlot(left) === normalizeSlot(right);
}
function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
    const date = parseDate(value);
    return date ? date.toLocaleDateString("en-GB", { ...options, timeZone: "UTC" }) : "—";
}
function dateInWeek(date: string, start: Date) {
    const parsed = parseDate(date);
    return !!parsed && parsed >= start && parsed < new Date(start.getTime() + 7 * 86400000);
}
function firstMonday(value: Date) {
    const monday = new Date(value);
    const offset = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - offset);
    return monday;
}
function lessonId(topicId: string, date: string, period: Period) { return `slot-${topicId}-${date}-${period}`; }
function sessionMatchesTopic(session: ClassSession, topic: CalendarTopic) {
    const code = normalized(topic.label); const name = normalized(topic.name);
    return [normalized(session.topicCode), normalized(session.topic)].some((value) => value && (
        value === code || value === name || value.startsWith(`${code} `) || value.startsWith(`${code}·`)
    ));
}
function buildLessons(topic: CalendarTopic, config: ScheduleConfig, learningStart: string): PlannedLesson[] {
    const from = parseDate(learningStart); const end = parseDate(topic.endDate);
    const topicFrom = parseDate(topic.startDate);
    if (!from || !end) return [];
    const start = topicFrom && topicFrom > from ? topicFrom : from;
    const generated: PlannedLesson[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        if (config.weekdays.includes(cursor.getUTCDay())) {
            for (const period of config.periods) {
                const range = config.times[period];
                const periodLabel = period === "morning" ? "Morning" : "Afternoon";
                generated.push({
                    id: lessonId(topic.id, isoDate(cursor), period),
                    name: topic.name || topic.label,
                    from: isoDate(cursor), to: isoDate(cursor),
                    slot: `${periodLabel} (${range.start}-${range.end})`,
                    trainer: undefined, venue: undefined,
                });
            }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return generated;
}
function initialConfig(lessons: CalendarLesson[]): ScheduleConfig {
    if (!lessons.length) return DEFAULT_CONFIG;
    const dates = lessons.map((lesson) => parseDate(lesson.from)).filter((date): date is Date => !!date);
    const weekdays = [...new Set(dates.map((date) => date.getUTCDay()))];
    const periods = [...new Set(lessons.map((lesson) => periodOf(lesson.slot)))];
    const times = { ...DEFAULT_CONFIG.times };
    for (const lesson of lessons) {
        const range = timeRange(lesson.slot);
        if (!range) continue;
        const p = periodOf(lesson.slot);
        const start = String(Math.floor(range.start / 60)).padStart(2, "0") + ":" + String(range.start % 60).padStart(2, "0");
        const end = String(Math.floor(range.end / 60)).padStart(2, "0") + ":" + String(range.end % 60).padStart(2, "0");
        times[p] = { start, end };
    }
    return { weekdays: weekdays.length ? weekdays : DEFAULT_CONFIG.weekdays, periods: periods.length ? periods : DEFAULT_CONFIG.periods, times };
}

function conflictReason(lesson: CalendarLesson, topic: CalendarTopic, current: ClassSession[], plan: CalendarLesson[]) {
    const currentConflicts = current.filter((session) => normalized(session.status) !== "cancelled"
        && session.date === lesson.from && overlaps(session.slot, lesson.slot)
        && !(sessionMatchesTopic(session, topic) && normalizeSlot(session.slot) === normalizeSlot(lesson.slot)));
    const plannedConflicts = plan.filter((other) => other.id !== lesson.id && other.from === lesson.from
        && overlaps(other.slot, lesson.slot));
    if (!currentConflicts.length && !plannedConflicts.length) return undefined;
    const sameRoom = currentConflicts.some((session) => normalized(session.room) && lesson.venue
        && normalized(session.room) === normalized(lesson.venue))
        || plannedConflicts.some((other) => normalized(other.venue) && lesson.venue
            && normalized(other.venue) === normalized(lesson.venue));
    const sameTeacher = [...currentConflicts.map((session) => session.trainer), ...plannedConflicts.map((other) => other.trainer)]
        .some((trainer) => normalized(trainer) && lesson.trainer && normalized(trainer) === normalized(lesson.trainer));
    return sameRoom ? "Room conflict" : sameTeacher ? "Teacher conflict" : "Class time conflict";
}

export function CalendarScheduleBuilder({
    calendar, topic, classItem, sessions, sessionsLoading, sessionsError, canManage, onCalendarSaved, onSessionsReload,
}: {
    calendar: ClassCalendarVersion;
    topic: CalendarTopic;
    classItem: ExternalClass;
    sessions: ClassSession[];
    sessionsLoading: boolean;
    sessionsError: boolean;
    canManage: boolean;
    onCalendarSaved: (calendar: ClassCalendarVersion) => void;
    onSessionsReload: () => Promise<unknown>;
}) {
    const [learningStart, setLearningStart] = useState(calendar.actualLearningStartDate || "");
    const [config, setConfig] = useState(() => initialConfig(topic.lessons ?? []));
    const [plan, setPlan] = useState<PlannedLesson[]>(() => topic.lessons ?? []);
    const [setupOpen, setSetupOpen] = useState(!topic.lessons?.length);
    const [activeWeek, setActiveWeek] = useState(0);
    const [saving, setSaving] = useState<"slot" | "draft" | "publish" | null>(null);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [error, setError] = useState("");
    const [published, setPublished] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [assigningLesson, setAssigningLesson] = useState<string | null>(null);
    const [selectedWeekAssignment, setSelectedWeekAssignment] = useState<string | null>(null);
    const roomsQuery = useQuery({ queryKey: ["external", "rooms"], queryFn: externalApi.getRooms, enabled: canManage });
    const trainersQuery = useQuery({ queryKey: ["external", "trainers", "active"], queryFn: () => externalApi.getTrainers("active"), enabled: canManage });
    const effectiveStart = parseDate(learningStart);
    const topicStart = parseDate(topic.startDate);
    const topicEnd = parseDate(topic.endDate || classItem.endDate || "");
    const classStart = parseDate(classItem.startDate || calendar.classStartDate || "");
    const classEnd = parseDate(classItem.endDate || calendar.classEndDate || "");
    const scheduleStart = effectiveStart && topicStart && topicStart > effectiveStart ? topicStart : effectiveStart;
    const validLearningStart = !!effectiveStart && (!classStart || effectiveStart >= classStart) && (!classEnd || effectiveStart <= classEnd);
    const validRange = !!scheduleStart && !!topicEnd && topicEnd >= scheduleStart;
    const daysCount = useMemo(() => {
        if (!validRange || !scheduleStart || !topicEnd) return 0;
        let days = 0; const cursor = new Date(scheduleStart);
        while (cursor <= topicEnd) { if (config.weekdays.includes(cursor.getUTCDay())) days += 1; cursor.setUTCDate(cursor.getUTCDate() + 1); }
        return days;
    }, [validRange, scheduleStart, topicEnd, config.weekdays]);
    const totalSlots = daysCount * config.periods.length;
    const firstWeek = scheduleStart ? firstMonday(scheduleStart) : undefined;
    const weeks = useMemo(() => {
        if (!firstWeek || !topicEnd) return [];
        const result: Date[] = []; const cursor = new Date(firstWeek);
        while (cursor <= topicEnd) { result.push(new Date(cursor)); cursor.setUTCDate(cursor.getUTCDate() + 7); }
        return result;
    }, [firstWeek?.toISOString(), topicEnd?.toISOString()]);
    const currentWeek = weeks[activeWeek];
    const hasPlan = plan.length > 0;
    const settingsValid = config.weekdays.length > 0 && config.periods.length > 0 && config.periods.every((period) => {
        const time = config.times[period]; return !!time.start && !!time.end && time.start < time.end;
    });
    const canSaveSlotTime = canManage && validLearningStart && validRange && settingsValid && !saving;
    const conflictById = useMemo(() => new Map(plan.map((lesson) => [lesson.id, conflictReason(lesson, topic, sessions, plan)])), [plan, topic, sessions]);
    const unresolvedCount = plan.filter((lesson) => !lesson.venue || !lesson.trainer).length;
    const conflictCount = [...conflictById.values()].filter(Boolean).length;
    const canPublish = canManage && hasPlan && !saving && !sessionsLoading && !sessionsError
        && !unresolvedCount && !conflictCount && !roomsQuery.isError && !trainersQuery.isError;
    const publishedCount = useMemo(() => plan.filter((lesson) => sessions.some((session) =>
        session.date === lesson.from && normalizeSlot(session.slot) === normalizeSlot(lesson.slot)
        && sessionMatchesTopic(session, topic)
        && normalized(session.status) !== "cancelled"
        && normalized(session.trainer) === normalized(lesson.trainer)
        && normalized(session.room) === normalized(lesson.venue))).length, [plan, sessions, topic]);
    const isPublished = published || (plan.length > 0 && publishedCount === plan.length);

    const changeWeekday = (value: number, selected: boolean) => setConfig((current) => ({
        ...current, weekdays: selected ? [...new Set([...current.weekdays, value])].sort((a, b) => a - b) : current.weekdays.filter((day) => day !== value),
    }));
    const changePeriod = (period: Period, selected: boolean) => setConfig((current) => ({
        ...current, periods: selected ? current.periods.includes(period) ? current.periods : [...current.periods, period]
            : current.periods.filter((item) => item !== period),
    }));

    const persistDraft = async (lessons: PlannedLesson[], changeNote: string) => {
        if (!effectiveStart) throw new Error("Actual Learning Start Date is required.");
        const classStartValue = classItem.startDate || calendar.classStartDate;
        if (!classStartValue) throw new Error("Class Start Date is missing from the class/calendar API.");
        const updatedTopic: CalendarTopic = {
            ...topic,
            startDate: scheduleStart ? isoDate(scheduleStart) : topic.startDate,
            slot: [...new Set(lessons.map((lesson) => lesson.slot).filter((slot): slot is string => !!slot))].join(" · "),
            lessons,
        };
        const currentItems = calendar.overviewItems ?? [];
        const hasTopic = currentItems.some((item) => item.id === topic.id);
        const overviewItems = hasTopic
            ? currentItems.map((item) => item.id === topic.id ? updatedTopic : item)
            : [...currentItems, updatedTopic];
        const saved = await externalApi.createCalendarVersion(classItem.id, calendar.id, {
            classStartDate: classStartValue,
            actualLearningStartDate: learningStart,
            overviewItems,
            historyChange: changeNote,
        });
        const next: ClassCalendarVersion = {
            ...calendar,
            ...saved,
            // Keep the server's lifecycle state; creating a version does not mean it is live.
            status: saved.status ?? calendar.status,
            historyChange: saved.historyChange ?? changeNote,
            lastModifiedDate: saved.lastModifiedDate ?? calendar.lastModifiedDate,
            lastModifiedBy: saved.lastModifiedBy ?? calendar.lastModifiedBy,
            overviewItems: saved.overviewItems ?? overviewItems,
            actualLearningStartDate: saved.actualLearningStartDate ?? learningStart,
        };
        onCalendarSaved(next);
        return next;
    };

    const handleSaveSlotTime = async () => {
        if (!canSaveSlotTime) return;
        setError(""); setSaving("slot");
        try {
            const prior = new Map(plan.map((lesson) => [`${lesson.from}|${normalizeSlot(lesson.slot)}`, lesson]));
            const generated = buildLessons(topic, config, learningStart).map((lesson) => {
                const old = prior.get(`${lesson.from}|${normalizeSlot(lesson.slot)}`);
                return old ? { ...lesson, trainer: old.trainer, venue: old.venue } : {
                    ...lesson, trainer: classItem.masterTrainer || undefined, venue: classItem.location || undefined,
                };
            });
            if (!generated.length) throw new Error("No study slots fall within the topic date range.");
            await persistDraft(generated, "Slot time saved");
            setPlan(generated); setSetupOpen(false); setDirty(false); setPublished(false); setActiveWeek(0);
        } catch (cause) {
            setError((cause as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
                || (cause as { message?: string })?.message || "Could not save the slot time.");
        } finally { setSaving(null); }
    };

    const handleSaveDraft = async () => {
        if (!hasPlan || !canManage || saving) return;
        setError(""); setSaving("draft");
        try { await persistDraft(plan, "Schedule draft saved"); setDirty(false); }
        catch (cause) {
            setError((cause as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
                || (cause as { message?: string })?.message || "Could not save the schedule draft.");
        } finally { setSaving(null); }
    };

    const publish = async () => {
        if (!canPublish) return;
        setError(""); setSaving("publish");
        let completed = 0;
        try {
            if (dirty) await persistDraft(plan, "Schedule draft saved before publish");
            const existing = await externalApi.getClassSessions(classItem.id);
            const operations = plan.flatMap((lesson) => {
                const session = existing.find((item) => item.date === lesson.from
                    && normalizeSlot(item.slot) === normalizeSlot(lesson.slot)
                    && sessionMatchesTopic(item, topic));
                const sameAssignment = session && normalized(session.status) !== "cancelled"
                    && normalized(session.trainer) === normalized(lesson.trainer)
                    && normalized(session.room) === normalized(lesson.venue);
                return sameAssignment ? [] : [{ lesson, session }];
            });
            setProgress({ done: 0, total: operations.length });
            for (const { lesson, session } of operations) {
                const payload: Partial<ClassSession> = {
                    classId: classItem.id,
                    date: lesson.from,
                    slot: lesson.slot,
                    topic: lesson.name || topic.name || topic.label,
                    topicCode: topic.label,
                    topicVersion: topic.version,
                    trainer: lesson.trainer,
                    room: lesson.venue,
                };
                if (session && normalized(session.status) === "cancelled") {
                    throw new Error(`The existing session on ${formatDate(lesson.from)} is cancelled. Resolve it before publishing this slot.`);
                }
                if (session) {
                    await externalApi.updateClassSession(classItem.id, session.id, payload);
                } else {
                    await externalApi.createClassSession(classItem.id, { ...payload, status: "upcoming" });
                }
                completed += 1;
                setProgress({ done: completed, total: operations.length });
            }
            await onSessionsReload();
            setPublished(true); setDirty(false);
            if (completed === 0) setError("All sessions in this schedule already exist with the saved room and trainer assignments.");
        } catch (cause) {
            await onSessionsReload();
            const detail = (cause as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
                || (cause as { message?: string })?.message;
            setError(completed
                ? `${completed} schedule changes were accepted before the API returned an error. Publish again to continue; matching sessions are skipped.`
                : `Could not publish the schedule${detail ? `: ${detail}` : ". Try again."}`);
        } finally { setSaving(null); }
    };

    const assign = (id: string, field: "trainer" | "venue", value: string) => {
        setPlan((current) => current.map((lesson) => lesson.id === id ? { ...lesson, [field]: value || undefined } : lesson));
        setDirty(true);
    };

    const applyAllWeeks = () => {
        if (!currentWeek) return;
        const source = plan.filter((lesson) => dateInWeek(lesson.from, currentWeek));
        const sourceAssignments = new Map(source.map((lesson) => {
            const date = parseDate(lesson.from)!;
            return [`${date.getUTCDay()}|${periodOf(lesson.slot)}`, { trainer: lesson.trainer, venue: lesson.venue }];
        }));
        setPlan((current) => current.map((lesson) => {
            if (dateInWeek(lesson.from, currentWeek)) return lesson;
            const date = parseDate(lesson.from);
            const assignment = date && sourceAssignments.get(`${date.getUTCDay()}|${periodOf(lesson.slot)}`);
            return assignment ? { ...lesson, ...assignment } : lesson;
        }));
        setDirty(true);
        setSelectedWeekAssignment("Applied assignments from the selected week to matching weekdays in all weeks.");
    };

    const weekTitle = currentWeek && plan.length ? `Week ${activeWeek + 1} · ${formatDate(isoDate(currentWeek), { day: "numeric", month: "short" })} – ${formatDate(isoDate(new Date(currentWeek.getTime() + 6 * 86400000)), { day: "numeric", month: "short", year: "numeric" })}` : "Weekly schedule";
    const weekLessons = currentWeek ? plan.filter((lesson) => dateInWeek(lesson.from, currentWeek)) : [];
    const weekAssigned = weekLessons.filter((lesson) => lesson.trainer && lesson.venue).length;

    const updateSetting = (period: Period, side: keyof TimeRange, value: string) => setConfig((current) => ({
        ...current, times: { ...current.times, [period]: { ...current.times[period], [side]: value } },
    }));

    const scheduleSetup = <section className="space-y-4 rounded-2xl border-2 border-blue-500 p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-semibold">Set slot time</h4>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">Before holiday exclusions</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Actual Learning Start Date <span className="text-red-600">*</span>
                <Input type="date" value={learningStart} min={classItem.startDate || calendar.classStartDate} max={classItem.endDate || calendar.classEndDate}
                    onChange={(event) => setLearningStart(event.target.value)} aria-label="Actual Learning Start Date" />
            </label>
            <div className="flex items-end gap-2 sm:col-span-2">
                <button type="button" aria-pressed={config.periods.length === 2} onClick={() => setConfig((current) => ({ ...current, periods: ["morning", "afternoon"] }))}
                    className={`flex-1 rounded-lg border p-3 text-left ${config.periods.length === 2 ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40" : "hover:bg-muted/50"}`}>
                    <strong className="block text-sm">{config.periods.length === 2 ? "●" : "○"} Full time</strong><span className="text-xs text-muted-foreground">Morning + Afternoon</span>
                </button>
                <button type="button" aria-pressed={config.periods.length === 1} onClick={() => setConfig((current) => ({ ...current, periods: [current.periods.length === 1 ? current.periods[0] : "morning"] }))}
                    className={`flex-1 rounded-lg border p-3 text-left ${config.periods.length === 1 ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40" : "hover:bg-muted/50"}`}>
                    <strong className="block text-sm">{config.periods.length === 1 ? "●" : "○"} Part time</strong><span className="text-xs text-muted-foreground">One session per study day</span>
                </button>
            </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
            <fieldset className="space-y-2"><legend className="text-xs font-medium text-muted-foreground">Study days</legend>
                <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((day) => <button key={day.value} type="button" aria-pressed={config.weekdays.includes(day.value)}
                    onClick={() => changeWeekday(day.value, !config.weekdays.includes(day.value))}
                    className={`min-w-12 rounded-lg border px-3 py-2 text-xs font-medium ${config.weekdays.includes(day.value) ? "border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200" : "text-muted-foreground hover:bg-muted"}`}>{day.short}</button>)}</div>
            </fieldset>
            <fieldset className="space-y-2"><legend className="text-xs font-medium text-muted-foreground">Sessions</legend>
                <div className="flex flex-wrap gap-2">{(["morning", "afternoon"] as const).map((period) => <button key={period} type="button" aria-pressed={config.periods.includes(period)}
                    onClick={() => changePeriod(period, !config.periods.includes(period))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${config.periods.includes(period) ? "border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200" : "text-muted-foreground hover:bg-muted"}`}>
                    {config.periods.includes(period) && <Check className="size-3.5" />}{period === "morning" ? `AM ${config.times.morning.start}–${config.times.morning.end}` : `PM ${config.times.afternoon.start}–${config.times.afternoon.end}`}</button>)}</div>
                <details><summary className="inline-flex cursor-pointer items-center gap-1.5 pt-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> Edit session times</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">{(["morning", "afternoon"] as const).map((period) => <div key={period} className="grid grid-cols-2 gap-2">
                        <label className="space-y-1 text-xs text-muted-foreground">{period === "morning" ? "Morning from" : "Afternoon from"}<Input type="time" value={config.times[period].start} onChange={(event) => updateSetting(period, "start", event.target.value)} /></label>
                        <label className="space-y-1 text-xs text-muted-foreground">{period === "morning" ? "Morning to" : "Afternoon to"}<Input type="time" value={config.times[period].end} onChange={(event) => updateSetting(period, "end", event.target.value)} /></label>
                    </div>)}</div>
                </details>
            </fieldset>
        </div>
        <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Weekly preview</p>
            <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 text-center text-[11px] sm:gap-1.5">
                <span />{WEEKDAYS.map((day) => <span key={day.value} className="text-muted-foreground">{day.short}</span>)}
                {(["morning", "afternoon"] as const).map((period) => <div key={period} className="contents"><span className="flex items-center pr-1 text-left font-medium">{period === "morning" ? "AM" : "PM"} {config.times[period].start}–{config.times[period].end}</span>
                    {WEEKDAYS.map((day) => <span key={day.value} className={`h-8 rounded-md ${config.weekdays.includes(day.value) && config.periods.includes(period) ? "bg-blue-700" : "border border-dashed bg-muted/20"}`} />)}</div>)}
            </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-muted-foreground"><strong className="text-foreground">{config.weekdays.length * config.periods.length} slots / week</strong>
                {validRange && scheduleStart && topicEnd ? <> · {daysCount} study days · {totalSlots} slots before holiday exclusions · {formatDate(isoDate(scheduleStart))}–{formatDate(isoDate(topicEnd))}</> : <> · Enter a valid actual learning start date within the class/topic range</>}</p>
            <Button type="button" disabled={!canSaveSlotTime} onClick={() => void handleSaveSlotTime()} className="ml-auto bg-blue-700 hover:bg-blue-800">
                {saving === "slot" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving === "slot" ? "Saving…" : "Save slot time"}
            </Button>
        </div>
        <p className="text-xs text-muted-foreground">Holiday dates are not excluded because the upstream system has no holiday API. This schedule is saved as a new draft version. The actual learning start date is required by the calendar API.</p>
    </section>;

    return <div className="space-y-3">
        {hasPlan && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-3 dark:border-blue-950 dark:bg-blue-950/20">
            <p className="text-sm"><strong>Slot time:</strong> {config.periods.length === 2 ? "Full time" : "Part time"} · {config.weekdays.map((day) => WEEKDAYS.find((item) => item.value === day)?.short).join(", ")} · {config.periods.map((period) => `${period === "morning" ? "AM" : "PM"} ${config.times[period].start}–${config.times[period].end}`).join(" + ")} <span className="ml-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{isPublished ? "Sessions created" : "Saved"}</span></p>
            <Button type="button" variant="outline" size="sm" disabled={!!saving || isPublished} onClick={() => setSetupOpen((open) => !open)}><Settings2 className="size-4" />{setupOpen ? "Close editor" : "Edit"}</Button>
        </div>}
        {(!hasPlan || setupOpen) && scheduleSetup}

        {hasPlan && <section className="space-y-4 rounded-2xl border border-blue-100 p-3 sm:p-5 dark:border-blue-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h4 className="font-semibold">{weekTitle}</h4><p className="text-xs text-muted-foreground">Starts {formatDate(learningStart)} · {weekAssigned} of {weekLessons.length} slots assigned · {conflictCount} conflict{conflictCount === 1 ? "" : "s"}</p></div>
                <div className="flex max-w-full flex-wrap gap-1.5">{weeks.map((week, index) => <Button key={week.toISOString()} type="button" size="sm" variant={activeWeek === index ? "default" : "outline"} className="h-8 px-2.5" onClick={() => setActiveWeek(index)}>W{index + 1}</Button>)}</div>
            </div>
            <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 text-[10px] sm:gap-1.5 sm:text-xs">
                <span />{WEEKDAYS.map((day) => {
                    const cellDate = currentWeek ? new Date(currentWeek) : new Date();
                    const offset = (day.value + 6) % 7;
                    cellDate.setUTCDate(cellDate.getUTCDate() + offset);
                    return <span key={day.value} className="text-center text-muted-foreground">{day.short}<br />{formatDate(isoDate(cellDate), { day: "2-digit" })}</span>;
                })}
                {(["morning", "afternoon"] as const).map((period) => <div key={period} className="contents">
                    <span className="flex items-center pr-1 font-medium">{period === "morning" ? "AM" : "PM"}<br />{config.times[period].start}–{config.times[period].end}</span>
                    {WEEKDAYS.map((day) => {
                        const date = currentWeek ? new Date(currentWeek) : new Date();
                        date.setUTCDate(date.getUTCDate() + ((day.value + 6) % 7));
                        const dateKey = isoDate(date);
                        const item = weekLessons.find((lesson) => lesson.from === dateKey && periodOf(lesson.slot) === period);
                        if (!item) return <div key={day.value} className="min-h-16 rounded-lg border border-dashed bg-muted/10 sm:min-h-[72px]" />;
                        const conflict = conflictById.get(item.id);
                        const canAssign = !isPublished && canManage && !saving;
                        return <div key={day.value} className={`min-w-0 rounded-lg border p-1.5 sm:p-2 ${conflict ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200" : item.venue && item.trainer ? "border-blue-600 bg-blue-700 text-white" : "border-dashed border-blue-400 bg-blue-50/60 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200"}`}>
                            <p className="truncate font-semibold" title={item.name}>{item.name}</p>
                            {conflict ? <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold"><AlertTriangle className="size-3 shrink-0" />{conflict}</p> : null}
                            <p className="mt-1 truncate text-[10px]" title={`Room: ${item.venue || "Needs assignment"}`}>{item.venue || "Needs room"}</p>
                            <p className="truncate text-[10px]" title={`Teacher: ${item.trainer || "Needs assignment"}`}>{item.trainer || "Needs teacher"}</p>
                            {canAssign && <button type="button" className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold underline" onClick={() => setAssigningLesson(assigningLesson === item.id ? null : item.id)}>
                                {item.venue && item.trainer ? "Assign again" : "+ Assign"}<ChevronDown className="size-3" />
                            </button>}
                            {canAssign && assigningLesson === item.id && <div className="mt-2 space-y-1.5">
                                <select aria-label={`Room for ${item.name} on ${item.from}`} className="h-8 w-full rounded border bg-background px-1 text-[10px] text-foreground" value={item.venue ?? ""} onChange={(event) => assign(item.id, "venue", event.target.value)}>
                                    <option value="">Assign room</option>{item.venue && !roomsQuery.data?.some((room) => room.name === item.venue) && <option value={item.venue}>{item.venue}</option>}{(roomsQuery.data ?? []).map((room) => <option key={room.id} value={room.name ?? ""}>{room.name}</option>)}
                                </select>
                                <select aria-label={`Trainer for ${item.name} on ${item.from}`} className="h-8 w-full rounded border bg-background px-1 text-[10px] text-foreground" value={item.trainer ?? ""} onChange={(event) => assign(item.id, "trainer", event.target.value)}>
                                    <option value="">Assign teacher</option>{item.trainer && !trainersQuery.data?.some((trainer) => trainer.name === item.trainer) && <option value={item.trainer}>{item.trainer}</option>}{(trainersQuery.data ?? []).map((trainer) => <option key={trainer.id} value={trainer.name ?? ""}>{trainer.name}</option>)}
                                </select>
                            </div>}
                        </div>;
                    })}
                </div>)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground"><span><i className="mr-1 inline-block size-2 bg-blue-700" />Assigned</span><span><i className="mr-1 inline-block size-2 border border-blue-500" />Needs room / teacher</span><span><i className="mr-1 inline-block size-2 bg-red-500" />Conflict</span></div>
                <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={!canManage || isPublished || !!saving || !weeks.length} onClick={applyAllWeeks}>Apply to all weeks</Button>
                    <Button type="button" size="sm" variant="outline" disabled={!canManage || !hasPlan || !!saving || sessionsLoading} onClick={() => void handleSaveDraft()}>{saving === "draft" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving === "draft" ? "Saving…" : "Save draft"}</Button>
                    <Button type="button" size="sm" disabled={!canPublish} onClick={() => void publish()}>{saving === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{saving === "publish" ? `Publishing ${progress.done}/${progress.total}…` : "Publish schedule"}</Button>
                </div>
            </div>
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
            {selectedWeekAssignment && <p role="status" className="text-xs text-emerald-800 dark:text-emerald-200">{selectedWeekAssignment}</p>}
            {(roomsQuery.isError || trainersQuery.isError) && <p role="alert" className="text-sm text-red-700 dark:text-red-300">Không tải được danh sách phòng/giảng viên. Cần API lookup khả dụng để gán và publish lịch.</p>}
            {sessionsError && <p role="alert" className="text-sm text-amber-800 dark:text-amber-200">Không tải được sessions hiện có; không thể xác minh xung đột hoặc publish an toàn.</p>}
            <p className="text-xs text-muted-foreground">Xung đột được kiểm tra với sessions trong lớp này. Upstream chưa có API ngày nghỉ hoặc khả dụng phòng/giảng viên xuyên lớp. Publish tạo từng session qua API; nếu lưu dở, bấm lại sẽ bỏ qua các buổi đã nhận.</p>
        </section>}
    </div>;
}
