import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, GripHorizontal, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { externalApi } from "@/api/features/external.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { classTitle } from "@/utils/class.utils";
import type { ExternalClass } from "@/types";
import type { CalendarTopic, ClassCalendarVersion } from "@/types/features/external";

function startingTopics(calendar: ClassCalendarVersion): CalendarTopic[] {
    if (calendar.overviewItems?.length) return structuredClone(calendar.overviewItems).map(topic => ({ ...topic, lessons: topic.lessons ?? [] }));
    return (calendar.sessions ?? []).map(session => ({
        id: `session-${session.id}`, label: session.topicCode || session.topic || `Session ${session.id}`,
        version: session.topicVersion, startDate: session.date, endDate: session.date, slot: session.slot,
        lessons: [{ id: `lesson-${session.id}`, name: session.topic || "Session", from: session.date, to: session.date,
            slot: session.slot, trainer: session.trainer, venue: session.room, notes: session.notes }],
    }));
}

function validDate(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function shortDate(value: string) {
    return validDate(value) ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(" ", "-") : "—";
}

export function CalendarAdjustView({ calendar, classItem, onBack }: {
    calendar: ClassCalendarVersion; classItem: ExternalClass; onBack: () => void;
}) {
    const [topics, setTopics] = useState(() => startingTopics(calendar));
    const [classStart, setClassStart] = useState(calendar.classStartDate || classItem.startDate || "");
    const [learningStart, setLearningStart] = useState(calendar.actualLearningStartDate || "");
    const [expanded, setExpanded] = useState<string[]>([]);
    const [dragged, setDragged] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newCode, setNewCode] = useState("");
    const [newFrom, setNewFrom] = useState(learningStart);
    const [newTo, setNewTo] = useState(learningStart);
    const [error, setError] = useState("");
    const client = useQueryClient();
    const save = useMutation({
        mutationFn: () => externalApi.createCalendarVersion(classItem.id, calendar.id, {
            classStartDate: classStart, actualLearningStartDate: learningStart, overviewItems: topics,
        }),
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["class-calendars", classItem.id] });
            toast.success("A new draft calendar version was created.");
            onBack();
        },
        onError: () => setError("Could not save the new calendar version. Your adjustments are kept; please try again."),
    });
    const patch = (id: string, update: Partial<CalendarTopic>) => setTopics(current => current.map(topic => topic.id === id ? { ...topic, ...update } : topic));
    const move = (id: string, target: number) => setTopics(current => {
        const from = current.findIndex(topic => topic.id === id);
        if (from < 0 || target < 0 || target >= current.length) return current;
        const next = [...current]; next.splice(target, 0, next.splice(from, 1)[0]); return next;
    });
    const submit = () => {
        setError("");
        if (!validDate(classStart) || !validDate(learningStart) || learningStart < classStart) {
            setError("Actual Learning Start Date must be on or after Class Start Date."); return;
        }
        if (!topics.length) { setError("Add at least one topic or activity."); return; }
        for (const topic of topics) {
            if (!topic.label.trim() || !validDate(topic.startDate) || !validDate(topic.endDate) || topic.startDate < learningStart || topic.endDate < topic.startDate) {
                setError(`Check the name and date range for ${topic.label || "this topic"}. Topics must start on or after Actual Learning Start Date.`); return;
            }
            if (topic.lessons?.some(lesson => !lesson.name.trim() || !validDate(lesson.from) || !validDate(lesson.to) || lesson.from < topic.startDate || lesson.to > topic.endDate || lesson.to < lesson.from)) {
                setError(`Lesson dates must be within the date range for ${topic.label}.`); return;
            }
        }
        save.mutate();
    };
    return (
        <section aria-label="Adjust calendar" className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <header className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Adjust calendar : {classTitle(classItem)}</h2></header>
            <fieldset disabled={save.isPending} className="max-h-[62dvh] space-y-5 overflow-y-auto p-4 sm:p-5">
                <div className="flex flex-wrap items-end gap-4">
                    <label className="min-w-52 flex-1 space-y-2 text-sm font-medium">Class Start Date<span className="text-red-600"> *</span><Input aria-label="Class Start Date" type="date" required value={classStart} onChange={event => setClassStart(event.target.value)} /></label>
                    <label className="min-w-52 flex-1 space-y-2 text-sm font-medium">Actual Learning Start Date<span className="text-red-600"> *</span><Input aria-label="Actual Learning Start Date" type="date" required min={classStart} value={learningStart} onChange={event => setLearningStart(event.target.value)} /></label>
                    <Button className="ml-auto bg-blue-800 hover:bg-blue-900" onClick={() => { setNewFrom(learningStart); setNewTo(learningStart); setAdding(true); }}><Plus className="size-4" /> Add New Topic & Activities</Button>
                </div>
                <div className="space-y-2">
                    {topics.map((topic, index) => <div key={topic.id} className="overflow-hidden rounded-lg border shadow-sm" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged) move(dragged, index); setDragged(null); }}>
                        <div className="flex items-center gap-2 bg-muted/40 px-3 py-3 sm:gap-3 sm:px-4">
                            <button type="button" draggable onDragStart={event => { event.dataTransfer.setData("text/plain", topic.id); setDragged(topic.id); }} onDragEnd={() => setDragged(null)} className="cursor-grab touch-none p-1 text-muted-foreground" aria-label={`Reorder ${topic.label}`}><GripHorizontal className="size-5" /></button>
                            <button type="button" className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 text-left" aria-expanded={expanded.includes(topic.id)} aria-controls={`adjust-topic-${topic.id}`} onClick={() => setExpanded(current => current.includes(topic.id) ? current.filter(id => id !== topic.id) : [...current, topic.id])}>
                                <span className="break-words text-sm font-semibold">{topic.label} {topic.name}{topic.version ? ` (${topic.version})` : ""}</span>
                                <span className="ml-auto shrink-0 text-sm">{shortDate(topic.startDate)} - {shortDate(topic.endDate)}</span>
                                <ChevronDown className={`size-4 transition-transform ${expanded.includes(topic.id) ? "rotate-180" : ""}`} />
                            </button>
                            <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" aria-label={`Delete ${topic.label}`} onClick={() => setTopics(current => current.filter(item => item.id !== topic.id))}><Trash2 className="size-4" /></Button>
                        </div>
                        {expanded.includes(topic.id) && <div id={`adjust-topic-${topic.id}`} className="space-y-4 border-t p-4">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <label className="space-y-1 text-xs">Topic Code<Input value={topic.label} maxLength={100} onChange={event => patch(topic.id, { label: event.target.value })} /></label>
                                <label className="space-y-1 text-xs">Topic Name<Input value={topic.name ?? ""} maxLength={255} onChange={event => patch(topic.id, { name: event.target.value })} /></label>
                                <label className="space-y-1 text-xs">Topic Version<Input value={topic.version ?? ""} maxLength={30} onChange={event => patch(topic.id, { version: event.target.value })} /></label>
                                <label className="space-y-1 text-xs">From<Input type="date" min={learningStart} value={topic.startDate} onChange={event => patch(topic.id, { startDate: event.target.value })} /></label>
                                <label className="space-y-1 text-xs">To<Input type="date" min={topic.startDate} value={topic.endDate} onChange={event => patch(topic.id, { endDate: event.target.value })} /></label>
                            </div>
                            <label className="block space-y-1 text-xs">Slot time<Input value={topic.slot ?? ""} onChange={event => patch(topic.id, { slot: event.target.value })} /></label>
                            {topic.lessons?.map((lesson, lessonIndex) => <div key={lesson.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
                                <label className="space-y-1 text-xs">Day {lessonIndex + 1} / Name<Input value={lesson.name} onChange={event => patch(topic.id, { lessons: topic.lessons?.map(item => item.id === lesson.id ? { ...item, name: event.target.value } : item) })} /></label>
                                <label className="space-y-1 text-xs">Lesson From<Input type="date" min={topic.startDate} max={topic.endDate} value={lesson.from} onChange={event => patch(topic.id, { lessons: topic.lessons?.map(item => item.id === lesson.id ? { ...item, from: event.target.value } : item) })} /></label>
                                <label className="space-y-1 text-xs">Lesson To<Input type="date" min={lesson.from} max={topic.endDate} value={lesson.to} onChange={event => patch(topic.id, { lessons: topic.lessons?.map(item => item.id === lesson.id ? { ...item, to: event.target.value } : item) })} /></label>
                            </div>)}
                            <div className="flex gap-2"><Button size="sm" variant="outline" disabled={index === 0} onClick={() => move(topic.id, index - 1)}><ArrowUp className="size-4" /> Move up</Button><Button size="sm" variant="outline" disabled={index === topics.length - 1} onClick={() => move(topic.id, index + 1)}><ArrowDown className="size-4" /> Move down</Button></div>
                        </div>}
                    </div>)}
                    {!topics.length && <p className="py-8 text-center text-sm text-muted-foreground">No topics. Add a topic or activity to build this calendar.</p>}
                </div>
            </fieldset>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
                {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
                <Button variant="outline" disabled={save.isPending} onClick={onBack}>Back to Calendar List</Button>
                <Button disabled={save.isPending} className="ml-auto bg-blue-800 hover:bg-blue-900" onClick={submit}>{save.isPending && <Loader2 className="size-4 animate-spin" />} {save.isPending ? "Saving…" : "Save as New Version"}</Button>
            </footer>
            <Dialog open={adding} onOpenChange={setAdding}><DialogContent><DialogHeader><DialogTitle>Add New Topic & Activities</DialogTitle><DialogDescription>Add a topic or activity to this calendar version.</DialogDescription></DialogHeader>
                <form className="space-y-3" onSubmit={event => {
                    event.preventDefault();
                    if (!newCode.trim() || !newName.trim() || !validDate(newFrom) || !validDate(newTo) || newFrom < learningStart || newTo < newFrom) return;
                    const id = crypto.randomUUID();
                    setTopics(current => [...current, { id, label: newCode.trim(), name: newName.trim(), startDate: newFrom, endDate: newTo,
                        lessons: [{ id: `${id}-lesson`, name: newName.trim(), from: newFrom, to: newTo }] }]);
                    setAdding(false); setNewName(""); setNewCode("");
                }}>
                    <label className="block space-y-1 text-sm">Topic Code<Input required maxLength={100} value={newCode} onChange={event => setNewCode(event.target.value)} /></label>
                    <label className="block space-y-1 text-sm">Topic / Activity Name<Input required maxLength={255} value={newName} onChange={event => setNewName(event.target.value)} /></label>
                    <label className="block space-y-1 text-sm">From<Input type="date" required min={learningStart} value={newFrom} onChange={event => setNewFrom(event.target.value)} /></label>
                    <label className="block space-y-1 text-sm">To<Input type="date" required min={newFrom} value={newTo} onChange={event => setNewTo(event.target.value)} /></label>
                    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button><Button type="submit">Add</Button></div>
                </form>
            </DialogContent></Dialog>
        </section>
    );
}
