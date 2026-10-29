import type { AssignmentTeachingSlot } from "@/api/features/class-setup.api";
import { Button } from "@/components/ui/button";
import { groupTeachingSlots } from "../assignment-schedule";

export function AssignmentSchedule({ slots = [], preview = false, onViewAll }: {
  slots?: AssignmentTeachingSlot[]; preview?: boolean; onViewAll?: () => void;
}) {
  if (!slots.length) return <p className="text-sm text-muted-foreground">No teaching slots</p>;
  const limit = preview ? 3 : slots.length;
  return <div className="space-y-3 text-sm">
    {groupTeachingSlots(slots, limit).map((group) => <div key={group.date} className="space-y-1.5">
      <time dateTime={group.date} className="block whitespace-nowrap font-medium">{group.date.split("-").reverse().join("/")}</time>
      <ul className="space-y-1 border-l-2 border-primary/20 pl-3">
        {group.slots.map((slot) => <li key={slot.number} className="flex items-center gap-3 whitespace-nowrap">
          <span className="min-w-10 text-xs text-muted-foreground">Slot {slot.number}</span>
          <span className="rounded-md bg-muted/60 px-2 py-1 font-medium tabular-nums">{slot.startTime.slice(0, 5)} &ndash; {slot.endTime.slice(0, 5)}</span>
        </li>)}
      </ul>
    </div>)}
    {preview && slots.length > limit && onViewAll && <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onViewAll}>View all {slots.length} slots</Button>}
  </div>;
}
