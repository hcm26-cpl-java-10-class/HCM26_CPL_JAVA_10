import { subjectApi } from "@/api/features/subject.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SubjectDTO } from "@/types/features/subject";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { subjectError } from "./subject-errors";

interface Props {
  subject: SubjectDTO | null;
  onClose: () => void;
  onCreated: (subject: SubjectDTO) => void;
}

export function SubjectCloneDialog({ subject, onClose, onCreated }: Props) {
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string>();
  const mutation = useMutation({
    mutationFn: () => subjectApi.cloneVersion(subject!.id!, version.trim()),
    onSuccess: onCreated,
    onError: (cause) => setError(subjectError(cause, "Unable to clone this subject. Try again.")),
  });
  useEffect(() => { setVersion(""); setError(undefined); }, [subject?.id]);
  return (
    <Dialog open={Boolean(subject)} onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Clone subject version</DialogTitle>
          <DialogDescription>
            Copy {subject?.code} · {subject?.version} to a new version. Existing programs and classes keep using the original.
            The copy starts as Inactive so you can edit its content before activating it.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (!version.trim()) { setError("New version is required."); return; }
          if (!mutation.isPending) mutation.mutate();
        }}>
          <div className="grid gap-2">
            <Label htmlFor="clone-version">New version</Label>
            <Input id="clone-version" value={version} maxLength={20} placeholder="e.g. 2.0" autoFocus
              disabled={mutation.isPending} aria-invalid={Boolean(error)} aria-describedby={error ? "clone-version-error" : undefined}
              onChange={(event) => { setVersion(event.target.value); setError(undefined); }} />
            {error && <p id="clone-version-error" role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !version.trim()}>{mutation.isPending ? "Cloning..." : "Clone version"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
