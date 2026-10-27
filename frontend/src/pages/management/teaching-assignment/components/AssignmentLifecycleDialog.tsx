import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { classSetupApi, type AssignmentEndRequest, type AssignmentLifecycleContext, type TeachingAssignment } from "@/api/features/class-setup.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canDeleteUnusedAssignment, canEndAssignment, endKey, initialEndDate, validateEndDate } from "../assignment-lifecycle";
import { formatScheduleDateTime } from "../assignment-detail";

export type LifecycleMode = "end" | "delete";

function message(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Unable to connect to the server. Please check your connection.";
    if (error.response.status === 403) return "You do not have permission for this action.";
    if (error.response.status === 404) return "This assignment no longer exists.";
    if (error.response.data?.errors && Object.keys(error.response.data.errors).length) return "Please correct the highlighted fields.";
    if (typeof error.response.data?.message === "string") return error.response.data.message;
  }
  return "Unable to complete the request. Please try again.";
}

export function AssignmentLifecycleDialog({ mode, assignment, onClose, onDeleted, onEndInstead }: {
  mode: LifecycleMode; assignment: TeachingAssignment; onClose: () => void; onDeleted: () => void; onEndInstead?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const context = useQuery({
    queryKey: ["teaching-assignment-lifecycle", assignment.id],
    queryFn: ({ signal }) => classSetupApi.getAssignmentLifecycleContext(assignment.id, signal), retry: 1,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className={mode === "end" ? "max-h-[90vh] overflow-y-auto sm:max-w-4xl" : "sm:max-w-lg"} showCloseButton={!busy}
      onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{mode === "end" ? "End teaching assignment" : "Delete teaching assignment"}</DialogTitle>
        <DialogDescription>{mode === "end" ? "Shorten the effective period while keeping the assignment and session history." : "Only assignments that have never been referenced by a session can be deleted."}</DialogDescription>
      </DialogHeader>
      {context.isPending || context.isFetching ? <p role="status" className="flex items-center justify-center gap-2 py-6"><LoaderCircle className="size-4 animate-spin" />Loading current assignment...</p>
        : context.isError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to load assignment</AlertTitle><AlertDescription>{message(context.error)} <Button variant="outline" size="sm" onClick={() => void context.refetch()}>Retry</Button></AlertDescription></Alert>
        : context.data && <LifecycleForm key={`${mode}:${context.data.assignment.revision}`} mode={mode} context={context.data} label={assignment}
          onBusy={setBusy} onReload={() => void context.refetch()} onClose={onClose} onDeleted={onDeleted} onEndInstead={onEndInstead} />}
    </DialogContent>
  </Dialog>;
}

function LifecycleForm({ mode, context, label, onBusy, onReload, onClose, onDeleted, onEndInstead }: {
  mode: LifecycleMode; context: AssignmentLifecycleContext; label: TeachingAssignment; onBusy: (busy: boolean) => void;
  onReload: () => void; onClose: () => void; onDeleted: () => void; onEndInstead?: () => void;
}) {
  const a = context.assignment;
  const client = useQueryClient();
  const sending = useRef(false);
  const [effectiveTo, setEffectiveTo] = useState(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return initialEndDate(a, today);
  });
  const [fieldError, setFieldError] = useState<string>();
  const [reviewed, setReviewed] = useState<AssignmentEndRequest | null>(null);
  const [page, setPage] = useState(0);
  const request = { effectiveTo, revision: a.revision };
  const impact = useQuery({
    queryKey: ["teaching-assignment-end-impact", a.id, reviewed, page],
    queryFn: ({ signal }) => classSetupApi.previewAssignmentEnd(a.id, reviewed!, page, signal), enabled: mode === "end" && reviewed !== null,
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: async () => mode === "end" ? classSetupApi.endAssignment(a.id, request) : classSetupApi.deleteAssignment(a.id, a.revision),
    retry: false,
    onSuccess: () => {
      for (const key of ["teaching-assignments", "teaching-assignment-options", "teaching-assignment-detail", "teaching-assignment-sessions",
        "teaching-assignment-edit-context", "teaching-assignment-impact", "teaching-assignment-lifecycle", "teaching-assignment-end-impact", "teaching-assignment-create-context"]) {
        void client.invalidateQueries({ queryKey: [key] });
      }
      toast.success(mode === "end" ? "Teaching assignment end date updated." : "Unused teaching assignment deleted.");
      if (mode === "delete") onDeleted(); else onClose();
    },
    onError: (error) => {
      setReviewed(null);
      if (axios.isAxiosError(error)) {
        const errors = error.response?.data?.errors?.effectiveTo;
        if (Array.isArray(errors) && typeof errors[0] === "string") setFieldError(errors[0]);
      }
    },
    onSettled: () => { sending.current = false; onBusy(false); },
  });
  const busy = mutation.isPending;
  const allowed = mode === "delete" ? canDeleteUnusedAssignment(context) : canEndAssignment(request, reviewed, impact.data) && !impact.isFetching && !impact.isError;
  const previewFieldError = axios.isAxiosError(impact.error) ? impact.error.response?.data?.errors?.effectiveTo?.[0] : undefined;
  const dateError = fieldError || (typeof previewFieldError === "string" ? previewFieldError : undefined);

  function preview() {
    const error = validateEndDate(effectiveTo, a); setFieldError(error);
    if (error) return;
    if (reviewed && endKey(reviewed) === endKey(request) && page === 0) void impact.refetch();
    else { setPage(0); setReviewed(request); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!allowed || busy || sending.current) return;
    if (mode === "end") {
      const error = validateEndDate(effectiveTo, a); setFieldError(error); if (error) return;
    }
    sending.current = true; onBusy(true); mutation.mutate();
  }

  return <form onSubmit={submit} noValidate className="space-y-4">
    <div className="rounded-lg border bg-muted/20 p-3 text-sm"><p className="font-medium">{a.classId === label.classId ? label.classCode || `Class #${a.classId}` : `Class #${a.classId}`} · {a.subjectCode} · {a.subjectName}</p>
      <p className="mt-1 text-muted-foreground">{a.trainerId === label.trainerId && label.trainerName ? label.trainerName : `Trainer #${a.trainerId}`} · {a.effectiveFrom} → {a.effectiveTo || "No end date"}</p>
    </div>
    {mode === "delete" ? <>
      {canDeleteUnusedAssignment(context) ? <p className="text-sm">Permanently delete this unused assignment? This action does not delete any session.</p>
        : <Alert variant="destructive"><AlertCircle /><AlertTitle>Assignment cannot be deleted</AlertTitle><AlertDescription>{context.linkedSessionCount > 0 ? `${context.linkedSessionCount} session(s) reference this assignment, including completed, cancelled or archived records.` : "This assignment has been used previously."} Keep this assignment to preserve its history.</AlertDescription></Alert>}
      {!canDeleteUnusedAssignment(context) && onEndInstead && <Button type="button" variant="outline" disabled={busy} onClick={onEndInstead}>End assignment instead</Button>}
    </> : <>
      <div className="max-w-sm space-y-2"><Label htmlFor="assignment-end-date">Effective end date</Label><Input id="assignment-end-date" type="date" value={effectiveTo} min={a.effectiveFrom} max={a.effectiveTo || undefined} disabled={busy}
        aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "assignment-end-date-error" : undefined}
        onChange={(event) => { setEffectiveTo(event.target.value); setFieldError(undefined); setReviewed(null); setPage(0); mutation.reset(); }} />
        {dateError && <p id="assignment-end-date-error" className="text-sm text-destructive">{dateError}</p>}
        <p className="text-xs text-muted-foreground">The end date is inclusive and cannot extend the current effective period.</p>
      </div>
      <Button type="button" variant="outline" disabled={busy || impact.isFetching} onClick={preview}>{impact.isFetching && <LoaderCircle className="size-4 animate-spin" />}Preview impact</Button>
      {reviewed && impact.data && !impact.isError && <section className="space-y-3" aria-label="End assignment impact" aria-busy={impact.isFetching}>
        <Alert variant={impact.data.canSave ? "default" : "destructive"}><AlertCircle /><AlertTitle>{impact.data.canSave ? "No sessions block this end date" : `${impact.data.affectedSessionCount} sessions block this end date`}</AlertTitle><AlertDescription>{impact.data.canSave ? "The server will check again before updating the end date." : "Resolve these sessions or choose a later end date. No session will be changed automatically."}</AlertDescription></Alert>
        {impact.data.affectedSessions.content.length > 0 && <Table><TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Time</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader><TableBody>{impact.data.affectedSessions.content.map(({ session, reasons }) => <TableRow key={session.id}><TableCell className="max-w-48 whitespace-normal">{session.title}<span className="block text-xs text-muted-foreground">{session.status}{!session.active ? " · Archived" : ""}</span></TableCell><TableCell className="whitespace-nowrap">{formatScheduleDateTime(session.startTime)}<span className="block">{formatScheduleDateTime(session.endTime)}</span></TableCell><TableCell className="max-w-80 whitespace-normal">{reasons.map((reason) => <p key={reason}>{reason}</p>)}</TableCell></TableRow>)}</TableBody></Table>}
        {impact.data.affectedSessions.totalPages > 1 && <div className="flex items-center justify-end gap-2"><Button type="button" variant="outline" size="icon" aria-label="Previous end impact page" disabled={page === 0 || impact.isFetching || busy} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button><span className="text-sm">Page {page + 1} / {impact.data.affectedSessions.totalPages}</span><Button type="button" variant="outline" size="icon" aria-label="Next end impact page" disabled={page + 1 >= impact.data.affectedSessions.totalPages || impact.isFetching || busy} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button></div>}
      </section>}
    </>}
    {(mutation.isError || (mode === "end" && impact.isError)) && <Alert variant="destructive"><AlertCircle /><AlertTitle>Action was not completed</AlertTitle><AlertDescription>{message(mutation.error || impact.error)}</AlertDescription></Alert>}
    <Button type="button" variant="ghost" disabled={busy} onClick={onReload}><RefreshCw className="size-4" />Reload current assignment</Button>
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" variant={mode === "delete" ? "destructive" : "default"} disabled={busy || !allowed}>{busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? (mode === "delete" ? "Deleting..." : "Ending...") : (mode === "delete" ? "Delete unused assignment" : "Confirm end date")}</Button></DialogFooter>
  </form>;
}
