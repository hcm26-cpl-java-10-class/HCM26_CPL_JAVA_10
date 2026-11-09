import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderTree } from "lucide-react";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceMasterMilestonesPanel } from "../workspace/WorkspaceMasterMilestonesPanel";

export function ProjectAssignmentPanel({ classId, sessionId, canAssign, published }: {
  classId: number; sessionId: number; canAssign: boolean; published: boolean;
}) {
  const { user, activeRole, hasPermission } = usePermissions();
  const client = useQueryClient();
  const [managedMaster, setManagedMaster] = useState<number | null>(null);
  const classUrl = "/team-allocation/classes/" + classId;
  const sessionQuery = "?sessionId=" + sessionId;
  const masters = useQuery({
    queryKey: ["class-master-projects", classId, sessionId, user.email, activeRole],
    queryFn: ({ signal }) => projectAssignmentApi.classMasters(classId, sessionId, signal),
    enabled: hasPermission("MILESTONE_WRITE") || hasPermission("PRJ_WORKSPACE_MANAGE"),
    retry: false,
  });

  return <Card>
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <CardTitle className="flex items-center gap-2"><FolderTree className="size-5 text-primary" />Đề bài dự án</CardTitle>
        <CardDescription>Giao trọn Master hoặc phân công các module cho những Team nháp của lớp.</CardDescription>
      </div>
      {canAssign && <Button className="w-fit" asChild><Link to={classUrl + "/assign" + sessionQuery}>Gán đề bài cho lớp</Link></Button>}
      {published && (hasPermission("WORKSPACE_READ") || hasPermission("VIEW_PROJECT_WORKSPACE")) &&
        <Button className="w-fit" asChild>
          <Link to={`/management/workspaces/candidates?classId=${classId}&sessionId=${sessionId}`}>Mở Workspace của phiên</Link>
        </Button>}
    </CardHeader>
    {masters.isError && <CardContent className="flex flex-wrap items-center gap-2">
      <p role="alert" className="text-sm">Không tải được danh sách Master của lớp.</p>
      <Button variant="outline" size="sm" onClick={() => void masters.refetch()}>Thử lại</Button>
    </CardContent>}
    {!!masters.data?.length && <CardContent className="space-y-3">
      <p className="text-sm font-medium">Master của lớp</p>
      <p className="text-xs text-muted-foreground">Mentor quản lý milestone chung. Các Team thực hiện phần việc của module được giao.</p>
      {masters.data.map(master => <div key={master.projectId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="space-y-1"><p className="text-sm font-medium">{master.name}</p><Badge variant="outline">{master.status}</Badge></div>
        <Button size="sm" variant="outline" onClick={() => setManagedMaster(master.projectId)}>Quản lý milestone Master</Button>
      </div>)}
    </CardContent>}
    <Dialog open={managedMaster != null} onOpenChange={open => { if (!open) setManagedMaster(null); }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Milestone Master của lớp</DialogTitle>
          <DialogDescription>Quản lý phần việc chung và đánh giá cấp Master.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          {managedMaster != null && <WorkspaceMasterMilestonesPanel masterProjectId={managedMaster} returnTo={classUrl + "/setup" + sessionQuery + "&tab=review"}
            onChanged={() => {
              void masters.refetch();
              void client.invalidateQueries({ queryKey: ["workspace-project-hierarchy"] });
            }} />}
        </div>
      </DialogContent>
    </Dialog>
  </Card>;
}
