import { assignmentSessionKey } from "../assignment-session-key";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { classSetupApi, type AssignmentEditContext, type TeachingAssignmentUpdateRequest, type SharedTrainer } from "@/api/features/class-setup.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReferenceInput } from "./ReferenceInput";
import { AssignmentRoleSelect } from "./AssignmentRoleSelect";
import { NewTrainerFields } from "./NewTrainerFields";
import { parseRole, resolveText, trainerTextOptions } from "../assignment-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatScheduleDateTime } from "../assignment-detail";
import { canSaveAssignmentEdit, updateKey, validateAssignmentEdit } from "../assignment-edit";
import type { AssignmentErrors, AssignmentForm } from "../assignment-form";

function message(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Unable to connect to the server. Please check your connection.";
    if (error.response.status === 403) return "You do not have permission to edit this assignment.";
    if (error.response.status === 404) return "This assignment no longer exists.";
    if ([502, 503, 504].includes(error.response.status)) return "The shared profile service is unavailable. Please try again.";
    if (error.response.data?.errors && Object.keys(error.response.data.errors).length) return "Please correct the highlighted fields.";
    if (typeof error.response.data?.message === "string") return error.response.data.message;
  }
  return "Unable to complete the request. Please try again.";
}

export function EditAssignmentDialog({ assignmentId, onClose }: { assignmentId: number; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const context = useQuery({
    queryKey: ["teaching-assignment-edit-context", assignmentId],
    queryFn: ({ signal }) => classSetupApi.getAssignmentEditContext(assignmentId, signal),
    retry: 1, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" showCloseButton={!busy}
      onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Edit teaching assignment</DialogTitle><DialogDescription>Review the effect on linked sessions before saving changes.</DialogDescription></DialogHeader>
      {context.isPending || context.isFetching ? <p role="status" className="flex items-center justify-center gap-2 py-8"><LoaderCircle className="size-4 animate-spin" />Loading current assignment...</p>
        : context.isError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load assignment</AlertTitle><AlertDescription>{message(context.error)} <Button variant="outline" size="sm" onClick={() => void context.refetch()}>Retry</Button></AlertDescription></Alert>
        : context.data && <EditForm key={context.data.assignment.revision} context={context.data} onClose={onClose}
          onBusy={setBusy} onReload={() => void context.refetch()} />}
    </DialogContent>
  </Dialog>;
}

function EditForm({ context, onClose, onBusy, onReload }: {
  context: AssignmentEditContext; onClose: () => void; onBusy: (busy: boolean) => void; onReload: () => void;
}) {
  const a = context.assignment;
  const { hasPermission } = usePermissions();
  const [newTrainer, setNewTrainer] = useState<SharedTrainer | null>(null);
  const [savingTrainer, setSavingTrainer] = useState(false);
  const trainers = newTrainer ? [...context.trainers.filter(t => t.id !== newTrainer.id), newTrainer] : context.trainers;
  const client = useQueryClient();
  const sending = useRef(false);
  const trainerOptions = trainerTextOptions(trainers);
  const trainerLocked = context.trainerLocked || context.linkedSessionCount > 0;
  const [form, setForm] = useState<AssignmentForm>({ classId: String(a.classId), programSubjectId: String(a.programSubjectId),
    trainerId: trainerOptions.find((option) => option.value === String(a.trainerId))?.label || String(a.trainerId),
    role: a.role, effectiveFrom: a.effectiveFrom, effectiveTo: a.effectiveTo || "" });
  const [errors, setErrors] = useState<AssignmentErrors>({});
  const [reviewed, setReviewed] = useState<TeachingAssignmentUpdateRequest | null>(null);
  const [page, setPage] = useState(0);
  const trainerId = trainerLocked ? String(a.trainerId) : resolveText(form.trainerId, trainerOptions);
  const role = parseRole(form.role);
  const resolvedForm = { ...form, trainerId: trainerId ?? "" };
  const request: TeachingAssignmentUpdateRequest | null = trainerId && role ? { classId: a.classId, programSubjectId: a.programSubjectId,
    trainerId: Number(trainerId), role, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null, revision: a.revision } : null;
  const impact = useQuery({
    queryKey: ["teaching-assignment-impact", a.id, reviewed, page],
    queryFn: ({ signal }) => classSetupApi.previewAssignmentImpact(a.id, reviewed!, page, signal),
    enabled: reviewed !== null, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const save = useMutation({
    mutationFn: () => { if (!request) throw new Error("Enter an existing trainer and select a role."); return classSetupApi.updateAssignment(a.id, request); }, retry: false,
    onSuccess: () => {
      for (const key of ["teaching-assignments", "teaching-assignment-options", "teaching-assignment-detail",
        "teaching-assignment-edit-context", "teaching-assignment-sessions", "teaching-assignment-create-context"]) {
        void client.invalidateQueries({ queryKey: [key] });
      }
      toast.success("Teaching assignment updated successfully.");
      onClose();
    },
    onError: (error) => {
      setReviewed(null);
      if (axios.isAxiosError(error)) {
        const fields = error.response?.data?.errors;
        const next: AssignmentErrors = {};
        for (const field of ["classId", "programSubjectId", "trainerId", "role", "effectiveFrom", "effectiveTo"] as const) {
          if (Array.isArray(fields?.[field]) && typeof fields[field][0] === "string") next[field] = fields[field][0];
        }
        setErrors(next);
      }
    },
    onSettled: () => { sending.current = false; onBusy(false); },
  });
  const busy = save.isPending || savingTrainer;
  const allowed = Boolean(request && canSaveAssignmentEdit(request, reviewed, impact.data)) && !impact.isFetching && !impact.isError;

  function change<K extends keyof AssignmentForm>(field: K, value: AssignmentForm[K]) {
    setForm((current) => ({ ...current, [field]: value })); setErrors({}); setReviewed(null); setPage(0); save.reset();
  }
  function preview() {
    const next = validateAssignmentEdit(resolvedForm, { ...context, trainers }); setErrors(next);
    if (Object.keys(next).length || !request) return;
    if (reviewed && updateKey(request) === updateKey(reviewed) && page === 0) void impact.refetch();
    else { setPage(0); setReviewed(request); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!allowed || busy || sending.current) return;
    const next = validateAssignmentEdit(resolvedForm, { ...context, trainers }); setErrors(next);
    if (Object.keys(next).length) return;
    sending.current = true; onBusy(true); save.mutate();
  }
  function fieldError(field: keyof AssignmentForm) {
    const source = axios.isAxiosError(impact.error) ? impact.error.response?.data?.errors?.[field] : undefined;
    const text = errors[field] || (Array.isArray(source) && typeof source[0] === "string" ? source[0] : undefined);
    return text ? <p id={`edit-${field}-error`} className="text-sm text-destructive">{text}</p> : null;
  }

  return <form onSubmit={submit} noValidate className="space-y-5">
    <div className="rounded-lg border bg-muted/20 p-3 text-sm"><p className="font-medium">{a.classCode || `Class #${a.classId}`} · {a.subjectCode} · {a.subjectName}</p><p className="mt-1 text-muted-foreground">Class and subject are fixed. Class dates: {context.classProfile.startDate || "Not provided"} → {context.classProfile.endDate || "Not provided"}</p></div>
    {fieldError("classId")}{fieldError("programSubjectId")}
    {(context.trainerLocked || context.linkedSessionCount > 0) && <Alert><AlertCircle /><AlertTitle>Trainer is locked</AlertTitle><AlertDescription>{context.linkedSessionCount > 0 ? `This assignment has ${context.linkedSessionCount} linked sessions.` : "This assignment has been used previously."} Keep the existing trainer and create a replacement assignment if another trainer is needed.</AlertDescription></Alert>}
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">{trainerLocked || hasPermission("TRAINER_CREATE") ? <NewTrainerFields id="edit-trainer" initial={{ name: a.trainerName ?? "", email: a.trainerEmail }} readOnly={trainerLocked}
        onBusy={value => { setSavingTrainer(value); onBusy(value); }} onDraftChange={() => change("trainerId", "")}
        onSaved={value => { setNewTrainer(value); change("trainerId", String(value.id)); void client.invalidateQueries({ queryKey: ["teaching-assignment-options"] }); }} />
        : <><Label htmlFor="edit-trainer">Trainer</Label><ReferenceInput id="edit-trainer" value={form.trainerId} options={trainerOptions} disabled={busy} onChange={value => change("trainerId", value)} placeholder="Enter trainer name or email" /></>}
        {fieldError("trainerId")}</div>
      <div className="space-y-2"><Label htmlFor="edit-role">Role</Label><AssignmentRoleSelect id="edit-role" value={form.role} disabled={busy} onChange={(value) => change("role", value)} aria-describedby="edit-role-error" />{fieldError("role")}</div>
      <div className="space-y-2"><Label htmlFor="edit-from">Effective from</Label><Input id="edit-from" type="date" value={form.effectiveFrom} min={context.classProfile.startDate ?? undefined} max={context.classProfile.endDate ?? undefined} onChange={(e) => change("effectiveFrom", e.target.value)} aria-describedby="edit-effectiveFrom-error" />{fieldError("effectiveFrom")}</div>
      <div className="space-y-2"><Label htmlFor="edit-to">Effective to</Label><Input id="edit-to" type="date" value={form.effectiveTo} min={form.effectiveFrom || undefined} max={context.classProfile.endDate ?? undefined} onChange={(e) => change("effectiveTo", e.target.value)} aria-describedby="edit-effectiveTo-error" />{fieldError("effectiveTo")}<p className="text-xs text-muted-foreground">{context.classProfile.endDate ? `Leave blank to use the class end date (${context.classProfile.endDate}).` : "Leave blank for no end date."}</p></div>
    </fieldset>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy || impact.isFetching} onClick={preview}>{impact.isFetching && <LoaderCircle className="size-4 animate-spin" />}Preview impact</Button><Button type="button" variant="ghost" disabled={busy} onClick={onReload}><RefreshCw className="size-4" />Reload current assignment</Button></div>
    {(impact.isError || save.isError) && <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to apply changes</AlertTitle><AlertDescription>{message(save.error || impact.error)}</AlertDescription></Alert>}
    {reviewed && impact.data && !impact.isError && <section className="space-y-3" aria-label="Assignment change impact" aria-busy={impact.isFetching}>
      <Alert variant={impact.data.canSave ? "default" : "destructive"}><AlertCircle /><AlertTitle>{impact.data.canSave ? "No linked sessions are affected" : `${impact.data.affectedSessionCount} linked sessions block this change`}</AlertTitle><AlertDescription>{impact.data.canSave ? "The server will check again when you save." : "Resolve the affected sessions or adjust the effective dates before saving."}</AlertDescription></Alert>
      {impact.data.affectedSessions.content.length > 0 && <Table><TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Time</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader><TableBody>{impact.data.affectedSessions.content.map(({ session, reasons }) => <TableRow key={assignmentSessionKey(session)}><TableCell className="max-w-48 whitespace-normal">{session.title}<span className="block text-xs text-muted-foreground">{session.status}{!session.active ? " · Archived" : ""}</span></TableCell><TableCell className="whitespace-nowrap">{formatScheduleDateTime(session.startTime)}<span className="block">{formatScheduleDateTime(session.endTime)}</span></TableCell><TableCell className="max-w-80 whitespace-normal">{reasons.map((reason) => <p key={reason}>{reason}</p>)}</TableCell></TableRow>)}</TableBody></Table>}
      {impact.data.affectedSessions.totalPages > 1 && <div className="flex items-center justify-end gap-2"><Button type="button" variant="outline" size="icon" aria-label="Previous affected sessions page" disabled={page === 0 || impact.isFetching || busy} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button><span className="text-sm">Page {page + 1} / {impact.data.affectedSessions.totalPages}</span><Button type="button" variant="outline" size="icon" aria-label="Next affected sessions page" disabled={page + 1 >= impact.data.affectedSessions.totalPages || impact.isFetching || busy} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button></div>}
    </section>}
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={!allowed || busy}>{busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Saving..." : "Save changes"}</Button></DialogFooter>
  </form>;
}
