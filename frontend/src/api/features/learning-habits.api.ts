import axios from "@/api/axios";

export type GoalPeriod = "WEEKLY" | "MONTHLY";
export type StudySource = "TIMER" | "MANUAL";
export type TimerAction = "pause" | "resume" | "finish" | "cancel";
export type CourseOption = { id: number; name: string };
export type DateRange = { from?: string; to?: string };

export interface GoalInput {
  title: string;
  description: string;
  period: GoalPeriod;
  targetMinutes: number;
  startDate: string;
  endDate: string | null;
  version?: number;
}

export interface Goal extends GoalInput {
  id: number;
  version: number;
  status: "ACTIVE" | "SCHEDULED" | "ENDED" | "ARCHIVED";
}

export interface TargetProgress {
  goalId: number;
  title: string;
  period: GoalPeriod;
  periodStart: string;
  fromDate: string;
  toDate: string;
  targetMinutes: number;
  actualSeconds: number;
  remainingSeconds: number;
  percentage: number;
}

export interface StudyInput {
  requestKey?: string;
  title: string;
  notes: string;
  courseId: number | null;
  studyDate: string;
  durationMinutes: number;
  version?: number;
}

export interface StudySession {
  id: number;
  version: number;
  title: string;
  notes: string | null;
  courseId: number | null;
  courseName: string | null;
  source: StudySource;
  state: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  selfReported: boolean;
  studyDate: string;
  elapsedSeconds: number;
  serverNow: string;
  expiresAt: string | null;
}

export interface ObjectiveInput {
  title: string;
  description: string;
  courseId: number | null;
  weekStart: string;
  targetDate: string | null;
  displayOrder: number;
  version?: number;
}

export interface Objective extends ObjectiveInput {
  id: number;
  version: number;
  courseName: string | null;
  completedAt: string | null;
}

export interface StudyDay {
  date: string;
  seconds: number;
  selfReportedSeconds: number;
  active: boolean;
}

export interface HabitStatistics {
  today: string;
  weekStart: string;
  from: string;
  to: string;
  zone: string;
  activeDayMinutes: number;
  maxManualMinutes: number;
  totalSeconds: number;
  rangeSeconds: number;
  todaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  averageActiveDaySeconds: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  completedObjectives: number;
  totalObjectives: number;
  weeklyCompletedObjectives: number;
  weeklyTotalObjectives: number;
  weeklyGoalsAchieved: number;
  weeklyGoalsTracked: number;
  weeklyGoal: TargetProgress | null;
  monthlyGoal: TargetProgress | null;
  days: StudyDay[];
  currentWeek: StudyDay[];
  weeks: { start: string; actualSeconds: number; targetMinutes: number | null }[];
  byCourse: { courseId: number | null; name: string; seconds: number }[];
}

const base = "/learning/me";
const sessionPath = base + "/study-sessions";
const objectivePath = base + "/objectives";
const goalPath = base + "/goals";

export const learningHabitsApi = {
  courses: async (signal?: AbortSignal) =>
    (await axios.get<CourseOption[]>(base + "/study-courses", { signal })).data,
  statistics: async (range: DateRange, signal?: AbortSignal) =>
    (await axios.get<HabitStatistics>(base + "/statistics", { params: range, signal })).data,
  activity: async (range: DateRange, signal?: AbortSignal) =>
    (await axios.get<StudyDay[]>(base + "/activity", { params: range, signal })).data,
  goals: async (signal?: AbortSignal) =>
    (await axios.get<Goal[]>(goalPath, { signal })).data,
  goalPeriods: async (range: DateRange, signal?: AbortSignal) =>
    (await axios.get<TargetProgress[]>(goalPath + "/periods", { params: range, signal })).data,
  saveGoal: async (input: GoalInput, id?: number) =>
    (id === undefined ? await axios.post(goalPath, input) : await axios.put(goalPath + "/" + id, input)).data,
  archiveGoal: async (goal: Goal) =>
    axios.patch(goalPath + "/" + goal.id + "/archive", null, { params: { version: goal.version } }),
  active: async (signal?: AbortSignal) => {
    const response = await axios.get<StudySession>(sessionPath + "/active", { signal });
    return response.status === 204 ? null : response.data;
  },
  history: async (params: DateRange & { page: number; source?: StudySource; size?: number }, signal?: AbortSignal) =>
    (await axios.get<{ items: StudySession[]; hasMore: boolean }>(sessionPath, { params, signal })).data,
  start: async (requestKey: string, courseId: number | null) =>
    (await axios.post<StudySession>(sessionPath + "/start", { requestKey, courseId })).data,
  transition: async (session: StudySession, action: TimerAction) =>
    (await axios.post<StudySession>(sessionPath + "/" + session.id + "/" + action, null,
      { params: { version: session.version } })).data,
  saveStudy: async (input: StudyInput, id?: number) =>
    (id === undefined ? await axios.post(sessionPath + "/manual", input)
      : await axios.put(sessionPath + "/" + id, input)).data,
  deleteStudy: async (study: StudySession) =>
    axios.delete(sessionPath + "/" + study.id, { params: { version: study.version } }),
  objectives: async (params: { week?: string; completed?: boolean }, signal?: AbortSignal) =>
    (await axios.get<Objective[]>(objectivePath, { params, signal })).data,
  saveObjective: async (input: ObjectiveInput, id?: number) =>
    (id === undefined ? await axios.post(objectivePath, input)
      : await axios.put(objectivePath + "/" + id, input)).data,
  objectiveStatus: async (objective: Objective, completed: boolean) =>
    axios.patch(objectivePath + "/" + objective.id + "/status", { completed, version: objective.version }),
  deleteObjective: async (objective: Objective) =>
    axios.delete(objectivePath + "/" + objective.id, { params: { version: objective.version } }),
};
