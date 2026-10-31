import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceMember } from "@/types/features/workspace";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowUpRight, Loader2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getWorkspaceError } from "./workspace.shared";
import { WorkspaceSectionState } from "./WorkspaceSectionState";

type MemberRole = WorkspaceMember["roles"][number];

const ROLE_LABELS: Record<MemberRole, string> = {
  PM: "PM (Leader)",
  BA: "BA",
  DEV: "DEV",
  QA: "QA",
};

function searchable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
}

export function WorkspaceMembersPanel({ workspaceId, teamId, classId, allocationSessionId, canViewMembers, onAccessChanged }: {
  workspaceId: number;
  teamId: number;
  classId: number;
  allocationSessionId: number;
  canViewMembers: boolean;
  onAccessChanged?: () => void;
}) {
  const { user, activeRole, hasPermission } = usePermissions();
  const [search, setSearch] = useState("");
  const query = useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.getMembers(workspaceId, signal),
    enabled: canViewMembers,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const denied = isAxiosError(query.error) && query.error.response?.status === 403;
  useEffect(() => { if (denied) onAccessChanged?.(); }, [denied, onAccessChanged]);

  const members = useMemo(() => query.data ?? [], [query.data]);
  const filteredMembers = useMemo(() => {
    const term = searchable(search.trim());
    return term ? members.filter(member =>
      searchable(`${member.display_name} ${member.user_code ?? ""}`).includes(term)) : members;
  }, [members, search]);

  if (denied) return <WorkspaceSectionState denied retry={() => onAccessChanged?.()} />;
  if (!canViewMembers) {
    return <Card><CardHeader><CardTitle>Members</CardTitle></CardHeader>
      <CardContent>You do not have permission to view member details.</CardContent></Card>;
  }

  const loading = query.isFetching || query.isLoading;
  const canOpenAllocation = hasPermission("PEO_TEAM_ALLOCATE") || hasPermission("PRJ_WORKSPACE_MANAGE");
  const allocationUrl = `/team-allocation/classes/${classId}?sessionId=${allocationSessionId}&teamId=${teamId}`;

  return <Card>
    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <CardTitle>{query.isError ? "Unable to load members" : loading ? "Members" : `Members (${members.length})`}</CardTitle>
        <CardDescription>Team members and roles from Project Team Allocation.</CardDescription>
      </div>
      {canOpenAllocation && <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
        <Link to={allocationUrl}>Open team allocation <ArrowUpRight className="size-4" /></Link>
      </Button>}
    </CardHeader>
    <CardContent className="space-y-4">
      {loading ? <p className="flex items-center justify-center gap-2 py-10"><Loader2 className="size-4 animate-spin" />Loading members...</p>
        : query.isError ? <div className="space-y-3"><p className="text-sm">{getWorkspaceError(query.error)}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>
        : members.length === 0 ? <p className="text-sm text-muted-foreground">No team members</p>
        : <>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search members by name or code" placeholder="Search name or member code" value={search}
              onChange={event => setSearch(event.target.value)} className="pl-9 pr-9" />
            {search && <Button type="button" variant="ghost" size="icon" aria-label="Clear search"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2" onClick={() => setSearch("")}><X className="size-4" /></Button>}
          </div>
          {search && <p className="text-xs text-muted-foreground">Showing {filteredMembers.length} of {members.length} members</p>}
          {filteredMembers.length === 0 ? <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No members match your search. <Button variant="link" className="px-1" onClick={() => setSearch("")}>Clear search</Button>
          </div> : <Table><TableHeader><TableRow><TableHead>Member code</TableHead><TableHead>Display name</TableHead><TableHead>Project roles</TableHead></TableRow></TableHeader>
            <TableBody>{filteredMembers.map((member, index) => <TableRow key={member.user_code ?? `${member.display_name}-${index}`}>
              <TableCell className="font-mono text-xs">{member.user_code || "Not assigned"}</TableCell>
              <TableCell className="font-medium">{member.display_name}</TableCell>
              <TableCell><div className="flex flex-wrap gap-1.5">{member.roles.length === 0
                ? <Badge variant="outline">Unassigned</Badge>
                : member.roles.map(role => <Badge key={role} variant={role === "PM" ? "default" : "secondary"}>{ROLE_LABELS[role]}</Badge>)}
              </div></TableCell>
            </TableRow>)}</TableBody></Table>}
        </>}
    </CardContent>
  </Card>;
}
