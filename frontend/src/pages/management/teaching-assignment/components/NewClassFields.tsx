import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { minimumClassStartDate, type NewClassForm } from "../new-class-form";

export function NewClassFields({ form, onChange, errors }: {
  form: NewClassForm;
  onChange: <K extends keyof NewClassForm>(key: K, value: NewClassForm[K]) => void;
  errors: Partial<Record<keyof NewClassForm, string>>;
}) {
  const change = onChange;
  const earliestStart = minimumClassStartDate();
  function props(key: keyof NewClassForm) {
    return { id: `new-class-${key}`, "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `new-class-${key}-error` : undefined };
  }
  function error(key: keyof NewClassForm) {
    return errors[key] && <p id={`new-class-${key}-error`} className="text-sm text-destructive">{errors[key]}</p>;
  }
  return <section className="space-y-4 rounded-lg border p-4" aria-label="Class information">
    <h2 className="font-semibold">1. Class information</h2>
    <div className="space-y-2"><Label htmlFor="new-class-name">Class name *</Label>
      <Input {...props("name")} value={form.name} onChange={e => change("name", e.target.value)} maxLength={200} placeholder="Enter any new class name" />{error("name")}
      <p className="text-xs text-muted-foreground">Enter a new name freely. A class code will be generated when you save.</p></div>
    <div className="space-y-2"><Label htmlFor="new-class-programName">Training program name *</Label>
      <Input {...props("programName")} value={form.programName} onChange={e => change("programName", e.target.value)} maxLength={200} placeholder="Enter any new program name" />{error("programName")}</div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="new-class-startDate">Class start date *</Label><Input {...props("startDate")} type="date" min={earliestStart} value={form.startDate} onChange={e => change("startDate", e.target.value)} />{error("startDate")}</div>
      <div className="space-y-2"><Label htmlFor="new-class-endDate">Class end date *</Label><Input {...props("endDate")} type="date" min={form.startDate > earliestStart ? form.startDate : earliestStart} value={form.endDate} onChange={e => change("endDate", e.target.value)} />{error("endDate")}</div>
      <div className="space-y-2"><Label htmlFor="new-class-plannedSize">Planned students *</Label><Input {...props("plannedSize")} type="number" min={1} max={10000} step={1} value={form.plannedSize} onChange={e => change("plannedSize", e.target.value)} />{error("plannedSize")}</div>
    </div>
  </section>;
}
