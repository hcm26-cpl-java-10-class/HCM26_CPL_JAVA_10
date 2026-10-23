import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, type FieldPath, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MilestoneApiError, MilestoneCreateOptions } from "@/types";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { MilestoneErrorSummary } from "./MilestoneErrorSummary";
import { milestoneFormSchema, type MilestoneFormValues } from "../milestone-form.schema";
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

  const { fields, append, remove, move } = useFieldArray({ control, name: "checklist" });
  const values = useWatch({ control });
  const latePolicyType = useWatch({ control, name: "latePolicy.type" });

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!options.rubrics.some((item) => item.id === values.rubricSnapshotId)) {
      setValue("rubricSnapshotId", options.rubrics.length === 1 ? options.rubrics[0].id : "", {
        shouldDirty: !!values.rubricSnapshotId,
      });
    }
    if (!options.reviewers.some((item) => item.id === values.reviewerId)) {
      setValue("reviewerId", options.reviewers.length === 1 ? options.reviewers[0].id : "", {
        shouldDirty: !!values.reviewerId,
      });
    }
  }, [options.reviewers, options.rubrics, setValue, values.reviewerId, values.rubricSnapshotId]);

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

  const addChecklistItem = () => {
    if (fields.length >= 100) return;
    append({ content: "", mandatory: true });
    requestAnimationFrame(() => setFocus(`checklist.${fields.length}.content`));
  };

  const selectLatePolicy = (type: "NO_LATE" | "ALLOW_LATE") => {
    setValue("latePolicy.type", type, { shouldDirty: true, shouldValidate: true });
    if (type === "NO_LATE") {
      setValue("latePolicy.lateUntil", undefined, { shouldDirty: true });
      setValue("latePolicy.penaltyPercent", undefined, { shouldDirty: true });
      clearErrors(["latePolicy.lateUntil", "latePolicy.penaltyPercent"]);
    }
  };

  const rubric = options.rubrics.find((item) => item.id === values.rubricSnapshotId);
  const reviewer = options.reviewers.find((item) => item.id === values.reviewerId);
  const hasMissingOptions = options.rubrics.length === 0 || options.reviewers.length === 0;
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
            {!options.reviewers.length ? <p>This project has no eligible reviewer.</p> : null}
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
                  <span className="text-xs text-muted-foreground">{values.title?.length ?? 0}/120</span>
                </div>
                <Input id="milestone-title" autoFocus required maxLength={120} placeholder="For example: Sprint 1 Delivery" aria-invalid={!!errors.title} {...register("title")} />
                <FieldMessage message={errors.title?.message} />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="milestone-description">Description</Label>
                  <span className="text-xs text-muted-foreground">{values.description?.length ?? 0}/1,000</span>
                </div>
                <Textarea
                  id="milestone-description"
                  rows={4}
                  maxLength={1000}
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
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Acceptance checklist</CardTitle>
                <CardDescription className="mt-1">Conditions the team must satisfy for delivery acceptance.</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addChecklistItem} disabled={fields.length >= 100 || submitting}>
                <Plus className="size-4" /> Add item
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-start">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</div>
                  <div className="grid min-w-0 gap-2">
                    <Input
                      required
                      maxLength={500}
                      placeholder={`Acceptance condition ${index + 1}`}
                      aria-label={`Checklist item ${index + 1}`}
                      aria-invalid={!!errors.checklist?.[index]?.content}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && index === fields.length - 1 && fields.length < 100) {
                          event.preventDefault();
                          addChecklistItem();
                        }
                      }}
                      {...register(`checklist.${index}.content`)}
                    />
                    <Controller control={control} name={`checklist.${index}.mandatory`} render={({ field: itemField }) => (
                      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox checked={itemField.value} onCheckedChange={(checked) => itemField.onChange(checked === true)} />
                        Mandatory
                      </label>
                    )} />
                    <FieldMessage message={errors.checklist?.[index]?.content?.message} />
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0 || submitting} onClick={() => move(index, index - 1)}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === fields.length - 1 || submitting} onClick={() => move(index, index + 1)}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Delete item" disabled={fields.length === 1 || submitting} onClick={() => remove(index)}><Trash2 /></Button>
                  </div>
                </div>
              ))}
              <FieldMessage message={typeof errors.checklist?.message === "string" ? errors.checklist.message : undefined} />
              <p className="text-xs text-muted-foreground">Press Enter in the last item to add another. Maximum 100 items.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acceptance settings</CardTitle>
              <CardDescription>Select the rubric version and responsible reviewer.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Rubric <span className="text-destructive">*</span></Label>
                <Controller control={control} name="rubricSnapshotId" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!options.rubrics.length}>
                    <SelectTrigger aria-invalid={!!errors.rubricSnapshotId}><SelectValue placeholder="Select a rubric version" /></SelectTrigger>
                    <SelectContent>{options.rubrics.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.version}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                <FieldMessage message={errors.rubricSnapshotId?.message} />
              </div>
              <div className="grid gap-2">
                <Label>Reviewer <span className="text-destructive">*</span></Label>
                <Controller control={control} name="reviewerId" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!options.reviewers.length}>
                    <SelectTrigger aria-invalid={!!errors.reviewerId}><SelectValue placeholder="Select a reviewer" /></SelectTrigger>
                    <SelectContent>{options.reviewers.map((item) => <SelectItem key={item.id} value={item.id}>{item.displayName}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                <FieldMessage message={errors.reviewerId?.message} />
              </div>
            </CardContent>
          </Card>

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
            <div><p className="text-muted-foreground">Checklist</p><p className="mt-1 font-medium">{fields.length} item(s)</p></div>
            <div><p className="text-muted-foreground">Rubric</p><p className="mt-1 font-medium">{rubric ? `${rubric.name} · ${rubric.version}` : "Not selected"}</p></div>
            <div><p className="text-muted-foreground">Reviewer</p><p className="mt-1 font-medium">{reviewer?.displayName || "Not selected"}</p></div>
            <div><p className="text-muted-foreground">Late submissions</p><Badge variant="secondary" className="mt-1">{latePolicyType === "ALLOW_LATE" ? "Allowed" : "Not allowed"}</Badge></div>
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
