import { Link } from "react-router-dom";
import { FolderTree, Plus } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ProjectAssignmentPanel({ classId, sessionId, canAssign, published }: {
  classId: number; sessionId: number; canAssign: boolean; published: boolean;
}) {
  const { hasPermission } = usePermissions();
  const classUrl = "/team-allocation/classes/" + classId;
  const sessionQuery = "?sessionId=" + sessionId;

  return <Card>
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <CardTitle className="flex items-center gap-2"><FolderTree className="size-5 text-primary" />Đề bài dự án</CardTitle>
        <CardDescription>Giao trọn Master hoặc phân công các module cho những Team nháp của lớp.</CardDescription>
      </div>
      {canAssign && <Button className="w-fit gap-2" asChild>
        <Link to={classUrl + "/assign" + sessionQuery}><Plus className="size-4" />Gán đề bài cho lớp</Link>
      </Button>}
      {published && (hasPermission("WORKSPACE_READ") || hasPermission("VIEW_PROJECT_WORKSPACE")) &&
        <Button className="w-fit" asChild>
          <Link to={`/management/workspaces/candidates?classId=${classId}&sessionId=${sessionId}`}>Mở Workspace của phiên</Link>
        </Button>}
    </CardHeader>
  </Card>;
}
