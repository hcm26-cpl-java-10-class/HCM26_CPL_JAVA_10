import api from './axios';
import type { ExamCategory } from '@/types';
import type { CodeSpec } from '@/types/features/exam';

export interface Exam {
    id: number;
    title: string;
    durationMinutes: number;
    category?: ExamCategory;
    totalPoints?: number;
    maxScore?: number;
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

// NEW (anti-cheat)
export type IntegrityEventType =
    | 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'COPY' | 'CUT' | 'PASTE'
    | 'CONTEXT_MENU' | 'DEVTOOLS_KEY' | 'PRINT_ATTEMPT' | 'MULTI_SESSION';

export interface ExamIntegrityConfig {
    enabled: boolean;
    detectTabSwitch: boolean;
    blockCopyPaste: boolean;
    requireFullscreen: boolean;
    singleSession: boolean;
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

    type: 'MULTIPLE_CHOICE' | 'ESSAY' | 'CODING';
    points: number;
    code?: CodeSpec | null;

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
    maxScore?: number;
    objectiveScore: number | null;
    finalScore: number | null;
    provisionalScore?: number | null;
    /** Teacher has published the results (Publish Results). */
    resultPublished?: boolean;
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
    integrity?: ExamIntegrityConfig; // NEW (anti-cheat)
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
    maxScore?: number;
    /** Teacher has published the results (Publish Results). */
    resultPublished?: boolean;
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
    maxScore?: number;

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
    maxScore?: number;
    objectiveScore: number | null;
    finalScore: number | null;
    submittedAt: string | null;
    questions: ExamReviewQuestion[];
}

export interface SaveExamAnswerRequest {
    questionId: number;
    selectedOptionIds?: number[];
    textAnswer?: string | null;
    markSaved?: boolean;
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

export interface CodeRunRequest {
    questionId: number;
    code: string;
    customInputs?: string[] | null;
}

export interface CodeTestRun {
    index: number;
    passed: boolean;
    status: string;
    inputs: string[];
    expected: string;
    actual: string | null;
    error: string | null;
}

export interface CodeRunResponse {
    tests: CodeTestRun[];
    custom: CodeTestRun | null;
    passed: number;
    total: number;
}

export const runCode = async (attemptId: number, request: CodeRunRequest) => {
    const response = await api.post<CodeRunResponse>(`/exams/attempts/${attemptId}/code/run`, request);
    return response.data;
};

export const runAnonymousCode = async (
    attemptId: number,
    sessionToken: string,
    request: CodeRunRequest,
) => {
    const response = await api.post<CodeRunResponse>(
        `/exams/anonymous/attempts/${attemptId}/code/run`,
        request,
        { headers: { 'X-Anonymous-Session': sessionToken } },
    );
    return response.data;
};

export const SESSION_TOKEN_KEY = 'anonymous_session_token';
export const SESSION_EMAIL_KEY = 'anonymous_student_email';
export const SESSION_NAME_KEY = 'anonymous_student_name';

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

// ===== NEW (anti-cheat) =====
export interface IntegrityEventsPayload {
    clientId: string;
    events: { type: IntegrityEventType; durationSeconds?: number; detail?: string }[];
}

export const sendIntegrityEvents = async (attemptId: number, payload: IntegrityEventsPayload) => {
    await api.post(`/exams/attempts/${attemptId}/integrity-events`, payload);
};

export const sendAnonymousIntegrityEvents = async (
    attemptId: number,
    sessionToken: string,
    payload: IntegrityEventsPayload,
) => {
    await api.post(`/exams/anonymous/attempts/${attemptId}/integrity-events`, payload, {
        headers: { 'X-Anonymous-Session': sessionToken },
    });
};

export interface IntegrityReportRow {
    studentId: number;
    studentName: string;
    email: string | null;
    username: string | null;
    employeeCode: string | null;
    phone: string | null;
    description: string | null;
    guest: boolean;
    attemptId: number;
    attemptNumber: number;
    status: ExamAttemptStatus;
    startedAt: string | null;
    submittedAt: string | null;
    objectiveScore: number | null;
    finalScore: number | null;
    maxScore: number | null;
    totalViolations: number;
    tabSwitchCount: number;
    windowBlurCount: number;
    fullscreenExitCount: number;
    copyPasteCount: number;
    contextMenuCount: number;
    shortcutCount: number;
    multiSessionCount: number;
    totalAwaySeconds: number;
    lastViolationAt: string | null;
    flagged: boolean;
    durationSeconds: number | null;
}

export interface IntegrityReport {
    examId: number;
    examTitle: string;
    antiCheatEnabled: boolean;
    totalAttempts: number;
    flaggedAttempts: number;
    totalViolations: number;
    totalsByType: Record<string, number>;
    rows: IntegrityReportRow[];
}

export interface IntegrityEventRecord {
    id: number;
    type: IntegrityEventType;
    occurredAt: string;
    durationSeconds: number | null;
    detail: string | null;
    userAgent: string | null;
    ipAddress: string | null;
}

export const getIntegrityReport = async (examId: number) => {
    const response = await api.get<IntegrityReport>(`/exams/${examId}/integrity-report`);
    return response.data;
};

export const getIntegrityEvents = async (examId: number, attemptId: number) => {
    const response = await api.get<IntegrityEventRecord[]>(
        `/exams/${examId}/integrity-report/attempts/${attemptId}/events`,
    );
    return response.data;
};
