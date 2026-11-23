export interface CertificateInsightsOverview {
  totalCertificates: number;
  uniqueLearners: number;
  uniqueCourses: number;
  departmentsWithCertificates: number;
  averageCertificatesPerLearner: number;
}

export interface CertificateInsightSkill {
  categoryId: number;
  skillCode: string;
  skillName: string;
}

export interface CertificateInsightDepartment {
  departmentId: number;
  departmentName: string;
  totalEmployees: number;
}

export interface CertificateInsightCell {
  departmentId: number;
  departmentName: string;
  totalEmployees: number;
  categoryId: number;
  skillCode: string;
  skillName: string;
  certifiedEmployees: number;
  certificateCount: number;
  coveragePercentage: number;
}

export interface CertificateInsightsHeatmap {
  skills: CertificateInsightSkill[];
  departments: CertificateInsightDepartment[];
  cells: CertificateInsightCell[];
}

export interface CertificateInsightCourse {
  courseId: number;
  courseName: string;
  certificateCount: number;
  certifiedLearners: number;
}

export interface CertificateInsightLearner {
  userId: number;
  fullName: string;
  email: string;
  certificateCount: number;
  latestIssuedAt?: string | null;
}

export interface CertificateInsightCellDetail {
  summary: CertificateInsightCell;
  courses: CertificateInsightCourse[];
  learners: CertificateInsightLearner[];
}
