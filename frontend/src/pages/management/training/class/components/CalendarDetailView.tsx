import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { classTitle } from "@/utils/class.utils";
import type { ExternalClass } from "@/types";
import type { CalendarLesson, CalendarTopic, ClassCalendarVersion } from "@/types/features/external";

function displayDate(value: string, long = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "—";
    return long ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
        : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).replace(/ /g, "-");
}

function LessonRow({ lesson, index }: { lesson: CalendarLesson; index: number }) {
    const [open, setOpen] = useState(false);
    return <>
        <TableRow>
            <TableCell className="w-20 text-center">{index + 1}</TableCell>
            <TableCell className="min-w-64 whitespace-normal">{lesson.name}</TableCell>
            <TableCell>{displayDate(lesson.from)}</TableCell>
            <TableCell>{displayDate(lesson.to)}</TableCell>
            <TableCell className="text-center"><Button variant="ghost" size="icon" aria-label={`Show lesson details: ${lesson.name}`} aria-expanded={open} aria-controls={`calendar-lesson-${lesson.id}`} onClick={() => setOpen(!open)}><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></Button></TableCell>
        </TableRow>
        {open && <TableRow id={`calendar-lesson-${lesson.id}`}><TableCell colSpan={5} className="bg-muted/20 px-5 py-4">
            <dl className="grid gap-3 whitespace-normal text-sm sm:grid-cols-2">
                {[["Time", lesson.slot], ["Trainer", lesson.trainer], ["Venue", lesson.venue], ["Notes", lesson.notes], ["Training Materials", lesson.materials]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value || "—"}</dd></div>)}
            </dl>
        </TableCell></TableRow>}
    </>;
}

export function CalendarDetailView({ calendar, classItem, onBack }: {
    calendar: ClassCalendarVersion;
    classItem: ExternalClass;
    onBack: () => void;
}) {
    const groups = useMemo(() => {
        const result = new Map<string, CalendarTopic>();
        for (const topic of calendar.overviewItems ?? []) result.set(topic.id, { ...topic, lessons: [...(topic.lessons ?? [])] });
        const sessionsByTopic = new Map<string, CalendarLesson[]>();
        for (const session of calendar.sessions ?? []) {
            const label = session.topicCode || session.topic || `Session ${session.id}`;
            const key = [...result.entries()].find(([, topic]) => topic.label.replace(/^\[|\]$/g, "") === label)?.[0] ?? label;
            const existing = result.get(key);
            const lessons = sessionsByTopic.get(key) ?? [];
            lessons.push({ id: `session-${session.id}`, name: session.topic || key, from: session.date, to: session.date,
                slot: session.slot, trainer: session.trainer, venue: session.room, notes: session.notes });
            sessionsByTopic.set(key, lessons);
            result.set(key, {
                id: existing?.id ?? key, label: existing?.label ?? key, name: existing?.name,
                version: existing?.version ?? session.topicVersion, slot: existing?.slot ?? session.slot,
                startDate: existing ? [existing.startDate, session.date].sort()[0] : session.date,
                endDate: existing ? [existing.endDate, session.date].sort().at(-1)! : session.date,
                lessons,
            });
        }
        return calendar.overviewItems?.length ? [...result.values()] : [...result.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [calendar]);

    return (
        <section aria-label="Calendar Detail" className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
            <header className="space-y-2 border-b px-4 py-4 sm:px-5">
                <div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-800 hover:underline dark:text-blue-300"
                    >
                        <ArrowLeft className="size-4" /> Back to Calendar
                    </button>
                </div>
                <div>
                    <h2 className="text-lg font-semibold">Calendar Detail : {classTitle(classItem)}</h2>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{calendar.name}</p>
                </div>
            </header>
            <div className="max-h-[62dvh] min-h-48 space-y-3 overflow-y-auto p-3 sm:p-5">
                <div className="flex flex-wrap gap-x-12 gap-y-2 pb-2 text-sm">
                    <p><span className="font-medium">Class Start Date:</span> {displayDate(calendar.classStartDate || classItem.startDate || "")}</p>
                    <p><span className="font-medium">Class End Date:</span> {displayDate(calendar.classEndDate || classItem.endDate || "")}</p>
                    <p><span className="font-medium">Actual Learning Start Date:</span> {displayDate(calendar.actualLearningStartDate ?? "")}</p>
                </div>
                {groups.length ? groups.map((topic, index) => (
                    <Collapsible key={topic.id} defaultOpen={topic.label !== "[OC]" && index < 4} className="group/calendar-topic overflow-hidden rounded-lg border shadow-sm">
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 bg-muted/40 px-4 py-4 text-left hover:bg-muted/60 sm:px-5">
                            <span className="min-w-0 break-words text-sm font-semibold">{topic.label}{topic.name ? ` ${topic.name}` : ""}{topic.version ? ` (${topic.version})` : ""}</span>
                            <span className="ml-auto hidden shrink-0 text-sm sm:inline">{displayDate(topic.startDate, true)} - {displayDate(topic.endDate, true)}</span>
                            <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]/calendar-topic:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="space-y-4 p-4 sm:p-5">
                                <p className="text-sm"><span className="font-medium">Slot time:</span> {topic.slot || "Not available"}</p>
                                <p className="text-xs text-muted-foreground sm:hidden">{displayDate(topic.startDate, true)} - {displayDate(topic.endDate, true)}</p>
                                <Table aria-label={`Lessons for ${topic.label}`} className="min-w-[700px] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
                                    <TableHeader className="bg-muted/50"><TableRow>
                                        <TableHead className="text-center">Day No</TableHead><TableHead>Name</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-center">Action</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>{topic.lessons?.length ? [...topic.lessons].sort((a, b) => a.from.localeCompare(b.from)).map((lesson, lessonIndex) => <LessonRow key={lesson.id} lesson={lesson} index={lessonIndex} />)
                                        : <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Lesson details are not available for this topic.</TableCell></TableRow>}</TableBody>
                                </Table>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )) : <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><CalendarDays className="size-8" /><p className="text-sm">No topic or lesson details available for this calendar version.</p></div>}
            </div>
            <footer className="border-t bg-card px-4 py-3 sm:px-5"><Button variant="outline" onClick={onBack}>Back to Calendar List</Button></footer>
        </section>
    );
}
