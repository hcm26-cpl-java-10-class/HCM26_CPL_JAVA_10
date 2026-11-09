import { useRef, useState, type MutableRefObject } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { memberReminderApi } from "@/api/features/member-reminder.api";
import type { InactiveMember } from "@/types/features/member-reminder";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getTaskError } from "../task-form.utils";

export function MemberReminderDialog({ projectId, members, note, onNoteChange, onClose, onSent, onReload, enabled, onBusy, request }: {
  projectId: string; members: InactiveMember[]; note: string; onNoteChange: (note: string) => void;
  onClose: () => void; onSent: () => void; onReload: () => Promise<void>; enabled: boolean; onBusy: (busy: boolean) => void;
  request: MutableRefObject<{ fingerprint: string; key: string } | null>;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [denied, setDenied] = useState(false);
  const mutation = useMutation({
    mutationFn: ({ payload, key }: { payload: { recipientUserIds: number[]; warningNote: string }; key: string }) =>
      memberReminderApi.send(projectId, payload, key),
    onSuccess: () => { toast.success("Reminders queued for the selected members."); onSent(); },
    onError: cause => {
      if ([401, 403].includes(getTaskError(cause).status ?? 0)) { setDenied(true); void onReload(); }
    },
  });
  const error = mutation.isError ? getTaskError(mutation.error) : undefined;
  const fieldError = error?.fieldErrors.warningNote?.[0];
  async function submit() {
    if (pending.current || !enabled || denied || !members.length || !note.trim()) return;
    const payload = { recipientUserIds: members.map(member => member.userId).sort((a,b) => a-b), warningNote: note };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); onBusy(true);
    try { await mutation.mutateAsync({ payload, key: request.current.key }); }
    catch { /* Keep every selected recipient, the raw note and unchanged request key. */ }
    finally { pending.current = false; setBusy(false); onBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85vh] min-w-0 overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Send inactivity reminders</DialogTitle>
        <DialogDescription>Private notifications will be queued for {members.length} selected member(s).</DialogDescription></DialogHeader>
      <form noValidate className="min-w-0 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <div className="max-h-32 overflow-y-auto rounded border p-3 text-sm">{members.map(member =>
          <p key={member.userId}>{member.displayName}{member.userCode ? ` (${member.userCode})` : ""}</p>)}</div>
        <div className="min-w-0 space-y-2"><Label htmlFor="member-reminder-note">Reminder note</Label>
          <Textarea id="member-reminder-note" rows={6} disabled={busy} value={note}
            className={`field-sizing-fixed min-h-36 min-w-0 max-w-full resize-y ${fieldError || note.length>500 ? "border-destructive" : ""}`}
            aria-invalid={!!fieldError || note.length>500} aria-describedby="member-reminder-note-error"
            onChange={event => { onNoteChange(event.target.value); mutation.reset(); }} />
          <p className={`text-right text-xs ${note.length>500 ? "text-destructive" : "text-muted-foreground"}`}>{note.length}/500</p>
          {fieldError && <p id="member-reminder-note-error" role="alert" className="text-sm text-destructive">{fieldError}</p>}
        </div>
        {error && !fieldError && <div role="alert" className="space-y-1 text-sm text-destructive"><p>{error.message}</p>
          {Object.entries(error.fieldErrors).filter(([key]) => key !== "warningNote").flatMap(([key, values]) =>
            values.map((message,index) => <p key={key+index}>{message}</p>))}</div>}
        {(error?.status===409 || error?.status===422 && !fieldError) &&
          <Button type="button" variant="outline" disabled={busy} onClick={() => void onReload()}>Reload member list</Button>}
        {(error?.status===409 || error?.status===422 && !fieldError) && <p className="text-xs text-muted-foreground">
          Your selection is kept. Close this dialog to remove a member before retrying.</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !enabled || denied || !members.length || !note.trim()} aria-busy={busy}>
            {busy && <Loader2 aria-label="Sending reminders" className="size-4 animate-spin" />}
            {busy ? "Sending..." : "Send reminders"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
