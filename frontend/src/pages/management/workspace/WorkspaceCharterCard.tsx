import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { projectHubApi } from "@/api/features/project-hub.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { charterProgressLabel } from "./team-charter.utils";
import { getWorkspaceError } from "./workspace.shared";

export function WorkspaceCharterCard({teamId, workspaceId}: {teamId: number; workspaceId: number}) {
  const {user, activeRole, hasPermission} = usePermissions();
  const charter = useQuery({queryKey: ["team-charter", teamId, workspaceId, user.email, activeRole], queryFn: () => projectHubApi.getCharter(teamId, workspaceId), retry: false});
  return <Card className="min-w-0"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="size-4" />Team charter</CardTitle><Button variant="outline" asChild><Link to={`/student/team/charter?teamId=${teamId}&workspaceId=${workspaceId}`}>Open team charter</Link></Button></CardHeader><CardContent className="text-sm">
    {charter.isPending ? <p role="status">Loading charter progress...</p> : charter.isError ? <div className="space-y-2"><p>{getWorkspaceError(charter.error)}</p><Button variant="outline" size="sm" onClick={() => void charter.refetch()}>Try again</Button></div> : <div className="flex flex-wrap items-center gap-3"><Badge variant="outline">Revision {charter.data.revision}</Badge><span>{charter.data.memberCount ? `${charter.data.confirmedCount}/${charter.data.memberCount} members confirmed` : "No member assignments"}</span><span className="text-muted-foreground">{charterProgressLabel(charter.data)}</span></div>}
    {hasPermission("TEAM_UPDATE") && <Button variant="link" className="mt-2 px-0" asChild><Link to="/mentor/teams">View team charter overview</Link></Button>}
  </CardContent></Card>;
}
