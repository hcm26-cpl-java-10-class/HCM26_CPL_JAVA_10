import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { CourseExam } from "@/types";

export function CurriculumAssessment({ exam }: { exam: CourseExam }) {
  const returnTo = `/courses/${exam.courseId}#course-assessments`;
  return <div className="flex flex-wrap items-center justify-between gap-2">
    <div><p className="font-medium">{exam.title}</p>
      <p className="text-xs text-muted-foreground">{exam.category} · {exam.durationMinutes} min · Weight: {exam.courseWeight == null ? "Not set" : `${exam.courseWeight}%`}</p>
    </div>
    <Button asChild variant="outline" size="sm"><Link to={returnTo}>Configure assessment</Link></Button>
  </div>;
}
