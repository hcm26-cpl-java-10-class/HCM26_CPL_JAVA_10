import { Link, useSearchParams } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import type { LessonDTO } from "@/types";
export function ConfigureAssessmentLink({ lesson }: { lesson: LessonDTO }) {
  const { activeRole, hasPermission } = usePermissions();
  const [params] = useSearchParams();
  if (["STUDENT", "GUEST"].includes(activeRole ?? "") || !hasPermission("COURSE_READ") || !hasPermission("EXAM_READ") || !hasPermission("EXAM_UPDATE") || !["QUIZ","EXAM","ASSIGNMENT"].includes(lesson.contentType ?? "")) return null;
  if (!lesson.id) return <p className="text-sm text-muted-foreground">Save the lesson first to configure its assessment.</p>;
  const courseId = Number(lesson.courseId || params.get("courseId"));
  if (!Number.isSafeInteger(courseId) || courseId<=0) return <p className="text-sm">Select this lesson's course in Curriculum to configure its assessment.</p>;
  return <Button asChild variant="outline" size="sm"><Link to={`/courses/${courseId}?assessmentLessonId=${lesson.id}&assessmentSectionId=${lesson.sectionId ?? ""}#course-assessments`}>Configure assessment</Link></Button>;
}
