export interface CourseReviewRequest {
  rating: number;
  comment?: string | null;
}

export interface CourseReviewResponse {
  id: number;
  courseId: number;
  studentId: number;
  studentFullName: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseReviewSummary {
  courseId: number;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}

export interface CourseReviewEligibility {
  completed: boolean;
  canReview: boolean;
  hasReviewed: boolean;
  myReview: CourseReviewResponse | null;
}