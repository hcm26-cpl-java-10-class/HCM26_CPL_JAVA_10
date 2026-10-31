import type { WorkspaceDetail } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceStatusBadge } from "./workspace.shared";

function information(value?: string | null) {
  return value?.trim() || "No information available";
}

export function WorkspaceOverviewPanel({ workspace, canViewMembers, onViewMembers }: {
  workspace: WorkspaceDetail;
  canViewMembers: boolean;
  onViewMembers: () => void;
}) {
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Project brief</CardTitle></CardHeader>
        <CardContent>
          {workspace.projectId == null ? <p className="text-sm text-muted-foreground">No project linked to this workspace.</p>
            : <div className="grid min-w-0 gap-5 text-sm sm:grid-cols-2">
              <div className="min-w-0"><p className="text-muted-foreground">Project code</p><p className="break-words">{information(workspace.projectCode)}</p></div>
              <div className="min-w-0"><p className="text-muted-foreground">Project name</p><p className="break-words">{information(workspace.projectName)}</p></div>
              <div className="min-w-0 sm:col-span-2"><p className="mb-2 font-medium">Description</p><p className="whitespace-pre-wrap break-words leading-7">{information(workspace.projectDescription)}</p></div>
              <div><p className="mb-2 text-muted-foreground">Project status</p>{workspace.projectStatus
                ? <WorkspaceStatusBadge status={workspace.projectStatus} />
                : <p>No information available</p>}</div>
              <div className="min-w-0"><p className="text-muted-foreground">Class</p><p className="break-words">{information(workspace.projectClassName)}</p></div>
              <div className="min-w-0"><p className="text-muted-foreground">Cohort</p><p className="break-words">{information(workspace.projectCohortName)}</p></div>
            </div>}
        </CardContent>
      </Card>
    </div>
    <div className="space-y-5">
      <Card><CardHeader><CardTitle>{workspace.teamName}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm"><span className="font-medium">{workspace.member_count}</span> active members</p>
          {canViewMembers ? <Button variant="outline" className="w-full" onClick={onViewMembers}>View members</Button>
            : <p className="text-sm text-muted-foreground">You do not have permission to view member details.</p>}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Mentor</CardTitle></CardHeader>
        <CardContent className="text-sm">{workspace.mentorName?.trim() || "No mentor assigned"}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Workspace information</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Code: {workspace.code}</p>
          <p>Created by: {workspace.createdByName || "Not available"}</p>
          <p>Created at: {workspace.createdAt ? new Date(workspace.createdAt).toLocaleString("en-GB") : "Not available"}</p>
        </CardContent>
      </Card>
    </div>
  </div>;
}
