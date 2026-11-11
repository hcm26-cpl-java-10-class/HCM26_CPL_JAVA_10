export interface TopicContextItem {
  topicId?: number | null;
  programSubjectId: number;
  subjectId: number;
  topicCode: string;
  topicName: string;
  sequenceOrder: number;
  totalHours: number;
  assignedTrainerId?: number;
  assignedTrainerName?: string;
  teachingAssignmentId?: number;
  defaultRoom?: string;
}

export interface ScheduleGenerationContextResponse {
  classId: number;
  classCode: string;
  className: string;
  programId?: number;
  programName?: string;
  programVersion?: string;
  totalHours: number;
  topics: TopicContextItem[];
}

export interface SlotTimeDTO {
  startTime: string; // HH:mm:ss
  endTime?: string;
  hoursPerSession: number;
}

export interface TopicOverrideDTO {
  topicId?: number;
  programSubjectId?: number;
  trainerId?: number;
  trainerName?: string;
  roomId?: number;
  roomName?: string;
}

export interface BulkPreviewRequestDTO {
  startDate: string; // YYYY-MM-DD
  daysOfWeek: string[]; // ["MONDAY", "WEDNESDAY", "FRIDAY"]
  slotTime: SlotTimeDTO;
  defaultRoomId?: number;
  defaultRoomName?: string;
  meetingUrl?: string;
  skipHolidays: boolean;
  checkConflicts: boolean;
  topicOverrides?: TopicOverrideDTO[];
}

export interface ConflictDetailDTO {
  type: string;
  conflictingClassCode?: string;
  message: string;
}

export interface PreviewSessionItemDTO {
  tempId: string;
  topicId?: number | null;
  programSubjectId: number;
  subjectId: number;
  topicName: string;
  sessionNumber: number;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO
  endTime: string; // ISO
  trainerId?: number;
  trainerName?: string;
  roomId?: number;
  roomName?: string;
  meetingUrl?: string;
  teachingAssignmentId?: number;
  title: string;
  status: "VALID" | "CONFLICT" | "PENDING";
  conflictDetails?: ConflictDetailDTO;
}

export interface BulkPreviewResponseDTO {
  classId: number;
  totalSessions: number;
  totalHoursCalculated: number;
  hasConflicts: boolean;
  conflictCount: number;
  startDate: string;
  estimatedEndDate: string;
  skippedHolidaysCount: number;
  sessions: PreviewSessionItemDTO[];
  correlationId: string;
}

export interface BulkSaveSessionsRequestDTO {
  sessions: PreviewSessionItemDTO[];
}

export interface BulkSaveSessionsResponseDTO {
  createdSessions: Array<{ source: "STUDY_SESSION"; id: number }>;
  classId: number;
  createdCount: number;
  status: string;
  message: string;
  createdAt: string;
  correlationId: string;
}