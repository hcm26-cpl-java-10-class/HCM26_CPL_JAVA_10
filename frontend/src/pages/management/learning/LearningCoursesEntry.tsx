import { usePermissions } from "@/hooks/usePermissions";
import CourseEnrollmentsPage from "../demo/enrollment/CourseEnrollmentsPage";

export default function LearningCoursesEntry() {
  const { activeRole } = usePermissions();

  if (activeRole === "STUDENT") {
    return <CourseEnrollmentsPage />;
  }

  return <div>Course Management is temporarily unavailable.</div>;
}
