
import { Star } from "lucide-react";

interface CourseRatingProps {
  averageRating?: number;
  totalReviews?: number;
  className?: string;
  showReviewCount?: boolean;
}

export function CourseRating({
  averageRating = 0,
  totalReviews = 0,
  className = "",
  showReviewCount = true,
}: CourseRatingProps) {
  if (totalReviews <= 0) return null;

  const rating = Math.min(5, Math.max(0, averageRating));

  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-sm ${className}`}
      aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${totalReviews} reviews`}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, index) => {
          const fillPercentage = Math.min(
            100,
            Math.max(0, (rating - index) * 100)
          );

          return (
            <span
              key={index}
              className="relative inline-flex size-4"
            >
              <Star className="absolute inset-0 size-4 text-muted-foreground/30" />

              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fillPercentage}%` }}
              >
                <Star className="size-4 fill-amber-400 text-amber-400" />
              </span>
            </span>
          );
        })}
      </div>

      <span className="font-semibold text-foreground">
        {rating.toFixed(1)}
      </span>

      {showReviewCount && (
        <span className="text-muted-foreground">
          ({totalReviews.toLocaleString()} ratings)
        </span>
      )}
    </div>
  );
}