import api from './axios';

export interface Exam {
    id: number;
    title: string;
    durationMinutes: number;
    totalPoints?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
}

export const getStudentExams = async (page = 0, size = 10) => {
    const response = await api.get<PageResponse<Exam>>('/api/exams', {
        params: { page, size }
    });
    return response.data;
};