import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssignmentTeachingSlot } from "@/api/features/class-setup.api";
import { validateTeachingSlots, teachingSlotMinutes, totalTeachingMinutes, formatTeachingDuration, type SlotErrors } from "../assignment-slots";

export function TeachingSlotsFields({ slots, onChange, from, to, errors = {}, disabled = false, title = "Teaching slots" }: {
  slots: AssignmentTeachingSlot[]; onChange: (slots: AssignmentTeachingSlot[]) => void;
  from?: string; to?: string | null; errors?: SlotErrors; disabled?: boolean; title?: string;
}) {
  const currentErrors = validateTeachingSlots(slots, from ?? "", to);
  function field(index: number, key: keyof AssignmentTeachingSlot) {
    const path = `teachingSlots[${index}].${key}`;
    const id = `teaching-slot-${index}-${key}`;
    const message = errors[path] || (key === "endTime" && slots[index].startTime && slots[index].endTime ? currentErrors[path] : undefined);
    return <div className="min-w-0 space-y-2" key={key}>
      <Label htmlFor={id}>{key === "date" ? "Teaching date" : key === "startTime" ? "Start time" : "End time"} *</Label>
      <Input id={id} type={key === "date" ? "date" : "time"} value={slots[index][key]}
        min={key === "date" ? from || undefined : undefined} max={key === "date" ? to || undefined : undefined}
        step={key === "date" ? undefined : 60} disabled={disabled} aria-invalid={Boolean(message)}
        aria-describedby={message ? `${id}-error` : undefined}
        onChange={event => onChange(slots.map((slot, position) => position === index ? { ...slot, [key]: event.target.value } : slot))} />
      {message && <p id={`${id}-error`} className="text-sm text-destructive">{message}</p>}
    </div>;
  }
  return <section className="space-y-3 rounded-lg border p-4" aria-label="Teaching slots">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{title}</h2>
      <Button type="button" variant="outline" size="sm" disabled={disabled || slots.length >= 200}
        onClick={() => onChange([...slots, { date: slots.at(-1)?.date || from || "", startTime: "", endTime: "" }])}><Plus className="size-4" />Add slot</Button></div>
    <p className="text-xs text-muted-foreground">Add a date and time for each teaching slot (Vietnam time). Each slot must be longer than 30 minutes. A trainer can teach multiple subjects on the same day when their slots do not overlap.</p>
    {errors.teachingSlots && <p role="alert" className="text-sm text-destructive">{errors.teachingSlots}</p>}
    {slots.map((slot, index) => <div key={index} className="grid items-start gap-3 rounded-md border p-3 sm:grid-cols-2 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="whitespace-nowrap text-sm font-semibold text-muted-foreground sm:col-span-2 md:col-span-1 md:pt-9">Slot {index + 1}</div>
      {field(index, "date")}{field(index, "startTime")}{field(index, "endTime")}
      <div className="min-w-0 space-y-2"><span className="text-sm font-medium">Duration</span>
        <output className="flex min-h-9 items-center rounded-md border bg-muted/20 px-3 py-2 text-sm" aria-label={`Duration of slot ${index + 1}`}
          htmlFor={`teaching-slot-${index}-startTime teaching-slot-${index}-endTime`}>{formatTeachingDuration(teachingSlotMinutes(slot))}</output></div>
      <Button type="button" variant="ghost" size="icon" className="sm:mt-7" aria-label={`Remove teaching slot ${index + 1}`} disabled={disabled}
        onClick={() => onChange(slots.filter((_, position) => position !== index))}><Trash2 className="size-4 text-destructive" /></Button>
    </div>)}
    <p className="border-t pt-3 text-sm font-medium" aria-live="polite">Total teaching time: {formatTeachingDuration(totalTeachingMinutes(slots))}</p>
  </section>;
}
