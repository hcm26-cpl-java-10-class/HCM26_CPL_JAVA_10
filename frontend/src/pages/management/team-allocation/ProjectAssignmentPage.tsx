import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MasterProjectAssignmentForm } from "./MasterProjectAssignmentForm";

function positiveId(value: string | null | undefined) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export default function ProjectAssignmentPage() {
  const { classId: classParam } = useParams<{ classId: string }>();
  const [search] = useSearchParams();
  const { user, activeRole } = usePermissions();
  const classId = positiveId(classParam);
  const sessionId = positiveId(search.get("sessionId"));
  const teamId = positiveId(search.get("teamId"));
  const backTo = classId == null ? "/team-allocation" : "/team-allocation/classes/" + classId
    + (sessionId == null ? "" : "/setup?sessionId=" + sessionId + "&tab=review");

  return (
    <MainLayout
      pathName={{ "team-allocation": "Phân nhóm dự án", assign: "Gán Master Project" }}
      // Same as the setup page: keep the "classes" breadcrumb on a real route.
      pathLinks={{
        classes: classId == null ? "/team-allocation" : "/team-allocation/classes/" + classId,
      }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="space-y-3 border-b pb-5">
          <Button variant="ghost" size="sm" asChild>
            <Link to={backTo}><ArrowLeft className="size-4" /> Về danh sách nhóm</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gán Master Project</h1>
            <p className="mt-1 text-sm text-muted-foreground">{teamId == null
              ? "Chọn đề bài đã công bố và phân công cho các Team nháp trong lớp."
              : "Giao toàn bộ đề bài cho Team đã chọn và lưu vai trò để chuẩn bị công bố chính thức."}</p>
          </div>
        </header>
        {classId != null && sessionId != null
          ? <MasterProjectAssignmentForm key={[classId, sessionId, teamId, user.email, activeRole].join(":")}
              classId={classId} sessionId={sessionId} initialTeamId={teamId} backTo={backTo} />
          : <p role="alert" className="rounded-lg border p-4 text-sm">Hãy chọn phiên phân nhóm của lớp trước khi gán đề bài.</p>}
      </div>
    </MainLayout>
  );
}
