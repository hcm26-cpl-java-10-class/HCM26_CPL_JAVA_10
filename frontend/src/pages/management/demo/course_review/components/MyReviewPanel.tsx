import { useState } from "react";
import { Star, Pencil, X, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { CourseReviewResponse } from "@/types";

interface MyReviewPanelProps {
  review: CourseReviewResponse;
  isSubmitting: boolean;
  onSubmit: (data: {
    rating: number;
    comment: string;
  }) => void;
  onCancel: () => void;
  isEditing: boolean;
  onEdit: () => void;
}

function RatingStars({
  rating,
  size = "md",
}: {
  rating: number;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`${size === "sm" ? "h-4 w-4" : "h-5 w-5"} ${
            index < rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

function RatingPicker({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 5 }, (_, index) => {
        const value = index + 1;

        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className="transition-transform hover:scale-110"
            aria-label={`Rate ${value} out of 5`}
          >
            <Star
              className={`h-7 w-7 ${
                value <= rating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function MyReviewPanel({
  review,
  isSubmitting,
  onSubmit,
  onCancel,
  isEditing,
  onEdit
}: MyReviewPanelProps) {
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment ?? "");
  const [isExpanded, setIsExpanded] = useState(false);
  const COMMENT_PREVIEW_LENGTH = 180;

  const shouldShowMore =
    (review.comment?.length ?? 0) > COMMENT_PREVIEW_LENGTH;

  const handleCancel = () => {
    setRating(review.rating);
    setComment(review.comment ?? "");
    onCancel();
  };

  const handleSubmit = () => {
    onSubmit({
      rating,
      comment: comment.trim(),
    });
  };

  if (!isEditing) {
    return (
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Your Review</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Your review
              </span>
            </div>

            <RatingStars rating={review.rating} />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit()}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit Review
          </Button>
        </div>

        {review.comment ? (
          <div>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {isExpanded || !shouldShowMore
                    ? review.comment
                    : `${review.comment.slice(0, COMMENT_PREVIEW_LENGTH).trimEnd()}...`}
                </p>

                {shouldShowMore && (
                <button
                    type="button"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                    {isExpanded ? "Show less" : "Show more"}
                </button>
                )}
            </div>
            ) : (
            <p className="text-sm italic text-muted-foreground">
                No written comment.
            </p>
            )}
        </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <div>
        <h3 className="font-semibold">Edit Your Review</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your rating and share your thoughts about this course.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Your Rating</label>
        <RatingPicker rating={rating} onChange={setRating} />
      </div>

      <div className="space-y-2">
        <label htmlFor="review-comment" className="text-sm font-medium">
          Your Comment (Optional)
        </label>

        <Textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Share your experience with this course..."
          maxLength={2000}
          rows={4}
          disabled={isSubmitting}
        />

        <p className="text-right text-xs text-muted-foreground">
          {comment.length}/2000
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || rating < 1 || rating > 5}
        >
          <Save className="mr-2 h-4 w-4" />
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}