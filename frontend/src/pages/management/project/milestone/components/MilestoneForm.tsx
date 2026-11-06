import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { Controller, type FieldErrors, type FieldPath, useForm, useWatch } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MilestoneApiError, MilestoneCreateOptions } from "@/types";
import { AlertCircle, AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ExternalLink, RefreshCw, Save } from "lucide-react";
import { MilestoneChecklistEditor } from "./MilestoneChecklistEditor";
import { MilestoneErrorSummary } from "./MilestoneErrorSummary";
import { MilestoneRubricSelector } from "./MilestoneRubricSelector";
import { MILESTONE_FORM_LIMITS, milestoneFormSchemaForTenant, tenantStartOfDay, tenantToday, type MilestoneFormValues } from "../milestone-form.schema";
import { formatTenantDateTime, toFormFieldPath } from "../milestone.utils";

interface MilestoneFormProps {
  options: MilestoneCreateOptions;
  defaultValues: MilestoneFormValues;
  submitting: boolean;
  apiError?: MilestoneApiError | null;
  networkUncertain?: boolean;
  onReloadOptions: () => void;
  reloadingOptions?: boolean;
  onSubmit: (values: MilestoneFormValues) => void;
  submitLabel?: string;
  isEditing?: boolean;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function FieldMessage({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="text-sm text-destructive">{message}</p> : null;
}

function fieldId(path: string): string {
  const checklist = /^checklist\.(\d+)/.exec(path);
  if (checklist) return `milestone-checklist-${checklist[1]}`;
  const ids: Record<string, string> = {
    title: "milestone-title", description: "milestone-description", startDate: "milestone-start-date",
    deadline: "milestone-deadline", rubricSnapshotId: "milestone-rubric",
    "latePolicy.lateUntil": "late-until", "latePolicy.penaltyPercent": "late-penalty",
    "resubmissionPolicy.maxAttempts": "max-submission-attempts",
  };
  return ids[path] ?? "milestone-settings-trigger";
}

function formErrorLinks(errors: FieldErrors<MilestoneFormValues>) {
  const links: Array<{ id: string; label: string; message: string }> = [];
  const add = (id: string, label: string, message?: string) => {
    if (message) links.push({ id, label, message });
  };
  add("milestone-title", "Milestone name", errors.title?.message);
  add("milestone-description", "Description", errors.description?.message);
  add("milestone-start-date", "Start date", errors.startDate?.message);
  add("milestone-deadline", "Deadline", errors.deadline?.message);
  add("milestone-checklist-0", "Acceptance checklist", errors.checklist?.message);
  errors.checklist?.forEach?.((item, index) => add(`milestone-checklist-${index}`, `Checklist item ${index + 1}`, item?.content?.message));
  add("milestone-rubric", "Evaluation rubric", errors.rubricSnapshotId?.message);
  add("milestone-settings-trigger", "Late submission policy", errors.latePolicy?.type?.message);
  add("max-submission-attempts", "Maximum submission attempts", errors.resubmissionPolicy?.maxAttempts?.message);
  add("late-until", "Accept until", errors.latePolicy?.lateUntil?.message);
  add("late-penalty", "Penalty", errors.latePolicy?.penaltyPercent?.message);
  return links;
}

export function MilestoneForm({
  options,
  defaultValues,
  submitting,
  apiError,
  networkUncertain,
  onReloadOptions,
  reloadingOptions = false,
  onSubmit,
  submitLabel,
  isEditing = false,
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
    trigger,
    formState: { errors, isDirty },
  } = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchemaForTenant(options.tenantTimeZone)),
    defaultValues,
    mode: "onBlur",
  });

  const values = useWatch({ control });
  const latePolicyType = useWatch({ control, name: "latePolicy.type" });
  const allowResubmission = useWatch({ control, name: "resubmissionPolicy.allowed" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showClientErrors, setShowClientErrors] = useState(false);

  const focusId = useCallback((id: string) => {
    if (["late-until", "late-penalty", "max-submission-attempts", "milestone-settings-trigger"].includes(id)) {
      setSettingsOpen(true);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus();
    }));
  }, []);

  const errorLinks = formErrorLinks(errors);
  const settingsExpanded = settingsOpen || !!errors.latePolicy || !!errors.resubmissionPolicy;

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
      if (/^checklist\.\d+$/.test(formPath)) formPath += ".content";
      if (/^checklist\.\d+\.orderIndex$/.test(formPath)) {
        formPath = formPath.replace(/\.orderIndex$/, ".content");
      }
      if (["idempotencyKey", "project", "teamId", "weight"].includes(formPath)) continue;

      const path = formPath as FieldPath<MilestoneFormValues>;
      setError(path, { type: "server", message: messages[0] });
      firstPath ??= path;
    }

    if (firstPath) focusId(fieldId(firstPath));
  }, [apiError, focusId, setError]);

  const selectLatePolicy = (type: "NO_LATE" | "ALLOW_LATE") => {
    setValue("latePolicy.type", type, { shouldDirty: true, shouldValidate: true });
    if (type === "NO_LATE") {
      setValue("latePolicy.lateUntil", undefined, { shouldDirty: true });
      setValue("latePolicy.penaltyPercent", undefined, { shouldDirty: true });
      clearErrors(["latePolicy.lateUntil", "latePolicy.penaltyPercent"]);
    }
  };

  const rubric = options.rubrics.find((item) => item.id === values.rubricSnapshotId);
  const hasMissingOptions = options.rubrics.length === 0;
  const now = new Date();
  const minimumDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  const tenantTomorrow = new Date(Date.parse(`${tenantToday(options.tenantTimeZone)}T00:00:00Z`) + 86400_000)
    .toISOString().slice(0, 10);
  const scheduledStart = tenantStartOfDay(values.startDate ?? "", options.tenantTimeZone);
  const deadlineInstant = values.deadline ? new Date(values.deadline) : null;
  const validDeadline = deadlineInstant && !Number.isNaN(deadlineInstant.getTime()) ? deadlineInstant : null;
  const lateUntilInstant = values.latePolicy?.lateUntil ? new Date(values.latePolicy.lateUntil) : null;
  const validLateUntil = lateUntilInstant && !Number.isNaN(lateUntilInstant.getTime()) ? lateUntilInstant : null;
  const validChecklistCount = values.checklist?.filter((item) => item?.content?.trim()).length ?? 0;
  const policySummary = `${latePolicyType === "ALLOW_LATE" ? "Late submissions allowed" : "No late submissions"} · ${allowResubmission ? (values.resubmissionPolicy?.maxAttempts ? `${values.resubmissionPolicy.maxAttempts} attempts` : "Unlimited attempts") : "No resubmissions"}`;
  const submitForm = handleSubmit(
    (formValues) => { setShowClientErrors(false); onSubmit(formValues); },
    (invalid) => {
      setShowClientErrors(true);
      const first = formErrorLinks(invalid)[0];
      if (first) focusId(first.id);
    },
  );

  return (
    <form onSubmit={submitForm} noValidate className="grid gap-6">
      {apiError ? <MilestoneErrorSummary error={apiError} networkUncertain={networkUncertain} /> : null}

      {showClientErrors && errorLinks.length > 0 ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>Review {errorLinks.length} field{errorLinks.length === 1 ? "" : "s"} before saving</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errorLinks.map(({ id, label, message }) => (
                <li key={`${id}-${message}`}>
                  <button type="button" className="text-left underline underline-offset-2" onClick={() => focusId(id)}>
                    {label}: {message}
                  </button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {hasMissingOptions ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Milestone cannot be {isEditing ? "saved" : "created"} yet</AlertTitle>
          <AlertDescription>
            <p>No eligible rubric is available. Create and publish one, then reload the options.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild type="button" size="sm" variant="outline"><a href="/rubrics" target="_blank" rel="noreferrer">Manage rubrics <ExternalLink className="size-4" /></a></Button>
              <Button type="button" size="sm" variant="outline" onClick={onReloadOptions} disabled={reloadingOptions}><RefreshCw className="size-4" /> {reloadingOptions ? "Reloading..." : "Reload options"}</Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>General information</CardTitle>
              <CardDescription>Describe what the team will deliver.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="milestone-title">Milestone name <span className="text-destructive">*</span></Label>
                  <span className="text-xs text-muted-foreground">{values.title?.length ?? 0}/{MILESTONE_FORM_LIMITS.title}</span>
                </div>
                <Input id="milestone-title" autoFocus required maxLength={MILESTONE_FORM_LIMITS.title} placeholder="For example: Sprint 1 Delivery" aria-invalid={!!errors.title} aria-describedby={errors.title ? "milestone-title-error" : undefined} {...register("title")} />
                <FieldMessage id="milestone-title-error" message={errors.title?.message} />
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
                  aria-describedby={errors.description ? "milestone-description-error" : undefined}
                  {...register("description")}
                />
                <FieldMessage id="milestone-description-error" message={errors.description?.message} />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>The milestone starts automatically at 00:00 in {options.tenantTimeZone}. Its start must be before the deadline.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="milestone-start-date">Start date <span className="text-destructive">*</span></Label>
                <Input id="milestone-start-date" type="date" required min={tenantTomorrow}
                  aria-invalid={!!errors.startDate} aria-describedby={`milestone-start-help${errors.startDate ? " milestone-start-error" : ""}`}
                  {...register("startDate")} />
                <p id="milestone-start-help" className="text-xs text-muted-foreground">Choose a future date in {options.tenantTimeZone}.</p>
                <FieldMessage id="milestone-start-error" message={errors.startDate?.message} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="milestone-deadline">Deadline <span className="text-destructive">*</span></Label>
                <Input id="milestone-deadline" type="datetime-local" required min={minimumDateTime}
                  aria-invalid={!!errors.deadline} aria-describedby={`milestone-deadline-help${errors.deadline ? " milestone-deadline-error" : ""}`}
                  {...register("deadline", { onBlur: () => void trigger(["startDate", "latePolicy.lateUntil"]) })} />
                <p id="milestone-deadline-help" className="text-xs text-muted-foreground">Enter in your device time zone; review the tenant time below.</p>
                <FieldMessage id="milestone-deadline-error" message={errors.deadline?.message} />
              </div>
              {scheduledStart && validDeadline ? (
                <p className="text-xs text-muted-foreground md:col-span-2">Tenant schedule: {formatTenantDateTime(scheduledStart.toISOString(), options.tenantTimeZone)} → {formatTenantDateTime(validDeadline.toISOString(), options.tenantTimeZone)}</p>
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
                triggerRef={field.ref}
                onChange={field.onChange}
              />
            )}
          />

          <Collapsible open={settingsExpanded} onOpenChange={setSettingsOpen}>
            <Card>
              <CardHeader>
                <CollapsibleTrigger asChild>
                  <button id="milestone-settings-trigger" type="button" className="w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <span className="flex items-center justify-between gap-3">
                      <CardTitle>Submission settings</CardTitle>
                      <ChevronDown className={`size-5 shrink-0 transition-transform ${settingsExpanded ? "rotate-180" : ""}`} />
                    </span>
                    <CardDescription className="mt-2">{policySummary}. Select to edit these settings.</CardDescription>
                  </button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="grid gap-6">
                  <div className="grid gap-4">
                    <h3 className="font-medium">Late submissions</h3>
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
                          <Input id="late-until" type="datetime-local" required min={values.deadline || minimumDateTime} aria-invalid={!!errors.latePolicy?.lateUntil} aria-describedby={errors.latePolicy?.lateUntil ? "late-until-error" : undefined} {...register("latePolicy.lateUntil")} />
                          <FieldMessage id="late-until-error" message={errors.latePolicy?.lateUntil?.message} />
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
                            aria-describedby={errors.latePolicy?.penaltyPercent ? "late-penalty-error" : undefined}
                            {...register("latePolicy.penaltyPercent", { setValueAs: (value) => value === "" ? undefined : Number(value) })}
                          />
                          <FieldMessage id="late-penalty-error" message={errors.latePolicy?.penaltyPercent?.message} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-4 border-t pt-5">
                    <h3 className="font-medium">Resubmissions</h3>
                    <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                      <div>
                        <Label htmlFor="allow-resubmission">Allow resubmission</Label>
                        <p className="mt-1 text-xs text-muted-foreground">Request Changes unlocks one new version at a time.</p>
                      </div>
                      <Controller control={control} name="resubmissionPolicy.allowed" render={({ field }) => (
                        <Switch id="allow-resubmission" checked={field.value} onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (!checked) {
                            setValue("resubmissionPolicy.maxAttempts", undefined, { shouldDirty: true });
                            clearErrors("resubmissionPolicy.maxAttempts");
                          } else if (!values.resubmissionPolicy?.maxAttempts) {
                            setValue("resubmissionPolicy.maxAttempts", 3, { shouldDirty: true });
                          }
                        }} />
                      )} />
                    </div>
                    {allowResubmission ? (
                      <div className="grid max-w-sm gap-2">
                        <Label htmlFor="max-submission-attempts">Maximum submission attempts</Label>
                        <Input id="max-submission-attempts" type="number" min="2" max="99" placeholder="Unlimited"
                          aria-invalid={!!errors.resubmissionPolicy?.maxAttempts}
                          aria-describedby={`max-submission-help${errors.resubmissionPolicy?.maxAttempts ? " max-submission-error" : ""}`}
                          {...register("resubmissionPolicy.maxAttempts", { setValueAs: (value) => value === "" ? undefined : Number(value) })} />
                        <p id="max-submission-help" className="text-xs text-muted-foreground">Includes the first submission. Leave blank for unlimited.</p>
                        <FieldMessage id="max-submission-error" message={errors.resubmissionPolicy?.maxAttempts?.message} />
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        <Card className="xl:sticky xl:top-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5" /> {isEditing ? "Review changes" : "Review milestone"}</CardTitle>
            <CardDescription>Check the schedule and submission rules before saving.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div><p className="text-muted-foreground">Scope</p><p className="mt-1 font-medium">{options.project?.name ?? "Team workspace"}</p></div>
            <div><p className="text-muted-foreground">Milestone</p><p className="mt-1 font-medium">{values.title?.trim() || "Not entered"}</p></div>
            <div><p className="text-muted-foreground">Starts automatically</p><p className="mt-1 flex items-start gap-2 font-medium"><CalendarClock className="mt-0.5 size-4 shrink-0" />{scheduledStart ? formatTenantDateTime(scheduledStart.toISOString(), options.tenantTimeZone) : "Not selected"}</p></div>
            <div><p className="text-muted-foreground">Deadline</p><p className="mt-1 font-medium">{validDeadline ? formatTenantDateTime(validDeadline.toISOString(), options.tenantTimeZone) : "Not selected"}</p></div>
            <div><p className="text-muted-foreground">Acceptance checklist</p><p className="mt-1 font-medium">{validChecklistCount} filled item{validChecklistCount === 1 ? "" : "s"}</p></div>
            <div><p className="text-muted-foreground">Evaluation rubric</p><p className="mt-1 font-medium">{rubric ? `${rubric.name} · ${rubric.version}` : "Not selected"}</p></div>
            <div><p className="text-muted-foreground">Submission settings</p><p className="mt-1 font-medium">{policySummary}</p>
              {latePolicyType === "ALLOW_LATE" ? <p className="mt-1 text-xs text-muted-foreground">Until {validLateUntil ? formatTenantDateTime(validLateUntil.toISOString(), options.tenantTimeZone) : "not set"} · {values.latePolicy?.penaltyPercent ?? "—"}% penalty</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-20 -mx-1 flex flex-col-reverse gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting || hasMissingOptions}>
          <Save className="size-4" /> {submitting ? "Saving..." : networkUncertain ? "Retry safely" : submitLabel ?? "Create milestone"}
        </Button>
      </div>

    </form>
  );
}
