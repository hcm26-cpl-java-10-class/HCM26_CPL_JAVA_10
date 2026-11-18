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
import { AlertCircle, ChevronRight, Flag, Loader2, PanelLeftClose, Plus, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
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
import { useTemplateDraft } from "../hooks/useTemplateDraft";
import { TemplateMilestoneEditor } from "./TemplateMilestoneEditor";

export function TemplateMilestonesForm({ plan, editable, rubrics, refreshingRubrics, onRefreshRubrics, onSaved, save }: {
  plan: TemplateMilestonePlan;
  editable: boolean;
  rubrics: MilestoneRubricOption[];
  refreshingRubrics: boolean;
  onRefreshRubrics: () => void;
  onSaved: (plan: TemplateMilestonePlan) => void;
  save?: (payload: TemplateMilestonePlanPayload) => Promise<TemplateMilestonePlan>;
}) {
  const weighted = plan.weightedMilestones !== false;
  const durationWeeks = plan.estimatedDurationWeeks;
  const formId = useId();
  const fieldId = useCallback((path: string) => `${formId}-${milestoneFieldId(path)}`, [formId]);
  const planValues = useMemo(() => toMilestoneValues(plan), [plan]);
  const { values: milestones, setValues: setMilestones, hasChanges, lockVersion, acceptSaved } = useTemplateDraft(
    planValues, plan.lockVersion, values => JSON.stringify(toMilestonePlanPayload(values, 0, weighted).milestones),
  );
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<MilestonePlanErrors>({});
  const [submitError, setSubmitError] = useState<ReturnType<typeof getTemplateError> | null>(null);
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const focusError = useRef<string | null>(null);
  const submitting = useRef(false);
  const activeIndex = milestones.findIndex(milestone => milestone.key === activeKey);
  const activeMilestone = milestones[activeIndex];

  function showErrors(nextErrors: MilestonePlanErrors) {
    const firstError = Object.keys(nextErrors)[0];
    const index = firstError?.match(/^milestones\[(\d+)\]/)?.[1];
    const invalidMilestone = index == null ? undefined : milestones[Number(index)];
    if (invalidMilestone) setActiveKey(invalidMilestone.key);
    focusError.current = firstError ?? null;
    setErrors(nextErrors);
  }

  useEffect(() => {
    if (!focusError.current) return;
    const target = document.getElementById(fieldId(focusError.current)) ?? editor.current;
    target?.focus();
    focusError.current = null;
  }, [errors, fieldId]);

  const mutation = useMutation({
    mutationFn: (payload: TemplateMilestonePlanPayload) => save ? save(payload) : projectTemplateApi.saveMilestones(plan.templateId, payload),
    onSuccess: (saved) => {
      acceptSaved(toMilestoneValues(saved), saved.lockVersion);
      setActiveKey(null);
      setSubmitError(null);
      setErrors({});
      onSaved(saved);
      toast.success("Milestone configuration saved successfully.");
    },
    onError: (error) => {
      const result = getTemplateError(error);
      showErrors(result.fields);
      setSubmitError(result);
    },
    onSettled: () => { submitting.current = false; },
  });
  const total = totalWeightHundredths(milestones);
  const weightOverflow = total > 10000;
  const canEdit = editable && plan.editable;
  const disabled = !canEdit || mutation.isPending;
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
  const openMilestone = (key: string) => {
    setActiveKey(key);
    requestAnimationFrame(() => editor.current?.scrollIntoView({ block: "start" }));
  };
  const collapseMilestone = () => {
    setActiveKey(null);
    document.getElementById(fieldId("milestones"))?.focus();
  };
  const addMilestone = () => {
    const item = newMilestone(milestones.length === 0);
    setMilestones(current => [...current, weighted ? item : { ...item, weight: "", dueUnit: "DAYS" }]);
    setErrors({});
    openMilestone(item.key);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !canEdit || !hasChanges) return;
    setSubmitError(null);
    const nextErrors = validateMilestonePlan(milestones, durationWeeks, weighted);
    if (Object.keys(nextErrors).length) {
      showErrors(nextErrors);
      return;
    }
    setErrors({});
    submitting.current = true;
    mutation.mutate(toMilestonePlanPayload(milestones, lockVersion, weighted));
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={mutation.isPending} className="grid min-w-0 gap-4">
      {submitError && <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Unable to save milestones</AlertTitle>
        <AlertDescription>{submitError.message}</AlertDescription>
      </Alert>}
      <Card className="overflow-hidden pt-0">
        <CardHeader className="border-b bg-indigo-50/50 pt-5 dark:bg-indigo-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Flag className="size-5 text-indigo-600 dark:text-indigo-400" />{weighted ? "Master milestone configuration" : "Module milestone configuration"}</CardTitle>
              <CardDescription className="mt-2">{weighted
                ? "Stages for the Master project. Class mentors manage them at class level in split assignments."
                : "Stages for this module. The assigned team works on them in the module workspace."}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {editable && <Button type="button" size="sm" variant="outline" disabled={refreshingRubrics || mutation.isPending}
                onClick={onRefreshRubrics}><RefreshCw className={refreshingRubrics ? "animate-spin" : undefined} />Refresh rubrics</Button>}
              <Badge variant="outline">{milestones.length} {milestones.length === 1 ? "milestone" : "milestones"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent id={fieldId("totalWeight")} tabIndex={-1} className="grid gap-3">
          {weighted && <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Total milestone weight</span>
            <span className={weightOverflow ? "font-semibold text-destructive"
              : total === 10000 ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-semibold"}>
              {total / 100} / 100%
            </span>
          </div>
          <Progress value={Math.min(total / 100, 100)} aria-label="Total milestone weight" aria-valuetext={`${total / 100}%`}
            className={weightOverflow || errors.totalWeight ? "[&_[data-slot=progress-indicator]]:bg-destructive"
              : total === 10000 ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
              : "[&_[data-slot=progress-indicator]]:bg-indigo-500"} />
          <div aria-live="polite"><FieldError errors={weightOverflow ? ["Total milestone weight exceeds 100%."] : errors.totalWeight} /></div>
          <p className="text-xs text-muted-foreground">Milestone weights must total 100% when you save.</p>
          </>}
          <div id={fieldId("estimatedDurationWeeks")} tabIndex={-1} className="grid gap-2">
            {durationWeeks !== null && durationWeeks > 0 && <p className="text-sm text-muted-foreground">
              Template duration: {durationWeeks} weeks ({durationWeeks * 7} days). Each milestone must be due within this period.
            </p>}
            <div aria-live="polite"><FieldError errors={errors.estimatedDurationWeeks} /></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <Card id={fieldId("milestones")} tabIndex={-1} className="gap-3 xl:sticky xl:top-4">
          <CardHeader className="px-4"><CardTitle className="text-base">Milestone list</CardTitle>
            <CardDescription>Select a milestone to open its configuration.</CardDescription></CardHeader>
          <CardContent className="grid min-w-0 gap-3 px-4">
            {(errors.milestones || errors.request || errors.lockVersion) && (
              <div aria-live="polite"><FieldError errors={errors.milestones ?? errors.request ?? errors.lockVersion} /></div>
            )}
            {milestones.length > 0 && <ol className="grid max-h-[45vh] gap-2 overflow-y-auto p-0.5">
              {milestones.map((milestone, index) => {
                const selected = milestone.key === activeKey;
                const path = `milestones[${index}]`;
                const invalid = Object.keys(errors).some(field => field === path || field.startsWith(`${path}.`));
                return <li key={milestone.key}>
                  <button type="button" aria-expanded={selected} aria-controls={fieldId("editor")}
                    className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/60" : "hover:bg-muted/40"}`}
                    onClick={() => selected ? collapseMilestone() : openMilestone(milestone.key)}>
                    <span className="shrink-0 font-medium text-muted-foreground">{index + 1}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium">{milestone.title.trim() || "New milestone"}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {milestone.mandatory ? "Required" : "Optional"}
                        {milestone.dueAfter && ` · ${milestone.dueAfter} ${milestone.dueUnit.toLowerCase()}`}
                        {weighted && milestone.weight && ` · ${milestone.weight}%`}
                      </span>
                      {invalid && <span className="mt-1 block text-xs text-destructive">Check configuration</span>}
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>;
              })}
            </ol>}
            {canEdit && <>
              <Button type="button" variant="outline" className="border-dashed" disabled={disabled} onClick={addMilestone}>
                <Plus /> Add milestone
              </Button>
              <Button type="submit" disabled={disabled || !hasChanges}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                {mutation.isPending ? "Saving..." : "Save milestones"}
              </Button>
              {hasChanges && <p className="text-xs text-muted-foreground" role="status">Unsaved changes</p>}
            </>}
          </CardContent>
        </Card>
        <div ref={editor} id={fieldId("editor")} tabIndex={-1} className="grid min-w-0 gap-3 scroll-mt-4">
          {activeMilestone ? <>
            <TemplateMilestoneEditor key={activeMilestone.key} milestone={activeMilestone} index={activeIndex}
              count={milestones.length} disabled={disabled} editable={canEdit} weighted={weighted} errors={errors} rubrics={rubricOptions} fieldId={fieldId}
              onChange={patch => changeMilestone(activeIndex, patch)}
              onMove={direction => moveMilestone(activeIndex, direction)} onRemove={() => setRemoveKey(activeMilestone.key)}
              onCollapse={collapseMilestone} />
            <Button type="button" variant="outline" className="w-fit justify-self-end" onClick={collapseMilestone}>
              <PanelLeftClose /> Back to milestone list
            </Button>
          </> : <div className="rounded-xl border border-dashed p-8 text-center">
            <Flag className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">{milestones.length ? "Select a milestone" : "No template milestones yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{milestones.length ? "Open a milestone from the list to see its details."
              : canEdit ? "Add the first delivery stage to get started." : "A milestone outline has not been configured."}</p>
          </div>}
        </div>
      </div>
      <ConfirmDialog open={!!removing} title="Remove this milestone?"
        description={`Remove "${removing?.title.trim() || "New milestone"}" and its checklist from this outline? The change is applied when you save milestones.`}
        confirmLabel="Remove milestone"
        onCancel={() => setRemoveKey(null)}
        onConfirm={() => {
          setMilestones(current => current.filter(item => item.key !== removeKey));
          if (removeKey === activeKey) collapseMilestone();
          setRemoveKey(null);
          setErrors({});
        }} />
    </form>
  );
}
