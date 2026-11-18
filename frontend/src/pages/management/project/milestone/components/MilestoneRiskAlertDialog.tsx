import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { milestoneRiskApi } from "@/api/features/milestone-risk.api";
import type { MilestoneRiskItem } from "@/types/features/milestone-risk";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getMilestoneApiError } from "../milestone.utils";
import { getMilestoneDraft, saveMilestoneDraft } from "../milestone-risk-drafts";

export function MilestoneRiskAlertDialog({ projectId, milestone, scope, enabled, onClose, onSent, onMissing, onReload }: {
  projectId: string; milestone: MilestoneRiskItem; scope: string; enabled: boolean; onClose: () => void;
  onSent: () => void; onMissing: () => void; onReload: () => Promise<void>;
}) {
  const saved = getMilestoneDraft(scope, milestone.id);
  const [note, setNote] = useState(saved?.note ?? "");
  const [denied, setDenied] = useState(false);
  const pending = useRef(false);
  const request = useRef<{ fingerprint: string; key: string } | undefined>(
    saved?.key && saved.fingerprint ? { key: saved.key, fingerprint: saved.fingerprint } : undefined);
  const mutation = useMutation({
    mutationFn: ({ payload, key }: { payload: { version: number; warningNote: string }; key: string }) =>
      milestoneRiskApi.send(projectId, milestone.id, payload, key),
    onSuccess: () => { toast.success("Risk alert queued for the project team."); onSent(); },
    onError: cause => {
      const error = getMilestoneApiError(cause);
      if (error.status === 404) { toast.error("Milestone does not exist or has been changed. Your warning draft was saved."); onMissing(); }
      if (error.status === 401 || error.status === 403) { setDenied(true); void onReload(); }
    },
  });
  const error = mutation.isError ? getMilestoneApiError(mutation.error) : undefined;
  const fieldError = error?.errors?.warningNote?.[0];
  async function submit() {
    if (pending.current || denied || !enabled || !milestone.progress.eligible) return;
    const payload = { version: milestone.version, warningNote: note };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    saveMilestoneDraft(scope, { milestoneId: milestone.id, title: milestone.title, note, ...request.current });
    pending.current = true;
    try { await mutation.mutateAsync({ payload, key: request.current.key }); }
    catch { /* Preserve note, draft and idempotency key for an unchanged retry. */ }
    finally { pending.current = false; }
  }
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent className="max-h-[85vh] min-w-0 overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Send risk alert to team</DialogTitle>
        <DialogDescription>{milestone.title}. Notifications will be queued for all active student members.</DialogDescription></DialogHeader>
      <form noValidate className="min-w-0 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <div className="min-w-0 space-y-2"><Label htmlFor="milestone-risk-note">Guidance note (optional)</Label>
          <Textarea id="milestone-risk-note" value={note} disabled={mutation.isPending}
            className={`field-sizing-fixed min-h-36 min-w-0 max-w-full resize-y ${fieldError || note.length>500 ? "border-destructive" : ""}`}
            aria-invalid={!!fieldError || note.length>500} aria-describedby="milestone-risk-note-error"
            onChange={event => { const value=event.target.value; setNote(value);
              saveMilestoneDraft(scope,{milestoneId:milestone.id,title:milestone.title,note:value});
              if (!mutation.isPending) mutation.reset();
            }} />
          <p className={`text-right text-xs ${note.length>500 ? "text-destructive" : "text-muted-foreground"}`}>{note.length}/500</p>
          <p className="text-xs text-muted-foreground">Leave blank to use the default milestone warning.</p>
          {fieldError && <p id="milestone-risk-note-error" role="alert" className="text-sm text-destructive">{fieldError}</p>}
        </div>
        {error && !fieldError && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
        {error?.status===409 && <Button type="button" variant="outline" onClick={() => void onReload()}>Reload milestone list</Button>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!enabled || denied || !milestone.progress.eligible || mutation.isPending}>
            {mutation.isPending ? "Queuing..." : "Send risk alert"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
