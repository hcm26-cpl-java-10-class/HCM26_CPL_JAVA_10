import { projectTemplateApi } from "@/api/features/project-template.api";
import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectTemplateDTO, ProjectTemplateOptions, ProjectTemplatePayload } from "@/types/features/project-template";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, FileText, Loader2, Save } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { getTemplateError, templateDescriptionCount, toTemplateFormValues, validateTemplateForm,
  maxDescriptionLength, maxTemplateCodeNameLength,
  type TemplateFieldErrors, type TemplateFormValues } from "../project-template.utils";
import { ProjectTemplateStatusBadge } from "./ProjectTemplateStatusBadge";
import { useTemplateDraft } from "../hooks/useTemplateDraft";

function TemplateField({ name, label, errors, suffix, children, required = true }: {
  name: string;
  label: string;
  errors?: string[];
  suffix?: ReactNode;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="grid min-w-0 content-start gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={`template-${name}`}>{label} {required && <span className="text-destructive">*</span>}</Label>
        {suffix}
      </div>
      {children}
      <div id={`template-${name}-error`} aria-live="polite"><FieldError errors={errors} /></div>
    </div>
  );
}

export function ProjectTemplateForm({ template, parentTemplate, options, minimumDurationWeeks = 0, onCancel, onSaved, save }: {
  template?: ProjectTemplateDTO;
  parentTemplate?: ProjectTemplateDTO;
  options: ProjectTemplateOptions;
  minimumDurationWeeks?: number;
  onCancel: () => void;
  onSaved: (template: ProjectTemplateDTO) => void;
  save?: (payload: ProjectTemplatePayload) => Promise<ProjectTemplateDTO>;
}) {
  const queryClient = useQueryClient();
  const { values, setValues, lockVersion } = useTemplateDraft({ ...toTemplateFormValues(template),
    ...(!template && parentTemplate ? { category: parentTemplate.category, level: parentTemplate.level,
      estimatedDurationWeeks: String(parentTemplate.estimatedDurationWeeks) } : {}) }, template?.lockVersion ?? 0);
  const module = template?.parentTemplateId != null || parentTemplate != null;
  const descriptionLength = values.description.length;
  const categories = [...new Set([...options.categories, ...[template?.category, parentTemplate?.category]
    .filter((value): value is string => !!value)])];
  const levels = [...(options.levels ?? [])];
  const savedLevel = template?.level ?? parentTemplate?.level;
  if (savedLevel && !levels.some(({ value }) => value === savedLevel)) levels.push({ value: savedLevel, label: savedLevel });
  const [errors, setErrors] = useState<TemplateFieldErrors>({});
  const [submitError, setSubmitError] = useState<ReturnType<typeof getTemplateError> | null>(null);
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: (payload: ProjectTemplatePayload) => save ? save(payload) : template
      ? projectTemplateApi.update(template.id, payload) : projectTemplateApi.create(payload),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["project-templates"] });
      if (!save) void queryClient.invalidateQueries({ queryKey: ["project-template-versions"] });
      toast.success(template ? "Template updated successfully." : "Template draft created successfully.");
      onSaved(saved);
    },
    onError: (error) => {
      const result = getTemplateError(error);
      setErrors(result.fields);
      setSubmitError(result);
    },
    onSettled: () => { submitting.current = false; },
  });
  const change = <K extends keyof TemplateFormValues>(field: K, value: TemplateFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setSubmitError(null);
    const nextErrors = validateTemplateForm(values, minimumDurationWeeks);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => document.getElementById(`template-${Object.keys(nextErrors)[0]}`)?.focus());
      return;
    }
    submitting.current = true;
    mutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description.trim(),
      ...(template?.parentTemplateId || parentTemplate?.id ? { parentTemplateId: template?.parentTemplateId ?? parentTemplate?.id } : {}),
      category: values.category.trim(),
      level: values.level.trim(),
      estimatedDurationWeeks: Number(values.estimatedDurationWeeks),
      ...(template ? { lockVersion } : {}),
    });
  };
  const inputProps = (field: keyof TemplateFormValues, limit?: number) => ({
    id: `template-${field}`,
    maxLength: limit,
    "aria-invalid": !!errors[field]?.length || limit != null && values[field].length > limit,
    "aria-describedby": `template-${field}-error${limit != null ? ` template-${field}-count` : ""}`,
  });
  const codeNameCount = (field: "code" | "name") => (
    <span id={`template-${field}-count`} className={`text-xs tabular-nums ${values[field].length > maxTemplateCodeNameLength ? "text-destructive" : "text-muted-foreground"}`}>
      {values[field].length} / {maxTemplateCodeNameLength} characters
    </span>
  );

  return (
    <form onSubmit={submit} noValidate aria-busy={mutation.isPending} className="grid min-w-0 grid-cols-1 gap-5">
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Unable to save template</AlertTitle>
          <AlertDescription>{submitError.message}</AlertDescription>
        </Alert>
      )}
      <fieldset disabled={mutation.isPending} className="min-w-0">
        <Card className="min-w-0 overflow-hidden pt-0">
          <CardHeader className="border-b bg-indigo-50/50 pt-5 dark:bg-indigo-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2"><FileText className="size-5 text-indigo-600 dark:text-indigo-400" />General information</CardTitle>
                <CardDescription className="mt-1">Define the project brief, category and expected duration.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2"><ProjectTemplateStatusBadge status="DRAFT" /><Badge variant="outline">Version {template?.templateVersion ?? 1}</Badge></div>
            </div>
          </CardHeader>
          <CardContent className="grid min-w-0 grid-cols-1 gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <TemplateField name="code" label="Code" errors={errors.code} suffix={codeNameCount("code")}>
                <Input {...inputProps("code", maxTemplateCodeNameLength)} value={values.code} onChange={(event) => change("code", event.target.value)} placeholder="E.g. PRJ-WEB-01" autoComplete="off" />
                <p className="text-xs text-muted-foreground">{template?.parentTemplateId || parentTemplate
                  ? "Unique within the parent template."
                  : `Unique for this version in ${options.tenantName}.`}</p>
              </TemplateField>
              <TemplateField name="name" label="Name" errors={errors.name} suffix={codeNameCount("name")}>
                <Input {...inputProps("name", maxTemplateCodeNameLength)} value={values.name} onChange={(event) => change("name", event.target.value)} placeholder="E.g. Learning Resource Portal" />
              </TemplateField>
            </div>
            <TemplateField name="description" label="Description" errors={errors.description} suffix={
              <span id="template-description-count" role="status"
                className={`text-xs tabular-nums ${descriptionLength > maxDescriptionLength ? "text-destructive" : "text-muted-foreground"}`}>
                {templateDescriptionCount(values.description)}
              </span>
            }>
              <Textarea {...inputProps("description", maxDescriptionLength)} rows={7} wrap="soft"
                className="min-w-0 max-w-full resize-y whitespace-pre-wrap [field-sizing:fixed] [overflow-wrap:anywhere]"
                value={values.description} onChange={(event) => change("description", event.target.value)}
                placeholder="Describe the project background, objectives and expected scope." />
            </TemplateField>
            <div className="grid gap-5 md:grid-cols-3">
              <TemplateField name="category" label="Domain / category" errors={errors.category}>
                <Select value={values.category} onValueChange={(value) => change("category", value)} disabled={module || mutation.isPending}>
                  <SelectTrigger {...inputProps("category")} className="w-full"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                </Select>
                {module && <p className="text-xs text-muted-foreground">Inherited from the master project.</p>}
              </TemplateField>
              <TemplateField name="level" label="Level" errors={errors.level}>
                <Select value={values.level} onValueChange={(value) => change("level", value)} disabled={mutation.isPending}>
                  <SelectTrigger {...inputProps("level")} className="w-full"><SelectValue placeholder="Select a level" /></SelectTrigger>
                  <SelectContent>{levels.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </TemplateField>
              <TemplateField name="estimatedDurationWeeks" label="Estimated duration (weeks)" errors={errors.estimatedDurationWeeks}>
                <Input {...inputProps("estimatedDurationWeeks")} inputMode="numeric" value={values.estimatedDurationWeeks}
                  onChange={(event) => change("estimatedDurationWeeks", event.target.value)} placeholder="E.g. 8" />
                {minimumDurationWeeks > 0 && <p className="text-xs text-muted-foreground">
                  Saved milestones require at least {minimumDurationWeeks} weeks. To use a shorter duration, update the milestone schedule first.
                </p>}
              </TemplateField>
            </div>
          </CardContent>
        </Card>
      </fieldset>
      <div className="flex flex-col-reverse gap-2 rounded-xl border bg-background p-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}><ArrowLeft /> Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          {mutation.isPending ? "Saving..." : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
