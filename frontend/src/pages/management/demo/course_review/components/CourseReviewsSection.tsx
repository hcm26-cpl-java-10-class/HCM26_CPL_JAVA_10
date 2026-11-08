import { courseReviewApi } from "@/api";
import type {
  CourseReviewRequest,
  CourseReviewResponse,
  CourseReviewSummary,
  CourseReviewEligibility,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { MyReviewPanel } from "./MyReviewPanel";
import { ReviewAuthor, ReviewComment } from "./ReviewDisplay";

const PAGE_SIZE = 5;

interface CourseReviewsSectionProps {
  courseId: number;
}

function formatReviewDate(value?: string) {
  if (!value) return "Recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return date.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function RatingStars({
  rating,
  size = "md",
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = {
    sm: "size-3.5",
    md: "size-4",
    lg: "size-6",
  }[size];

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`${sizeClass} ${
            value <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/40"
          }`}
        />
      ))}
    </span>
  );
}

function RatingPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Choose a rating">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          aria-label={`${rating} star${rating > 1 ? "s" : ""}`}
          disabled={disabled}
          onClick={() => onChange(rating)}
          className="rounded-sm p-1 transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            className={`size-7 ${
              rating <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function RatingSummary({ summary }: { summary: CourseReviewSummary }) {
  const average = Number(summary.averageRating ?? 0);
  const total = summary.totalReviews ?? 0;
  const distribution = summary.ratingDistribution ?? {};

  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Student reviews</h2>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          This course has not received any reviews yet.
        </p>
      ) : (
        <div className="mt-5 grid gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center rounded-xl bg-muted/40 p-5">
            <span className="text-5xl font-bold tabular-nums">
              {average.toFixed(1)}
            </span>
            <RatingStars rating={Math.round(average)} size="md" />
            <span className="mt-2 text-sm text-muted-foreground">
              {total} {total === 1 ? "review" : "reviews"}
            </span>
          </div>

          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = distribution[rating] ?? 0;
              const percentage = total > 0 ? (count / total) * 100 : 0;

              return (
                <div key={rating} className="flex items-center gap-3 text-sm">
                  <span className="w-3 text-muted-foreground">{rating}</span>
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewForm({
  initialReview,
  isSubmitting,
  onSubmit,
}: {
  initialReview: CourseReviewResponse | null;
  isSubmitting: boolean;
  onSubmit: (data: CourseReviewRequest) => void;
}) {
  const [rating, setRating] = useState(initialReview?.rating ?? 5);
  const [comment, setComment] = useState(initialReview?.comment ?? "");

  useEffect(() => {
    setRating(initialReview?.rating ?? 5);
    setComment(initialReview?.comment ?? "");
  }, [initialReview?.id, initialReview?.rating, initialReview?.comment]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (rating < 1 || rating > 5) {
      toast.error("Please select a rating from 1 to 5 stars.");
      return;
    }

    onSubmit({
      rating,
      comment: comment.trim() || null,
    });
  };

  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {initialReview ? "Edit your review" : "Write a review"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your experience to help other students choose this course.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Your rating</p>
          <RatingPicker
            value={rating}
            onChange={setRating}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="course-review-comment" className="text-sm font-medium">
            Your comment <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="course-review-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 2000))}
            placeholder="What did you like about this course? What could be improved?"
            rows={4}
            maxLength={2000}
            disabled={isSubmitting}
          />
          <p className="text-right text-xs text-muted-foreground">
            {comment.length}/2000
          </p>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="mr-2 size-4 animate-spin" />}
          {initialReview ? "Update review" : "Submit review"}
        </Button>
      </form>
    </section>
  );
}

function ReviewList({
  reviews,
  isLoading,
}: {
  reviews: CourseReviewResponse[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        Loading reviews...
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center">
        <MessageSquare className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">No reviews yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Be the first student to share your experience.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ReviewAuthor
                name={review.studentFullName}
                >
                <RatingStars rating={review.rating} size="sm" />
            </ReviewAuthor>
            <time className="text-xs text-muted-foreground">
              {formatReviewDate(review.createdAt)}
            </time>
          </div>

            <div className="mt-4">
                <ReviewComment comment={review.comment} />
            </div>
        </article>
      ))}
    </div>
  );
}

export function CourseReviewsSection({ courseId }: CourseReviewsSectionProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [isEditingMyReview, setIsEditingMyReview] = useState(false);

  const reviewsQuery = useQuery({
    queryKey: ["course-reviews", courseId, page],
    queryFn: () => courseReviewApi.getReviews(courseId, { page, size: PAGE_SIZE }),
    enabled: Number.isInteger(courseId) && courseId > 0,
  });

  const summaryQuery = useQuery({
    queryKey: ["course-review-summary", courseId],
    queryFn: () => courseReviewApi.getSummary(courseId),
    enabled: Number.isInteger(courseId) && courseId > 0,
  });

  const eligibilityQuery = useQuery({
    queryKey: ["course-review-eligibility", courseId],
    queryFn: () => courseReviewApi.getEligibility(courseId),
    enabled: Number.isInteger(courseId) && courseId > 0,
    retry: false,
  });

  const eligibility: CourseReviewEligibility | undefined = eligibilityQuery.data;
  const myReview = eligibility?.myReview ?? null;

  const refreshReviewQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["course-reviews", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["course-review-summary", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["course-review-eligibility", courseId] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (data: CourseReviewRequest) =>
      courseReviewApi.createReview(courseId, data),
    onSuccess: async () => {
      toast.success("Your review has been submitted.");
      setPage(0);
      await refreshReviewQueries();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not submit your review."));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CourseReviewRequest) =>
      courseReviewApi.updateMyReview(courseId, data),
    onSuccess: () => {
        setIsEditingMyReview(false);

        queryClient.invalidateQueries({
            queryKey: ["course-reviews", courseId],
        });

        queryClient.invalidateQueries({
            queryKey: ["course-review-summary", courseId],
        });

        queryClient.invalidateQueries({
            queryKey: ["course-review-eligibility", courseId],
        });

        toast.success("Your review has been updated successfully.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not update your review."));
    },
  });

  const handleSubmit = (data: CourseReviewRequest) => {
    if (myReview) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const reviews = reviewsQuery.data?.content ?? [];
  const totalPages = reviewsQuery.data?.totalPages ?? 0;

  return (
    <section className="space-y-6" aria-labelledby="course-reviews-heading">
      <div>
        <h2 id="course-reviews-heading" className="text-2xl font-bold tracking-tight">
          Reviews & ratings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Feedback from students who have taken this course.
        </p>
      </div>

      {summaryQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : summaryQuery.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 p-4">
          <p className="text-sm text-destructive">Could not load the rating summary.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void summaryQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : summaryQuery.data ? (
        <RatingSummary summary={summaryQuery.data} />
      ) : null}

    {!eligibilityQuery.isLoading &&
    !eligibilityQuery.isError &&
    eligibility?.completed &&
    (
        eligibility.hasReviewed && myReview ? (
        <MyReviewPanel
            key={`my-review-${myReview.id}`}
            review={myReview}
            isSubmitting={isSubmitting}
            isEditing={isEditingMyReview}
            onEdit={() => setIsEditingMyReview(true)}
            onCancel={() => setIsEditingMyReview(false)}
            onSubmit={handleSubmit}
        />
        ) : eligibility.canReview ? (
        <ReviewForm
            key="new-review"
            initialReview={null}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
        />
        ) : null
    )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">All reviews</h3>

        {reviewsQuery.isError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 p-4">
            <p className="text-sm text-destructive">Could not load course reviews.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void reviewsQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <ReviewList
            reviews={reviews}
            isLoading={reviewsQuery.isLoading}
          />
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || reviewsQuery.isFetching}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1 || reviewsQuery.isFetching}
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
