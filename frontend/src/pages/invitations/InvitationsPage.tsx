import { Navigate } from "react-router-dom";

import InvitationsLandingPage from "@/pages/management/exam/invitations";
import StudentInvitationList from "@/components/features/invitation/StudentInvitationList";
import { usePermissions } from "@/hooks/usePermissions";
import { STUDENT_ROLE, normalizeRole } from "@/utils/rbac.utils";

export default function InvitationsPage() {
    const { activeRole } = usePermissions();
    const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;

    return isStudent ? <StudentInvitationList /> : <InvitationsLandingPage />;
}

export function StudentInvitationsRedirect() {
    return <Navigate to="/invitations" replace />;
}
