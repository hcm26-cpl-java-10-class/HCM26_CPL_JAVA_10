import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, type FieldPath, useForm, useWatch } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MilestoneApiError, MilestoneCreateOptions } from "@/types";
import { AlertTriangle, CalendarClock, CheckCircle2, Save } from "lucide-react";
import { MilestoneChecklistEditor } from "./MilestoneChecklistEditor";
import { MilestoneErrorSummary } from "./MilestoneErrorSummary";
import { getMilestoneRubricMetrics, MilestoneRubricSelector } from "./MilestoneRubricSelector";
import { MILESTONE_FORM_LIMITS, milestoneFormSchema, type MilestoneFormValues } from "../milestone-form.schema";
import { toFormFieldPath } from "../milestone.utils";

interface MilestoneFormProps {
  options: MilestoneCreateOptions;
  defaultValues: MilestoneFormValues;
  submitting: boolean;
  apiError?: MilestoneApiError | null;
  networkUncertain?: boolean;
  onSubmit: (values: MilestoneFormValues) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function FieldMessage({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

export function MilestoneForm({
  options,
  defaultValues,
  submitting,
  apiError,
  networkUncertain,
  onSubmit,
  onCancel,
  onDirtyChange,
}: MilestoneFormProps) {
  const {
    control,
    register,
    handleSubmit,
    clearErrors,
    setError,
    setFocus,
    setValue,
    formState: { errors, isDirty },
  } = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  const values = useWatch({ control });
  const latePolicyType = useWatch({ control, name: "latePolicy.type" });
  const allowResubmission = useWatch({ control, name: "resubmissionPolicy.allowed" });

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!options.rubrics.some((item) => item.id === values.rubricSnapshotId)) {
      setValue("rubricSnapshotId", options.rubrics.length === 1 ? options.rubrics[0].id : "", {
        shouldDirty: !!values.rubricSnapshotId,
      });
    }
  }, [options.rubrics, setValue, values.rubricSnapshotId]);

  useEffect(() => {
    const serverErrors = apiError?.errors;
    if (!serverErrors) return;

    let firstPath: FieldPath<MilestoneFormValues> | null = null;
    for (const [serverPath, messages] of Object.entries(serverErrors)) {
      let formPath = toFormFieldPath(serverPath);
      if (formPath.startsWith("rubric.")) formPath = "rubricSnapshotId";
      if (formPath === "checklist") formPath = "checklist.0.content";
      if (/^checklist\.\d+\.orderIndex$/.test(formPath)) {
        formPath = formPath.replace(/\.orderIndex$/, ".content");
      }
      if (formPath === "idempotencyKey" || formPath === "project") continue;

      const path = formPath as FieldPath<MilestoneFormValues>;
      setError(path, { type: "server", message: messages[0] });
      firstPath ??= path;
    }

    if (firstPath) {
      requestAnimationFrame(() => setFocus(firstPath as FieldPath<MilestoneFormValues>));
    }
  }, [apiError, setError, setFocus]);

  const selectLatePolicy = (type: "NO_LATE" | "ALLOW_LATE") => {
    setValue("latePolicy.type", type, { shouldDirty: true, shouldValidate: true });
    if (type === "NO_LATE") {
      setValue("latePolicy.lateUntil", undefined, { shouldDirty: true });
      setValue("latePolicy.penaltyPercent", undefined, { shouldDirty: true });
      clearErrors(["latePolicy.lateUntil", "latePolicy.penaltyPercent"]);
    }
  };

  const rubric = options.rubrics.find((item) => item.id === values.rubricSnapshotId);
  const rubricMetrics = getMilestoneRubricMetrics(rubric);
  const hasMissingOptions = options.rubrics.length === 0;
  const now = new Date();
  const minimumDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6">
      {apiError ? <MilestoneErrorSummary error={apiError} networkUncertain={networkUncertain} /> : null}

      {hasMissingOptions ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Milestone cannot be created yet</AlertTitle>
          <AlertDescription>
            {!options.rubrics.length ? <p>This project has no eligible rubric.</p> : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>General information</CardTitle>
              <CardDescription>Define the delivery milestone and its deadline.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="milestone-title">Milestone name <span className="text-destructive">*</span></Label>
                  <span className="text-xs text-muted-foreground">{values.title?.length ?? 0}/{MILESTONE_FORM_LIMITS.title}</span>
                </div>
                <Input id="milestone-title" autoFocus required maxLength={MILESTONE_FORM_LIMITS.title} placeholder="For example: Sprint 1 Delivery" aria-invalid={!!errors.title} {...register("title")} />
                <FieldMessage message={errors.title?.message} />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="milestone-description">Description</Label>
                  <span className="text-xs text-muted-foreground">{values.description?.length ?? 0}/{MILESTONE_FORM_LIMITS.description.toLocaleString("en-US")}</span>
                </div>
                <Textarea
                  id="milestone-description"
                  rows={4}
                  maxLength={MILESTONE_FORM_LIMITS.description}
                  className="h-32 min-h-32 max-h-32 resize-none overflow-y-auto !field-sizing-fixed"
                  placeholder="Describe the expected deliverables and outcome"
                  aria-invalid={!!errors.description}
                  {...register("description")}
                />
                <FieldMessage message={errors.description?.message} />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="milestone-deadline">Deadline <span className="text-destructive">*</span></Label>
                  <Input id="milestone-deadline" type="datetime-local" required min={minimumDateTime} aria-invalid={!!errors.deadline} {...register("deadline")} />
                  <p className="text-xs text-muted-foreground">Uses your device time zone. The server validates it again when you submit.</p>
                  <FieldMessage message={errors.deadline?.message} />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                  <div>
                    <Label htmlFor="milestone-mandatory">Mandatory milestone</Label>
                    <p className="mt-1 text-xs text-muted-foreground">The team must complete this milestone in the project.</p>
                  </div>
                  <Controller control={control} name="mandatory" render={({ field }) => (
                    <Switch id="milestone-mandatory" checked={field.value} onCheckedChange={field.onChange} />
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resubmission policy</CardTitle>
              <CardDescription>Control whether a reviewer can request a corrected version.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                <div>
                  <Label htmlFor="allow-resubmission">Allow resubmission</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Request Changes will unlock exactly one new immutable version at a time.</p>
                </div>
                <Controller control={control} name="resubmissionPolicy.allowed" render={({ field }) => (
                  <Switch
                    id="allow-resubmission"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      if (!checked) {
                        setValue("resubmissionPolicy.maxAttempts", undefined, { shouldDirty: true });
                        clearErrors("resubmissionPolicy.maxAttempts");
                      } else if (!values.resubmissionPolicy?.maxAttempts) {
                        setValue("resubmissionPolicy.maxAttempts", 3, { shouldDirty: true });
                      }
                    }}
                  />
                )} />
              </div>
              {allowResubmission ? (
                <div className="grid max-w-sm gap-2">
                  <Label htmlFor="max-submission-attempts">Maximum submission attempts</Label>
                  <Input
                    id="max-submission-attempts"
                    type="number"
                    min="2"
                    max="99"
                    placeholder="Unlimited"
                    aria-invalid={!!errors.resubmissionPolicy?.maxAttempts}
                    {...register("resubmissionPolicy.maxAttempts", { setValueAs: (value) => value === "" ? undefined : Number(value) })}
                  />
                  <p className="text-xs text-muted-foreground">Includes the first submission. For example, 3 means versions 1–3; leave blank for unlimited.</p>
                  <FieldMessage message={errors.resubmissionPolicy?.maxAttempts?.message} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <MilestoneChecklistEditor
            control={control}
            errors={errors}
            register={register}
            setFocus={setFocus}
            submitting={submitting}
          />

          <Controller
            control={control}
            name="rubricSnapshotId"
            render={({ field }) => (
              <MilestoneRubricSelector
                rubrics={options.rubrics}
                value={field.value}
                error={errors.rubricSnapshotId?.message}
                disabled={submitting}
                onChange={field.onChange}
              />
            )}
          />

          <Card>
            <CardHeader>
              <CardTitle>Late submission policy</CardTitle>
              <CardDescription>Choose whether submissions are accepted after the deadline.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <RadioGroup value={latePolicyType} onValueChange={(value) => selectLatePolicy(value as "NO_LATE" | "ALLOW_LATE")} className="grid gap-3 md:grid-cols-2">
                <Label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="NO_LATE" />
                  <span><span className="block font-medium">No late submissions</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Submissions after the deadline will be rejected.</span></span>
                </Label>
                <Label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="ALLOW_LATE" />
                  <span><span className="block font-medium">Allow late submissions</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Accept submissions until a limit and apply a penalty.</span></span>
                </Label>
              </RadioGroup>

              {latePolicyType === "ALLOW_LATE" ? (
                <div className="grid gap-5 rounded-xl border bg-muted/20 p-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="late-until">Accept until <span className="text-destructive">*</span></Label>
                    <Input id="late-until" type="datetime-local" required min={values.deadline || minimumDateTime} aria-invalid={!!errors.latePolicy?.lateUntil} {...register("latePolicy.lateUntil")} />
                    <FieldMessage message={errors.latePolicy?.lateUntil?.message} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="late-penalty">Penalty (%) <span className="text-destructive">*</span></Label>
                    <Input
                      id="late-penalty"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      placeholder="For example: 10"
                      aria-invalid={!!errors.latePolicy?.penaltyPercent}
                      {...register("latePolicy.penaltyPercent", { setValueAs: (value) => value === "" ? undefined : Number(value) })}
                    />
                    <FieldMessage message={errors.latePolicy?.penaltyPercent?.message} />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5" /> Summary</CardTitle>
            <CardDescription>Review the milestone before creating it.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div><p className="text-muted-foreground">Project</p><p className="mt-1 font-medium">{options.project.name}</p></div>
            <div><p className="text-muted-foreground">Milestone</p><p className="mt-1 font-medium">{values.title?.trim() || "Not entered"}</p></div>
            <div><p className="text-muted-foreground">Deadline</p><p className="mt-1 flex items-center gap-2 font-medium"><CalendarClock className="size-4" />{values.deadline ? new Date(values.deadline).toLocaleString("en-GB") : "Not selected"}</p></div>
            <div><p className="text-muted-foreground">Checklist</p><p className="mt-1 font-medium">{values.checklist?.length ?? 0} item(s)</p></div>
            <div>
              <p className="text-muted-foreground">Rubric</p>
              <p className="mt-1 font-medium">{rubric ? `${rubric.name} · ${rubric.version}` : "Not selected"}</p>
              {rubric ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {rubricMetrics.criteriaCount} criteria · {rubricMetrics.totalMaxScore} maximum score
                </p>
              ) : null}
            </div>
            <div><p className="text-muted-foreground">Late submissions</p><Badge variant="secondary" className="mt-1">{latePolicyType === "ALLOW_LATE" ? "Allowed" : "Not allowed"}</Badge></div>
            <div><p className="text-muted-foreground">Resubmissions</p><Badge variant="secondary" className="mt-1">{allowResubmission ? (values.resubmissionPolicy?.maxAttempts ? `Up to ${values.resubmissionPolicy.maxAttempts} attempts` : "Unlimited attempts") : "Not allowed"}</Badge></div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-20 -mx-1 flex flex-col-reverse gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting || hasMissingOptions}>
          <Save className="size-4" /> {submitting ? "Creating..." : networkUncertain ? "Retry safely" : "Create milestone"}
        </Button>
      </div>

    </form>
  );
}
