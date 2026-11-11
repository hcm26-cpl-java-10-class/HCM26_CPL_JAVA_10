import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CalendarDays, ChevronDown, Clock3, Code2, FileText, GraduationCap, MapPin, RefreshCw, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClassSessions } from "@/hooks/useExternalLookups";
import { usePermissions } from "@/hooks/usePermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { topicApi } from "@/api/features/topic.api";
import type { TopicItem } from "@/types/features/content";
import { classTitle } from "@/utils/class.utils";
import type { ExternalClass } from "@/types";
import type { CalendarLesson, CalendarTopic, ClassCalendarVersion } from "@/types/features/external";
import { CalendarScheduleBuilder } from "./CalendarScheduleBuilder";

type DetailedLesson = CalendarLesson & { type?: string; status?: string };

function displayDate(value?: string, long = false) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "—";
    return long ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
        : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).replace(/ /g, "-");
}

function displayDateTime(value?: string) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function normalized(value?: string) {
    return (value ?? "").replace(/^\[|\]$/g, "").trim().toLowerCase();
}

function LessonRow({ lesson, index }: { lesson: DetailedLesson; index: number }) {
    const [open, setOpen] = useState(false);
    const details: Array<[string, string | undefined, React.ReactNode]> = [
        ["Time", lesson.slot, <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />],
        ["Trainer", lesson.trainer, <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />],
        ["Venue", lesson.venue, <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />],
        ["Type", lesson.type, <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />],
        ["Status", lesson.status, <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />],
        ["Notes", lesson.notes, <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />],
        ["Training materials", lesson.materials, <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />],
    ];

    return <>
        <TableRow>
            <TableCell className="text-center">{index + 1}</TableCell>
            <TableCell className="whitespace-normal [overflow-wrap:anywhere] font-medium">{lesson.name || "Untitled lesson"}</TableCell>
            <TableCell>{displayDate(lesson.from)}</TableCell>
            <TableCell>{displayDate(lesson.to)}</TableCell>
            <TableCell className="text-center">
                <Button variant="ghost" size="icon" aria-label={`Show lesson details: ${lesson.name}`} aria-expanded={open} aria-controls={`calendar-lesson-${lesson.id}`} onClick={() => setOpen(!open)}>
                    <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </Button>
            </TableCell>
        </TableRow>
        {open && <TableRow id={`calendar-lesson-${lesson.id}`}>
            <TableCell colSpan={5} className="bg-muted/20 px-3 py-4 sm:px-5">
                <dl className="grid gap-x-6 gap-y-4 whitespace-normal text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {details.map(([label, value, icon]) => <div key={label} className="flex min-w-0 gap-2">
                        {icon}<div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value?.trim() || "Not provided"}</dd></div>
                    </div>)}
                </dl>
            </TableCell>
        </TableRow>}
    </>;
}

function DateCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return <div className="grid min-h-24 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-card p-3 sm:p-4 dark:border-blue-950 dark:from-blue-950/30 dark:to-card">
        <span className="flex size-11 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">{icon}</span>
        <div className="min-w-0"><p className="min-h-8 text-xs leading-4 text-muted-foreground">{label}</p><p className="break-words text-base font-semibold">{value}</p></div>
    </div>;
}

function MetadataCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "blue" | "violet" | "slate" }) {
    const tones = {
        blue: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
        violet: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200",
        slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    };
    return <div className="flex min-h-[76px] min-w-0 items-center gap-3 rounded-2xl bg-slate-50/90 p-3 sm:p-4 dark:bg-slate-900/50">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>{icon}</span>
        <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>
    </div>;
}

export function CalendarDetailView({ calendar, classItem, onBack, sourceVerified, sampleData, onCalendarSaved }: {
    calendar: ClassCalendarVersion;
    classItem: ExternalClass;
    onBack: () => void;
    sourceVerified: boolean;
    sampleData: boolean;
    onCalendarSaved: (calendar: ClassCalendarVersion) => void;
}) {
    const classSessionsQuery = useClassSessions(String(classItem.id));
    const { hasPermission } = usePermissions();
    const canManageSchedule = sourceVerified && !sampleData && hasPermission("SESSION_UPDATE");
    const [selectedTopicId, setSelectedTopicId] = useState("");
    const activeTopicsQuery = useQuery({
        queryKey: ["topics", "active", "calendar-selector"],
        queryFn: topicApi.getActive,
    });
    const groups = useMemo(() => {
        const result = new Map<string, CalendarTopic>();
        for (const topic of calendar.overviewItems ?? []) {
            // Older local calendar responses synthesized a class-range topic when no sessions existed.
            // It is a planning range, not a real topic, so keep it out of displayed counts/details.
            if ((topic.lessons ?? []).some((lesson) => lesson.id.startsWith("class-range-"))) continue;
            result.set(topic.id, { ...topic, lessons: [...(topic.lessons ?? [])] });
        }

        const seenSessionIds = new Set<number>();
        for (const session of [...(classSessionsQuery.data ?? []), ...(calendar.sessions ?? [])]) {
            if (seenSessionIds.has(session.id)) continue;
            seenSessionIds.add(session.id);
            const label = session.topicCode || session.topic || `Session ${session.id}`;
            const matching = [...result.entries()].find(([, topic]) =>
                [topic.label, topic.name].some((value) => normalized(value) === normalized(label)));
            const key = matching?.[0] ?? label;
            const existing = result.get(key);
            const lesson: DetailedLesson = {
                id: `session-${session.id}`, name: session.topic || label,
                from: session.date, to: session.date, slot: session.slot,
                trainer: session.trainer, venue: session.room, notes: session.notes,
                type: session.type, status: session.status,
            };
            const lessons = [...(existing?.lessons ?? [])];
            const duplicate = lessons.some((item) => {
                const sourceId = String(session.id);
                const lessonId = item.id.replace(/^(session|lesson)-/, "");
                const sameSource = lessonId === sourceId;
                const sameOccurrence = item.from === lesson.from && item.to === lesson.to
                    && normalized(item.name) === normalized(lesson.name)
                    && normalized(item.slot) === normalized(lesson.slot);
                return sameSource || sameOccurrence;
            });
            if (!duplicate) lessons.push(lesson);
            result.set(key, {
                id: existing?.id ?? key,
                label: existing?.label ?? label,
                name: existing?.name,
                version: existing?.version ?? session.topicVersion,
                slot: existing?.slot ?? session.slot,
                startDate: existing ? [existing.startDate, session.date].sort()[0] : session.date,
                endDate: existing ? [existing.endDate, session.date].sort().at(-1)! : session.date,
                lessons,
            });
        }
        return [...result.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.label.localeCompare(b.label));
    }, [calendar, classSessionsQuery.data]);

    const actualLessons = groups.flatMap((topic) => topic.lessons ?? []);
    const selectedCatalogTopic: TopicItem | undefined = activeTopicsQuery.data?.find((topic) => String(topic.id) === selectedTopicId);
    const classStartDate = calendar.classStartDate || classItem.startDate || "";
    const classEndDate = calendar.classEndDate || classItem.endDate || "";
    const selectedScheduleTopic: CalendarTopic | undefined = selectedCatalogTopic ? {
        id: String(selectedCatalogTopic.id),
        label: selectedCatalogTopic.code,
        name: selectedCatalogTopic.name,
        version: selectedCatalogTopic.version,
        startDate: classStartDate,
        endDate: classEndDate,
        lessons: [],
    } : undefined;
    const isLiveWithoutSessions = calendar.version === "Live" && !calendar.actualLearningStartDate && actualLessons.length === 0;
    const statusLabel = calendar.status === "active" ? "Active" : calendar.status === "draft" ? "Draft" : "Inactive";

    return (
        <section aria-label="Calendar Detail" className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
            {sampleData && <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Đang dùng chế độ dữ liệu mẫu. Không thể tạo buổi học upstream trong môi trường này.</div>}
            {!sampleData && !sourceVerified && <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Chưa xác minh được nguồn dữ liệu upstream; thao tác lưu lịch đang bị khóa.</div>}
            <header className="space-y-4 border-b border-blue-100 bg-gradient-to-r from-blue-50/50 via-background to-indigo-50/40 px-4 py-4 sm:px-6 sm:py-5 dark:border-blue-950 dark:from-blue-950/20 dark:via-background dark:to-indigo-950/20">
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3 pt-1 sm:gap-4">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 sm:size-14 dark:bg-blue-900/70 dark:text-blue-200"><CalendarDays className="size-6 sm:size-7" /></span>
                        <div className="min-w-0">
                            <h2 className="text-xl font-semibold leading-tight sm:text-2xl">Calendar Detail : {classTitle(classItem)}</h2>
                            <p className="mt-1.5 break-words text-sm text-slate-600 sm:text-base dark:text-slate-300">{calendar.name}</p>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 sm:gap-3">
                        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
                            <ArrowLeft className="size-4" /> Back to Calendar
                        </button>
                        <div className="flex flex-wrap justify-end gap-2">
                            <Badge variant="outline">{calendar.version === "Live" ? "Live calendar" : `Version ${calendar.version}`}</Badge>
                            <Badge variant="secondary" className={calendar.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" : calendar.status === "draft" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-muted text-muted-foreground"}>{statusLabel}</Badge>
                        </div>
                    </div>
                </div>
                <div className="grid gap-2 border-t border-blue-100 pt-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-blue-950">
                    <MetadataCard label="Change" value={calendar.historyChange || "Not provided"} icon={<RefreshCw className="size-5" />} tone="blue" />
                    <MetadataCard label="Last updated" value={displayDateTime(calendar.lastModifiedDate)} icon={<Clock3 className="size-5" />} tone="violet" />
                    <MetadataCard label="Updated by" value={calendar.lastModifiedBy || "Not provided"} icon={<UserRound className="size-5" />} tone="slate" />
                </div>
            </header>

            <div className="min-h-0 space-y-5 overflow-y-auto p-4 sm:space-y-6 sm:p-6">
                <section aria-label="Class dates" className="grid items-stretch gap-3 md:grid-cols-3 sm:gap-4">
                    <DateCard label="Class start" value={displayDate(calendar.classStartDate || classItem.startDate)} icon={<CalendarDays className="size-5" />} />
                    <DateCard label="Class end" value={displayDate(calendar.classEndDate || classItem.endDate)} icon={<CalendarDays className="size-5" />} />
                    <DateCard label="Actual learning start" value={displayDate(calendar.actualLearningStartDate)} icon={<Clock3 className="size-5" />} />
                </section>

                <section aria-labelledby="calendar-schedule-heading" className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="flex items-start gap-3"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"><CalendarDays className="size-5" /></span><div><h3 id="calendar-schedule-heading" className="text-lg font-semibold">Schedule</h3><p className="text-sm text-muted-foreground">Topics and lesson dates included in this calendar.</p></div></div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800"><BookOpen className="size-3.5" />{groups.length} {groups.length === 1 ? "topic" : "topics"}</span><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800"><GraduationCap className="size-3.5" />{actualLessons.length} {actualLessons.length === 1 ? "lesson" : "lessons"}</span></div>
                    </div>

                    {groups.length ? groups.map((topic) => {
                        const lessons = (topic.lessons ?? []).sort((a, b) => a.from.localeCompare(b.from));
                        const slots = [...new Set(lessons.map((lesson) => lesson.slot).filter((slot): slot is string => !!slot?.trim()))];
                        return <Collapsible key={topic.id} defaultOpen className="group/calendar-topic overflow-hidden rounded-xl border">
                            <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 px-3 py-3 text-left hover:from-blue-100/80 hover:to-indigo-100/60 sm:px-4 dark:from-blue-950/40 dark:to-indigo-950/30">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"><Code2 className="size-5" /></span>
                                <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{topic.label}{topic.name ? ` · ${topic.name}` : ""}</span>{topic.version && <span className="mt-0.5 block text-xs text-muted-foreground">Topic version {topic.version}</span>}</span>
                                <span className="hidden shrink-0 text-right text-sm text-muted-foreground md:block">{displayDate(topic.startDate, true)} – {displayDate(topic.endDate, true)}</span>
                                <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]/calendar-topic:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="space-y-3 p-3 sm:p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                        <p className="text-muted-foreground md:hidden">{displayDate(topic.startDate, true)} – {displayDate(topic.endDate, true)}</p>
                                        <p><span className="font-medium">Slot time:</span> {slots.length ? slots.join(", ") : topic.slot || "Not provided"}</p>
                                    </div>
                                    <CalendarScheduleBuilder
                                        calendar={calendar}
                                        topic={topic}
                                        classItem={classItem}
                                        sessions={classSessionsQuery.data ?? []}
                                        sessionsLoading={classSessionsQuery.isPending}
                                        sessionsError={classSessionsQuery.isError}
                                        canManage={canManageSchedule}
                                        onCalendarSaved={onCalendarSaved}
                                        onSessionsReload={async () => classSessionsQuery.refetch()}
                                    />
                                    {lessons.length ? <Table aria-label={`Lessons for ${topic.label}`} className="w-full max-w-full table-fixed text-xs sm:text-sm [&_td]:whitespace-normal [&_td]:[overflow-wrap:anywhere] [&_td]:px-1.5 [&_td]:py-2.5 [&_th]:whitespace-normal [&_th]:[overflow-wrap:anywhere] [&_th]:px-1.5">
                                        <colgroup><col className="w-[9%]" /><col className="w-[35%]" /><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[16%]" /></colgroup>
                                        <TableHeader className="bg-muted/50"><TableRow>
                                            <TableHead className="text-center">No.</TableHead><TableHead>Lesson</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-center">Details</TableHead>
                                        </TableRow></TableHeader>
                                        <TableBody>{lessons.map((lesson, index) => <LessonRow key={lesson.id} lesson={lesson as DetailedLesson} index={index} />)}</TableBody>
                                    </Table> : <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                                        {isLiveWithoutSessions ? "No active lessons are scheduled yet. The dates above show the class planning range." : "Lesson details are not available for this topic."}
                                    </div>}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>;
                    }) : <section className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4 sm:p-5 dark:border-blue-950 dark:bg-blue-950/10">
                        <div><h4 className="font-semibold">Choose a topic to schedule</h4><p className="text-sm text-muted-foreground">Danh sách lấy trực tiếp từ Topics &amp; Syllabus (chỉ topic đang active).</p></div>
                        {activeTopicsQuery.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading active topics…</p>
                            : activeTopicsQuery.isError ? <p role="alert" className="text-sm text-red-700">Không tải được topic từ API. Hãy thử tải lại; không có topic mẫu được tự thêm.</p>
                            : <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                                <SelectTrigger aria-label="Select topic for calendar" className="max-w-xl bg-background"><SelectValue placeholder="Select topic (code · name)" /></SelectTrigger>
                                <SelectContent>{(activeTopicsQuery.data ?? []).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.code} · {item.name} · v{item.version} ({item.durationHours}h)</SelectItem>)}</SelectContent>
                            </Select>}
                        {selectedScheduleTopic && <>
                            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3"><p><strong className="text-foreground">Topic:</strong> {selectedScheduleTopic.label} · {selectedScheduleTopic.name}</p><p><strong className="text-foreground">Class range:</strong> {displayDate(classStartDate, true)} – {displayDate(classEndDate, true)}</p><p><strong className="text-foreground">Topic duration:</strong> {selectedCatalogTopic?.durationHours} hours</p></div>
                            <CalendarScheduleBuilder
                                calendar={calendar}
                                topic={selectedScheduleTopic}
                                classItem={classItem}
                                sessions={classSessionsQuery.data ?? []}
                                sessionsLoading={classSessionsQuery.isPending}
                                sessionsError={classSessionsQuery.isError}
                                canManage={canManageSchedule}
                                onCalendarSaved={(updated) => { setSelectedTopicId(""); onCalendarSaved(updated); }}
                                onSessionsReload={async () => classSessionsQuery.refetch()}
                            />
                        </>}
                        {!activeTopicsQuery.isPending && !activeTopicsQuery.isError && !activeTopicsQuery.data?.length && <p className="text-sm text-muted-foreground">API hiện không có topic active để xếp lịch.</p>}
                    </section>}
                </section>
            </div>

        </section>
    );
}
