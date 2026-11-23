import axiosInstance from "@/api/axios";

export interface SupervisorAttemptDTO {
    attemptId: number;
    examId: number;
    examTitle: string;
    studentId: number;
    studentName: string;
    studentEmail: string;
    startedAt: string;
    deadlineAt: string;
}

export interface SupervisorViolationDTO {
    id: number;
    attemptId: number;
    studentName: string;
    examTitle: string;
    type: string;
    occurredAt: string;
    durationSeconds?: number | null;
    detail?: string | null;
}

export const examSupervisorApi = {
    async getActiveAttempts(): Promise<SupervisorAttemptDTO[]> {
        const response = await axiosInstance.get<SupervisorAttemptDTO[]>(
            "/exam-supervisor/attempts",
        );

        return response.data;
    },

    async getActiveViolations(): Promise<SupervisorViolationDTO[]> {
        const response = await axiosInstance.get<SupervisorViolationDTO[]>(
            "/exam-supervisor/violations",
        );

        return response.data;
    },
};