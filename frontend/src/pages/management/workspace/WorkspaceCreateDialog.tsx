import { workspaceApi } from "@/api/features/workspace.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceCandidateItem } from "@/types/features/workspace";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getWorkspaceError } from "./workspace.shared";

export function WorkspaceCreateDialog({ candidates, initialSelection, onClose, onOpenWorkspace }: {
  candidates: WorkspaceCandidateItem[];
  initialSelection: WorkspaceCandidateItem | null;
  onClose: () => void;
  onOpenWorkspace: (id: number) => void;
}) {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState(initialSelection?.teamId ?? candidates[0]?.teamId ?? 0);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const team = candidates.find(candidate => candidate.teamId === teamId);
  const create = useMutation({
    mutationFn: () => workspaceApi.create({ teamId }, key.current),
    onSuccess: async result => {
      await queryClient.invalidateQueries({ queryKey: ["workspace-candidates"] });
      toast.success("Workspace created successfully");
      onOpenWorkspace(result.id!);
    },
    onError: error => setError(getWorkspaceError(error)),
  });

  return <Dialog open onOpenChange={open => { if (!open && !create.isPending) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create workspace for active team</DialogTitle>
      </DialogHeader>
      {initialSelection ? <div className="space-y-2">
        <p className="font-medium">{team?.teamName}</p>
        <p className="text-sm text-muted-foreground">{team?.className} · {team?.memberCount ?? 0} members</p>
      </div> : <select className="h-10 rounded-md border bg-background px-3" value={teamId} onChange={event => {
        const nextTeamId = Number(event.target.value);
        setTeamId(nextTeamId);
      }}>
        {candidates.map(candidate => <option key={candidate.teamId} value={candidate.teamId}>{candidate.teamName} · {candidate.classCode}</option>)}
      </select>}
      <p className="text-sm text-muted-foreground">Workspace này thuộc trực tiếp Team và không cần Project Template.</p>
      {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Workspace was not created</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <DialogFooter>
        <Button variant="outline" disabled={create.isPending} onClick={onClose}>Cancel</Button>
        <Button disabled={!hasPermission("WORKSPACE_CREATE") || !teamId || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Create workspace
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
