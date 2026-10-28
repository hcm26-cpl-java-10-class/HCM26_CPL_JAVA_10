import type { WorkspaceDetail } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <CardContent className="space-y-5">
          {workspace.projectId != null ? <>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-muted-foreground">Project name</p><p>{information(workspace.projectName)}</p></div>
              <div><p className="text-muted-foreground">Project code</p><p>{information(workspace.projectCode)}</p></div>
              <div><p className="text-muted-foreground">Status</p><p>{information(workspace.projectStatus)}</p></div>
            </div>
            <div><p className="mb-2 text-sm font-medium">Description</p><p className="whitespace-pre-wrap text-sm leading-7">{information(workspace.projectDescription)}</p></div>
          </> : <p className="text-sm text-muted-foreground">No project is associated with this workspace.</p>}
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
