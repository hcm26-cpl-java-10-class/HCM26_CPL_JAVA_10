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
    hasPassword?: boolean;
    showAnswersAfterExam?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export type ExamAttemptStatus =
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'SUBMITTED'
    | 'PENDING_REVIEW'
    | 'EXPIRED';

export interface ExamAttemptQuestion {
    id: number;
    content: string;
    /** Khớp với enum QuestionType của backend (MULTIPLE_CHOICE | ESSAY). */
    type: 'MULTIPLE_CHOICE' | 'ESSAY';
    points: number;
    /** true = nhiều đáp án đúng -> ô vuông (checkbox); false = ô tròn (radio). */
    multiSelect: boolean;
    options: { id: number; content: string; imageUrl?: string | null }[];
    imageUrl?: string | null;
}

export interface ExamAttemptAnswer {
    questionId: number;
    selectedOptionIds: number[];
    textAnswer: string | null;
    saved?: boolean;
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

export interface ExamReviewOption {
    id: number;
    content: string;
    imageUrl?: string | null;
    correct: boolean;
    selected: boolean;
}

export interface ExamReviewQuestion {
    questionId: number;
    content: string;
    imageUrl?: string | null;
    type: ExamAttemptQuestion['type'];
    points: number;
    /** null for essay questions */
    correct: boolean | null;
    options: ExamReviewOption[];
    textAnswer?: string | null;
    score?: number | null;
    feedback?: string | null;
}

export interface ExamAttemptReview {
    attemptId: number;
    examId: number;
    title: string;
    attemptNumber: number;
    status: ExamAttemptStatus;
    totalPoints: number;
    objectiveScore: number | null;
    finalScore: number | null;
    submittedAt: string | null;
    questions: ExamReviewQuestion[];
}

export interface SaveExamAnswerRequest {
    questionId: number;
    selectedOptionIds?: number[];
    textAnswer?: string | null;
    markSaved?: boolean; // NEW: true khi sinh viên bấm "Lưu bài" ở câu tự luận
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

export const startOrResumeExam = async (examId: number, password?: string) => {
    const pass = password || sessionStorage.getItem(`exam_pass_${examId}`) || undefined;
    const response = await api.post<ExamAttempt>(`/exams/${examId}/attempt`, null, {
        params: pass ? { password: pass } : undefined,
    });
    sessionStorage.removeItem(`exam_pass_${examId}`);
    return response.data;
};

export const verifyExamPassword = async (examId: number, password: string) => {
    const response = await api.post<{ valid: boolean; message: string }>(`/exams/${examId}/verify-password`, {
        password,
    });
    return response.data;
};

export const saveExamAnswers = async (attemptId: number, answers: SaveExamAnswerRequest[]) => {
    const response = await api.put<ExamAttempt>(`/exams/attempts/${attemptId}/answers`, answers);
    return response.data;
};

export const getAttemptReview = async (attemptId: number) => {
    const response = await api.get<ExamAttemptReview>(`/exams/attempts/${attemptId}/review`);
    return response.data;
};

export const submitExamAttempt = async (attemptId: number, answers: SaveExamAnswerRequest[]) => {
    const response = await api.post<ExamAttempt>(`/exams/attempts/${attemptId}/submit`, answers);
    return response.data;
};

// ============ HỌC SINH THI QUA LINK (KHÔNG CÓ TÀI KHOẢN) ============

export const SESSION_TOKEN_KEY = 'anonymous_session_token';
export const SESSION_EMAIL_KEY = 'anonymous_student_email';
export const SESSION_NAME_KEY = 'anonymous_student_name';

/** Bắt đầu/tiếp tục làm bài bằng phiên anonymous. */
export const startAnonymousExam = async (sessionToken: string, password?: string) => {
    const response = await api.post<ExamAttempt>('/exams/anonymous/attempt', {
        sessionToken,
        password: password || undefined,
    });
    return response.data;
};

export const saveAnonymousAnswers = async (
    attemptId: number,
    sessionToken: string,
    answers: SaveExamAnswerRequest[],
) => {
    const response = await api.put<ExamAttempt>(
        `/exams/anonymous/attempts/${attemptId}/answers`,
        answers,
        { headers: { 'X-Anonymous-Session': sessionToken } },
    );
    return response.data;
};

export const submitAnonymousExam = async (
    attemptId: number,
    sessionToken: string,
    answers: SaveExamAnswerRequest[],
) => {
    const response = await api.post<ExamAttempt>(
        `/exams/anonymous/attempts/${attemptId}/submit`,
        answers,
        { headers: { 'X-Anonymous-Session': sessionToken } },
    );
    return response.data;
};