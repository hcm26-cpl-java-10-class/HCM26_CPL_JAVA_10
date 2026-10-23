import { workspaceApi } from "@/api/features/workspace.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceCandidateItem, WorkspaceCreateRequest } from "@/types/features/workspace";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getWorkspaceError, WORKSPACE_SECTIONS, WorkspaceStatusBadge } from "./workspace.shared";

export function WorkspaceCreateDialog({ candidates, initialSelection, onClose, onOpenWorkspace }: {
  candidates: WorkspaceCandidateItem[];
  initialSelection: WorkspaceCandidateItem | null;
  onClose: () => void;
  onOpenWorkspace: (id: number) => void;
}) {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"selection" | "confirmation">("selection");
  const [teamId, setTeamId] = useState(initialSelection ? String(initialSelection.teamId) : "");
  const [projectId, setProjectId] = useState(initialSelection?.projectId ? "project-" + initialSelection.projectId : "");
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState("");
  const [existingId, setExistingId] = useState<number | null>(null);
  const requestKey = useRef("");
  const saving = useRef(false);
  const canCreate = hasPermission("WORKSPACE_CREATE");
  const canRead = hasPermission("WORKSPACE_READ");
  const teams = [...new Map(candidates.map(row => [row.teamId, row])).values()];
  const selectedTeam = teams.find(row => String(row.teamId) === teamId);
  const projectsQuery = useQuery({
    queryKey: ["workspace-project-options", teamId],
    queryFn: () => workspaceApi.getProjectOptions(Number(teamId)),
    enabled: !!teamId && !selectedTeam?.workspaceId, retry: false, staleTime: 0,
  });
  const projects = projectsQuery.data ?? [];
  const optionKey = (option: { projectId?: number | null }) => "project-" + option.projectId;
  const option = projects.find(row => optionKey(row) === projectId);
  const selected = option && selectedTeam && !selectedTeam.workspaceId ? {
    ...selectedTeam, projectId: option.projectId,
    projectName: option.name, projectCode: option.code, projectStatus: option.status,
    cohortName: option.cohortName, eligibleForWorkspace: selectedTeam.eligibleForWorkspace && (selectedTeam.memberCount ?? 0) > 0,
  } : undefined;
  const payload: WorkspaceCreateRequest | undefined = selected ? {
    teamId: selected.teamId,
    projectId: selected.projectId!,
  } : undefined;
  const confirmation = useQuery({
    queryKey: ["workspace-confirmation", selected?.projectId, selected?.teamId],
    queryFn: () => workspaceApi.confirmCreate(payload!),
    enabled: step === "confirmation" && !!selected,
    retry: false, staleTime: 0, gcTime: 0,
  });
  const confirmed = confirmation.data?.projectId == selected?.projectId && confirmation.data?.teamId === selected?.teamId
    ? confirmation.data : undefined;

  function continueToConfirmation() {
    if (!selected?.eligibleForWorkspace || !canCreate || saving.current) return;
    requestKey.current = crypto.randomUUID();
    setCreationError(""); setExistingId(null); setStep("confirmation");
  }
  async function create() {
    if (!confirmed?.eligibleForWorkspace || !canCreate || confirmation.isFetching || confirmation.isError || saving.current) return;
    saving.current = true; setIsCreating(true); setCreationError("");
    try {
      const result = await workspaceApi.create(payload!, requestKey.current);
      if (!result.id) throw new Error("The server did not return a workspace ID.");
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["workspace-candidates"] }), queryClient.invalidateQueries({ queryKey: ["workspace-project-options"] }), queryClient.invalidateQueries({ queryKey: ["project-teams"] })]);
      toast.success("Workspace created successfully");
      onOpenWorkspace(result.id);
    } catch (error) {
      setCreationError(getWorkspaceError(error));
      if (isAxiosError<{ workspaceId?: number }>(error) && error.response?.status === 409) setExistingId(error.response.data.workspaceId ?? null);
      void queryClient.invalidateQueries({ queryKey: ["workspace-candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-project-options"] });
      void confirmation.refetch();
    } finally { saving.current = false; setIsCreating(false); }
  }
  const openId = step === "selection" ? selectedTeam?.workspaceId : existingId ?? confirmed?.workspaceId;
  return <Dialog open onOpenChange={open => { if (!open && !saving.current) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
      onEscapeKeyDown={event => { if (saving.current) event.preventDefault(); }}
      onInteractOutside={event => { if (saving.current) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>Create workspace</DialogTitle>
        <DialogDescription>{step === "selection"
          ? "Step 1 of 2 — Select a team, then an available project."
          : "Step 2 of 2 — Review the latest project and team details before creating the workspace."}</DialogDescription>
      </DialogHeader>
      {step === "selection" ? <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="workspace-team">Team</Label>
            <Select value={teamId} onValueChange={value => { setTeamId(value); setProjectId(""); }}>
              <SelectTrigger id="workspace-team" className="w-full"><SelectValue placeholder="Select a team" /></SelectTrigger>
              <SelectContent>{teams.map(row => <SelectItem key={row.teamId} value={String(row.teamId)} disabled={!!row.workspaceId}>{row.teamName} ({row.teamCode})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="workspace-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId} disabled={!teamId || !!selectedTeam?.workspaceId || projectsQuery.isFetching || projectsQuery.isError}>
              <SelectTrigger id="workspace-project" className="w-full"><SelectValue placeholder={projectsQuery.isFetching ? "Loading projects..." : teamId ? "Select a project" : "Select a team first"} /></SelectTrigger>
              <SelectContent>{projects.map(row => <SelectItem key={optionKey(row)} value={optionKey(row)}>{row.name} ({row.code})</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">A project belongs to one team. Teams with a project use their assigned project. Unassigned teams can select an unassigned project. Assignment happens only after confirmation.</p>
        {selectedTeam && !selectedTeam.workspaceId && (selectedTeam.memberCount ?? 0) === 0 && <Alert variant="destructive"><AlertCircle /><AlertTitle>This team has no members</AlertTitle><AlertDescription>Add at least one active member before creating a workspace.</AlertDescription></Alert>}
        {projectsQuery.isError && <Alert variant="destructive"><AlertCircle /><AlertDescription>{getWorkspaceError(projectsQuery.error)}<Button variant="outline" size="sm" onClick={() => void projectsQuery.refetch()}>Reload projects</Button></AlertDescription></Alert>}
        {teamId && projectsQuery.isSuccess && !projects.length && !selectedTeam?.workspaceId && <p className="text-sm text-muted-foreground">No available projects. A project must be unassigned, or assigned to this team, and have no workspace.</p>}
        {selected && <dl className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
          <div><dt className="text-sm text-muted-foreground">Cohort</dt><dd className="mt-1 font-medium">{selected.cohortName ?? "Not assigned"}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Team members</dt><dd className="mt-1 font-medium">{selected.memberCount ?? 0}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Project status</dt><dd className="mt-1"><WorkspaceStatusBadge status={selected.projectStatus} /></dd></div>
          <div><dt className="text-sm text-muted-foreground">Workspace</dt><dd className="mt-1 font-medium">{selected.workspaceId ? "Created" : "Not created"}</dd></div>
        </dl>}
        {selected && !selected.eligibleForWorkspace && (selectedTeam?.memberCount ?? 0) > 0 && <Alert><AlertCircle /><AlertTitle>{selected.workspaceId ? "Workspace already exists" : "This project is not eligible"}</AlertTitle>
          <AlertDescription>{selected.workspaceId ? "Open the existing workspace to continue working." : "A workspace can only be created for an active team linked to a Planning or Active project."}</AlertDescription></Alert>}
      </div> : confirmation.isFetching ? <div className="flex items-center justify-center gap-2 py-10"><Loader2 className="size-4 animate-spin" />Loading latest details...</div>
        : confirmation.isError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Unable to confirm project and team</AlertTitle><AlertDescription>{getWorkspaceError(confirmation.error)}<Button variant="outline" size="sm" onClick={() => void confirmation.refetch()}>Reload details</Button></AlertDescription></Alert>
          : confirmed && <div className="space-y-5">
            <dl className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              {[["Project", confirmed.projectName], ["Team", confirmed.teamName], ["Cohort", confirmed.cohortName ?? "Not assigned"], ["Team members", String(confirmed.memberCount ?? 0)]]
                .map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
            </dl>
            <div className="space-y-3"><p className="text-sm font-medium">Your workspace includes eight sections</p>
              <div className="grid gap-2 sm:grid-cols-2">{WORKSPACE_SECTIONS.map(({ id, label, description, icon: Icon }) => <div key={id} className="flex items-start gap-3 rounded-md border p-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">{label}</p><p className="text-xs leading-5 text-muted-foreground">{description}</p></div></div>)}</div>
              <p className="text-xs leading-5 text-muted-foreground">Members come from the existing team. On confirmation, the project is assigned to this team and becomes Active. No workspace or project assignment is saved before confirmation. Unconfigured project sections start empty.</p>
            </div>
            {!confirmed.eligibleForWorkspace && <Alert><AlertCircle /><AlertTitle>{confirmed.workspaceId ? "Workspace already exists" : "Project is no longer eligible"}</AlertTitle><AlertDescription>{confirmed.workspaceId ? "You can open the existing workspace." : "Select a team with a Planning or Active project."}</AlertDescription></Alert>}
          </div>}
      {creationError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Workspace was not created</AlertTitle><AlertDescription>{creationError}</AlertDescription></Alert>}
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={isCreating} onClick={onClose}>Cancel</Button>
        {step === "confirmation" && <Button variant="outline" disabled={isCreating} onClick={() => { setStep("selection"); setCreationError(""); setExistingId(null); }}><ArrowLeft />Back</Button>}
        {canRead && openId ? <Button disabled={isCreating} onClick={() => onOpenWorkspace(openId)}>Open workspace<ArrowRight /></Button>
          : step === "selection" ? <Button disabled={!selected?.eligibleForWorkspace || !canCreate} onClick={continueToConfirmation}>Continue<ArrowRight /></Button>
            : <Button disabled={isCreating || confirmation.isFetching || confirmation.isError || !confirmed?.eligibleForWorkspace || !canCreate} onClick={() => void create()}>{isCreating ? <Loader2 className="animate-spin" /> : <Plus />}{isCreating ? "Creating..." : creationError ? "Try again" : "Confirm creation"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
