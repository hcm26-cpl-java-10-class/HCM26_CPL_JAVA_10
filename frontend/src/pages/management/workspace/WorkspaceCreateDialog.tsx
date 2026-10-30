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
  const [taskPrefix, setTaskPrefix] = useState("FA");
  const key = useRef(crypto.randomUUID());
  const team = candidates.find(candidate => candidate.teamId === teamId);
  const create = useMutation({
    mutationFn: () => workspaceApi.create({ teamId, taskKeyPrefix: taskPrefix || "FA" }, key.current),
    onSuccess: async result => {
      await queryClient.invalidateQueries({ queryKey: ["workspace-candidates"] });
      await queryClient.invalidateQueries({ queryKey: ["milestone-project-options"] });
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
      {team?.projectName && <div className="space-y-2 text-sm">
        <p><span className="text-muted-foreground">Assigned project brief:</span> {team.projectName}</p>
        <p className="text-muted-foreground">The workspace will use this brief and its saved project configuration.</p>
      </div>}
      {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Workspace was not created</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="space-y-2 text-sm">
        <label className="block font-medium">Tiền tố mã công việc (Task Key Prefix):</label>
        <input
          type="text"
          className="h-9 w-full rounded-md border bg-background px-3 font-mono uppercase"
          placeholder="Ví dụ: FA, PRJ, CRM..."
          maxLength={8}
          value={taskPrefix}
          onChange={e => setTaskPrefix(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
        />
        <p className="text-xs text-muted-foreground">Các task và subtask sẽ được đánh số theo tiền tố này (ví dụ: {taskPrefix || "FA"}-01, {taskPrefix || "FA"}-02).</p>
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={create.isPending} onClick={onClose}>Cancel</Button>
        <Button disabled={!hasPermission("WORKSPACE_CREATE") || !teamId || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Create workspace
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
