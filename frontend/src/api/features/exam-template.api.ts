
import axiosInstance from "@/api/axios";

export interface ExamTemplateDTO {
    id: number;
    name: string;
    description?: string;
    durationMinutes: number;
    maxAttempts: number;
    questionCount: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface SaveExamTemplateRequest {
    name: string;
    description?: string;
}

export interface CreateExamFromTemplateRequest {
    title: string;
    startTime?: string;
    endTime?: string;
}

export const examTemplateApi = {
    saveFromExam: async (
        examId: number,
        payload: SaveExamTemplateRequest
    ): Promise<ExamTemplateDTO> => {
        const response = await axiosInstance.post<ExamTemplateDTO>(
            `/exam-templates/from-exam/${examId}`,
            payload
        );
        return response.data;
    },

    list: async (): Promise<ExamTemplateDTO[]> => {
        const response = await axiosInstance.get<ExamTemplateDTO[]>(
            "/exam-templates"
        );
        return response.data;
    },

    createExam: async (
        templateId: number,
        payload: CreateExamFromTemplateRequest
    ) => {
        const response = await axiosInstance.post(
            `/exam-templates/${templateId}/create-exam`,
            payload
        );
        return response.data;
    },

    delete: async (templateId: number): Promise<void> => {
        await axiosInstance.delete(`/exam-templates/${templateId}`);
    },
};
