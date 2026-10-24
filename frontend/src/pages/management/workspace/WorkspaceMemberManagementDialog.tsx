import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectHubApi } from "@/api/features/project-hub.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { ManagedTeamMember, TeamMembershipUpdate } from "@/types/features/project-hub";
import type { ProjectRole, ParticipationStatus } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { getWorkspaceError } from "./workspace.shared";
import { PROJECT_ROLE_LABELS, PARTICIPATION_LABELS } from "./workspace.roles";

export function WorkspaceMemberManagementDialog({ teamId, workspaceId, open, onOpenChange }: {
  teamId: number; workspaceId: number; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const { user, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const allowed = hasPermission("TEAM_UPDATE") && hasPermission("WORKSPACE_MEMBER_READ");
  const roster = useQuery({ queryKey: ["team-managed-members", teamId, user.email],
    queryFn: () => projectHubApi.getMembers(teamId), enabled: open && allowed, retry: false, staleTime: 0 });
  const options = useQuery({ queryKey: ["team-member-options", teamId, user.email],
    queryFn: () => projectHubApi.getMemberOptions(teamId), enabled: open && allowed, retry: false, staleTime: 0 });
  const [selectedUser, setSelectedUser] = useState("");
  const [newRole, setNewRole] = useState<ProjectRole>("UNASSIGNED");
  const save = useMutation({
    mutationFn: ({ userId, ...update }: TeamMembershipUpdate & { userId: number }) => projectHubApi.saveMember(teamId, userId, update),
    onSuccess: async () => {
      setSelectedUser(""); setNewRole("UNASSIGNED");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team-managed-members", teamId] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-detail", workspaceId], refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: ["workspace-candidates"] }),
        queryClient.invalidateQueries({ queryKey: ["project-teams"] })
      ]);
      toast.success("Team membership saved");
    }
  });
  const available = options.data?.filter(option => !roster.data?.some(member => member.userId === option.userId)) ?? [];
  const loading = roster.isLoading || options.isLoading;
  const failed = roster.isError || options.isError;
  return <Dialog open={open && allowed} onOpenChange={value => { if (!save.isPending) onOpenChange(value); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" onInteractOutside={event => { if (save.isPending) event.preventDefault(); }} onEscapeKeyDown={event => { if (save.isPending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Manage members</DialogTitle><DialogDescription>Assign project roles and update participation in this team.</DialogDescription></DialogHeader>
      {loading ? <p className="flex items-center gap-2 py-6"><Loader2 className="size-4 animate-spin" />Loading team members...</p>
        : failed ? <div className="space-y-3"><p>{getWorkspaceError(roster.error ?? options.error)}</p><Button variant="outline" onClick={() => void Promise.all([roster.refetch(), options.refetch()])}>Try again</Button></div>
        : <>
          <div className="space-y-3">{roster.data?.length ? roster.data.map(member =>
            <MembershipRow key={`${member.userId}:${member.projectRole}:${member.status}`} member={member} pending={save.isPending}
              onSave={update => save.mutate({ userId: member.userId, ...update })} />)
            : <p className="text-muted-foreground">No team members</p>}</div>
          <div className="space-y-3 rounded-lg border p-4">
            <p className="font-medium">Add an existing user</p>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Select value={selectedUser} onValueChange={setSelectedUser} disabled={save.isPending || available.length === 0}>
                <SelectTrigger aria-label="User to add" className="w-full"><SelectValue placeholder={available.length ? "Select a user" : "No other users available"} /></SelectTrigger>
                <SelectContent>{available.map(option => <SelectItem key={option.userId} value={String(option.userId)}>{option.displayName} · {option.userCode ?? "No member code"}</SelectItem>)}</SelectContent>
              </Select>
              <RoleSelect value={newRole} onChange={setNewRole} disabled={save.isPending} label="New member project role" />
              <Button disabled={!selectedUser || save.isPending} onClick={() => save.mutate({ userId: Number(selectedUser), projectRole: newRole, status: "ACTIVE" })}>Add member</Button>
            </div>
          </div>
        </>}
      {save.isError && <Alert variant="destructive"><AlertDescription>{getWorkspaceError(save.error)}</AlertDescription></Alert>}
      <div className="flex justify-end"><Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Done</Button></div>
    </DialogContent>
  </Dialog>;
}

function RoleSelect({ value, onChange, disabled, label }: { value: ProjectRole; onChange: (value: ProjectRole) => void; disabled: boolean; label: string }) {
  return <Select value={value} onValueChange={value => onChange(value as ProjectRole)} disabled={disabled}>
    <SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger>
    <SelectContent>{Object.entries(PROJECT_ROLE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
  </Select>;
}

function MembershipRow({ member, pending, onSave }: { member: ManagedTeamMember; pending: boolean; onSave: (update: TeamMembershipUpdate) => void }) {
  const [projectRole, setProjectRole] = useState(member.projectRole);
  const [status, setStatus] = useState(member.status);
  const changed = projectRole !== member.projectRole || status !== member.status;
  return <div className="grid items-center gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto]">
    <div className="min-w-0"><p className="break-words font-medium">{member.displayName}</p><p className="text-xs text-muted-foreground">{member.userCode ?? "No member code"}</p></div>
    <RoleSelect value={projectRole} onChange={setProjectRole} disabled={pending} label={`Project role for ${member.displayName}`} />
    <Select value={status} onValueChange={value => setStatus(value as ParticipationStatus)} disabled={pending}>
      <SelectTrigger aria-label={`Participation for ${member.displayName}`} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(PARTICIPATION_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
    </Select>
    <Button variant="outline" disabled={pending || !changed} aria-label={`Save membership for ${member.displayName}`} onClick={() => onSave({ projectRole, status })}><Save />Save</Button>
  </div>;
}
