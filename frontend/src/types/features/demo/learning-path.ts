export type PathCourseStatus = "COMPLETED" | "IN_PROGRESS" | "AVAILABLE" | "LOCKED";

export interface LearningPathSummary {
  id: number;
  name: string;
  description?: string | null;
  courseCount: number;
  completedCount: number;
  progressPercent: number;
  completed: boolean;
}

export interface LearningPathCourseItem {
  courseId: number;
  courseName: string;
  position: number;
  status: PathCourseStatus;
  /** Names of prerequisite courses the learner has not completed yet. */
  missingPrerequisites: string[];
}

export interface LearningPathDetail {
  id: number;
  name: string;
  description?: string | null;
  courses: LearningPathCourseItem[];
  completedCount: number;
  progressPercent: number;
  completed: boolean;
  completionCode?: string | null;
  completedAt?: string | null;
}

export interface LearningPathRequest {
  name: string;
  description?: string;
}
