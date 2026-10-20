export interface ProgramTopicItemDTO {
  topicId: number;
  topicCode?: string;
  topicName: string;
  sequenceOrder?: number;
  orderIndex?: number;
  totalHours?: number;
  durationHours?: number;
  defaultSlot?: string;
  assignedTrainerId?: number;
  assignedTrainerName?: string;
  preferredTrainerId?: number;
  preferredTrainerName?: string;
  preferredRoomId?: string;
}

export interface TrainerOptionDTO {
  id: number;
  name: string;
  email: string;
}

export interface RoomOptionDTO {
  roomId: string;
  roomName: string;
  capacity: number;
}

export interface ScheduleGenerationContextResponse {
  classId: number;
  classCode: string;
  calendarVersionId?: number;
  programId?: number;
  programName: string;
  totalHours: number;
  defaultRoomId?: string;
  defaultRoomName?: string;
  topics: ProgramTopicItemDTO[];
  holidays: string[];
  availableTrainers: TrainerOptionDTO[];
  availableRooms: RoomOptionDTO[];
}

export interface BulkPreviewRequestDTO {
  startDate: string; // YYYY-MM-DD
  daysOfWeek: string[]; // ["MONDAY", "WEDNESDAY", "FRIDAY"]
  slotTime: {
    slotName?: string;
    startTime: string; // HH:mm:ss
    endTime: string; // HH:mm:ss
    hoursPerSession?: number;
  };
  defaultRoomId?: string;
  skipHolidays: boolean;
  checkConflicts?: boolean;
}

export interface PreviewSessionItemDTO {
  tempId: string;
  topicId: number;
  topicName: string;
  sessionNumber: number;
  date: string; // YYYY-MM-DD
  dayOfWeek?: string;
  startTime: string; // YYYY-MM-DDTHH:mm:ss
  endTime: string; // YYYY-MM-DDTHH:mm:ss
  trainerId: number;
  trainerName: string;
  roomId: string;
  status?: string; // VALID, CONFLICT
  hasConflict?: boolean;
  conflictDetails?: {
    type?: string;
    conflictingClassCode?: string;
    message?: string;
  };
  conflictReason?: string;
  isFractional?: boolean;
}

export interface BulkPreviewResponseDTO {
  classId: number;
  calendarVersionId?: number;
  totalSessions: number;
  totalHoursCalculated?: number;
  startDate: string;
  estimatedEndDate: string;
  skippedHolidaysCount: number;
  conflictCount: number;
  hasConflicts?: boolean;
  sessions: PreviewSessionItemDTO[];
  correlationId?: string;
}

export interface BulkSaveSessionsRequestDTO {
  sessions: PreviewSessionItemDTO[];
}

export interface BulkSaveSessionsResponseDTO {
  calendarVersionId: number;
  classId: number;
  createdCount: number;
  status: string;
  message: string;
  createdAt: string;
  correlationId: string;
}
