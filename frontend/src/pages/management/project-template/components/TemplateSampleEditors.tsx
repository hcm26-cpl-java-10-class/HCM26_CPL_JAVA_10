import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TemplateSuggestedRole } from "@/types/features/project-template";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { sampleFieldId, type BacklogItemValues, type SampleContentErrors } from "../sample-content.utils";

function Field({ path, label, required, errors, children }: {
  path: string; label: string; required?: boolean; errors: SampleContentErrors; children: ReactNode;
}) {
  return <div className="grid content-start gap-2"><Label htmlFor={sampleFieldId(path)}>{label}{required && <span className="text-destructive">*</span>}</Label>
    {children}<div id={`${sampleFieldId(path)}-error`} aria-live="polite"><FieldError errors={errors[path]} /></div></div>;
}

interface EditorProps {
  index: number; count: number; disabled: boolean; editable: boolean; errors: SampleContentErrors;
  onMove: (direction: -1 | 1) => void; onRemove: () => void;
}

function Actions({ index, count, disabled, editable, onMove, onRemove, label }: EditorProps & { label: string }) {
  return editable && <div className="flex shrink-0 gap-1">
    <Button type="button" variant="ghost" size="icon-sm" disabled={disabled || index === 0} aria-label={`Move ${label} ${index + 1} up`} onClick={() => onMove(-1)}><ArrowUp /></Button>
    <Button type="button" variant="ghost" size="icon-sm" disabled={disabled || index === count - 1} aria-label={`Move ${label} ${index + 1} down`} onClick={() => onMove(1)}><ArrowDown /></Button>
    <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" disabled={disabled} aria-label={`Remove ${label} ${index + 1}`} onClick={onRemove}><Trash2 /></Button>
  </div>;
}

export function TemplateBacklogEditor(props: EditorProps & {
  item: BacklogItemValues; roles: TemplateSuggestedRole[]; onChange: (patch: Partial<BacklogItemValues>) => void;
}) {
  const { item, index, disabled, errors, roles, onChange } = props;
  const path = `backlogItems[${index}]`;
  const fieldProps = (field: string) => ({ id: sampleFieldId(`${path}.${field}`), "aria-invalid": !!errors[`${path}.${field}`], "aria-describedby": `${sampleFieldId(`${path}.${field}`)}-error` });
  return <Card><CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0">
    <p className="text-xs text-muted-foreground">Backlog item {index + 1}</p><CardTitle className="mt-1 break-words text-base">{item.title.trim() || "New backlog item"}</CardTitle>
  </div><Actions {...props} label="backlog item" /></div></CardHeader><CardContent>
    <fieldset disabled={disabled} className="grid gap-4">
      <FieldError errors={errors[path] ?? errors[`${path}.id`]} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field path={`${path}.title`} label="Backlog title" required errors={errors}><Input {...fieldProps("title")} value={item.title}
          onChange={(event) => onChange({ title: event.target.value })} placeholder="E.g. Design the database" /></Field>
        <Field path={`${path}.suggestedRole`} label="Suggested role" required errors={errors}>
          <Select value={item.suggestedRole} disabled={disabled} onValueChange={(value) => onChange({ suggestedRole: value as TemplateSuggestedRole })}>
            <SelectTrigger {...fieldProps("suggestedRole")} className="w-full"><SelectValue placeholder="Select a role" /></SelectTrigger>
            <SelectContent>{roles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field path={`${path}.description`} label="Backlog description" errors={errors}><Textarea {...fieldProps("description")} rows={3} value={item.description}
        onChange={(event) => onChange({ description: event.target.value })} placeholder="Describe the expected work (optional)." /></Field>
    </fieldset>
  </CardContent></Card>;
}
