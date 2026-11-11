/**
 * Kiểu dữ liệu cho AI so sánh khóa học.
 *
 * <p>Phần "phân tích" (analysis) do AI sinh ra; backend đã kiểm tra lại
 * moduleKey, courseId và các chỉ số trước khi trả về.
 */

export type AiComparisonLanguage = "en" | "vi";

/** Vị trí của khóa học mục tiêu so với các khóa học đối chiếu trong một module. */
export type AiModulePosition = "ABOVE" | "AT_PAR" | "BELOW";

/** Kết luận tổng thể. */
export type AiOverallVerdict = "STRONGER" | "SIMILAR" | "WEAKER";

/** Mức ưu tiên của một khuyến nghị. */
export type AiRecommendationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface AiEvidence {
  /** Tên field của chỉ số (khớp với `CourseComparisonItem`). */
  metric: string;
  target: number | null;
  peerMedian: number | null;
  bestPeer?: string | null;
}

export interface AiModuleEvaluation {
  moduleKey: string;
  position: AiModulePosition;
  finding: string;
  evidence: AiEvidence[];
}

export interface AiBiggestGap {
  moduleKey: string;
  metric: string;
  target: number | null;
  peerMedian: number | null;
  gap: number | null;
}

export interface AiBenchmarkPeer {
  courseId: number;
  courseName: string;
  why: string;
}

export interface AiRecommendation {
  priority: AiRecommendationPriority;
  moduleKey: string;
  action: string;
  basedOn: string;
  expectedImpact: string;
}

export interface AiComparisonAnalysis {
  headline: string;
  overall: {
    verdict: AiOverallVerdict;
    rank: number;
    outOf: number;
    summary: string;
  };
  modules: AiModuleEvaluation[];
  strengths: string[];
  weaknesses: string[];
  biggestGaps: AiBiggestGap[];
  benchmarkPeers: AiBenchmarkPeer[];
  recommendations: AiRecommendation[];
  dataCaveats: string[];
}

export interface AiCompareRequest {
  targetCourseId: number;
  peerCourseIds?: number[];
  from?: string;
  to?: string;
  focus?: string;
  language?: AiComparisonLanguage;
}

export interface AiCompareResponse {
  targetCourseId: number;
  targetCourseName: string;
  peerCourseIds: number[];
  peerCount: number;
  /** true nghĩa là danh sách peer bị cắt bớt do giới hạn 15 khóa. */
  peersTruncated: boolean;
  /** true nghĩa là peer được backend tự chọn. */
  peersAutoSelected: boolean;
  analysis: AiComparisonAnalysis;
}

export interface AiChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiFollowUpRequest {
  targetCourseId: number;
  peerCourseIds?: number[];
  from?: string;
  to?: string;
  question: string;
  history?: AiChatTurn[];
  language?: AiComparisonLanguage;
}

export interface AiFollowUpAnswer {
  reply: string;
  referencedCourseIds: number[];
  referencedMetrics: string[];
  followUps: string[];
}

export interface AiOutlineRequest {
  targetCourseId: number;
  peerCourseIds?: number[];
  focus?: string;
  language?: AiComparisonLanguage;
}

export interface AiOutlineTopic {
  topic: string;
  coveredByCourseIds: number[];
  importance: AiRecommendationPriority;
  suggestedLesson: string;
  suggestedSection: string;
}

export interface AiOutlineAnalysis {
  summary: string;
  size: {
    target: { sections: number; lessons: number; hours: number };
    peerMedian: { sections: number; lessons: number; hours: number };
  };
  missingTopics: AiOutlineTopic[];
  uniqueStrengths: string[];
  contentMix: {
    target: Record<string, number>;
    peers: string;
  };
  structureIssues: string[];
  uncertain: string[];
  notComparable: { courseId: number; reason: string }[];
}

export interface AiOutlineResponse {
  targetCourseId: number;
  targetCourseName: string;
  peerCourseIds: number[];
  analysis: AiOutlineAnalysis;
}

export interface AiSummaryRequest {
  analysis: AiComparisonAnalysis;
  language?: AiComparisonLanguage;
}

export interface AiSummaryResponse {
  summary: string;
}
