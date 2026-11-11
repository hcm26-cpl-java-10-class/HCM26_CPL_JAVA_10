import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, PanelLeftClose, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { maxDescriptionLength } from "../project-template.utils";
import { maxBacklogTitleLength, type BacklogItemValues, type SampleContentErrors } from "../sample-content.utils";

function Field({ id, label, required, errors, length, limit, children }: {
  id: string; label: string; required?: boolean; errors?: string[]; children: ReactNode;
  length: number; limit: number;
}) {
  return <div className="grid content-start gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Label htmlFor={id}>{label}{required && <span className="text-destructive">*</span>}</Label>
      <span id={`${id}-count`} className={`text-xs tabular-nums ${length > limit ? "text-destructive" : "text-muted-foreground"}`}>
        {length.toLocaleString("en-US")} / {limit.toLocaleString("en-US")} characters
      </span>
    </div>
    {children}<div id={`${id}-error`} aria-live="polite"><FieldError errors={errors} /></div></div>;
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
  item: BacklogItemValues; fieldId: (path: string) => string; onChange: (patch: Partial<BacklogItemValues>) => void;
  onCollapse: () => void;
}) {
  const { item, index, disabled, errors, fieldId, onChange, onCollapse } = props;
  const path = `backlogItems[${index}]`;
  const fieldProps = (field: "title" | "description", maxLength: number) => {
    const id = fieldId(`${path}.${field}`);
    return { id, maxLength, "aria-invalid": !!errors[`${path}.${field}`] || item[field].length > maxLength,
      "aria-describedby": `${id}-error ${id}-count` };
  };
  const titleInput = fieldProps("title", maxBacklogTitleLength);
  const descriptionInput = fieldProps("description", maxDescriptionLength);
  return <Card><CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0">
    <p className="text-xs text-muted-foreground">Backlog item {index + 1}</p><CardTitle className="mt-1 break-words text-base">{item.title.trim() || "New backlog item"}</CardTitle>
  </div><div className="flex shrink-0 items-center gap-1">
    <Actions {...props} label="backlog item" />
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Collapse backlog item" title="Collapse backlog item"
      onClick={onCollapse}><PanelLeftClose /></Button>
  </div></div></CardHeader><CardContent>
    <fieldset disabled={disabled} className="grid gap-4">
      <FieldError errors={errors[path] ?? errors[`${path}.id`]} />
      <Field id={titleInput.id} label="Backlog title" required errors={errors[`${path}.title`]}
        length={item.title.length} limit={maxBacklogTitleLength}><Input {...titleInput} value={item.title}
        onChange={(event) => onChange({ title: event.target.value })} placeholder="E.g. Design the database" /></Field>
      <Field id={descriptionInput.id} label="Backlog description" errors={errors[`${path}.description`]}
        length={item.description.length} limit={maxDescriptionLength}><Textarea {...descriptionInput} rows={3} value={item.description}
        onChange={(event) => onChange({ description: event.target.value })} placeholder="Describe the expected work (optional)." /></Field>
    </fieldset>
  </CardContent></Card>;
}
