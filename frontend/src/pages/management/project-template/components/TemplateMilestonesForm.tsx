import { projectTemplateApi } from "@/api/features/project-template.api";
import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { Progress } from "@/components/ui/progress";
import type { TemplateMilestonePlan, TemplateMilestonePlanPayload } from "@/types/features/project-template";
import type { MilestoneRubricOption } from "@/types/features/milestone";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Flag, Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  milestoneFieldId,
  newMilestone,
  toMilestonePlanPayload,
  toMilestoneValues,
  totalWeightHundredths,
  validateMilestonePlan,
  type MilestonePlanErrors,
  type MilestoneValues,
} from "../milestone-plan.utils";
import { getTemplateError } from "../project-template.utils";
import { TemplateMilestoneEditor } from "./TemplateMilestoneEditor";

export function TemplateMilestonesForm({ plan, editable, rubrics, refreshingRubrics, onRefreshRubrics, onSaved }: {
  plan: TemplateMilestonePlan;
  editable: boolean;
  rubrics: MilestoneRubricOption[];
  refreshingRubrics: boolean;
  onRefreshRubrics: () => void;
  onSaved: (plan: TemplateMilestonePlan) => void;
}) {
  const [milestones, setMilestones] = useState(() => toMilestoneValues(plan));
  const [savedValues, setSavedValues] = useState(() => JSON.stringify(toMilestonePlanPayload(toMilestoneValues(plan), 0).milestones));
  const [lockVersion, setLockVersion] = useState(plan.lockVersion);
  const [durationWeeks, setDurationWeeks] = useState(plan.estimatedDurationWeeks);
  const [errors, setErrors] = useState<MilestonePlanErrors>({});
  const [submitError, setSubmitError] = useState<ReturnType<typeof getTemplateError> | null>(null);
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: (payload: TemplateMilestonePlanPayload) => projectTemplateApi.saveMilestones(plan.templateId, payload),
    onSuccess: (saved) => {
      const values = toMilestoneValues(saved);
      setMilestones(values);
      setSavedValues(JSON.stringify(toMilestonePlanPayload(values, 0).milestones));
      setLockVersion(saved.lockVersion);
      setDurationWeeks(saved.estimatedDurationWeeks);
      setSubmitError(null);
      setErrors({});
      onSaved(saved);
      toast.success("Milestone configuration saved successfully.");
    },
    onError: (error) => {
      const result = getTemplateError(error);
      setErrors(result.fields);
      setSubmitError(result);
    },
    onSettled: () => { submitting.current = false; },
  });
  const total = totalWeightHundredths(milestones);
  const disabled = !editable || mutation.isPending;
  const hasChanges = JSON.stringify(toMilestonePlanPayload(milestones, 0).milestones) !== savedValues;
  const removing = milestones.find((milestone) => milestone.key === removeKey);
  const rubricOptions = [...rubrics];
  plan.milestones.forEach((milestone) => {
    if (milestone.rubric && !rubricOptions.some((rubric) => rubric.id === milestone.rubric?.id)) rubricOptions.push(milestone.rubric);
  });

  const changeMilestone = (index: number, patch: Partial<MilestoneValues>) => {
    setMilestones((current) => current.map((milestone, position) => position === index ? { ...milestone, ...patch } : milestone));
    const paths = Object.keys(patch).map((field) => `milestones[${index}].${field}`);
    if ("dueUnit" in patch) paths.push(`milestones[${index}].dueAfter`);
    setErrors((current) => Object.fromEntries(Object.entries(current)
      .filter(([path]) => path !== "totalWeight" && !paths.some((changed) => path.startsWith(changed)))));
  };
  const moveMilestone = (index: number, direction: -1 | 1) => {
    const next = [...milestones];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setMilestones(next);
    setErrors({});
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !editable || !hasChanges) return;
    setSubmitError(null);
    const nextErrors = validateMilestonePlan(milestones, durationWeeks);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      requestAnimationFrame(() => document.getElementById(milestoneFieldId(firstError))?.focus());
      return;
    }
    submitting.current = true;
    mutation.mutate(toMilestonePlanPayload(milestones, lockVersion));
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={mutation.isPending} className="grid min-w-0 gap-4">
      {submitError && <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Unable to save milestones</AlertTitle>
        <AlertDescription>{submitError.message}</AlertDescription>
      </Alert>}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Flag className="size-5" />Milestone configuration</CardTitle>
              <CardDescription className="mt-2">Define delivery stages, assessment criteria and submission rules for this template.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {editable && <Button type="button" size="sm" variant="outline" disabled={refreshingRubrics || mutation.isPending}
                onClick={onRefreshRubrics}><RefreshCw className={refreshingRubrics ? "animate-spin" : undefined} />Refresh rubrics</Button>}
              <Badge variant="outline">{milestones.length} milestones</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent id={milestoneFieldId("totalWeight")} tabIndex={-1} className="grid gap-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Total milestone weight</span>
            <span className={total === 10000 ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-semibold"}>
              {total === null ? "—" : total / 100} / 100%
            </span>
          </div>
          <Progress value={total === null ? 0 : Math.min(total / 100, 100)} aria-label="Total milestone weight"
            className={errors.totalWeight ? "[&_[data-slot=progress-indicator]]:bg-destructive" : undefined} />
          <div aria-live="polite"><FieldError errors={errors.totalWeight} /></div>
          <p className="text-xs text-muted-foreground">Milestone weights must total 100% when you save.</p>
          <div id={milestoneFieldId("estimatedDurationWeeks")} tabIndex={-1} className="grid gap-2">
            {durationWeeks !== null && durationWeeks > 0 && <p className="text-sm text-muted-foreground">
              Template duration: {durationWeeks} weeks ({durationWeeks * 7} days). Each milestone must be due within this period.
            </p>}
            <div aria-live="polite"><FieldError errors={errors.estimatedDurationWeeks} /></div>
          </div>
        </CardContent>
      </Card>

      <div id={milestoneFieldId("milestones")} tabIndex={-1} className="grid min-w-0 gap-4">
        {(errors.milestones || errors.request || errors.lockVersion) && (
          <div aria-live="polite"><FieldError errors={errors.milestones ?? errors.request ?? errors.lockVersion} /></div>
        )}
        {!milestones.length && <div className="rounded-xl border border-dashed p-8 text-center">
          <Flag className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">No template milestones yet</p>
          <p className="mt-1 text-sm text-muted-foreground">{editable ? "Add the first delivery stage to get started." : "A milestone outline has not been configured."}</p>
        </div>}
        {milestones.map((milestone, index) => <TemplateMilestoneEditor
          key={milestone.key}
          milestone={milestone}
          index={index}
          count={milestones.length}
          disabled={disabled}
          editable={editable}
          errors={errors}
          rubrics={rubricOptions}
          onChange={(patch) => changeMilestone(index, patch)}
          onMove={(direction) => moveMilestone(index, direction)}
          onRemove={() => setRemoveKey(milestone.key)}
        />)}
      </div>
      {editable && <>
        <Button type="button" variant="outline" className="w-full border-dashed" disabled={disabled}
          onClick={() => { setMilestones((current) => [...current, newMilestone(current.length === 0)]); setErrors({}); }}>
          <Plus /> Add milestone
        </Button>
        <div className="flex justify-end rounded-xl border bg-background p-3">
          <Button type="submit" disabled={disabled || !hasChanges}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {mutation.isPending ? "Saving..." : "Save milestones"}
          </Button>
        </div>
      </>}
      <ConfirmDialog open={!!removing} title="Remove this milestone?"
        description={`Remove "${removing?.title.trim() || "New milestone"}" and its checklist from this outline? The change is applied when you save milestones.`}
        confirmLabel="Remove milestone"
        onCancel={() => setRemoveKey(null)}
        onConfirm={() => { setMilestones((current) => current.filter((item) => item.key !== removeKey)); setRemoveKey(null); setErrors({}); }} />
    </form>
  );
}
