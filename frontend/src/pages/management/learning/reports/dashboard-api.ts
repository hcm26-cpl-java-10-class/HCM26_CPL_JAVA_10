import api from "@/api/axios";
import type { Course } from "../components/reports/report-api";

export interface Overview {
  enrolled: number;
  enrolledInPeriod: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  unknown: number;
  completionRate: number | null;
  averageProgress: number | null;
  measuredCourses: number;
}

export interface RoadmapPhase {
  title: string;
  startWeek: number;
  endWeek: number;
  status: string;
  objective: string;
  courses: Course[];
}

export interface Roadmap {
  goal: string;
  level: string;
  title: string;
  revision: number | null;
  generatedAt: string | null;
  weeks: number | null;
  budgetMinutes: number;
  completedPhases: number;
  completionRate: number | null;
  phases: RoadmapPhase[];
}

export interface AssessmentScore {
  title: string;
  submittedAt: string;
  score: number;
  maxScore: number;
  percent: number;
}

export interface Assessments {
  results: number;
  averagePercent: number | null;
  scores: AssessmentScore[];
}

export interface StudyDay {
  date: string;
  seconds: number;
  selfReportedSeconds: number;
  active: boolean;
}

export interface StudySessionItem {
  id: number;
  studyDate: string;
  courseTitle: string | null;
  note: string | null;
  durationSeconds: number;
  source: string;
}

export interface StudySessionHistory {
  items: StudySessionItem[];
  totalPages: number;
}

export type PeriodPreset = "THIS_WEEK" | "THIS_MONTH" | "LAST_30_DAYS" | "THIS_QUARTER" | "CUSTOM";

export interface PerformanceDashboardData {
  from: string;
  to: string;
  zone: string;
  overview: Overview | null;
  courses: Course[] | null;
  roadmap: Roadmap | null;
  assessments: Assessments | null;
  limitations: string[];
}

export interface StudyWeekly {
  start: string;
  plannedSeconds: number | null;
  actualSeconds: number;
}

export interface StudyByCourse {
  courseId: number | null;
  name: string;
  seconds: number;
}

export interface StudyObjectives {
  total: number;
  completed: number;
  overdue: number;
  completedDuringPeriod: number;
}

export interface ReportStudyData {
  actualSeconds: number;
  timerSeconds: number;
  selfReportedSeconds: number;
  plannedSeconds: number | null;
  remainingSeconds: number | null;
  coveredActualSeconds: number | null;
  achievement: number | null;
  coveredDays: number;
  activeDays: number;
  averageActiveDaySeconds: number;
  currentStreak: number;
  longestStreak: number;
  days: StudyDay[];
  weeks: StudyWeekly[];
  byCourse: StudyByCourse[];
}

export interface GoalsHabitsDashboardData {
  from: string;
  to: string;
  zone: string;
  study: ReportStudyData | null;
  objectives: StudyObjectives | null;
  limitations: string[];
}

export const dashboardApi = {
  performance: async (
    params: { from?: string; to?: string; courseId?: number },
    signal?: AbortSignal,
  ): Promise<PerformanceDashboardData> => {
    const res = await api.get<PerformanceDashboardData>("/learning/me/reports/performance", {
      params,
      signal,
    });
    return res.data;
  },
  goalsHabits: async (
    params: { from?: string; to?: string },
    signal?: AbortSignal,
  ): Promise<GoalsHabitsDashboardData> => {
    const res = await api.get<GoalsHabitsDashboardData>("/learning/me/reports/goals-habits", {
      params,
      signal,
    });
    return res.data;
  },
  sessions: async (
    params: { from?: string; to?: string; page?: number; size?: number },
    signal?: AbortSignal,
  ): Promise<StudySessionHistory> => {
    const res = await api.get<StudySessionHistory>("/learning/me/study-sessions", {
      params,
      signal,
    });
    return res.data;
  },
};

export function computePresetRange(preset: PeriodPreset, todayStr?: string): { from: string; to: string } {
  const today = todayStr ? new Date(`${todayStr}T00:00:00Z`) : new Date();
  const to = today.toISOString().slice(0, 10);
  const start = new Date(today);
  if (preset === "THIS_WEEK") {
    const day = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - day);
  } else if (preset === "THIS_MONTH") {
    start.setUTCDate(1);
  } else if (preset === "THIS_QUARTER") {
    const qMonth = Math.floor(start.getUTCMonth() / 3) * 3;
    start.setUTCMonth(qMonth, 1);
  } else {
    start.setUTCDate(start.getUTCDate() - 29);
  }
  return { from: start.toISOString().slice(0, 10), to };
}
