import axiosInstance from "@/api/axios";

export interface QuestionSnapshot {
    content: string;
    type: string;
    difficulty: string;
    topic?: string | null;
    imageUrl?: string | null;
    points: number;
    codeSpec?: string | null;
    options: { id?: number | null; content: string; correct: boolean; imageUrl?: string | null }[];
    gradingCriteria: { name: string; description?: string | null; weightPercentage?: number | null }[];
}

export interface QuestionVersion {
    id: number;
    versionNumber: number;
    note?: string | null;
    createdBy?: number | null;
    createdByName?: string | null;
    createdAt: string;
    snapshot: QuestionSnapshot;
}

export interface QuestionVersionCompare {
    fromVersion: number;
    toVersion: number;
    changes: { field: string; before: string; after: string }[];
}

export const questionVersionApi = {
    async history(questionId: string | number): Promise<QuestionVersion[]> {
        return (await axiosInstance.get<QuestionVersion[]>(`/questions/${questionId}/versions`)).data;
    },
    async compare(questionId: string | number, from: number, to: number): Promise<QuestionVersionCompare> {
        return (await axiosInstance.get<QuestionVersionCompare>(`/questions/${questionId}/versions/compare`, { params: { from, to } })).data;
    },
    async restore(questionId: string | number, versionNumber: number): Promise<void> {
        await axiosInstance.post(`/questions/${questionId}/versions/${versionNumber}/restore`);
    },
};
