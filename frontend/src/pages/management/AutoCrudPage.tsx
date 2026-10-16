import { ProTable } from "@/components/datatable/ProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { MainLayout } from "@/components/layout/MainLayout";
import { PermissionGate } from "@/components/PermissionGate";
import { normalizeEntityActionPath, resolveEntityActionPath } from "@/router/entity-action.utils";
import type { EntityConfig } from "@/types";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AutoCrudPageProps {
    entity: EntityConfig;
}

export const AutoCrudPage = ({ entity }: AutoCrudPageProps) => {
    const navigate = useNavigate();
    const { activeRole } = usePermissions();
    const breadcrumbKey = entity.path.replace(/^\/+/, "");

    const table = useProTable(entity.api, entity.schema);

    const createPage = entity.actionPages?.create;
    const editPage = entity.actionPages?.edit;
    const detailPage = entity.actionPages?.detail;

    const headerActions = useMemo(() => {
        if (!createPage) {
            return undefined;
        }

        return (
            <PermissionGate permission={createPage.requiredPermission || table.permission?.keys?.create}>
                <ActionButton
                    onClick={() => navigate(normalizeEntityActionPath(entity.path, createPage.path))}
                    tooltip={`Create ${entity.name}`}
                    title="Create"
                    variant="default"
                    icon={<Plus size={16} />}
                />
            </PermissionGate>
        );
    }, [createPage, entity.name, navigate, table.permission?.keys?.create]);

    const allHeaderActions = (
        <div className="flex items-center gap-2">
            {headerActions}
            {entity.headerActions}
        </div>
    );

    const onEdit = useMemo(() => {
        if (!editPage) {
            return undefined;
        }

        return (row: any) => {
            const pathTemplate = normalizeEntityActionPath(entity.path, editPage.path);
            const path = resolveEntityActionPath(pathTemplate, row, entity.schema.idField);

            if (!path) {
                toast.error("Unable to open edit page because row id is missing.");
                return;
            }

            navigate(path);
        };
    }, [editPage, entity.schema.idField, navigate]);

    const onView = useMemo(() => {
        if (!detailPage) {
            return undefined;
        }

        return (row: any) => {
            const pathTemplate = normalizeEntityActionPath(entity.path, detailPage.path);
            const path = resolveEntityActionPath(pathTemplate, row, entity.schema.idField);

            if (!path) {
                toast.error("Unable to open detail page because row id is missing.");
                return;
            }

            navigate(path);
        };
    }, [detailPage, entity.schema.idField, navigate]);

    const isStudentRole = normalizeRole(activeRole) === STUDENT_ROLE;
    const isReadOnlyLikeRole =
        !!table.permission?.canRead &&
        !table.permission?.canCreate &&
        !table.permission?.canUpdate &&
        !table.permission?.canDelete &&
        !table.permission?.canImport &&
        !table.permission?.canExport;

    const browseMode = isStudentRole || isReadOnlyLikeRole;

    return (
        <MainLayout pathName={{ [breadcrumbKey]: entity.name }}>
            <ProTable
                table={table}
                mode={browseMode ? "browse" : "default"}
                headerActions={browseMode ? undefined : allHeaderActions}
                hideActions={browseMode}
                onEdit={browseMode ? undefined : onEdit}
                onView={onView}
                renderCard={entity.cardRenderer}
            />
        </MainLayout>
    );
};
