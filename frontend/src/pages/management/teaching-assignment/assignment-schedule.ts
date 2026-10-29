import type { AssignmentTeachingSlot } from "@/api/features/class-setup.api";

/** Sort a copy so reading the schedule never changes the saved slot order. */
export function groupTeachingSlots(slots: AssignmentTeachingSlot[] = [], limit = slots.length) {
  const ordered = slots.map((slot, index) => ({ ...slot, number: index + 1 }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
  const groups: { date: string; slots: typeof ordered }[] = [];
  for (const slot of ordered.slice(0, limit)) {
    const last = groups.at(-1);
    if (last?.date === slot.date) last.slots.push(slot);
    else groups.push({ date: slot.date, slots: [slot] });
  }
  return groups;
}

/** Empty filtered pages must retain their controls; a failed request is not an empty history. */
export function showLinkedSessionHistory({ total, status, page, pending, failed }: {
  total: number; status: string; page: number; pending: boolean; failed: boolean;
}) {
  return pending || failed || total > 0 || status !== "all" || page > 0;
}
