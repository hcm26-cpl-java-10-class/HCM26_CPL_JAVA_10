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

  return <Card className="overflow-hidden py-0 shadow-sm">
    <CardHeader className="flex flex-col gap-3 border-b px-5 py-3.5 [.border-b]:pb-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderTree className="size-4 text-muted-foreground" />
          Đề bài dự án
        </CardTitle>
        <CardDescription>Giao trọn Master hoặc phân công các module cho những Team nháp của lớp.</CardDescription>
      </div>
      {canAssign && <Button className="w-fit gap-2" asChild>
        <Link to={classUrl + "/assign" + sessionQuery}><Plus className="size-4" />Gán đề bài cho lớp</Link>
      </Button>}
      {published && (hasPermission("WORKSPACE_READ") || hasPermission("VIEW_PROJECT_WORKSPACE")) &&
        <Button variant="outline" className="w-fit" asChild>
          <Link to={`/management/workspaces/candidates?classId=${classId}&sessionId=${sessionId}`}>Mở Workspace của phiên</Link>
        </Button>}
    </CardHeader>
  </Card>;
}
