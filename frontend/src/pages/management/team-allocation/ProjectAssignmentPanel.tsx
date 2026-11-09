import { Link } from "react-router-dom";
import { FolderTree, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export function ProjectAssignmentPanel({ classId, sessionId, canAssign }: {
  classId: number; sessionId: number; canAssign: boolean;
}) {
  const classUrl = "/team-allocation/classes/" + classId;
  const sessionQuery = "?sessionId=" + sessionId;

  return <Card>
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <CardTitle className="flex items-center gap-2"><FolderTree className="size-5 text-primary" />Đề bài dự án</CardTitle>
      {canAssign && <Button className="w-fit gap-2" asChild>
        <Link to={classUrl + "/assign" + sessionQuery}><Plus className="size-4" />Gán đề bài cho lớp</Link>
      </Button>}
    </CardHeader>
  </Card>;
}
