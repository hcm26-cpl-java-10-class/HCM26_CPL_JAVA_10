import { Navigate } from "react-router-dom";

import StudentInvitationList from "@/components/features/invitation/StudentInvitationList";
import InvitationsLandingPage from "@/pages/invitations/InvitationsLandingPage";
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
