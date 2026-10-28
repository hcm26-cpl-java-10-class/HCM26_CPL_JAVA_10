import { ProTable } from "@/components/datatable/ProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { MainLayout } from "@/components/layout/MainLayout";
import { PermissionGate } from "@/components/PermissionGate";
import {
    normalizeEntityActionPath,
    resolveEntityActionPath,
} from "@/router/entity-action.utils";
import type { EntityConfig } from "@/types";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { usePermissions } from "@/hooks/usePermissions";
import {
    ADMIN_ROLE,
    normalizeRole,
    STUDENT_ROLE,
} from "@/utils/rbac.utils";
import { Plus, ShieldCheck } from "lucide-react";
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

    // Khai báo trước khi sử dụng trong useMemo
    const normalizedActiveRole = normalizeRole(activeRole);
    const isAdminRole = normalizedActiveRole === ADMIN_ROLE;
    const isUserManagement = entity.path === "/users";
    const isStudentRole = normalizedActiveRole === STUDENT_ROLE;

    const headerActions = useMemo(() => {
        const matrixAction = entity.path === "/permissions" ? (
            <PermissionGate permission="ROLE_UPDATE">
                <ActionButton
                    onClick={() => navigate("/role-permissions")}
                    tooltip="Open role permission matrix"
                    title="Permission matrix"
                    variant="outline"
                    icon={<ShieldCheck size={16} />}
                />
            </PermissionGate>
        ) : null;

        if (!createPage) {
    if (entity.path === "/permissions") {
        return (
            <>
                {matrixAction}

                {table.permission?.canCreate && (
                    <PermissionGate
                        permission={table.permission?.keys?.create}
                    >
                        <ActionButton
                            onClick={() => table.openCreate()}
                            tooltip="Create Permission"
                            title="Create"
                            variant="default"
                            icon={<Plus size={16} />}
                        />
                    </PermissionGate>
                )}
            </>
        );
    }

    // Những trang khác, bao gồm Role:
    // sử dụng nút Create mặc định của ToolbarActions.
    return undefined;
}

        const createPath = normalizeEntityActionPath(
            entity.path,
            createPage.path
        );

        // Ưu tiên hiển thị nút tạo tài khoản ở trang Users cho Admin
        if (isUserManagement && isAdminRole) {
            return (
                <>
                    {matrixAction}
                    <ActionButton
                        onClick={() => navigate(createPath)}
                        tooltip="Tạo tài khoản học sinh / giáo viên"
                        title="Tạo tài khoản"
                        variant="default"
                        icon={<Plus size={16} />}
                    />
                </>
            );
        }

        return (
            <>
                {matrixAction}
                <PermissionGate
                    permission={
                        createPage.requiredPermission ||
                        table.permission?.keys?.create
                    }
                >
                    <ActionButton
                        onClick={() => navigate(createPath)}
                        tooltip={`Create ${entity.name}`}
                        title="Create"
                        variant="default"
                        icon={<Plus size={16} />}
                    />
                </PermissionGate>
            </>
        );
    }, [
        createPage,
        entity.name,
        entity.path,
        entity.path,
        isAdminRole,
        isUserManagement,
        navigate,
        table.permission?.keys?.create,
    ]);

    const onEdit = useMemo(() => {
        if (!editPage) {
            return undefined;
        }

        return (row: any) => {
            const pathTemplate = normalizeEntityActionPath(
                entity.path,
                editPage.path
            );
            const path = resolveEntityActionPath(
                pathTemplate,
                row,
                entity.schema.idField
            );

            if (!path) {
                toast.error(
                    "Unable to open edit page because row id is missing."
                );
                return;
            }

            navigate(path);
        };
    }, [editPage, entity.path, entity.schema.idField, navigate]);

    const onView = useMemo(() => {
        if (!detailPage) {
            return undefined;
        }

        return (row: any) => {
            const pathTemplate = normalizeEntityActionPath(
                entity.path,
                detailPage.path
            );
            const path = resolveEntityActionPath(
                pathTemplate,
                row,
                entity.schema.idField
            );

            if (!path) {
                toast.error(
                    "Unable to open detail page because row id is missing."
                );
                return;
            }

            navigate(path);
        };
    }, [detailPage, entity.path, entity.schema.idField, navigate]);

    const isReadOnlyLikeRole =
        !!table.permission?.canRead &&
        !table.permission?.canCreate &&
        !table.permission?.canUpdate &&
        !table.permission?.canDelete &&
        !table.permission?.canImport &&
        !table.permission?.canExport;

    const browseMode =
        isStudentRole ||
        (isReadOnlyLikeRole && !(isUserManagement && isAdminRole));

    return (
        <MainLayout pathName={{ [breadcrumbKey]: entity.name }}>
            <ProTable
                table={table}
                mode={browseMode ? "browse" : "default"}
                headerActions={browseMode ? undefined : headerActions}
                hideActions={browseMode}
                onEdit={browseMode ? undefined : onEdit}
                onView={onView}
                renderCard={entity.cardRenderer}
            />
        </MainLayout>
    );
};