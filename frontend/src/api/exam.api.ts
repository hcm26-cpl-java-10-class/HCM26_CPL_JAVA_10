import api from './axios';

export interface Exam {
    id: number;
    title: string;
    durationMinutes: number;
    totalPoints?: number;
    isActive?: boolean;
    startTime?: string | null;
    endTime?: string | null;
    maxAttempts?: number | null;
    latePolicy?: 'NOT_ALLOWED' | 'ALLOWED' | 'ALLOWED_WITH_PENALTY';
    createdAt?: string;
    updatedAt?: string;
}

/** NOT_STARTED chỉ là trạng thái hiển thị (chưa có attempt); server không trả về giá trị này. */
export type ExamAttemptStatus =
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'SUBMITTED'
    | 'PENDING_REVIEW'
    | 'EXPIRED';

export interface ExamAttemptQuestion {
    id: number;
    content: string;
    type: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'ESSAY';
    points: number;
    options: { id: number; content: string }[];
}

export interface ExamAttemptAnswer {
    questionId: number;
    selectedOptionIds: number[];
    textAnswer: string | null;
}

export interface ExamAttempt {
    id: number;
    examId: number;
    attemptNumber: number;
    title: string;
    durationMinutes: number;
    totalPoints: number;
    objectiveScore: number | null;
    finalScore: number | null;
    status: ExamAttemptStatus;
    startedAt: string;
    officialDeadlineAt?: string | null;
    deadlineAt: string;
    submittedAt: string | null;
    late?: boolean;
    latePenaltyPercentApplied?: number | null;
    attemptsUsed?: number;
    attemptsRemaining?: number;
    bestScore?: number | null;
    questions: ExamAttemptQuestion[];
    answers: ExamAttemptAnswer[];
}

export interface ExamAttemptSummary {
    id: number;
    examId: number;
    attemptNumber: number;
    bestScore: number | null;
    attemptsUsed: number;
    attemptsRemaining: number;
    status: ExamAttemptStatus;
    objectiveScore: number | null;
    finalScore: number | null;
    totalPoints: number;
    startedAt: string;
    deadlineAt: string;
    submittedAt: string | null;
}

export interface SaveExamAnswerRequest {
    questionId: number;
    selectedOptionIds?: number[];
    textAnswer?: string | null;
}

export interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
}

export const getStudentExams = async (page = 0, size = 10) => {
    const response = await api.get<PageResponse<Exam>>('/exams', {
        params: { page, size, isActive: true, status: 'PUBLISHED' }
    });
    return response.data;
};

export const getMyExamAttempts = async () => {
    const response = await api.get<ExamAttemptSummary[]>('/exams/my-attempts');
    return response.data;
};

export const startOrResumeExam = async (examId: number) => {
    const response = await api.post<ExamAttempt>(`/exams/${examId}/attempt`);
    return response.data;
};

export const saveExamAnswers = async (attemptId: number, answers: SaveExamAnswerRequest[]) => {
    const response = await api.put<ExamAttempt>(`/exams/attempts/${attemptId}/answers`, answers);
    return response.data;
};

export const submitExamAttempt = async (attemptId: number, answers: SaveExamAnswerRequest[]) => {
    const response = await api.post<ExamAttempt>(`/exams/attempts/${attemptId}/submit`, answers);
    return response.data;
};