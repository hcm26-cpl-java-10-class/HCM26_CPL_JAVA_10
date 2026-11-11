import { isISODate } from "./assignment-form.ts";
import type { AssignmentTeachingSlot } from "@/api/features/class-setup.api";

export type SlotErrors = Record<string, string>;

/** Integer minutes keep values such as 31 minutes exact, without floating-hour rounding. */
export function teachingSlotMinutes(slot: Pick<AssignmentTeachingSlot, "startTime" | "endTime">): number | null {
  const valid = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!valid(slot.startTime) || !valid(slot.endTime)) return null;
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const result = minutes(slot.endTime) - minutes(slot.startTime);
  return result > 0 ? result : null;
}

export function totalTeachingMinutes(slots: AssignmentTeachingSlot[]): number | null {
  if (!slots.length) return null;
  let total = 0;
  for (const slot of slots) {
    const minutes = teachingSlotMinutes(slot);
    if (minutes === null) return null;
    total += minutes;
  }
  return total;
}

export function formatTeachingDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return [hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "", remainder ? `${remainder} ${remainder === 1 ? "minute" : "minutes"}` : ""].filter(Boolean).join(" ") || "0 minutes";
}

export function validateTeachingSlots(slots: AssignmentTeachingSlot[], from: string, to?: string | null): SlotErrors {
  const errors: SlotErrors = {};
  if (!slots.length || slots.length > 200) errors.teachingSlots = "Add between 1 and 200 teaching slots.";
  const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  slots.forEach((slot, index) => {
    const key = `teachingSlots[${index}]`;
    if (!isISODate(slot.date)) errors[`${key}.date`] = "Enter a valid teaching date.";
    else if ((isISODate(from) && slot.date < from) || (to && isISODate(to) && slot.date > to))
      errors[`${key}.date`] = "Teaching date must be within the assignment effective dates and class dates.";
    if (!validTime(slot.startTime)) errors[`${key}.startTime`] = "Enter a valid start time (HH:mm).";
    if (!validTime(slot.endTime)) errors[`${key}.endTime`] = "Enter a valid end time (HH:mm).";
    else if (validTime(slot.startTime) && slot.endTime <= slot.startTime)
      errors[`${key}.endTime`] = "End time must be after start time on the same day.";
    else if (validTime(slot.startTime)) {
      if ((teachingSlotMinutes(slot) ?? 0) <= 30)
        errors[`${key}.endTime`] = "Each teaching slot must be longer than 30 minutes.";
    }
    if (isISODate(slot.date) && validTime(slot.startTime) && validTime(slot.endTime) && slot.endTime > slot.startTime) {
      for (const previous of slots.slice(0, index)) {
        if (slot.date === previous.date && validTime(previous.startTime) && validTime(previous.endTime)
            && slot.startTime < previous.endTime && previous.startTime < slot.endTime)
          errors[`${key}.startTime`] = "Teaching slots must not overlap. Adjacent slots are allowed.";
      }
    }
  });
  return errors;
}

export function slotSummary(slots?: AssignmentTeachingSlot[]): string {
  return slots?.length ? slots.map(slot => `${slot.date.split("-").reverse().join("/")} ${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`).join("; ") : "Not specified";
}
