import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { projectAlertApi } from "@/api/features/project-alert.api";
import type { MilestoneAlert } from "@/types/features/project-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAlertError } from "./alert-errors";

export function MilestoneWorkItemsDialog({ row, owner, onClose, onSaved }: {
  row: MilestoneAlert; owner: string; onClose: () => void; onSaved: () => void;
}) {
  const query = useQuery({ queryKey: ["alert-milestone-links", owner, row.team.id, row.id],
    queryFn: ({ signal }) => projectAlertApi.links(row.team.id, row.id, signal), retry: false, gcTime: 0 });
  const [selected,setSelected] = useState<Set<number>>(new Set()), pending = useRef(false), [busy,setBusy] = useState(false);
  useEffect(() => { if (query.data) setSelected(new Set(query.data.selectedIds)); }, [query.data]);
  const mutation = useMutation({ mutationFn: () => projectAlertApi.saveLinks(row.team.id,row.id,query.data!.milestoneVersion,[...selected]),
    onSuccess: () => { toast.success("Milestone work items updated."); onSaved(); } });
  const error = query.isError ? getAlertError(query.error) : mutation.isError ? getAlertError(mutation.error) : undefined;
  const denied = [401,403].includes(error?.status ?? 0);
  async function save() { if (pending.current || !query.data || denied) return; pending.current=true;setBusy(true);
    try { await mutation.mutateAsync(); } catch { /* Keep selections for correction/retry. */ } finally { pending.current=false;setBusy(false); } }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>Link backlog items · {row.title}</DialogTitle>
      <DialogDescription>Only selected top-level backlog items count toward this milestone's work progress. Subtasks are excluded.</DialogDescription></DialogHeader>
    {query.isPending ? <p role="status">Loading team backlog...</p> : <>
      {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
      {!denied && query.data && <><div className="max-h-80 space-y-2 overflow-y-auto rounded border p-3">
        {!query.data.availableItems.length && <p className="text-sm text-muted-foreground">No backlog items belong to this team yet.</p>}
        {query.data.availableItems.map(item => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded p-2 hover:bg-muted">
          <Checkbox aria-label={"Link " + item.title} checked={selected.has(Number(item.id))} disabled={busy}
            onCheckedChange={checked => setSelected(previous => { const next=new Set(previous); if(checked===true)next.add(Number(item.id));else next.delete(Number(item.id));return next; })}/>
          <span className="text-sm"><span className="font-medium">{item.title}</span><span className="ml-2 text-muted-foreground">{item.workType} · {item.status}</span></span>
        </label>)}</div><p className="text-xs text-muted-foreground">{selected.size} selected. Saving an empty selection records that no work has been planned; completion will be 0%.</p></>}
      {query.isError && <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>}
    </>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
      <Button disabled={busy || !query.data || denied} onClick={() => void save()}>{busy && <Loader2 className="size-4 animate-spin"/>}{busy ? "Saving..." : "Save links"}</Button></div>
  </DialogContent></Dialog>;
}
