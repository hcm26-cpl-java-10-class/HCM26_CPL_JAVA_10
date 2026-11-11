export interface ScheduleValidationCandidate {
    candidateKey: string;
    sessionId?: number;
    classId: number;
    trainerId: number;
    startAt: string;
    endAt: string;
    roomId?: number;
    location?: string;
    meetingUrl?: string;
}

export interface ScheduleValidationRequest {
    sessions: ScheduleValidationCandidate[];
}

export interface ScheduleConflictIssue {
    code: string;
    candidateKey?: string | null;
    field?: string | null;
    message?: string | null;
    conflictSessionId?: number | null;
    conflictCandidateKey?: string | null;
}

export interface ScheduleValidationResponse {
    versionId: number;
    valid: boolean;
    issues: ScheduleConflictIssue[];
}
