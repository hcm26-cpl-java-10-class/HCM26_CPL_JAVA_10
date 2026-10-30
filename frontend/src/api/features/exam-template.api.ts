import axiosInstance from "@/api/axios";

export interface ExamTemplateOptionDTO {
    id: number;
    content: string;
    correct?: boolean;
    isCorrect?: boolean;
    imageUrl?: string;
    position: number;
}

export interface ExamTemplateQuestionDTO {
    id: number;
    content: string;
    type: "MULTIPLE_CHOICE" | "ESSAY" | "CODING";
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topic?: string;
    imageUrl?: string;
    points: number;
    position: number;
    options: ExamTemplateOptionDTO[];
}

export interface ExamTemplateDTO {
    id: number;
    name: string;
    description?: string;
    durationMinutes: number;
    maxAttempts: number;
    questionCount: number;
    createdAt?: string;
    updatedAt?: string;
    questions?: ExamTemplateQuestionDTO[];
}

export interface SaveExamTemplateRequest {
    name: string;
    description?: string;
}

export interface UpdateExamTemplateRequest {
    name: string;
    description?: string;
    durationMinutes?: number;
    maxAttempts?: number;
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

    get: async (templateId: number): Promise<ExamTemplateDTO> => {
        const response = await axiosInstance.get<ExamTemplateDTO>(
            `/exam-templates/${templateId}`
        );
        return response.data;
    },

    update: async (
        templateId: number,
        payload: UpdateExamTemplateRequest
    ): Promise<ExamTemplateDTO> => {
        const response = await axiosInstance.put<ExamTemplateDTO>(
            `/exam-templates/${templateId}`,
            payload
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
