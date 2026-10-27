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