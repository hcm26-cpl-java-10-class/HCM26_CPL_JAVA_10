export interface LessonAnswer {
  id: number;
  questionId: number;
  content: string;
  authorId: number;
  authorName: string;
  byInstructor: boolean;
  /** This answer is marked as the accepted (correct) answer of its question. */
  accepted: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface LessonQuestion {
  id: number;
  lessonId: number;
  content: string;
  authorId: number;
  authorName: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  answered: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAnswer: boolean;
  /** Pinned by the instructor: always listed first. */
  pinned: boolean;
  pinnedAt?: string | null;
  upvoteCount: number;
  upvotedByMe: boolean;
  /** False for the viewer's own question. */
  canUpvote: boolean;
  /** Instructor / admin only. */
  canPin: boolean;
  /** Asker, instructor or admin (and the question has at least one answer). */
  canAccept: boolean;
  acceptedAnswerId?: number | null;
  /** The accepted answer (if any) comes first. */
  answers: LessonAnswer[];
}

export type QuestionSort = "newest" | "votes";

export interface LessonQuestionPage {
  content: LessonQuestion[];
  totalElements: number;
  totalPages: number;
  /** Zero-based index of this page. */
  number: number;
}

/** A question still waiting for an answer, with enough context to jump to its lesson. */
export interface UnansweredQuestion {
  id: number;
  content: string;
  authorId: number;
  authorName: string;
  createdAt?: string | null;
  lessonId: number;
  lessonTitle: string;
  sectionId: number;
  sectionTitle: string;
  courseId: number;
  courseName: string;
}

export interface UnansweredQuestionPage {
  content: UnansweredQuestion[];
  totalElements: number;
  totalPages: number;
  /** Zero-based index of this page. */
  number: number;
}

export interface CourseUnansweredCount {
  courseId: number;
  courseName: string;
  count: number;
}