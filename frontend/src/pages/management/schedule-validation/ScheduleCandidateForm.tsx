import { Input } from "@/components/ui/input";
import type { ScheduleCandidate, ScheduleResources } from "@/api/features/schedule-check.api";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
type LegacyAssignment = Pick<ScheduleCandidate, "classId" | "topicId" | "trainerId">;

export function ScheduleCandidateForm({ value, onChange, resources, disabled = false, prefix, legacyAssignment }: {
    value: ScheduleCandidate;
    onChange: (value: ScheduleCandidate) => void;
    resources: ScheduleResources;
    disabled?: boolean;
    prefix: string;
    legacyAssignment?: LegacyAssignment;
}) {
    const refs = resources.references;
    const patch = (update: Partial<ScheduleCandidate>) => onChange({ ...value, ...update });
    const assignments = refs.assignments.filter(a => a.status === "ACTIVE");
    const selected = assignments.find(a => a.id === value.teachingAssignmentId);
    const legacy = legacyAssignment && legacyAssignment.classId != null && legacyAssignment.topicId != null && legacyAssignment.trainerId != null;
    const assignmentValue = value.teachingAssignmentId ?? (legacy ? "legacy-session" : "");
    const label = (name: string, text: string, control: React.ReactNode) => <div className="space-y-1"><label htmlFor={`${prefix}-${name}`} className="text-sm font-medium">{text}</label>{control}</div>;
    const assignmentLabel = (a: LegacyAssignment) => `${refs.classes.find(c => c.id === a.classId)?.name ?? `Class #${a.classId}`} / Topic #${a.topicId} / ${refs.trainers.find(t => t.id === a.trainerId)?.name ?? `Instructor #${a.trainerId}`}`;
    return <fieldset disabled={disabled} className="grid gap-4 md:grid-cols-2">
        {label("title", "Session title", <Input id={`${prefix}-title`} value={value.title} maxLength={150} required onChange={e => patch({ title: e.target.value })} />)}
        {label("assignment", "Teaching assignment (class / Topic / instructor)", <select id={`${prefix}-assignment`} className={selectClass} required value={assignmentValue} onChange={e => {
            if (e.target.value === "legacy-session" && legacyAssignment) {
                patch({ ...legacyAssignment, teachingAssignmentId: null });
                return;
            }
            const a = assignments.find(x => x.id === Number(e.target.value));
            if (!a && e.target.value === String(value.teachingAssignmentId)) return;
            patch({ teachingAssignmentId: a?.id, classId: a?.classId, topicId: a?.topicId, trainerId: a?.trainerId });
        }}><option value="">Select an active teaching assignment</option>
            {legacy && <option value="legacy-session">Existing session (no linked assignment): {assignmentLabel(legacyAssignment!)}</option>}
            {value.teachingAssignmentId != null && !selected && <option value={value.teachingAssignmentId}>Current assignment #{value.teachingAssignmentId} (not in scheduling references)</option>}
            {assignments.map(a => <option key={a.id} value={a.id}>{assignmentLabel(a)}</option>)}
        </select>)}
        {label("start", "Start time", <Input id={`${prefix}-start`} type="datetime-local" required value={value.startTime.slice(0, 16)} onChange={e => patch({ startTime: e.target.value })} />)}
        {label("end", "End time", <Input id={`${prefix}-end`} type="datetime-local" required value={value.endTime.slice(0, 16)} onChange={e => patch({ endTime: e.target.value })} />)}
        {label("room", "Room (optional for online sessions)", <select id={`${prefix}-room`} className={selectClass} value={value.roomId ?? ""} onChange={e => {
            const room = refs.rooms.find(r => r.id === Number(e.target.value));
            patch({ roomId: room?.id, location: room?.name ?? "" });
        }}><option value="">No room selected</option>{refs.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>)}
        {label("url", "Online meeting URL", <Input id={`${prefix}-url`} type="url" maxLength={1000} placeholder="https://..." value={value.meetingUrl ?? ""} onChange={e => patch({ meetingUrl: e.target.value })} />)}
        {legacy && value.teachingAssignmentId == null && <p className="text-sm text-muted-foreground md:col-span-2">This existing session has no stored teaching assignment link. Keeping it preserves the current class, Topic and instructor.</p>}
        {selected && <p className="text-sm text-muted-foreground md:col-span-2">Assignment validity: {selected.effectiveFrom} to {selected.effectiveTo ?? "No end date"}.</p>}
    </fieldset>;
}
