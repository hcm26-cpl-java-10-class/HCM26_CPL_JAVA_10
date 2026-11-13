import { useQuery } from "@tanstack/react-query";
import { courseReportApi } from "@/api/features/demo/course-report.api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  value: number | null;
  onChange: (courseId: number) => void;
  disabled?: boolean;
};

/** Courses the current user is allowed to view (admin: all, instructor: own courses). */
export function AnalyticsCourseSelect({ value, onChange, disabled }: Props) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["course-report"],
    queryFn: courseReportApi.getCourseEnrollmentReport,
  });

  const courses = data.filter((row) => row.courseId != null);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-muted-foreground">Course</span>
      <Select
        value={value == null ? undefined : String(value)}
        onValueChange={(next) => onChange(Number(next))}
        disabled={disabled || isLoading || !courses.length}
      >
        <SelectTrigger className="w-full min-w-64">
          <SelectValue
            placeholder={
              isLoading ? "Loading courses..." : "Select a course to analyse"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {courses.map((course) => (
            <SelectItem key={course.courseId} value={String(course.courseId)}>
              {course.courseName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}