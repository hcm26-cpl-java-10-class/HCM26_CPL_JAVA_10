import api from './axios';
import type { ExamCategory, ResultVisibility } from '@/types';
import type { CodeSpec } from '@/types/features/exam';

export interface Exam {
    id: number;
    title: string;
    durationMinutes: number;
    category?: ExamCategory;
    totalPoints?: number;
    maxScore?: number;
    isActive?: boolean;
    maxAttempts?: number | null;
    latePolicy?: 'NOT_ALLOWED' | 'ALLOWED' | 'ALLOWED_WITH_PENALTY';
    hasPassword?: boolean;
    /** Course link (optional): set when the exam belongs to a course / section / lesson. */
    courseId?: number | null;
    courseName?: string | null;
    sectionId?: number | null;
    sectionTitle?: string | null;
    lessonId?: number | null;
    lessonTitle?: string | null;
    showAnswersAfterExam?: boolean;
    /** When students can review their scores. */
    resultVisibility?: ResultVisibility;
    createdAt?: string;
    updatedAt?: string;
}

// NEW (anti-cheat)
export type IntegrityEventType =
    | 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'COPY' | 'CUT' | 'PASTE'
    | 'CONTEXT_MENU' | 'DEVTOOLS_KEY' | 'PRINT_ATTEMPT' | 'MULTI_SESSION'
    | 'CAMERA_OFF' | 'CAMERA_COVERED' | 'FACE_MISSING' | 'MULTIPLE_FACES' | 'HEAD_TURNED';

export interface ExamIntegrityConfig {
    enabled: boolean;
    detectTabSwitch: boolean;
    blockCopyPaste: boolean;
    requireFullscreen: boolean;
    singleSession: boolean;
    cameraProctoring?: boolean;
    notifyOnViolation?: boolean;
    /** Entry photo already taken (questions stay hidden until then). */
    entryPhotoDone?: boolean;
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
    /** Pass score frozen when the attempt started (null when the exam has none). */
    passScore?: number | null;
    /** Passed / not passed; null until the result is published and graded. */
    passed?: boolean | null;
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
    passScore?: number | null;
    passed?: boolean | null;
    submittedAt: string | null;
    /** Results and correct/wrong answers are released (scores published). */
    revealAnswers: boolean;
    questions: ExamReviewQuestion[];
}

export interface AttemptIntegritySummary {
    /** Attempt has at least one anti-cheat violation. */
    flagged: boolean;
    totalViolations: number;
    tabSwitchCount: number;
    copyPasteCount: number;
    fullscreenExitCount: number;
    shortcutCount: number;
    multiSessionCount: number;
    windowBlurCount: number;
    contextMenuCount: number;
    totalAwaySeconds: number;
    lastViolationAt: string | null;
    antiCheatEnabled: boolean;
}

export interface AttemptSubmission {
    review: ExamAttemptReview;
    integrity: AttemptIntegritySummary;
}

export interface IntegrityEventDTO {
    id: number;
    type: string;
    occurredAt: string;
    durationSeconds?: number | null;
    detail?: string | null;
    userAgent?: string | null;
    ipAddress?: string | null;
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

export interface CodeVerifyItem {
    index: number;
    visible: boolean;
    /** OK (matches), WRONG_ANSWER (ran but differs), COMPILE_ERROR, RUNTIME_ERROR, TIME_LIMIT, INFRA_ERROR, SKIPPED */
    status: string;
    actual: string | null;
    error: string | null;
    matches: boolean;
}

export interface CodeVerifyResponse {
    tests: CodeVerifyItem[];
    matched: number;
    total: number;
    infraError: boolean;
    compileError: string | null;
}

/** Teacher: run a reference solution on every test of an unsaved coding question. */
export const verifyCodeSpec = async (spec: CodeSpec, code: string) => {
    const response = await api.post<CodeVerifyResponse>('/exams/code/verify', { spec, code });
    return response.data;
};

/** Teacher: the Main class the system generates for a function declaration. */
export const previewMain = async (spec: CodeSpec) => {
    const response = await api.post<{ main: string }>('/exams/code/main-preview', { spec });
    return response.data.main;
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
    events: { type: IntegrityEventType; durationSeconds?: number; detail?: string; snapshot?: string }[];
}

export const sendEntryPhoto = async (attemptId: number, imageData: string) => {
    await api.post(`/exams/attempts/${attemptId}/proctor-photo`, { imageData });
};

export const sendAnonymousEntryPhoto = async (attemptId: number, sessionToken: string, imageData: string) => {
    await api.post(`/exams/anonymous/attempts/${attemptId}/proctor-photo`, { imageData }, {
        headers: { 'X-Anonymous-Session': sessionToken },
    });
};

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
    cameraOffCount: number;
    cameraCoveredCount: number;
    faceMissingCount: number;
    multipleFacesCount: number;
    headTurnedCount: number;
    hasEntryPhoto: boolean;
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
    /** Evidence photo (data URL) for camera violations. */
    snapshot: string | null;
}

export interface EntryPhoto {
    imageData: string | null;
    capturedAt: string | null;
}

export const getEntryPhoto = async (examId: number, attemptId: number) => {
    const response = await api.get<EntryPhoto>(
        `/exams/${examId}/integrity-report/attempts/${attemptId}/entry-photo`,
    );
    return response.data;
};

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
