export type CourseAnalyticsGranularity = "DAY" | "WEEK" | "MONTH";

export interface LessonFunnelItem {
  lessonId: number;
  lessonTitle: string;
  contentType?: string | null;
  sectionId: number;
  sectionTitle: string;
  sectionOrder: number;
  lessonOrder: number;
  position: number;
  startedCount: number;
  completedCount: number;
  completionRate: number;
  dropOffFromPrevious: number;
}

export interface LessonFunnelResponse {
  courseId: number;
  courseName: string;
  totalLearners: number;
  totalLessons: number;
  biggestDropOff?: LessonFunnelItem | null;
  lowestCompletion?: LessonFunnelItem | null;
  lessons: LessonFunnelItem[];
}

export interface TrendPoint {
  bucketStart: string;
  enrollments: number;
  lessonsCompleted: number;
  certificatesIssued: number;
}

export interface TrendResponse {
  courseId: number;
  courseName: string;
  from: string;
  to: string;
  granularity: CourseAnalyticsGranularity;
  totalEnrollments: number;
  totalLessonsCompleted: number;
  totalCertificatesIssued: number;
  points: TrendPoint[];
}

export interface ProgressBucket {
  label: string;
  learners: number;
}

export interface AtRiskLearner {
  enrollmentId: number;
  userId: number;
  studentName: string;
  studentEmail: string;
  progressPercentage: number;
  enrolledAt: string;
  lastAccessedAt?: string | null;
  inactiveDays: number;
  reason: "NEVER_STARTED" | "INACTIVE" | string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW" | string;
}

export interface ActivityResponse {
  courseId: number;
  courseName: string;
  inactiveThresholdDays: number;
  totalLearners: number;
  completedLearners: number;
  activeLearners: number;
  inactiveLearners: number;
  neverStartedLearners: number;
  progressDistribution: ProgressBucket[];
  atRiskLearners: AtRiskLearner[];
}

export interface RatingBucket {
  stars: number;
  count: number;
  percentage: number;
}

export interface CourseReviewAnalyticsResponse {
  courseId: number;
  courseName: string;
  averageRating: number;
  totalReviews: number;
  totalLearners: number;
  reviewCoverage: number;
  distribution: RatingBucket[];
}

export interface CourseRatingRankItem {
  rank: number;
  courseId: number;
  courseName: string;
  instructor?: string | null;
  averageRating: number;
  totalReviews: number;
}

export interface ScoreBucket {
  label: string;
  attempts: number;
}

export interface ExamAnalyticsItem {
  examId: number;
  title: string;
  category?: string | null;
  maxScore: number;
  passScore: number;
  totalAttempts: number;
  gradedAttempts: number;
  participants: number;
  averageScore?: number | null;
  highestScore?: number | null;
  lowestScore?: number | null;
  passedAttempts: number;
  passRate?: number | null;
  scoreDistribution: ScoreBucket[];
}

export interface CourseExamAnalyticsResponse {
  courseId: number;
  courseName: string;
  totalExams: number;
  totalGradedAttempts: number;
  overallAverageScorePercent?: number | null;
  overallPassRate?: number | null;
  exams: ExamAnalyticsItem[];
}

// ===== 6. Department analytics =====

export interface DepartmentAnalyticsItem {
  departmentId: number;
  departmentCode?: string | null;
  departmentName: string;
  learnerCount: number;
  completedLearners: number;
  completionRate: number;
  averageProgress: number;
  averageExamScore?: number | null;
  examGradedAttempts: number;
  activeLearners: number;
  atRiskLearners: number;
  dropOffRate: number;
}

export interface DepartmentAnalyticsResponse {
  courseId?: number | null;
  courseName: string;
  totalLearners: number;
  departmentCount: number;
  bestDepartment?: DepartmentAnalyticsItem | null;
  worstDepartment?: DepartmentAnalyticsItem | null;
  departments: DepartmentAnalyticsItem[];
}

// ===== 7. Course ranking =====

export interface CourseRankingItem {
  rank: number;
  courseId: number;
  courseName: string;
  instructor?: string | null;
  learnerCount: number;
  completedLearners: number;
  completionRate: number;
  averageRating: number;
  totalReviews: number;
  activeLearners: number;
  inactiveLearners: number;
  dropOffRate: number;
}

export interface CourseRankingResponse {
  totalCourses: number;
  topByLearners: CourseRankingItem[];
  topByCompletionRate: CourseRankingItem[];
  topByRating: CourseRankingItem[];
  highestDropOff: CourseRankingItem[];
  allCourses: CourseRankingItem[];
}

// ===== 8. Content quality + Q&A =====

export interface ReportedLessonItem {
  rank: number;
  lessonId: number;
  lessonTitle: string;
  courseId: number;
  courseName: string;
  reportCount: number;
  openReports: number;
  resolvedReports: number;
  topReason?: string | null;
}

export interface ReportReasonBucket {
  reason: string;
  count: number;
  percentage: number;
}

export interface UnansweredQuestionItem {
  questionId: number;
  lessonId: number;
  lessonTitle?: string | null;
  courseName: string;
  studentName?: string | null;
  content: string;
  createdAt?: string | null;
  waitingHours: number;
}

export interface ContentQualityResponse {
  courseId: number;
  courseName: string;
  totalReports: number;
  openReports: number;
  resolvedReports: number;
  totalQuestions: number;
  answeredQuestions: number;
  unansweredCount: number;
  answerRate: number;
  averageResponseHours?: number | null;
  mostReportedLessons: ReportedLessonItem[];
  reportReasons: ReportReasonBucket[];
  unansweredQuestions: UnansweredQuestionItem[];
}
