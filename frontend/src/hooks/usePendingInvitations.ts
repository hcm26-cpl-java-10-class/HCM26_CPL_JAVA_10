import { invitationApi } from "@/api";
import type { InvitationDTO } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { STUDENT_ROLE, normalizeRole } from "@/utils/rbac.utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export const studentInvitationsQueryKey = ["student-invitations"] as const;

const POLL_INTERVAL_MS = 30_000;

export function isInvitationPending(invitation: InvitationDTO, now: number = Date.now()): boolean {
    const isPendingStatus = invitation.status === "PENDING" || invitation.status === "SENT";
    if (!isPendingStatus) return false;

    if (!invitation.expiresAt) return true;

    const expiresAt = new Date(invitation.expiresAt).getTime();
    if (Number.isNaN(expiresAt)) return true;

    return expiresAt > now;
}

export function usePendingInvitations() {
    const { activeRole } = usePermissions();
    const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;

    const query = useQuery<InvitationDTO[]>({
        queryKey: studentInvitationsQueryKey,
        queryFn: invitationApi.getMyInvitations,
        enabled: isStudent,
        refetchInterval: POLL_INTERVAL_MS,
        staleTime: POLL_INTERVAL_MS / 2,
    });

    const invitations = useMemo(() => query.data ?? [], [query.data]);
    const pending = useMemo(
        () => invitations.filter((invitation) => isInvitationPending(invitation)),
        [invitations],
    );

    return {
        pending,
        count: pending.length,
        isLoading: query.isLoading,
        isError: query.isError,
    };
}
