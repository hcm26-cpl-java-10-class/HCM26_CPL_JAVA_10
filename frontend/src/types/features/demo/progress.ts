import type { LessonContentType } from "./lesson";

export interface LessonProgressItem {
  lessonId: number;
  sectionId: number;
  sectionTitle: string;
  title: string;
  contentType: LessonContentType;
  contentUrl?: string | null;
  textContent?: string | null;
  duration?: number | null;
  orderIndex: number;
  studentAnswer?: string | null;
  completed: boolean;
  completedAt?: string | null;
  lastAccessedAt?: string | null;
}

export interface EnrollmentProgress {
  enrollmentId: number;
  courseId: number;
  courseName: string;
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
  lastLessonId?: number | null;
  lastAccessedAt?: string | null;
  lessons: LessonProgressItem[];
}
