import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { classSetupApi } from "@/api/features/class-setup.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssignmentRoleSelect } from "./AssignmentRoleSelect";
import { NewClassFields } from "./NewClassFields";
import { TeachingSlotsFields } from "./TeachingSlotsFields";
import { parseRole } from "../assignment-text";
import type { NewClassForm } from "../new-class-form";
import { hasCreationErrors, validateAssignmentCreation, type CreationErrors, type CreationAssignmentForm } from "../assignment-creation";

const emptyErrors = (): CreationErrors => ({ classDetails: {}, trainer: {}, assignment: {}, slots: {} });

function serverErrors(error: unknown): CreationErrors {
  const result = emptyErrors();
  if (!axios.isAxiosError(error)) return result;
  const fields = error.response?.data?.errors;
  for (const [path, messages] of Object.entries(fields ?? {})) {
    if (/^teachingSlots(?:\[\d+\](?:\.(?:date|startTime|endTime))?)?$/.test(path) && Array.isArray(messages) && typeof messages[0] === "string")
      result.slots[path] = messages[0];
  }
  function text(...keys: string[]) {
    for (const key of keys) if (Array.isArray(fields?.[key]) && typeof fields[key][0] === "string") return fields[key][0] as string;
  }
  for (const [key, paths] of [
    ["name", ["classDetails.name", "name", "classId"]],
    ["programName", ["classDetails.newProgram.name", "newProgram.name", "programId"]],
    ["programVersion", ["classDetails.newProgram.version", "newProgram.version"]],
    ["startDate", ["classDetails.startDate", "startDate", "effectiveFrom"]],
    ["endDate", ["classDetails.endDate", "endDate"]],
    ["plannedSize", ["classDetails.plannedSize", "plannedSize"]],
  ] as const) {
    const message = text(...paths); if (message) result.classDetails[key] = message;
  }
  for (const key of ["name", "email"] as const) {
    const message = text(`trainer.${key}`); if (message) result.trainer[key] = message;
  }
  for (const [key, paths] of [["subject", ["newSubject.name", "subjectId", "classDetails.newProgram.subjectIds", "newProgram.subjectIds"]], ["role", ["role"]]] as const) {
    const message = text(...paths); if (message) result.assignment[key] = message;
  }
  return result;
}

function requestError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Unable to connect to the server. Check your connection before retrying.";
    if ([502, 503, 504].includes(error.response.status)) return "The shared data service is unavailable. Please try again.";
    if (error.response.status === 403) return "You do not have permission to create all assignment details.";
    if (hasCreationErrors(serverErrors(error))) return "Please correct the highlighted fields.";
    if (typeof error.response.data?.message === "string") return error.response.data.message;
  }
  return "Unable to create the assignment. Please try again.";
}

export function CreateAssignmentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const client = useQueryClient();
  const { hasAllPermissions } = usePermissions();
  const canCreate = hasAllPermissions(["ASSIGNMENT_CREATE", "CLASS_CREATE", "CLASS_UPDATE_PROGRAM", "PROGRAM_CREATE", "PROGRAM_UPDATE", "TRAINER_CREATE", "SUBJECT_CREATE"]);
  const [classForm, setClassForm] = useState<NewClassForm>({ name: "", programName: "", programVersion: "1.0", subjectIds: [], startDate: "", endDate: "", plannedSize: "25" });
  const [trainer, setTrainer] = useState({ name: "", email: "" });
  const [form, setForm] = useState<CreationAssignmentForm>({ subject: "", role: "MAIN",
    teachingSlots: [{ date: "", startTime: "", endTime: "" }] });
  const [validation, setValidation] = useState<CreationErrors>(emptyErrors);
  const submitting = useRef(false);
  const mutation = useMutation({ mutationFn: classSetupApi.createAssignmentWithDetails, retry: false,
    onSuccess: () => {
      for (const key of ["teaching-assignments", "teaching-assignment-options", "teaching-assignment-create-options", "teaching-assignment-create-context", "class-setup-classes", "programs", "available-assignments"]) {
        void client.invalidateQueries({ queryKey: [key] });
      }
      toast.success("Teaching assignment created successfully."); onCreated();
    },
    onSettled: () => { submitting.current = false; },
  });
  const remoteErrors = serverErrors(mutation.error);
  const errors: CreationErrors = {
    classDetails: { ...remoteErrors.classDetails, ...validation.classDetails },
    trainer: { ...remoteErrors.trainer, ...validation.trainer },
    assignment: { ...remoteErrors.assignment, ...validation.assignment },
    slots: { ...remoteErrors.slots, ...validation.slots },
  };
  const busy = mutation.isPending;
  function changed() { setValidation(emptyErrors()); mutation.reset(); }
  function changeClass<K extends keyof NewClassForm>(key: K, value: NewClassForm[K]) {
    setClassForm(current => ({ ...current, [key]: value }));
    changed();
  }
  function change<K extends keyof CreationAssignmentForm>(key: K, value: CreationAssignmentForm[K]) {
    setForm(current => ({ ...current, [key]: value })); changed();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || submitting.current || !canCreate) return;
    const next = validateAssignmentCreation(classForm, trainer, form);
    setValidation(next);
    const role = parseRole(form.role);
    if (hasCreationErrors(next) || !role) return;
    submitting.current = true;
    mutation.mutate({
      classDetails: { name: classForm.name.trim(), startDate: classForm.startDate, endDate: classForm.endDate, plannedSize: Number(classForm.plannedSize),
        newProgram: { name: classForm.programName.trim(), version: "1.0", subjectIds: [] } },
      trainer: { name: trainer.name.trim(), email: trainer.email.trim() }, newSubject: { name: form.subject.trim() }, role,
      effectiveFrom: classForm.startDate, effectiveTo: null,
      teachingSlots: form.teachingSlots,
    });
  }
  function assignmentProps(key: keyof CreationAssignmentForm) {
    return { "aria-invalid": Boolean(errors.assignment[key]), "aria-describedby": errors.assignment[key] ? `create-${key}-error` : undefined };
  }
  function fieldError(key: keyof CreationAssignmentForm) {
    return errors.assignment[key] && <p id={`create-${key}-error`} className="text-sm text-destructive">{errors.assignment[key]}</p>;
  }

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" showCloseButton={!busy}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>New teaching assignment</DialogTitle><DialogDescription>Enter the class, subject and trainer details, then add teaching slots.</DialogDescription></DialogHeader>
      <form onSubmit={submit} noValidate className="space-y-5">
        {!canCreate && <Alert variant="destructive"><AlertCircle /><AlertTitle>Permission required</AlertTitle><AlertDescription>You need permission to create assignments, classes, programs and trainer profiles.</AlertDescription></Alert>}
        {mutation.isError && <Alert variant="destructive" role="alert"><AlertCircle /><AlertTitle>Assignment was not created</AlertTitle><AlertDescription>{requestError(mutation.error)}</AlertDescription></Alert>}
        <fieldset disabled={busy || !canCreate} className="space-y-5">
          <NewClassFields form={classForm} onChange={changeClass} errors={errors.classDetails} />
          <section className="space-y-4 rounded-lg border p-4" aria-label="Subject and trainer">
          <h2 className="font-semibold">2. Subject and trainer</h2>
          <div className="space-y-2"><Label htmlFor="create-subject">Subject *</Label>
            <Input id="create-subject" value={form.subject} onChange={event => change("subject", event.target.value)} maxLength={200}
              placeholder="Enter subject name" {...assignmentProps("subject")} />{fieldError("subject")}</div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="create-trainer-name">Trainer name *</Label>
              <Input id="create-trainer-name" type="text" value={trainer.name} maxLength={200} required placeholder="Enter trainer name"
                aria-invalid={Boolean(errors.trainer.name)} aria-describedby={errors.trainer.name ? "create-trainer-name-error" : undefined}
                onChange={event => { setTrainer(current => ({ ...current, name: event.target.value })); changed(); }} />
              {errors.trainer.name && <p id="create-trainer-name-error" className="text-sm text-destructive">{errors.trainer.name}</p>}</div>
            <div className="space-y-2"><Label htmlFor="create-trainer-email">Trainer email *</Label>
              <Input id="create-trainer-email" type="email" value={trainer.email} maxLength={200} required placeholder="Enter trainer email"
                aria-invalid={Boolean(errors.trainer.email)} aria-describedby={errors.trainer.email ? "create-trainer-email-error" : undefined}
                onChange={event => { setTrainer(current => ({ ...current, email: event.target.value })); changed(); }} />
              {errors.trainer.email && <p id="create-trainer-email-error" className="text-sm text-destructive">{errors.trainer.email}</p>}</div>
            <div className="space-y-2"><Label htmlFor="create-role">Role *</Label><AssignmentRoleSelect id="create-role" value={form.role} onChange={value => change("role", value)} disabled={busy} {...assignmentProps("role")} />{fieldError("role")}</div>
          </div>
          </section>
          <TeachingSlotsFields slots={form.teachingSlots} onChange={slots => change("teachingSlots", slots)}
            from={classForm.startDate} to={classForm.endDate} errors={errors.slots} disabled={busy} title="3. Teaching schedule" />
        </fieldset>
        <p className="text-xs text-muted-foreground">All details are saved together when you create the assignment. A class subject can have one main trainer and multiple assistant trainers at a time.</p>
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !canCreate}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Creating..." : "Create assignment"}
          </Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
