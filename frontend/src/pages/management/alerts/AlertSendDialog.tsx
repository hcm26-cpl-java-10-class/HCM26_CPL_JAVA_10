import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { projectAlertApi } from "@/api/features/project-alert.api";
import { alertRowName, type AlertKind, type AlertPayload, type AlertRow } from "@/types/features/project-alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getAlertError } from "./alert-errors";

export function AlertSendDialog({ kind, rows, owner, note, setNote, request, onBusy, onClose, onSent, onReload }: {
  kind: AlertKind; rows: AlertRow[]; owner: string; note: string; setNote: (note: string) => void;
  request: MutableRefObject<{ fingerprint: string; key: string } | null>; onBusy: (busy: boolean) => void;
  onClose: () => void; onSent: () => void; onReload: () => Promise<void>;
}) {
  const pending = useRef(false), [busy, setBusy] = useState(false), [denied, setDenied] = useState(false);
  const client = useQueryClient();
  const team = rows[0]?.team;
  const draftKey = `project-alert-note:${owner}:${kind}:${team?.id}:${kind === "MILESTONE" ? rows[0]?.id : "batch"}`;
  useEffect(() => { try { const draft = localStorage.getItem(draftKey); if (draft !== null) setNote(draft); } catch { /* Storage may be unavailable. */ } }, [draftKey]);
  function changeNote(value: string) { setNote(value); mutation.reset(); try { localStorage.setItem(draftKey, value); } catch { /* Keep the in-memory draft. */ } }
  const mutation = useMutation({
    mutationFn: ({ payload, key }: { payload: AlertPayload; key: string }) => projectAlertApi.send(payload, key),
    onSuccess: () => { try { localStorage.removeItem(draftKey); } catch { /* The alert is already sent. */ }
      void client.invalidateQueries({ queryKey: ["workspace-alerts"] });
      toast.success("Alert sent to the team's workspace."); onSent(); },
    onError: cause => {
      const status=getAlertError(cause).status;
      if ([401,403].includes(status ?? 0)) {
        setDenied(true); void onReload();
        void client.invalidateQueries({ queryKey: ["project-alert-options", owner] });
      }
      if(status===409) void client.invalidateQueries({ queryKey: ["project-alert-options", owner] });
      if (status===404) { toast.error("The milestone is no longer available. Your note was kept as a draft.");onClose();void onReload(); }
    },
  });
  const error = mutation.isError ? getAlertError(mutation.error) : undefined;
  const fieldError = error?.fieldErrors.warningNote?.[0];
  async function submit() {
    if (pending.current || denied || !team || !rows.length || kind !== "MILESTONE" && !note.trim()) return;
    const payload: AlertPayload = { teamId: team.id, kind, selections: rows.map(row => ({ id: row.id, ...("version" in row ? { version: row.version } : {}) }))
      .sort((a,b) => a.id.localeCompare(b.id)), warningNote: note };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); onBusy(true);
    try { await mutation.mutateAsync({ payload, key: request.current.key }); }
    catch { /* Preserve every selection, the full raw note and the retry key. */ }
    finally { pending.current = false; setBusy(false); onBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>{kind === "MILESTONE" ? "Send milestone deadline alert" : "Send overdue backlog alert"}</DialogTitle>
      <DialogDescription>{team?.className} / {team?.name}. This alert will appear in the team's workspace.</DialogDescription></DialogHeader>
    <form noValidate className="min-w-0 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="max-h-32 overflow-y-auto rounded border p-3 text-sm">{rows.map(row => <p key={row.id}>{alertRowName(row)}</p>)}</div>
      <div className="space-y-2"><Label htmlFor="project-alert-note">Warning note{kind === "MILESTONE" ? " (optional)" : ""}</Label>
        <Textarea id="project-alert-note" rows={6} value={note} disabled={busy} onChange={event => changeNote(event.target.value)}
          className={`field-sizing-fixed min-h-36 min-w-0 max-w-full resize-y ${fieldError || note.length > 500 ? "border-destructive" : ""}`}
          aria-invalid={!!fieldError || note.length > 500} aria-describedby="project-alert-note-error"/>
        <p className={`text-right text-xs ${note.length > 500 ? "text-destructive" : "text-muted-foreground"}`}>{note.length}/500</p>
        {fieldError && <p id="project-alert-note-error" role="alert" className="text-sm text-destructive">{fieldError}</p>}
      </div>
      {error && !fieldError && <div role="alert" className="space-y-1 text-sm text-destructive"><p>{error.message}</p>
        {Object.entries(error.fieldErrors).filter(([key]) => key !== "warningNote").flatMap(([key,values]) => values.map((value,index) => <p key={key+index}>{value}</p>))}</div>}
      {[409,422,404].includes(error?.status ?? 0) && <div className="space-y-2"><Button type="button" variant="outline" disabled={busy} onClick={() => void onReload()}>Reload list</Button>
        <p className="text-xs text-muted-foreground">Your note and selections are kept. Close this dialog to remove an item before retrying.</p></div>}
      {denied && <p role="alert" className="text-sm text-destructive">Your access has changed. Reload the page or sign in again.</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy || denied || !rows.length || kind !== "MILESTONE" && !note.trim()} aria-busy={busy}>
          {busy && <Loader2 aria-label="Sending alert" className="size-4 animate-spin"/>}{busy ? "Sending..." : "Send alert"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
