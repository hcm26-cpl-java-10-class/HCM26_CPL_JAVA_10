import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import type { DemoScheduleVersion } from "./training-calendar-demo.types";

// Dữ liệu riêng cho bản xem thử giao diện; không gọi API hoặc sửa dữ liệu thật.
type Activity = {
  id: string;
  name: string;
  pic: string;
  contribution: string;
  format: string;
  start: string;
  end: string;
};
type TrainingDay = { id: string; name: string; date: string; activities: Activity[] };
type TrainingTopic = {
  id: string;
  code: string;
  name: string;
  trainer: string;
  mentor: string;
  prerequisite: string;
  slot: string;
  days: TrainingDay[];
};
type Props = {
  version: DemoScheduleVersion;
  onBack: () => void;
};
type Removal = { kind: "topic" | "day" | "activity"; topicId: string; dayId?: string; activityId?: string };

const SLOTS = [
  { id: "1", name: "Slot 1 · 07:00–09:15", start: "07:00", end: "09:15" },
  { id: "2", name: "Slot 2 · 09:30–11:45", start: "09:30", end: "11:45" },
  { id: "3", name: "Slot 3 · 12:30–14:45", start: "12:30", end: "14:45" },
  { id: "4", name: "Slot 4 · 15:00–17:15", start: "15:00", end: "17:15" },
];
const TOPIC_PRESETS = [
  { code: "JAVA_CORE", name: "Java Core & OOP Fundamentals" },
  { code: "SPRING_BOOT", name: "Spring Boot Backend Development" },
  { code: "FINAL_PROJECT", name: "Final Project" },
];
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const cellClass = "px-3 py-2 text-left align-top";
const uid = () => crypto.randomUUID();

function newActivity(start = "07:00", end = "09:15"): Activity {
  return { id: uid(), name: "New activity", pic: "Demo trainer", contribution: "Lecture", format: "Offline", start, end };
}
function makeDemoTopics(): TrainingTopic[] {
  return [
    {
      id: "demo-java", code: "JAVA_CORE", name: "Java Core & OOP Fundamentals", trainer: "Demo trainer", mentor: "", prerequisite: "", slot: "1",
      days: [
        { id: "demo-day-1", name: "Java introduction", date: "2026-10-19", activities: [{ ...newActivity(), name: "Java syntax and development tools" }] },
        { id: "demo-day-2", name: "Object-oriented programming", date: "2026-10-20", activities: [{ ...newActivity(), name: "Classes, objects and encapsulation", contribution: "Practice" }] },
      ],
    },
    {
      id: "demo-spring", code: "SPRING_BOOT", name: "Spring Boot Backend Development", trainer: "Demo trainer", mentor: "", prerequisite: "demo-java", slot: "2",
      days: [{ id: "demo-day-3", name: "Build a REST API", date: "2026-10-22", activities: [{ ...newActivity("09:30", "11:45"), name: "REST controllers and request validation" }] }],
    },
  ];
}
function duration(start: string, end: string) {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const result = minutes(end) - minutes(start);
  return result > 0 ? result : null;
}
function dayName(date: string) {
  const parsed = new Date(`${date}T12:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-GB", { weekday: "long", timeZone: "Asia/Ho_Chi_Minh" });
}

export default function TrainingCalendarAdjustDemo({ version, onBack }: Props) {
  const [topics, setTopics] = useState<TrainingTopic[]>(makeDemoTopics);
  const [classStart, setClassStart] = useState("2026-10-19");
  const [learningStart, setLearningStart] = useState("2026-10-19");
  const [collapsedTopics, setCollapsedTopics] = useState<string[]>([]);
  const [collapsedDays, setCollapsedDays] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicPreset, setTopicPreset] = useState("CUSTOM");
  const [topicCode, setTopicCode] = useState("");
  const [topicName, setTopicName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [savedPreview, setSavedPreview] = useState<{ topics: TrainingTopic[]; note: string; classStart: string; learningStart: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dayCount = topics.reduce((sum, topic) => sum + topic.days.length, 0);
  const activityCount = topics.reduce((sum, topic) => sum + topic.days.reduce((n, day) => n + day.activities.length, 0), 0);

  function changeTopics(update: (previous: TrainingTopic[]) => TrainingTopic[]) {
    setTopics(update);
    setDirty(true);
    setError(null);
  }
  function changeTopic(id: string, update: Partial<TrainingTopic>) {
    changeTopics((previous) => previous.map((topic) => topic.id === id ? { ...topic, ...update } : topic));
  }
  function changeDay(topicId: string, dayId: string, update: Partial<TrainingDay>) {
    changeTopics((previous) => previous.map((topic) => topic.id !== topicId ? topic : {
      ...topic, days: topic.days.map((day) => day.id === dayId ? { ...day, ...update } : day),
    }));
  }
  function changeActivity(topicId: string, dayId: string, activityId: string, update: Partial<Activity>) {
    changeTopics((previous) => previous.map((topic) => topic.id !== topicId ? topic : {
      ...topic, days: topic.days.map((day) => day.id !== dayId ? day : {
        ...day, activities: day.activities.map((activity) => activity.id === activityId ? { ...activity, ...update } : activity),
      }),
    }));
  }
  function addDay(topic: TrainingTopic) {
    const slot = SLOTS.find((item) => item.id === topic.slot) ?? SLOTS[0];
    changeTopic(topic.id, { days: [...topic.days, {
      id: uid(), name: `Training day ${topic.days.length + 1}`, date: learningStart,
      activities: [{ ...newActivity(slot.start, slot.end), pic: topic.trainer }],
    }] });
  }
  function addTopic() {
    if (!topicCode.trim() || !topicName.trim()) return;
    changeTopics((previous) => [...previous, {
      id: uid(), code: topicCode.trim(), name: topicName.trim(), trainer: "", mentor: "", prerequisite: "", slot: "1", days: [],
    }]);
    setTopicOpen(false);
  }
  function removeSelected() {
    if (!removal) return;
    const target = removal;
    changeTopics((previous) => {
      if (target.kind === "topic") return previous
        .filter((topic) => topic.id !== target.topicId)
        .map((topic) => topic.prerequisite === target.topicId ? { ...topic, prerequisite: "" } : topic);
      return previous.map((topic) => topic.id !== target.topicId ? topic : {
        ...topic, days: target.kind === "day"
          ? topic.days.filter((day) => day.id !== target.dayId)
          : topic.days.map((day) => day.id !== target.dayId ? day : {
            ...day, activities: day.activities.filter((activity) => activity.id !== target.activityId),
          }),
      });
    });
    setRemoval(null);
  }
  function validatePreview() {
    if (!classStart || !learningStart) return "Enter both start dates.";
    if (learningStart < classStart) return "Actual learning start must not be before class start.";
    if (!topics.length) return "Add at least one topic.";
    for (const topic of topics) {
      if (!topic.code.trim() || !topic.name.trim()) return "Each topic needs a code and name.";
      if (!topic.days.length) return `Add a training day to ${topic.code}.`;
      for (const day of topic.days) {
        if (!day.name.trim() || !day.date) return `Complete the day name and date in ${topic.code}.`;
        if (day.date < learningStart) return `${topic.code}: a training day is before actual learning start.`;
        if (!day.activities.length) return `${topic.code}: each training day needs an activity.`;
        for (const activity of day.activities) {
          if (!activity.name.trim() || !activity.pic.trim()) return `${topic.code}: complete activity name and PIC.`;
          if (duration(activity.start, activity.end) === null) return `${topic.code}: end time must be later than start time.`;
        }
      }
    }
    return null;
  }
  function openSave() {
    const message = validatePreview();
    setError(message);
    if (!message) setSaveOpen(true);
  }
  function savePreview() {
    const message = validatePreview();
    if (message || !changeNote.trim()) { setError(message || "Enter a change note."); return; }
    // Bản sao chỉ nằm trong bộ nhớ của màn hình này, không tạo ScheduleVersion thật.
    setSavedPreview({ topics: structuredClone(topics), note: changeNote.trim(), classStart, learningStart });
    setSaveOpen(false);
    setDirty(false);
    setError(null);
  }

  return (
    <MainLayout pathName={{ "training-calendar": "Training Calendar", demo: "Adjust demo" }}>
      <div className="mx-auto w-full max-w-7xl space-y-4 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h1 className="text-xl font-semibold">Adjust calendar: {version.classId}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Version {version.versionNumber} · {version.status}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => dirty || savedPreview ? setLeaveOpen(true) : onBack()}>
            <ArrowLeft className="size-4" /> Back to calendar list
          </Button>
        </div>

        <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <strong>Demo workspace.</strong> Topics and activities below are sample data, not the contents of this version.
          Changes and saved previews stay on this screen only and disappear when you leave or reload.
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="demo-class-start">Class start date</Label>
            <Input id="demo-class-start" type="date" value={classStart} onChange={(event) => { setClassStart(event.target.value); setDirty(true); }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demo-learning-start">Actual learning start date</Label>
            <Input id="demo-learning-start" type="date" value={learningStart} onChange={(event) => { setLearningStart(event.target.value); setDirty(true); }} />
          </div>
          <Button className="ml-auto" onClick={() => { setTopicPreset("CUSTOM"); setTopicCode(""); setTopicName(""); setTopicOpen(true); }}>
            <Plus className="size-4" /> Add topic
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Start dates validate this preview; existing training dates do not move automatically.</p>

        {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
        {savedPreview && (
          <div role="status" className="rounded-md border bg-muted/30 p-3 text-sm">
            <strong>Demo preview saved.</strong> {savedPreview.note}
            <p className="mt-1 text-muted-foreground">{savedPreview.topics.length} topics · No server version was created.{dirty ? " You have further unsaved changes." : ""}</p>
          </div>
        )}
        {topics.length === 0 && <div className="rounded-lg border p-8 text-center text-muted-foreground">No topics yet. Select Add topic to begin.</div>}

        {topics.map((topic) => {
          const collapsed = collapsedTopics.includes(topic.id);
          return (
            <section key={topic.id} className="rounded-lg border bg-card shadow-sm">
              <div className="flex items-center gap-2 rounded-t-lg bg-muted/60 px-3 py-2">
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  aria-controls={`topic-${topic.id}`}
                  onClick={() => setCollapsedTopics((previous) => collapsed ? previous.filter((id) => id !== topic.id) : [...previous, topic.id])}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {collapsed ? <ChevronRight className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                  <span className="break-words">[{topic.code}] {topic.name}</span>
                </button>
                <span className="text-xs text-muted-foreground">{topic.days.length} days</span>
                <Button variant="ghost" size="sm" aria-label={`Remove topic ${topic.code}`} onClick={() => setRemoval({ kind: "topic", topicId: topic.id })}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              {!collapsed && (
                <div id={`topic-${topic.id}`} className="space-y-3 p-3">
                  <div className="grid grid-cols-4 gap-3">
                    <label className="space-y-1 text-xs font-medium">Default slot for new activities
                      <select className={selectClass} value={topic.slot} onChange={(event) => changeTopic(topic.id, { slot: event.target.value })}>
                        {SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium">Prerequisite topic
                      <select className={selectClass} value={topic.prerequisite} onChange={(event) => changeTopic(topic.id, { prerequisite: event.target.value })}>
                        <option value="">None</option>
                        {topics.filter((item) => item.id !== topic.id).map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium">Trainer
                      <Input value={topic.trainer} onChange={(event) => changeTopic(topic.id, { trainer: event.target.value })} placeholder="Trainer name" />
                    </label>
                    <label className="space-y-1 text-xs font-medium">Mentor
                      <Input value={topic.mentor} onChange={(event) => changeTopic(topic.id, { mentor: event.target.value })} placeholder="Optional mentor" />
                    </label>
                  </div>

                  {topic.days.map((day, index) => {
                    const dayCollapsed = collapsedDays.includes(day.id);
                    return (
                      <div key={day.id} className="rounded-md border">
                        <div className="flex flex-wrap items-center gap-2 bg-muted/20 p-2">
                          <Button
                            variant="ghost" size="sm" aria-expanded={!dayCollapsed} aria-controls={`day-${day.id}`}
                            aria-label={`${dayCollapsed ? "Expand" : "Collapse"} day ${index + 1}`}
                            onClick={() => setCollapsedDays((previous) => dayCollapsed ? previous.filter((id) => id !== day.id) : [...previous, day.id])}
                          >
                            {dayCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                          </Button>
                          <span className="w-14 text-sm font-medium">Day {index + 1}</span>
                          <Input className="min-w-40 flex-1" aria-label={`Day ${index + 1} name in ${topic.code}`} value={day.name} onChange={(event) => changeDay(topic.id, day.id, { name: event.target.value })} />
                          <Input className="w-40" type="date" aria-label={`Day ${index + 1} date in ${topic.code}`} value={day.date} onChange={(event) => changeDay(topic.id, day.id, { date: event.target.value })} />
                          <span className="w-24 text-xs text-muted-foreground">{dayName(day.date)}</span>
                          <Button variant="ghost" size="sm" aria-label={`Remove day ${index + 1} in ${topic.code}`} onClick={() => setRemoval({ kind: "day", topicId: topic.id, dayId: day.id })}><Trash2 className="size-4 text-destructive" /></Button>
                        </div>
                        {!dayCollapsed && (
                          <div id={`day-${day.id}`}>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[950px] text-sm">
                                <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                                  <tr>{["Activity name", "PIC", "Contribution type", "Format", "Start", "End", "Duration", "Action"].map((label) => <th key={label} scope="col" className={cellClass}>{label}</th>)}</tr>
                                </thead>
                                <tbody>
                                  {day.activities.map((activity) => {
                                    const minutes = duration(activity.start, activity.end);
                                    return (
                                      <tr key={activity.id} className="border-b last:border-b-0">
                                        <td className={cellClass}><Input className="min-w-48" aria-label="Activity name" value={activity.name} onChange={(event) => changeActivity(topic.id, day.id, activity.id, { name: event.target.value })} /></td>
                                        <td className={cellClass}><Input className="min-w-28" aria-label="Person in charge" value={activity.pic} onChange={(event) => changeActivity(topic.id, day.id, activity.id, { pic: event.target.value })} /></td>
                                        <td className={cellClass}><select className={selectClass} aria-label="Contribution type" value={activity.contribution} onChange={(event) => changeActivity(topic.id, day.id, activity.id, { contribution: event.target.value })}>{["Lecture", "Practice", "Assignment", "Assessment"].map((value) => <option key={value}>{value}</option>)}</select></td>
                                        <td className={cellClass}><select className={selectClass} aria-label="Training format" value={activity.format} onChange={(event) => changeActivity(topic.id, day.id, activity.id, { format: event.target.value })}>{["Offline", "Online", "Self-study"].map((value) => <option key={value}>{value}</option>)}</select></td>
                                        <td className={cellClass}><Input className="w-28" type="time" aria-label="Activity start time" value={activity.start} onChange={(event) => changeActivity(topic.id, day.id, activity.id, { start: event.target.value })} /></td>
                                        <td className={cellClass}><Input className="w-28" type="time" aria-label="Activity end time" value={activity.end} onChange={(event) => changeActivity(topic.id, day.id, activity.id, { end: event.target.value })} /></td>
                                        <td className={`${cellClass} whitespace-nowrap`}>{minutes === null ? <span className="text-destructive">Invalid time</span> : `${minutes} min`}</td>
                                        <td className={cellClass}><Button variant="ghost" size="sm" aria-label={`Remove activity ${activity.name}`} onClick={() => setRemoval({ kind: "activity", topicId: topic.id, dayId: day.id, activityId: activity.id })}><Trash2 className="size-4 text-destructive" /></Button></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex justify-end border-t p-2">
                              <Button variant="outline" size="sm" onClick={() => {
                                const slot = SLOTS.find((item) => item.id === topic.slot) ?? SLOTS[0];
                                changeDay(topic.id, day.id, { activities: [...day.activities, { ...newActivity(slot.start, slot.end), pic: topic.trainer }] });
                              }}><Plus className="size-4" /> Add activity</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => addDay(topic)}><Plus className="size-4" /> Add day</Button></div>
                </div>
              )}
            </section>
          );
        })}

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-sm">
          <span className="text-sm text-muted-foreground">{topics.length} topics · {dayCount} days · {activityCount} activities {dirty ? "· Unsaved changes" : ""}</span>
          <Button onClick={openSave}><Save className="size-4" /> Save as new version (demo)</Button>
        </div>
      </div>

      <Dialog open={topicOpen} onOpenChange={setTopicOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add topic</DialogTitle><DialogDescription>Choose a sample topic or enter a custom topic for this demo.</DialogDescription></DialogHeader>
          <label className="space-y-1 text-sm">Sample topic
            <select className={selectClass} value={topicPreset} onChange={(event) => {
              setTopicPreset(event.target.value);
              const preset = TOPIC_PRESETS.find((item) => item.code === event.target.value);
              setTopicCode(preset?.code ?? ""); setTopicName(preset?.name ?? "");
            }}>
              <option value="CUSTOM">Custom topic</option>
              {TOPIC_PRESETS.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">Topic code<Input maxLength={50} value={topicCode} onChange={(event) => setTopicCode(event.target.value)} /></label>
          <label className="space-y-1 text-sm">Topic name<Input maxLength={150} value={topicName} onChange={(event) => setTopicName(event.target.value)} /></label>
          <DialogFooter><Button variant="outline" onClick={() => setTopicOpen(false)}>Cancel</Button><Button disabled={!topicCode.trim() || !topicName.trim()} onClick={addTopic}>Add topic</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={removal !== null} onOpenChange={(open) => { if (!open) setRemoval(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Remove {removal?.kind}</DialogTitle><DialogDescription>Remove this item and its nested content from the demo workspace?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRemoval(null)}>Cancel</Button><Button variant="destructive" onClick={removeSelected}>Remove</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent><DialogHeader><DialogTitle>Save demo preview</DialogTitle><DialogDescription>This captures a preview on this screen only. It does not create or activate a server version.</DialogDescription></DialogHeader>
          <label className="space-y-1 text-sm">Change note<Input maxLength={500} value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Describe your changes" /></label>
          <DialogFooter><Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button><Button disabled={!changeNote.trim()} onClick={savePreview}>Save demo preview</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent><DialogHeader><DialogTitle>Leave demo workspace?</DialogTitle><DialogDescription>All edits and saved demo previews on this screen will be discarded.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setLeaveOpen(false)}>Keep editing</Button><Button onClick={onBack}>Leave demo</Button></DialogFooter></DialogContent>
      </Dialog>
    </MainLayout>
  );
}
