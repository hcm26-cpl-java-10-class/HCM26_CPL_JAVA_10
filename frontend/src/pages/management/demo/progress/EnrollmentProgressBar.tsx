import { progressApi } from "@/api";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";

export function EnrollmentProgressBar({ enrollmentId }: { enrollmentId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["lesson-progress", enrollmentId],
    queryFn: () => progressApi.getByEnrollment(enrollmentId),
  });
  const percentage = data?.progressPercentage ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Progress</span>
        <span>{isLoading ? "…" : `${percentage}%`}</span>
      </div>
      <Progress value={percentage} aria-label="Course progress" />
    </div>
  );
}
