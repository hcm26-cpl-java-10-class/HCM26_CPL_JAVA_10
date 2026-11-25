import axiosInstance from "@/api/axios";

export interface ExamDashboardSummary {
    pendingGrading: number;
    flaggedAttempts: number;
    pendingAppeals: number;
    closingSoonInvitations: number;
    examsNeedingAttention: number;
    totalExams: number;
}

export interface ExamDashboardItem {
    examId: number;
    title: string;
    category?: string | null;
    pendingGrading: number;
    flaggedAttempts: number;
    pendingAppeals: number;
    closingSoonInvitations: number;
    nextClosingAt?: string | null;
}

export interface ExamDashboardDTO {
    summary: ExamDashboardSummary;
    items: ExamDashboardItem[];
}

export const examDashboardApi = {
    async get(): Promise<ExamDashboardDTO> {
        const response = await axiosInstance.get<ExamDashboardDTO>("/exams/dashboard");
        return response.data;
    },
};
