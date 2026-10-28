import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TemplateMilestoneTimeUnit } from "@/types/features/project-template";
import type { MilestoneRubricOption } from "@/types/features/milestone";
import { MilestoneRubricSelector } from "@/pages/management/project/milestone/components/MilestoneRubricSelector";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { milestoneFieldId, type MilestonePlanErrors, type MilestoneValues } from "../milestone-plan.utils";
import { TemplateLatePolicyEditor } from "./TemplateLatePolicyEditor";

function MilestoneField({ path, label, required, errors, children }: {
  path: string;
  label: string;
  required?: boolean;
  errors: MilestonePlanErrors;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={milestoneFieldId(path)}>{label}{required && <span className="text-destructive">*</span>}</Label>
      {children}
      <div id={`${milestoneFieldId(path)}-error`} aria-live="polite"><FieldError errors={errors[path]} /></div>
    </div>
  );
}

export function TemplateMilestoneEditor({ milestone, index, count, disabled, editable, errors, rubrics, onChange, onMove, onRemove }: {
  milestone: MilestoneValues;
  index: number;
  count: number;
  disabled: boolean;
  editable: boolean;
  errors: MilestonePlanErrors;
  rubrics: MilestoneRubricOption[];
  onChange: (patch: Partial<MilestoneValues>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const path = `milestones[${index}]`;
  const fieldProps = (field: string) => ({
    id: milestoneFieldId(`${path}.${field}`),
    "aria-invalid": !!errors[`${path}.${field}`]?.length,
    "aria-describedby": `${milestoneFieldId(`${path}.${field}`)}-error`,
  });
  const changeChecklist = (itemIndex: number, patch: { content?: string; mandatory?: boolean }) => {
    onChange({ checklistItems: milestone.checklistItems.map((item, position) => position === itemIndex ? { ...item, ...patch } : item) });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Milestone {index + 1}</p>
            <CardTitle className="mt-1 break-words text-base leading-relaxed">{milestone.title.trim() || "New milestone"}</CardTitle>
          </div>
          {editable && <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move milestone ${index + 1} up`}
              disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move milestone ${index + 1} down`}
              disabled={disabled || index === count - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
            <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Remove milestone ${index + 1}`}
              disabled={disabled} onClick={onRemove}><Trash2 /></Button>
          </div>}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <fieldset disabled={disabled} className="grid min-w-0 gap-5">
          {errors[path] && <div aria-live="polite"><FieldError errors={errors[path]} /></div>}
          <MilestoneField path={`${path}.title`} label="Milestone name" required errors={errors}>
            <Input {...fieldProps("title")} value={milestone.title} onChange={(event) => onChange({ title: event.target.value })}
              placeholder="E.g. Requirements analysis" />
          </MilestoneField>
          <MilestoneField path={`${path}.description`} label="Description" errors={errors}>
            <Textarea {...fieldProps("description")} rows={3} value={milestone.description}
              onChange={(event) => onChange({ description: event.target.value })} placeholder="Describe the expected outcome (optional)." />
          </MilestoneField>
          <div className="grid gap-4 sm:grid-cols-3">
            <MilestoneField path={`${path}.dueAfter`} label="Due after" required errors={errors}>
              <Input {...fieldProps("dueAfter")} inputMode="numeric" value={milestone.dueAfter}
                onChange={(event) => onChange({ dueAfter: event.target.value })} placeholder="E.g. 2" />
            </MilestoneField>
            <MilestoneField path={`${path}.dueUnit`} label="Time unit" required errors={errors}>
              <Select value={milestone.dueUnit} disabled={disabled}
                onValueChange={(value) => onChange({ dueUnit: value as TemplateMilestoneTimeUnit })}>
                <SelectTrigger {...fieldProps("dueUnit")} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="DAYS">Days</SelectItem><SelectItem value="WEEKS">Weeks</SelectItem></SelectContent>
              </Select>
            </MilestoneField>
            <MilestoneField path={`${path}.weight`} label="Weight (%)" required errors={errors}>
              <Input {...fieldProps("weight")} inputMode="decimal" value={milestone.weight}
                onChange={(event) => onChange({ weight: event.target.value })} placeholder="E.g. 25" />
            </MilestoneField>
          </div>
          <p className="text-xs text-muted-foreground">Due after the project start date. One week equals 7 days.</p>
          <div className="flex items-center gap-2">
            <Checkbox {...fieldProps("mandatory")} checked={milestone.mandatory} disabled={disabled}
              onCheckedChange={(checked) => onChange({ mandatory: checked === true })} />
            <Label htmlFor={milestoneFieldId(`${path}.mandatory`)}>Required milestone</Label>
            <FieldError errors={errors[`${path}.mandatory`]} />
          </div>
          <div className="grid gap-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Checklist</h2>
              {editable && <Button type="button" size="sm" variant="outline" disabled={disabled || milestone.checklistItems.length >= 100}
                onClick={() => onChange({ checklistItems: [...milestone.checklistItems, { key: crypto.randomUUID(), content: "", mandatory: true }] })}>
                <Plus /> Add checklist item
              </Button>}
            </div>
            <FieldError errors={errors[`${path}.checklistItems`]} />
            {!milestone.checklistItems.length && <p className="text-sm text-muted-foreground">No checklist items.</p>}
            {milestone.checklistItems.map((item, itemIndex) => {
              const itemPath = `${path}.checklistItems[${itemIndex}]`;
              return (
                <div key={item.key} className="grid min-w-0 gap-2 rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={milestoneFieldId(`${itemPath}.content`)}>Item {itemIndex + 1}</Label>
                    {editable && <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" disabled={disabled}
                      aria-label={`Remove checklist item ${itemIndex + 1} from milestone ${index + 1}`}
                      onClick={() => onChange({ checklistItems: milestone.checklistItems.filter((_, position) => position !== itemIndex) })}><Trash2 /></Button>}
                  </div>
                  <Input id={milestoneFieldId(`${itemPath}.content`)} value={item.content} placeholder="E.g. Requirements document is complete"
                    onChange={(event) => changeChecklist(itemIndex, { content: event.target.value })}
                    aria-invalid={!!errors[`${itemPath}.content`]?.length}
                    aria-describedby={`${milestoneFieldId(`${itemPath}.content`)}-error`} />
                  <div id={`${milestoneFieldId(`${itemPath}.content`)}-error`} aria-live="polite"><FieldError errors={errors[`${itemPath}.content`]} /></div>
                  <div className="flex items-center gap-2">
                    <Checkbox id={milestoneFieldId(`${itemPath}.mandatory`)} checked={item.mandatory} disabled={disabled}
                      onCheckedChange={(checked) => changeChecklist(itemIndex, { mandatory: checked === true })} />
                    <Label htmlFor={milestoneFieldId(`${itemPath}.mandatory`)}>Required</Label>
                  </div>
                  <FieldError errors={errors[`${itemPath}.mandatory`] ?? errors[itemPath]} />
                </div>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-3">
          <MilestoneRubricSelector id={milestoneFieldId(`${path}.rubricVersionId`)}
            rubrics={rubrics} value={milestone.rubricVersionId} disabled={disabled} allowManage={editable}
            error={errors[`${path}.rubricVersionId`]?.join(" ")}
            onChange={(rubricVersionId) => onChange({ rubricVersionId })} />
          {!milestone.rubricVersionId && milestone.legacyRubricCriteria.length > 0 && <details className="rounded-lg border p-4 text-sm">
            <summary className="cursor-pointer font-medium">Previously entered criteria</summary>
            <p className="mt-3 text-muted-foreground">Use these criteria as a reference when selecting or creating a rubric in the library.</p>
            <ul className="mt-3 grid list-disc gap-2 pl-5">
              {milestone.legacyRubricCriteria.map((criterion) => <li key={criterion.id}>
                {criterion.name} — {criterion.maxScore} points{criterion.description ? `: ${criterion.description}` : ""}
              </li>)}
            </ul>
          </details>}
        </div>
        <fieldset disabled={disabled}>
          <TemplateLatePolicyEditor policy={milestone.latePolicy} milestoneIndex={index}
            disabled={disabled} editable={editable} errors={errors}
            onChange={(latePolicy) => onChange({ latePolicy })} />
        </fieldset>
      </CardContent>
    </Card>
  );
}
