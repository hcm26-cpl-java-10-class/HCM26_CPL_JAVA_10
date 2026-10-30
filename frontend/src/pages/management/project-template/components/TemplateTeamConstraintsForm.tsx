import { projectTemplateApi } from "@/api/features/project-template.api";
import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  ProjectTemplateDTO,
  TemplateRoleQuotas,
  TemplateTeamConstraintsPayload,
} from "@/types/features/project-template";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Loader2, Save, Users } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { getTemplateError } from "../project-template.utils";
import {
  teamRoleTotal,
  templateTeamRoles,
  toTeamConstraintsValues,
  validateTeamConstraints,
  type TeamConstraintsErrors,
} from "../team-constraints.utils";

interface TemplateTeamConstraintsFormProps {
  template: ProjectTemplateDTO;
  editable: boolean;
  onSaved: (template: ProjectTemplateDTO) => void;
  save?: (payload: TemplateTeamConstraintsPayload) => Promise<ProjectTemplateDTO>;
}

export function TemplateTeamConstraintsForm({ template, editable, onSaved, save }: TemplateTeamConstraintsFormProps) {
  const [values, setValues] = useState(() => toTeamConstraintsValues(template.teamConstraints));
  const [savedValues, setSavedValues] = useState(values);
  const [lockVersion, setLockVersion] = useState(template.lockVersion);
  const [errors, setErrors] = useState<TeamConstraintsErrors>({});
  const [submitError, setSubmitError] = useState<ReturnType<typeof getTemplateError> | null>(null);
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: (payload: TemplateTeamConstraintsPayload) =>
      save ? save(payload) : projectTemplateApi.updateTeamConstraints(template.id, payload),
    onSuccess: (saved) => {
      const savedRules = toTeamConstraintsValues(saved.teamConstraints);
      setValues(savedRules);
      setSavedValues(savedRules);
      setLockVersion(saved.lockVersion);
      setErrors({});
      setSubmitError(null);
      onSaved(saved);
      toast.success("Team rules saved successfully.");
    },
    onError: (error) => {
      const result = getTemplateError(error);
      setErrors(result.fields);
      setSubmitError(result);
    },
    onSettled: () => { submitting.current = false; },
  });
  const canEdit = editable && template.status === "DRAFT" && !template.readOnly;
  const hasChanges = JSON.stringify(values) !== JSON.stringify(savedValues);
  const disabled = mutation.isPending || !canEdit;
  const total = teamRoleTotal(values);

  const changeSize = (field: "minMembers" | "maxMembers", value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, minMembers: undefined, maxMembers: undefined, roleQuotas: undefined }));
  };
  const changeRole = (role: keyof TemplateRoleQuotas, value: string) => {
    setValues((current) => ({ ...current, roleQuotas: { ...current.roleQuotas, [role]: value } }));
    setErrors((current) => ({ ...current, [`roleQuotas.${role}`]: undefined, roleQuotas: undefined }));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !canEdit || !hasChanges) return;
    setSubmitError(null);
    const nextErrors = validateTeamConstraints(values);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      requestAnimationFrame(() => document.getElementById(`team-${firstError.replaceAll(".", "-")}`)?.focus());
      return;
    }
    submitting.current = true;
    mutation.mutate({
      minMembers: Number(values.minMembers),
      maxMembers: Number(values.maxMembers),
      roleQuotas: {
        pm: Number(values.roleQuotas.pm),
        ba: Number(values.roleQuotas.ba),
        dev: Number(values.roleQuotas.dev),
        qa: Number(values.roleQuotas.qa),
      },
      allowMultiRole: values.allowMultiRole,
      lockVersion,
    });
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={mutation.isPending} className="grid gap-4">
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Unable to save team rules</AlertTitle>
          <AlertDescription>{submitError.message}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="size-5" />Team constraints</CardTitle>
              <CardDescription className="mt-2">Set team size, minimum role quotas and whether members can hold multiple roles.</CardDescription>
            </div>
            <Badge variant="outline">{template.teamConstraints ? "Configured" : "Not configured"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!canEdit && !template.teamConstraints ? (
            <p className="py-4 text-sm text-muted-foreground">Team constraints have not been configured.</p>
          ) : (
            <fieldset disabled={disabled} className="grid min-w-0 gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["minMembers", "Minimum members"],
                  ["maxMembers", "Maximum members"],
                ] as const).map(([field, label]) => (
                  <div key={field} className="grid content-start gap-2">
                    <Label htmlFor={`team-${field}`}>{label} <span className="text-destructive">*</span></Label>
                    <Input id={`team-${field}`} inputMode="numeric" value={values[field]}
                      onChange={(event) => changeSize(field, event.target.value)}
                      aria-invalid={!!errors[field]?.length} aria-describedby={`team-${field}-error`} />
                    <div id={`team-${field}-error`} aria-live="polite"><FieldError errors={errors[field]} /></div>
                  </div>
                ))}
              </div>

              <div id="team-roleQuotas" tabIndex={-1} className="grid gap-4 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium">Minimum role quotas</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Use 0 for roles that are not required.</p>
                  </div>
                  <Badge variant={errors.roleQuotas ? "destructive" : "secondary"}>
                    Total minimum: {total ?? "—"}
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {templateTeamRoles.map(({ key, label, name }) => {
                    const field = `roleQuotas.${key}`;
                    const inputId = `team-roleQuotas-${key}`;
                    return (
                      <div key={key} className="grid content-start gap-2">
                        <Label htmlFor={inputId}>{label} <span className="text-destructive">*</span></Label>
                        <p className="text-xs text-muted-foreground">{name}</p>
                        <Input id={inputId} inputMode="numeric" value={values.roleQuotas[key]}
                          onChange={(event) => changeRole(key, event.target.value)}
                          aria-invalid={!!errors[field]?.length || !!errors.roleQuotas?.length}
                          aria-describedby={`${inputId}-error team-roleQuotas-error`} />
                        <div id={`${inputId}-error`} aria-live="polite"><FieldError errors={errors[field]} /></div>
                      </div>
                    );
                  })}
                </div>
                <div id="team-roleQuotas-error" aria-live="polite"><FieldError errors={errors.roleQuotas} /></div>
                <p className="text-xs text-muted-foreground">Total minimum quotas must not exceed maximum members, including when multiple roles are allowed.</p>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="grid gap-2">
                  <Label htmlFor="team-allowMultiRole">Allow multiple roles per member</Label>
                  <p className="text-sm text-muted-foreground">A member can hold more than one role in the team.</p>
                  <div id="team-allowMultiRole-error" aria-live="polite"><FieldError errors={errors.allowMultiRole} /></div>
                </div>
                <Switch id="team-allowMultiRole" checked={values.allowMultiRole} disabled={disabled}
                  onCheckedChange={(checked) => setValues((current) => ({ ...current, allowMultiRole: checked }))}
                  aria-describedby="team-allowMultiRole-error" aria-invalid={!!errors.allowMultiRole?.length} />
              </div>
            </fieldset>
          )}
        </CardContent>
      </Card>
      {canEdit && (
        <div className="flex justify-end rounded-xl border bg-background p-3">
          <Button type="submit" disabled={disabled || !hasChanges}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {mutation.isPending ? "Saving..." : "Save team rules"}
          </Button>
        </div>
      )}
    </form>
  );
}
