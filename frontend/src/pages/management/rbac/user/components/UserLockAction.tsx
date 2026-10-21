
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";

import { userApi } from "@/api";
import { roleApi } from "@/api/features/rbac/role.api";
import ActionButton from "@/components/datatable/common/ActionButton";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole } from "@/utils/rbac.utils";
import type { UserDTO } from "@/types";

interface Props {
    user: UserDTO;
    onSuccess: () => void;
}

export function UserLockAction({ user, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);
    const {
        activeRole,
        user: currentUser,
        isPreviewMode,
    } = usePermissions();

    const isAdmin = normalizeRole(activeRole) === "ADMIN";

    const { data: rolesPage, isLoading: rolesLoading, isError: rolesError } =
        useQuery({
            queryKey: ["roles", "lock-action"],
            queryFn: () => roleApi.getPage({ page: 0, size: 1000 }),
            enabled: isAdmin && !isPreviewMode,
            staleTime: 5 * 60 * 1000,
        });

    const isTargetAdmin = rolesPage?.content?.some(
        (role) =>
            role.name?.toUpperCase() === "ADMIN" &&
            user.roleIds?.some(
                (roleId) => String(roleId) === String(role.id)
            )
    );

    const isSelf =
        !!user.email &&
        !!currentUser.email &&
        user.email.toLowerCase() === currentUser.email.toLowerCase();

    if (!isAdmin || isPreviewMode) {
        return null;
    }

    // Do not show actions until role information is available.
    if (rolesLoading || rolesError || !rolesPage) {
        return null;
    }

    // Backend prevents locking ADMIN accounts.
    if (isTargetAdmin) {
        return null;
    }

    const handleToggleLock = async () => {
        if (user.id == null || loading) return;

        if (!user.locked && isSelf) {
            toast.error("You cannot lock your own account");
            return;
        }

        setLoading(true);

        try {
            if (user.locked) {
                await userApi.unlockUser(user.id);
                toast.success("User unlocked successfully");
            } else {
                await userApi.lockUser(user.id);
                toast.success("User locked successfully");
            }

            onSuccess();
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                "Failed to update user lock status"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <ActionButton
            onClick={handleToggleLock}
            tooltip={user.locked ? "Unlock user" : "Lock user"}
            icon={
                user.locked ? (
                    <LockOpen size={14} />
                ) : (
                    <Lock size={14} />
                )
            }
            disabled={loading || (!user.locked && isSelf)}
        />
    );
}
