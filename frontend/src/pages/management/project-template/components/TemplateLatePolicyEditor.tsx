import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  emptyLatePolicy,
  milestoneFieldId,
  weightHundredths,
  type LatePolicyValues,
  type MilestonePlanErrors,
} from "../milestone-plan.utils";

export function TemplateLatePolicyEditor({ policy, milestoneIndex, disabled, editable, errors, onChange }: {
  policy: LatePolicyValues | null;
  milestoneIndex: number;
  disabled: boolean;
  editable: boolean;
  errors: MilestonePlanErrors;
  onChange: (policy: LatePolicyValues) => void;
}) {
  const values = policy ?? emptyLatePolicy();
  const path = `milestones[${milestoneIndex}].latePolicy`;
  const fieldProps = (field: string) => ({
    id: milestoneFieldId(`${path}.${field}`),
    "aria-invalid": !!errors[`${path}.${field}`]?.length,
    "aria-describedby": `${milestoneFieldId(`${path}.${field}`)}-error`,
  });
  const validDays = /^\d+$/.test(values.maxLateDays.trim()) && Number(values.maxLateDays) > 0
    && Number(values.maxLateDays) <= 2147483647;
  const validPenalty = weightHundredths(values.penaltyPerDayPercent) !== null;

  return (
    <section id={milestoneFieldId(path)} tabIndex={-1} className="grid min-w-0 gap-4 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-medium">Late submission policy</h2>
        <p className="mt-1 text-xs text-muted-foreground">Set the allowed delay and daily score deduction for this milestone.</p>
      </div>
      <div aria-live="polite"><FieldError errors={errors[path]} /></div>
      {!editable && policy === null ? (
        <p className="text-sm text-muted-foreground">A late submission policy has not been configured.</p>
      ) : <>
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <Label htmlFor={fieldProps("allowLateSubmission").id}>Allow late submissions</Label>
            <p className="text-xs text-muted-foreground">Allow submissions after the milestone deadline.</p>
            <div id={`${fieldProps("allowLateSubmission").id}-error`} aria-live="polite">
              <FieldError errors={errors[`${path}.allowLateSubmission`]} />
            </div>
          </div>
          <Switch {...fieldProps("allowLateSubmission")} checked={values.allowLateSubmission} disabled={disabled}
            onCheckedChange={(allowLateSubmission) => onChange({ ...values, allowLateSubmission })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor={fieldProps("maxLateDays").id}>Maximum late days{values.allowLateSubmission && <span className="text-destructive">*</span>}</Label>
            <Input {...fieldProps("maxLateDays")} inputMode="numeric" value={values.maxLateDays}
              disabled={disabled || !values.allowLateSubmission} placeholder={values.allowLateSubmission ? "E.g. 2" : "Not applicable"}
              onChange={(event) => onChange({ ...values, maxLateDays: event.target.value })} />
            <div id={`${fieldProps("maxLateDays").id}-error`} aria-live="polite"><FieldError errors={errors[`${path}.maxLateDays`]} /></div>
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor={fieldProps("penaltyPerDayPercent").id}>Daily penalty (%){values.allowLateSubmission && <span className="text-destructive">*</span>}</Label>
            <Input {...fieldProps("penaltyPerDayPercent")} inputMode="decimal" value={values.penaltyPerDayPercent}
              disabled={disabled || !values.allowLateSubmission} placeholder={values.allowLateSubmission ? "E.g. 5" : "Not applicable"}
              onChange={(event) => onChange({ ...values, penaltyPerDayPercent: event.target.value })} />
            <div id={`${fieldProps("penaltyPerDayPercent").id}-error`} aria-live="polite"><FieldError errors={errors[`${path}.penaltyPerDayPercent`]} /></div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {values.allowLateSubmission
            ? "Deduction is a percentage of the milestone's maximum score for each late day. A 0% penalty is allowed."
            : "Late submissions are not accepted. The late-day limit and penalty do not apply."}
        </p>
        {values.allowLateSubmission && validDays && validPenalty && (
          <p className="rounded-lg bg-muted/40 p-3 text-sm">
            Up to {Number(values.maxLateDays)} late days, with a {Number(values.penaltyPerDayPercent)}% deduction per day.
          </p>
        )}
      </>}
    </section>
  );
}
