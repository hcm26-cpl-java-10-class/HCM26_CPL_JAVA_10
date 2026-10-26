import { invitationApi } from "@/api";
import type { InvitationDTO } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { STUDENT_ROLE, normalizeRole } from "@/utils/rbac.utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Key dùng chung cho danh sách lời mời của student.
 *
 * StudentInvitationList và InvitationBell phải dùng CÙNG key này để chia sẻ cache:
 * khi student bấm "Chấp nhận", setQueryData trong trang danh sách sẽ cập nhật
 * cache ngay, badge trên chuông tự giảm mà không cần chờ refetch.
 */
export const studentInvitationsQueryKey = ["student-invitations"] as const;

/** Khoảng thời gian tự động hỏi lại server để phát hiện lời mời mới. */
const POLL_INTERVAL_MS = 30_000;

/**
 * Một lời mời được coi là "còn việc phải làm" khi đang ở trạng thái chờ phản hồi
 * và chưa quá hạn. Lời mời không có expiresAt được hiểu là không giới hạn hạn.
 */
export function isInvitationPending(invitation: InvitationDTO, now: number = Date.now()): boolean {
    const isPendingStatus = invitation.status === "PENDING" || invitation.status === "SENT";
    if (!isPendingStatus) return false;

    if (!invitation.expiresAt) return true;

    const expiresAt = new Date(invitation.expiresAt).getTime();
    if (Number.isNaN(expiresAt)) return true;

    return expiresAt > now;
}

/**
 * Đếm số lời mời thi đang chờ phản hồi của student hiện tại.
 *
 * Chỉ chạy khi role hiện tại là STUDENT — TEACHER/ADMIN không vào trang này nên
 * tránh được request thừa mỗi 30s.
 */
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
    // useMemo để mảng pending giữ nguyên tham chiếu giữa các lần render,
    // tránh useEffect toast trong InvitationBell chạy lại vô ích.
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
