import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { classSetupApi } from "@/api/features/class-setup.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReferenceInput } from "./ReferenceInput";
import { parseRole, resolveText, trainerTextOptions } from "../assignment-text";
import { validateAssignmentForm, type AssignmentErrors, type AssignmentForm } from "../assignment-form";

function requestError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Unable to connect to the server. Check your connection before retrying.";
    if ([502, 503, 504].includes(error.response.status)) return "The shared data service is unavailable. Please try again.";
    if (error.response.status === 403) return "You do not have permission to create teaching assignments.";
    if (error.response.status === 409) return error.response.data?.message || "This assignment overlaps an existing assignment.";
    if (Object.keys(serverErrors(error)).length) return "Please correct the highlighted fields.";
    if (typeof error.response.data?.message === "string") return error.response.data.message;
  }
  return "Unable to complete the request. Please try again.";
}

function serverErrors(error: unknown): AssignmentErrors {
  if (!axios.isAxiosError(error)) return {};
  const fields: (keyof AssignmentForm)[] = ["classId", "programSubjectId", "trainerId", "role", "effectiveFrom", "effectiveTo"];
  const errors: AssignmentErrors = {};
  const response = error.response?.data?.errors;
  for (const field of fields) {
    const messages: unknown = response?.[field];
    if (Array.isArray(messages) && typeof messages[0] === "string") errors[field] = messages[0];
  }
  return errors;
}

function FieldError({ field, errors }: { field: keyof AssignmentForm; errors: AssignmentErrors }) {
  return errors[field] ? <p id={`create-${field}-error`} className="text-sm text-destructive">{errors[field]}</p> : null;
}

export function CreateAssignmentDialog({ initialClassId, onClose, onCreated }: {
  initialClassId?: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const [form, setForm] = useState<AssignmentForm>({
    classId: initialClassId ? String(initialClassId) : "", programSubjectId: "", trainerId: "",
    role: "MAIN", effectiveFrom: "", effectiveTo: "",
  });
  const [validationErrors, setValidationErrors] = useState<AssignmentErrors>({});
  const options = useQuery({
    queryKey: ["teaching-assignment-create-options"],
    queryFn: ({ signal }) => classSetupApi.getAssignmentCreateOptions(signal), retry: 1,
  });
  const classOptions = (options.data?.classes ?? []).map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}`, aliases: [item.code, item.name] }));
  const trainerOptions = trainerTextOptions(options.data?.trainers ?? []);
  const classId = resolveText(form.classId, classOptions) ?? "";
  const selectedClass = options.data?.classes.find((item) => String(item.id) === classId);
  const context = useQuery({
    queryKey: ["teaching-assignment-create-context", selectedClass?.id],
    queryFn: ({ signal }) => classSetupApi.getAssignmentCreateContext(selectedClass!.id, signal),
    enabled: Boolean(selectedClass), retry: 1,
  });
  const mutation = useMutation({
    mutationFn: classSetupApi.createAssignment,
    retry: false,
    onSuccess: () => {
      // Refresh in the background: a failed reload must never turn a successful write into a retry.
      void queryClient.invalidateQueries({ queryKey: ["teaching-assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["teaching-assignment-options"] });
      void queryClient.invalidateQueries({ queryKey: ["teaching-assignment-create-context"] });
      toast.success("Teaching assignment created successfully.");
      onCreated();
    },
  });
  const errors = { ...serverErrors(mutation.error), ...validationErrors };
  const subjectOptions = (context.data?.subjects ?? []).map((item) => ({ value: String(item.programSubjectId),
    label: `${item.code} · ${item.name} · v${item.version}`, aliases: [item.code, item.name, `${item.code} v${item.version}`] }));
  const resolvedForm = { ...form, classId, programSubjectId: resolveText(form.programSubjectId, subjectOptions) ?? "",
    trainerId: resolveText(form.trainerId, trainerOptions) ?? "" };
  const ready = Boolean(options.data && !options.isError && selectedClass && context.data && !context.isFetching && !context.isError);
  const busy = mutation.isPending;
  const dates = context.data?.classProfile;

  function change<K extends keyof AssignmentForm>(field: K, value: AssignmentForm[K]) {
    setForm((current) => ({ ...current, [field]: value, ...(field === "classId" ? { programSubjectId: "" } : {}) }));
    setValidationErrors({});
    mutation.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || submitting.current || !ready) return;
    const nextErrors = validateAssignmentForm(resolvedForm, context.data,
      options.data!.classes.map((item) => item.id), options.data!.trainers.map((item) => item.id));
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const role = parseRole(form.role);
    if (!role) return;
    submitting.current = true;
    mutation.mutate({
      classId: Number(resolvedForm.classId), programSubjectId: Number(resolvedForm.programSubjectId), trainerId: Number(resolvedForm.trainerId),
      role, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null,
    }, { onSettled: () => { submitting.current = false; } });
  }

  function fieldProps(field: keyof AssignmentForm) {
    return { "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? `create-${field}-error` : undefined };
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}
      onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
      onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>New teaching assignment</DialogTitle>
        <DialogDescription>Assign an active trainer to a subject in the class training program.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate className="space-y-5">
        {options.isPending && <p role="status" className="flex items-center gap-2 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading classes and trainers...</p>}
        {options.isError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load assignment options</AlertTitle><AlertDescription>{requestError(options.error)} <Button type="button" size="sm" variant="outline" onClick={() => void options.refetch()}>Retry options</Button></AlertDescription></Alert>}
        {options.data && !options.data.classes.length && <Alert><AlertCircle /><AlertTitle>No eligible classes</AlertTitle><AlertDescription>A class must be active and have an active training program before you can create an assignment.</AlertDescription></Alert>}
        {options.data && !options.data.trainers.length && <Alert><AlertCircle /><AlertTitle>No active trainers</AlertTitle><AlertDescription>No eligible trainers are available in the trainer directory.</AlertDescription></Alert>}
        {mutation.isError && <Alert variant="destructive" role="alert"><AlertCircle /><AlertTitle>Assignment was not created</AlertTitle><AlertDescription>{requestError(mutation.error)}</AlertDescription></Alert>}
        <fieldset disabled={busy} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="create-class">Class <span aria-hidden="true">*</span></Label>
            <ReferenceInput id="create-class" value={form.classId} onChange={(value) => change("classId", value)}
              options={classOptions} placeholder="Enter class code, name or ID" disabled={busy || !options.data?.classes.length} {...fieldProps("classId")} />
            <FieldError field="classId" errors={errors} />
          </div>
          {selectedClass && context.isPending && <p role="status" className="flex items-center gap-2 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading class subjects...</p>}
          {selectedClass && context.isError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load class subjects</AlertTitle><AlertDescription>{requestError(context.error)} <Button type="button" size="sm" variant="outline" onClick={() => void context.refetch()}>Retry subjects</Button></AlertDescription></Alert>}
          {context.data && <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="font-medium">{context.data.program.name} · v{context.data.program.version}</p>
            <p className="mt-1 text-muted-foreground">Class dates: {dates?.startDate || "No start date provided"} → {dates?.endDate || "No end date provided"}</p>
          </div>}
          {context.data && !context.data.subjects.length && <p role="status" className="text-sm text-muted-foreground">This class has no active subjects available for assignment.</p>}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="create-subject">Subject <span aria-hidden="true">*</span></Label>
              <ReferenceInput id="create-subject" value={form.programSubjectId} onChange={(value) => change("programSubjectId", value)}
                options={subjectOptions} placeholder="Enter subject code, name or program-subject ID" disabled={busy || !ready || !context.data?.subjects.length} {...fieldProps("programSubjectId")} />
              <FieldError field="programSubjectId" errors={errors} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-trainer">Trainer <span aria-hidden="true">*</span></Label>
              <ReferenceInput id="create-trainer" value={form.trainerId} onChange={(value) => change("trainerId", value)}
                options={trainerOptions} placeholder="Enter trainer name, email or ID" disabled={busy || !options.data?.trainers.length} {...fieldProps("trainerId")} />
              <FieldError field="trainerId" errors={errors} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role <span aria-hidden="true">*</span></Label>
              <Input id="create-role" value={form.role} onChange={(event) => change("role", event.target.value)} placeholder="Main or Assistant" disabled={busy} {...fieldProps("role")} />
              <p className="text-xs text-muted-foreground">Enter Main or Assistant.</p>
              <FieldError field="role" errors={errors} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-from">Effective from <span aria-hidden="true">*</span></Label>
              <Input id="create-from" type="date" value={form.effectiveFrom} min={dates?.startDate ?? undefined} max={dates?.endDate ?? undefined} onChange={(event) => change("effectiveFrom", event.target.value)} {...fieldProps("effectiveFrom")} />
              <FieldError field="effectiveFrom" errors={errors} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-to">Effective to</Label>
              <Input id="create-to" type="date" value={form.effectiveTo} min={form.effectiveFrom || dates?.startDate || undefined} max={dates?.endDate ?? undefined} onChange={(event) => change("effectiveTo", event.target.value)} {...fieldProps("effectiveTo")} />
              <FieldError field="effectiveTo" errors={errors} />
              <p className="text-xs text-muted-foreground">{dates?.endDate ? `Leave blank to use the class end date (${dates.endDate}).` : "Leave blank if the assignment has no end date."}</p>
            </div>
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">A class subject can have one main trainer and multiple assistant trainers at a time. The same trainer cannot have overlapping assignments for the same class subject.</p>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !ready || !context.data?.subjects.length || !options.data?.trainers.length}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Creating..." : "Create assignment"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
