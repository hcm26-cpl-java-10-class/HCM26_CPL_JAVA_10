import { useProTable } from "@/components/datatable/hook/useProTable";
import { ProTable } from "@/components/datatable/ProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import type { EntityConfig, SessionDTO } from "@/types";
import { normalizeRole } from "@/utils/rbac.utils";
import { Eye, Pen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SessionDeleteDialog } from "../components/SessionDeleteDialog";
import { SessionRowActions } from "../components/SessionRowActions";

export function SessionListPage({ entity }: { entity: EntityConfig }) {
  const navigate = useNavigate();
  const { activeRole, hasPermission } = usePermissions();
  const [deleteSession, setDeleteSession] = useState<SessionDTO | null>(null);
  const isAdmin = normalizeRole(activeRole) === "ADMIN";
  const table = useProTable(entity.api, entity.schema, {
    permissionOverrides: {
      canCreate: isAdmin && hasPermission("SESSION_CREATE"),
      canUpdate: isAdmin && hasPermission("SESSION_UPDATE"),
      canDelete: isAdmin && hasPermission("SESSION_DELETE"),
    },
  });
  const browseMode =
    normalizeRole(activeRole) === "STUDENT" ||
    (!table.permission.canCreate &&
      !table.permission.canUpdate &&
      !table.permission.canDelete &&
      !table.permission.canImport &&
      !table.permission.canExport);

  return (
    <MainLayout pathName={{ sessions: entity.name }}>
      <ProTable<SessionDTO>
        table={table}
        mode={browseMode ? "browse" : "default"}
        hideActions={browseMode}
        headerActions={
          table.permission.canCreate ? (
            <ActionButton
              title="Create"
              tooltip="Tạo buổi học"
              icon={<Plus size={16} />}
              variant="default"
              onClick={() => navigate("/sessions/create")}
            />
          ) : null
        }
        onView={(session) => navigate("/sessions/" + session.id)}
        renderRowActions={(session) => {
          const isDraft = session.calendarVersionStatus === "DRAFT";
          const canChange = isDraft && session.status === "SCHEDULED";
          return (
            <>
              {table.permission.canRead && (
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Xem chi tiết"
                  title="Xem chi tiết"
                  onClick={() => navigate("/sessions/" + session.id)}
                >
                  <Eye className="size-3.5 text-muted-foreground" />
                </Button>
              )}
              {table.permission.canUpdate && (
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Chỉnh sửa buổi học"
                  title={
                    !isDraft
                      ? "Chỉ sửa buổi học trong DRAFT"
                      : !canChange
                        ? "Chỉ sửa buổi học đang SCHEDULED"
                        : "Chỉnh sửa buổi học"
                  }
                  disabled={!canChange}
                  onClick={() => navigate("/sessions/" + session.id + "/edit")}
                >
                  <Pen className="size-3.5 text-muted-foreground" />
                </Button>
              )}
              {table.permission.canDelete && (
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Xóa buổi học"
                  title={
                    !isDraft
                      ? "Chỉ xóa buổi học trong DRAFT"
                      : !canChange
                        ? "Chỉ xóa buổi học đang SCHEDULED"
                        : "Xóa buổi học"
                  }
                  disabled={!canChange}
                  onClick={() => setDeleteSession(session)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
              <SessionRowActions session={session} />
            </>
          );
        }}
        extraRowActions={entity.extraRowActions}
      />
      {deleteSession && (
        <SessionDeleteDialog
          key={deleteSession.id}
          session={deleteSession}
          onClose={() => setDeleteSession(null)}
          onDeleted={() => setDeleteSession(null)}
        />
      )}
    </MainLayout>
  );
}
