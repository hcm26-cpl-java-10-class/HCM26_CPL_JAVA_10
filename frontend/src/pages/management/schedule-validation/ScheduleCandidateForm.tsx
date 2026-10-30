import { Input } from "@/components/ui/input";
import type { ScheduleCandidate, ScheduleResources } from "@/api/features/schedule-check.api";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export function ScheduleCandidateForm({ value, onChange, resources, disabled = false, prefix }: {
    value: ScheduleCandidate;
    onChange: (value: ScheduleCandidate) => void;
    resources: ScheduleResources;
    disabled?: boolean;
    prefix: string;
}) {
    const refs = resources.references;
    const patch = (update: Partial<ScheduleCandidate>) => onChange({ ...value, ...update });
    const assignments = refs.assignments.filter(a => a.status === "ACTIVE");
    const selected = assignments.find(a => a.id === value.teachingAssignmentId);
    const label = (name: string, text: string, control: React.ReactNode) => <div className="space-y-1"><label htmlFor={`${prefix}-${name}`} className="text-sm font-medium">{text}</label>{control}</div>;
    return <fieldset disabled={disabled} className="grid gap-4 md:grid-cols-2">
        {label("title", "Session title", <Input id={`${prefix}-title`} value={value.title} maxLength={150} required onChange={e => patch({ title: e.target.value })} />)}
        {label("assignment", "Teaching assignment (class / subject / instructor)", <select id={`${prefix}-assignment`} className={selectClass} required value={value.teachingAssignmentId ?? ""} onChange={e => {
            const a = assignments.find(x => x.id === Number(e.target.value));
            patch({ teachingAssignmentId: a?.id, classId: a?.classId, topicId: a?.topicId, trainerId: a?.trainerId });
        }}><option value="">Select an active teaching assignment</option>{assignments.map(a => <option key={a.id} value={a.id}>{refs.classes.find(c => c.id === a.classId)?.name ?? `Class #${a.classId}`} / Subject #{a.topicId} / {refs.trainers.find(t => t.id === a.trainerId)?.name ?? `Instructor #${a.trainerId}`}</option>)}</select>)}
        {label("start", "Start time", <Input id={`${prefix}-start`} type="datetime-local" required value={value.startTime.slice(0, 16)} onChange={e => patch({ startTime: e.target.value })} />)}
        {label("end", "End time", <Input id={`${prefix}-end`} type="datetime-local" required value={value.endTime.slice(0, 16)} onChange={e => patch({ endTime: e.target.value })} />)}
        {label("room", "Room (optional for online sessions)", <select id={`${prefix}-room`} className={selectClass} value={value.roomId ?? ""} onChange={e => {
            const room = refs.rooms.find(r => r.id === Number(e.target.value));
            patch({ roomId: room?.id, location: room?.name ?? "" });
        }}><option value="">No room selected</option>{refs.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>)}
        {label("url", "Online meeting URL", <Input id={`${prefix}-url`} type="url" maxLength={1000} placeholder="https://..." value={value.meetingUrl ?? ""} onChange={e => patch({ meetingUrl: e.target.value })} />)}
        {selected && <p className="text-sm text-muted-foreground md:col-span-2">Assignment validity: {selected.effectiveFrom} to {selected.effectiveTo ?? "No end date"}.</p>}
    </fieldset>;
}
