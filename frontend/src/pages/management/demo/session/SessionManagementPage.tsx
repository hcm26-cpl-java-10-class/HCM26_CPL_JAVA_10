import { Plus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { sessionApi } from "@/api/features/demo/session.api";
import ActionButton from "@/components/datatable/common/ActionButton";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { ProTable } from "@/components/datatable/ProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { ClassLabel } from "@/components/session/ClassLabel";
import { useSessionActionController } from "@/components/session/session-actions";
import { SessionActionsMenu } from "@/components/session/SessionActionsMenu";
import { SessionDialogs } from "@/components/session/SessionDialogs";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import type { SessionDTO } from "@/types";
import { sessionSchema } from "./session.schema";

/** "?classId=12" -> 12. Anything else (missing, empty, non-numeric) means "no class context". */
function parseClassId(value: string | null): number | undefined {
    return value && /^[1-9]\d{0,14}$/.test(value) ? Number(value) : undefined;
}

function SessionTable({ classId }: { classId?: number }) {
    const navigate = useNavigate();
    const { hasPermission } = usePermissions();
    const controller = useSessionActionController();

    const table = useProTable(sessionApi, sessionSchema, {
        initialFilters: classId != null ? { classId: String(classId) } : undefined,
        // Sessions are closed with Cancel / Complete, never removed from here
        permissionOverrides: { canDelete: false },
    });

    // Always a node (even an empty one): returning undefined would bring back the generic create form,
    // which bypasses the dialogs that keep the class context and run the full validation.
    const headerActions = hasPermission("SESSION_CREATE") ? (
        <ActionButton
            onClick={() => controller.open({ type: "create", classId })}
            tooltip={classId != null ? "Create a session for this class" : "Create a session"}
            title="Create session"
            variant="default"
            icon={<Plus size={16} />}
        />
    ) : (
        <></>
    );

    return (
        <MainLayout pathName={{ sessions: "Sessions" }}>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
                {classId != null && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-blue-50 px-4 py-2 text-sm dark:bg-blue-950/30">
                        <span className="text-muted-foreground">Showing the sessions of class</span>
                        <ClassLabel classId={classId} asLink showName />
                        <Button asChild variant="outline" size="sm" className="ml-auto">
                            <Link to="/sessions">Show all classes</Link>
                        </Button>
                    </div>
                )}
                <div className="min-h-0 flex-1">
                    <ProTable<SessionDTO>
                        table={table}
                        headerActions={headerActions}
                        renderRowActions={(row) => <SessionActionsMenu session={row} controller={controller} />}
                        onRowClick={(row) => navigate(`/sessions/${row.id}`)}
                    />
                </div>
            </div>
            <SessionDialogs controller={controller} />
        </MainLayout>
    );
}

/** Cross-class session management. `?classId=` opens it for one class, which is how the class calendar links here. */
export default function SessionManagementPage() {
    const [searchParams] = useSearchParams();
    const classId = parseClassId(searchParams.get("classId"));

    // keyed by the class so that following a link to another class starts from fresh table state
    return <SessionTable key={classId ?? "all"} classId={classId} />;
}
