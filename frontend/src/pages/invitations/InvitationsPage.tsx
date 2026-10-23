import { Navigate } from "react-router-dom";

import InvitationsLandingPage from "@/pages/management/exam/invitations";
import StudentInvitationList from "@/components/features/invitation/StudentInvitationList";
import { usePermissions } from "@/hooks/usePermissions";
import { STUDENT_ROLE, normalizeRole } from "@/utils/rbac.utils";

/**
 * Trang /invitations chung cho cả 3 role. Tự phân nhánh theo `activeRole`:
 * - STUDENT: xem lời mời của mình dưới dạng notification, bấm Chấp nhận → vào thi.
 * - TEACHER / ADMIN: trang quản lý invitation của giáo viên (chọn đề thi → quản lý).
 *
 * Route /student/invitations cũ redirect về đây để giữ tương thích bookmark.
 */
export default function InvitationsPage() {
    const { activeRole } = usePermissions();
    const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;

    return isStudent ? <StudentInvitationList /> : <InvitationsLandingPage />;
}

export function StudentInvitationsRedirect() {
    return <Navigate to="/invitations" replace />;
}
