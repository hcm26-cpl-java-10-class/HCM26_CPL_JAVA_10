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
    // Sửa '/api/exams' thành '/exams' để không bị lặp chữ /api
    const response = await api.get<PageResponse<Exam>>('/exams', {
        params: { page, size }
    });
    return response.data;
};