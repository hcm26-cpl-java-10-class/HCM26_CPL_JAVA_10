import { useState } from "react";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceMember } from "@/types/features/workspace";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users } from "lucide-react";
import { getWorkspaceError } from "./workspace.shared";
import { PROJECT_ROLE_LABELS, PARTICIPATION_LABELS } from "./workspace.roles";
import { WorkspaceMemberManagementDialog } from "./WorkspaceMemberManagementDialog";

export function WorkspaceMembersPanel({ workspaceId, teamId, canViewMembers }: {
  workspaceId: number;
  teamId: number;
  canViewMembers: boolean;
}) {
  const { user, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [managementOpen, setManagementOpen] = useState(false);
  const query = useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", workspaceId, user.email],
    queryFn: () => workspaceApi.getMembers(workspaceId),
    enabled: canViewMembers,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always"
  });

  if (!canViewMembers) {
    return <Card><CardHeader><CardTitle>Members</CardTitle></CardHeader>
      <CardContent>You do not have permission to view member details.</CardContent></Card>;
  }
  const members = query.data ?? [];
  const loading = query.isFetching || query.isLoading;
  const denied = isAxiosError(query.error) && query.error.response?.status === 403;
  function changeManagementOpen(open: boolean) {
    setManagementOpen(open);
    if (!open) void queryClient.invalidateQueries({ queryKey: ["workspace-detail", workspaceId] });
  }
  return <>
    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>{query.isError ? "Unable to load members" : loading ? "Members" : "Members (" + members.length + ")"}</CardTitle>
        {hasPermission("TEAM_UPDATE") && <Button variant="outline" onClick={() => setManagementOpen(true)}><Users />Manage members</Button>}
      </div></CardHeader>
      <CardContent>{loading ? <p className="flex items-center justify-center gap-2 py-10"><Loader2 className="size-4 animate-spin" />Loading members...</p>
        : query.isError ? <div className="space-y-3"><p className="text-sm">{denied ? "You do not have permission to view member details." : getWorkspaceError(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>
        : members.length === 0 ? <p className="text-sm text-muted-foreground">No team members</p>
        : <Table><TableHeader><TableRow><TableHead>Member code</TableHead><TableHead>Display name</TableHead><TableHead>Project role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{members.map((member, index) => <TableRow key={member.user_code ?? "uncoded-" + index}>
            <TableCell>{member.user_code || "Not assigned"}</TableCell>
            <TableCell>{member.display_name}</TableCell>
            <TableCell>{PROJECT_ROLE_LABELS[member.project_role] ?? "Unassigned role"}</TableCell>
            <TableCell>{PARTICIPATION_LABELS[member.status]}</TableCell>
          </TableRow>)}</TableBody></Table>}
      </CardContent>
    </Card>
    {hasPermission("TEAM_UPDATE") && <WorkspaceMemberManagementDialog teamId={teamId} workspaceId={workspaceId} open={managementOpen} onOpenChange={changeManagementOpen} />}
  </>;
}
