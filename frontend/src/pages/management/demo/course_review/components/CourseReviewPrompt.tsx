import { courseReviewApi } from "@/api";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Eye, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CourseReviewPromptProps {
  courseId: number;
}

export function CourseReviewPrompt({
  courseId,
}: CourseReviewPromptProps) {
  const navigate = useNavigate();

  const eligibilityQuery = useQuery({
    queryKey: ["course-review-eligibility", courseId],
    queryFn: () => courseReviewApi.getEligibility(courseId),
    enabled: Number.isInteger(courseId) && courseId > 0,
    retry: false,
  });

  const eligibility = eligibilityQuery.data;

  const handleReviewNavigation = () => {
    navigate(`/courses/${courseId}#reviews`);
  };

  if (eligibilityQuery.isLoading) {
    return (
      <div className="mt-3 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">
          Checking review status...
        </p>
      </div>
    );
  }

  if (eligibilityQuery.isError) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">
          Could not load your review status.
        </p>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void eligibilityQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!eligibility?.completed) {
    return null;
  }

  const hasReviewed = eligibility.hasReviewed;

  return (
    <div className="mt-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {hasReviewed ? (
              <CheckCircle2 className="size-5 text-green-600" />
            ) : (
              <Star className="size-5 text-amber-500" />
            )}

            <p className="font-semibold">
              {hasReviewed
                ? "Review Submitted"
                : "Share Your Experience"}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            {hasReviewed
              ? "Thank you for sharing your feedback!"
              : "Your feedback helps other students choose the right course."}
          </p>
        </div>

        {hasReviewed ? (
          <Button
            variant="outline"
            onClick={handleReviewNavigation}
          >
            <Eye className="size-4" />
            View Your Review
          </Button>
        ) : eligibility.canReview ? (
          <Button onClick={handleReviewNavigation}>
            <Star className="size-4" />
            Write a Review
          </Button>
        ) : null}
      </div>
    </div>
  );
}