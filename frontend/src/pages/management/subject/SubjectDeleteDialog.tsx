import { subjectApi } from "@/api/features/subject.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SubjectDTO } from "@/types/features/subject";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface Props { subject: SubjectDTO; onClose: () => void; onDelete: () => Promise<boolean | undefined> }

export function SubjectDeleteDialog({ subject, onClose, onDelete }: Props) {
  const usage = useQuery({ queryKey: ["subject-usage", subject.id], queryFn: () => subjectApi.getUsage(subject.id!), staleTime: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{usage.data?.referenced ? "This version cannot be deleted" : "Delete subject?"}</DialogTitle>
          <DialogDescription>{subject.code} · {subject.name} · Version {subject.version}</DialogDescription>
        </DialogHeader>
        {usage.isPending && <p role="status" className="text-sm text-muted-foreground">Checking references...</p>}
        {usage.isError && <div role="alert" className="space-y-2 text-sm"><p>Unable to check references.</p><Button variant="outline" onClick={() => void usage.refetch()}>Retry</Button></div>}
        {usage.data && <p className="text-sm leading-6 text-muted-foreground">{usage.data.referenced
          ? "This version is used in a program, teaching assignment or study session. Set it to Inactive to stop using it for new selections; existing references are preserved."
          : "This version has no references. Deleting it permanently removes its subject details and content."}</p>}
        {failed && <p role="alert" className="text-sm text-destructive">Deletion failed. The subject may have changed. Refresh its references and try again.</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
          {usage.data && !usage.data.referenced && !usage.isError && <Button variant="destructive" disabled={busy || usage.isFetching} onClick={async () => {
            setBusy(true); setFailed(false);
            try { if (await onDelete()) onClose(); else { setFailed(true); void usage.refetch(); } }
            finally { setBusy(false); }
          }}>{busy ? "Deleting..." : "Delete subject"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
