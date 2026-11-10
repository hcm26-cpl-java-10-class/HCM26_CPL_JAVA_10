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

/** Một yếu tố làm tăng điểm rủi ro bỏ học. */
export interface RiskFactor {
  /** INACTIVITY | LOW_PROGRESS | NEVER_STARTED | LOW_EXAM_SCORE | LOW_STUDY_TIME */
  code: string;
  label: string;
  /** Số điểm yếu tố này góp vào tổng điểm rủi ro. */
  points: number;
  detail: string;
}

export interface AtRiskLearner {
  enrollmentId: number;
  userId: number;
  studentName: string;
  studentEmail: string;
  departmentName?: string | null;
  progressPercentage: number;
  enrolledAt: string;
  lastAccessedAt?: string | null;
  inactiveDays: number;
  reason: "NEVER_STARTED" | "INACTIVE" | string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW" | string;
  /** Điểm rủi ro 0-100. */
  riskScore: number;
  /** Các yếu tố đã góp điểm, sắp xếp theo điểm giảm dần. */
  riskFactors: RiskFactor[];
  /** Yếu tố chính (mã yếu tố điểm cao nhất). */
  primaryRiskReason: string;
  /** Tổng giây đã học trong khóa học. */
  studySeconds: number;
  /** Điểm thi trung bình (% điểm tối đa), null nếu chưa thi. */
  examScorePercent?: number | null;
}

/** Nhóm học viên theo mức rủi ro. */
export interface RiskLevelBucket {
  level: "HIGH" | "MEDIUM" | "LOW" | string;
  learners: number;
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
  /** Số học viên chưa hoàn thành (không tính vào nhóm nguy cơ). */
  notCompletedLearners: number;
  /** Số học viên có nguy cơ bỏ học (HIGH + MEDIUM). */
  atRiskCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  /** Điểm rủi ro trung bình (0-100) trong nhóm nguy cơ. */
  averageRiskScore: number;
  progressDistribution: ProgressBucket[];
  riskDistribution: RiskLevelBucket[];
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
  /** -1 (code "UNASSIGNED") là nhóm học viên chưa thuộc phòng ban nào. */
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
  /** Học viên chưa từng mở bài học nào. */
  neverStartedLearners: number;
  atRiskLearners: number;
  /** Tỉ lệ chưa hoàn thành (0-100) = 100 - completionRate. */
  notCompletedRate: number;
  dropOffRate: number;
  /** Tổng số giây học của phòng ban. */
  totalStudySeconds: number;
  /** Tổng số giờ học của phòng ban. */
  totalStudyHours: number;
  /** Số giờ học trung bình mỗi học viên. */
  averageStudyHoursPerLearner: number;
}

export interface DepartmentAnalyticsResponse {
  courseId?: number | null;
  courseName: string;
  totalLearners: number;
  departmentCount: number;
  /** Tổng số giờ học của toàn bộ phòng ban trong phạm vi. */
  totalStudyHours: number;
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
  /** Học viên đã truy cập khóa học trong vòng ngưỡng không hoạt động. */
  activeLearners: number;
  /** Học viên đã từng học nhưng đã lâu không truy cập. */
  inactiveLearners: number;
  /** Học viên chưa từng mở bài học nào. */
  neverStartedLearners: number;
  /** Số học viên chưa hoàn thành khóa học. */
  notCompletedLearners: number;
  /** Tỉ lệ chưa hoàn thành (%). */
  notCompletedRate: number;
  /** Tỉ lệ bỏ học thực sự (%): inactive + never started / tổng học viên. */
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

// ===== 9. Study time (số giờ học) =====

export interface StudentStudyTimeItem {
  enrollmentId: number;
  userId: number;
  studentName: string;
  studentEmail: string;
  departmentName?: string | null;
  /** Tổng số giây học. */
  studySeconds: number;
  /** Tổng số giờ học. */
  studyHours: number;
  completedLessons: number;
  totalLessons: number;
  completionRate: number;
  lastAccessedAt?: string | null;
}

export interface StudyTimeResponse {
  courseId: number;
  courseName: string;
  totalStudySeconds: number;
  totalStudyHours: number;
  totalLearners: number;
  averageStudyHoursPerLearner: number;
  topLearner?: StudentStudyTimeItem | null;
  learners: StudentStudyTimeItem[];
}
