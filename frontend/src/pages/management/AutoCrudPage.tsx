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
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { userApi } from "@/api/features/rbac/user.api";
import { Lock, LockOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface AutoCrudPageProps {
    entity: EntityConfig;
}

export const AutoCrudPage = ({ entity }: AutoCrudPageProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [lockingUserId, setLockingUserId] = useState<string | number | null>(null);
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
    const isProtectedAdmin = (row: any) => {
        return row.roleIds?.some(
            (roleId: string | number) => Number(roleId) === 1
        ) ?? false;
    };
    const handleToggleLock = async (row: any) => {

        if (row.roleIds?.some((roleId: number) => Number(roleId) === 1)) {
            toast.error("Admin accounts cannot be blocked");
            return;
        }
        if (!isUserManagement || !isAdminRole) return;

        const id = row[entity.schema.idField];

        if (id == null) {
            toast.error("User ID not found");
            return;
        }

        if (lockingUserId !== null) return;

        if (isProtectedAdmin(row)) {
            toast.error("Admin accounts cannot be blocked");
            return;
        }

        const isLocked = row.locked === true;
        const action = isLocked ? "unblock" : "block";

        const confirmed = window.confirm(
            `Are you sure you want to ${action} user "${row.username}"?`
        );

        if (!confirmed) return;

        try {
            setLockingUserId(id);

            if (isLocked) {
                await userApi.unlockUser(id);
            } else {
                await userApi.lockUser(id);
            }

            toast.success(
                isLocked
                    ? "User unblocked successfully"
                    : "User blocked successfully"
            );

            await queryClient.invalidateQueries({
                queryKey: [entity.schema.entityName],
            });
        } catch (error) {
            console.error(error);
            toast.error(`Failed to ${action} user`);
        } finally {
            setLockingUserId(null);
        }
    };
    const isStudentRole = normalizedActiveRole === STUDENT_ROLE;

    const headerActions = useMemo(() => {
        if (!createPage) {
            return undefined;
        }

        const createPath = normalizeEntityActionPath(
            entity.path,
            createPage.path
        );

        // Ưu tiên hiển thị nút tạo tài khoản ở trang Users cho Admin
        if (isUserManagement && isAdminRole) {
            return (
                <ActionButton
                    onClick={() => navigate(createPath)}
                    tooltip="Tạo tài khoản học sinh / giáo viên"
                    title="Tạo tài khoản"
                    variant="default"
                    icon={<Plus size={16} />}
                />
            );
        }

        return (
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
        );
    }, [
        createPage,
        entity.name,
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
                extraRowActions={
                    isUserManagement && isAdminRole && !browseMode
                        ? (row: any) => {
                            if (isProtectedAdmin(row)) {
                                return null;
                            }

                            return (
                                <ActionButton
                                    onClick={() => handleToggleLock(row)}
                                    tooltip={row.locked ? "Unblock user" : "Block user"}
                                    icon={
                                        row.locked ? (
                                            <LockOpen size={14} className="text-green-600" />
                                        ) : (
                                            <Lock size={14} className="text-red-500" />
                                        )
                                    }
                                />
                            );
                        }
                        : undefined
                }
            />
        </MainLayout>
    );
};