import { useRef, useState } from "react";
import axios from "axios";
import { LoaderCircle } from "lucide-react";
import { classSetupApi } from "@/api/features/class-setup.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteSelectedAssignments, type BulkDeleteResult, type DeleteTarget } from "../assignment-bulk-delete";

function failureMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Unable to connect to the server. Refresh the list to check the current state.";
    if (error.response.status === 403) return "You do not have permission to delete this assignment.";
    if (error.response.status === 404) return "This assignment no longer exists. Refresh the list.";
    if (typeof error.response.data?.message === "string") return error.response.data.message;
  }
  return error instanceof Error ? error.message : "Unable to delete this assignment. Please try again.";
}

export function BulkDeleteAssignmentsDialog({ assignments, onClose, onDeleted }: {
  assignments: DeleteTarget[]; onClose: () => void; onDeleted: (ids: number[]) => Promise<void>;
}) {
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [result, setResult] = useState<BulkDeleteResult | null>(null);
  async function confirm() {
    if (sending.current || result) return;
    sending.current = true;
    setBusy(true);
    try {
      const outcome = await deleteSelectedAssignments(assignments, classSetupApi.deleteAssignment, setCompleted);
      setResult(outcome);
      await onDeleted(outcome.deletedIds);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" showCloseButton={!busy}
      onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
      onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{result ? "Deletion result" : "Delete selected assignments"}</DialogTitle>
        <DialogDescription>{result ? "Failed assignments are kept selected in the list." : `Permanently delete ${assignments.length} selected assignments? Only assignments that have never been used by a session can be deleted. Classes, subjects and trainers are kept.`}</DialogDescription>
      </DialogHeader>
      {!result && <ul className="max-h-52 space-y-2 overflow-y-auto text-sm">{assignments.map((a) => <li key={a.id}>{a.classCode || `Assignment #${a.id}`} · {a.subjectCode}</li>)}</ul>}
      {busy && <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin" />Deleting {completed} / {assignments.length}...</p>}
      {result && <div className="space-y-3">
        <p role="status">Deleted: {result.deletedIds.length}. Failed: {result.failures.length}.</p>
        {result.failures.length > 0 && <ul className="max-h-64 space-y-3 overflow-y-auto text-sm text-destructive">{result.failures.map(({ assignment: a, error }) => <li key={a.id}>
          <span className="font-medium">{a.classCode || `Assignment #${a.id}`} · {a.subjectCode}: </span>{failureMessage(error)}
        </li>)}</ul>}
      </div>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>{result ? "Close" : "Cancel"}</Button>
        {!result && <Button variant="destructive" disabled={busy || !assignments.length} onClick={() => void confirm()}>{busy ? "Deleting..." : `Delete ${assignments.length} assignments`}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
