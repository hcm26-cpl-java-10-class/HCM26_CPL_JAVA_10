export interface LessonAnswer {
  id: number;
  questionId: number;
  content: string;
  authorId: number;
  authorName: string;
  byInstructor: boolean;
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
  answers: LessonAnswer[];
}

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
