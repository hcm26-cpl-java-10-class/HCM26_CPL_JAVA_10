import { usePermissions } from "@/hooks/usePermissions";
import CourseManagementPage from "../demo/course";
import CourseEnrollmentsPage from "../demo/enrollment/CourseEnrollmentsPage";

// Preserve the Course group's Admin View; Learner View exposes the catalog only.
export default function LearningCoursesEntry() {
  const { activeRole } = usePermissions();
  return activeRole === "STUDENT" ? <CourseEnrollmentsPage /> : <CourseManagementPage />;
}
