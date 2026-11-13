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

// ===== 10. So sánh giữa các khóa học (Course Comparison) =====

/** Xếp loại đánh giá tổng hợp của một khóa học. */
export type CourseOverallVerdict = "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR";

/**
 * Số liệu của MỘT khóa học trong toàn bộ các module so sánh.
 * Các trường được gom phẳng để frontend dựng bảng so sánh dễ dàng.
 */
export interface CourseComparisonItem {
  courseId: number;
  courseName: string;
  instructor?: string | null;

  // ===== Tổng quan =====
  learnerCount: number;
  completedLearners: number;
  /** % học viên hoàn thành khóa học. */
  completionRate: number;
  /** % học viên chưa hoàn thành. */
  notCompletedRate: number;
  /** % học viên bỏ học (không hoạt động hoặc chưa từng bắt đầu). */
  dropOffRate: number;

  // ===== 1. Phễu học tập =====
  funnelTotalLessons: number;
  /** % hoàn thành trung bình các bài học (0-100). */
  funnelAvgCompletion: number;
  /** % hoàn thành bài học đầu tiên (0-100). */
  funnelFirstLessonRate: number;
  /** % hoàn thành bài học cuối cùng (0-100). */
  funnelLastLessonRate: number;
  /** Mức tụt lớn nhất giữa hai bài liền kề (%). */
  funnelMaxDropOff: number;
  funnelMaxDropOffLesson?: string | null;
  /** % hoàn thành thấp nhất trong một bài học. */
  funnelLowestLessonRate: number;
  funnelLowestLesson?: string | null;
  /** Thứ hạng trong module phễu (1 = tốt nhất). */
  funnelRank: number;

  // ===== 2. Xu hướng theo thời gian =====
  trendEnrollments: number;
  trendLessonsCompleted: number;
  trendCertificates: number;
  trendEnrollmentsPerDay: number;
  trendRank: number;

  // ===== 3. Hoạt động & rủi ro =====
  activityActive: number;
  activityInactive: number;
  activityNeverStarted: number;
  /** % học viên còn hoạt động (0-100). */
  activityActiveRate: number;
  activityAtRisk: number;
  /** % học viên có nguy cơ bỏ học (0-100). */
  activityAtRiskRate: number;
  activityAverageRiskScore: number;
  activityRank: number;

  // ===== 4. Đánh giá =====
  reviewAverageRating: number;
  reviewTotal: number;
  /** % học viên đã đánh giá (0-100). */
  reviewCoverage: number;
  /** % đánh giá 5 sao (0-100). */
  reviewFiveStarRate: number;
  /** % đánh giá 1-2 sao (0-100). */
  reviewLowStarRate: number;
  reviewRank: number;

  // ===== 5. Phòng ban =====
  departmentCount: number;
  departmentBest?: string | null;
  departmentBestRate: number;
  departmentWorst?: string | null;
  departmentWorstRate: number;
  /** Chênh lệch hoàn thành giữa phòng ban tốt nhất và kém nhất (điểm %). */
  departmentGap: number;
  departmentRank: number;

  // ===== 6. Xếp hạng =====
  rankByLearners: number;
  rankByCompletion: number;
  rankByRating: number;
  rankByDropOff: number;

  // ===== 7. Chất lượng nội dung & Q&A =====
  contentTotalReports: number;
  contentOpenReports: number;
  /** % báo cáo đã được xử lý (0-100). */
  contentResolvedRate: number;
  contentTotalQuestions: number;
  contentUnanswered: number;
  /** % câu hỏi đã được trả lời (0-100). */
  contentAnswerRate: number;
  /** Thời gian phản hồi trung bình (giờ). */
  contentAverageResponseHours?: number | null;
  contentRank: number;

  // ===== 8. Thời gian học =====
  studyTotalHours: number;
  studyAverageHours: number;
  studyMaxHours: number;
  studyRank: number;

  // ===== Tổng hợp =====
  /** Điểm tổng hợp 0-100 (cao = khóa học hoạt động tốt hơn). */
  overallScore: number;
  overallVerdict: CourseOverallVerdict | string;
  /** Điểm mạnh nổi bật. */
  strengths: string[];
  /** Điểm yếu cần cải thiện. */
  weaknesses: string[];
  /**
   * Nhận định riêng của khóa học cho TỪNG module, dạng map
   * `moduleKey -> nhận định`. Ví dụ `{ funnel: "..." }`.
   */
  moduleEvaluations?: Record<string, string> | null;
}

/** Nhận định/đánh giá của một module so sánh. */
export interface ModuleInsight {
  /** Khóa module: funnel | trend | activity | reviews | departments | ranking | content | study-time */
  key: string;
  title: string;
  description: string;
  /** Chỉ số dùng để xếp hạng trong module này. */
  bestMetric: string;
  bestCourseId?: number | null;
  bestCourseName?: string | null;
  bestValue?: number | null;
  worstCourseId?: number | null;
  worstCourseName?: string | null;
  worstValue?: number | null;
  /** Câu đánh giá tổng hợp của module. */
  evaluation: string;
}

export interface CourseComparisonResponse {
  totalCourses: number;
  from: string;
  to: string;
  granularity: CourseAnalyticsGranularity;
  inactiveThresholdDays: number;
  /** Các khóa học, đã sắp xếp theo điểm tổng hợp giảm dần. */
  courses: CourseComparisonItem[];
  /** Nhận định cho từng module. */
  modules: ModuleInsight[];
}
