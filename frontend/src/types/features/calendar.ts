export type CalendarSessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface CalendarSession {
  id: string;
  title: string;
  className: string;
  subjectName: string;
  trainerName: string;
  location: string;
  startTime: string;
  endTime: string;
  status: CalendarSessionStatus;
}

export interface CalendarCandidateSession {
  candidateKey: string;
  title: string;
  topicId: number;
  trainerId: number;
  location: string;
  startTime: string;
  endTime: string;
}

export interface CalendarValidateRequest {
  classId: number;
  learningStartDate?: string;
  sessions: CalendarCandidateSession[];
}

export interface CalendarConflictIssue {
  code: string;
  candidateKey?: string;
  field?: string;
  message: string;
  conflictingSessionId?: number | null;
}

export interface CalendarValidationResult {
  valid: boolean;
  issues: CalendarConflictIssue[];
}
