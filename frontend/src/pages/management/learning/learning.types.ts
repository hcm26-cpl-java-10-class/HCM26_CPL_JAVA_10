export type CourseStatus = "in_progress" | "completed" | "saved" | "enrolled";

export interface NextItemInfo {
  title: string;
  type: "assignment" | "lesson" | "quiz" | "video";
  duration: string;
  link?: string;
}

export interface CertificateInfo {
  id: string;
  courseTitle: string;
  issuer: string;
  issuedDate: string;
  grade?: string;
  score?: number;
  credentialUrl?: string;
  recipientName?: string;
}

export interface LearningCourse {
  id: string;
  courseId?: number;
  title: string;
  skill: string;
  provider: string;
  lastAccessed: string;
  progress: number | null;
  enrolledAt?: string | null;
  status: CourseStatus;
  estimatedCompletion?: string;
  completedDate?: string;
  score?: number;
  nextItem?: NextItemInfo;
  certificate?: CertificateInfo;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  completedGoals: number;
  allGoalsCompleted: boolean;
  minutesLearned: number;
  itemsCount: number;
}

export interface LearningStatsSummary {
  dailyGoalsCompleted: number;
  itemsCompleted: number;
  minutesLearned: number;
}
