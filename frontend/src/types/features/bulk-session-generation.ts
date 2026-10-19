export interface ProgramTopicItemDTO {
  topicId: number;
  topicCode: string;
  topicName: string;
  orderIndex: number;
  durationHours: number;
  defaultSlot: string;
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
  calendarVersionId: number;
  programName: string;
  totalHours: number;
  topics: ProgramTopicItemDTO[];
  holidays: string[];
  availableTrainers: TrainerOptionDTO[];
  availableRooms: RoomOptionDTO[];
}

export interface BulkPreviewRequestDTO {
  classId: number;
  calendarVersionId: number;
  startDate: string; // YYYY-MM-DD
  selectedDaysOfWeek: string[]; // ["MONDAY", "WEDNESDAY", "FRIDAY"]
  slot: "MORNING" | "AFTERNOON" | "EVENING" | "CUSTOM";
  slotStartTime?: string; // HH:mm:ss
  slotEndTime?: string; // HH:mm:ss
  defaultTrainerId?: number;
  defaultRoomId?: string;
  skipHolidays: boolean;
  customHolidayDates?: string[];
}

export interface PreviewSessionItemDTO {
  tempId: string;
  topicId: number;
  topicName: string;
  sessionNumber: number;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  startTime: string; // YYYY-MM-DDTHH:mm:ss
  endTime: string; // YYYY-MM-DDTHH:mm:ss
  trainerId: number;
  trainerName: string;
  roomId: string;
  hasConflict: boolean;
  conflictReason?: string;
  isFractional?: boolean;
}

export interface BulkPreviewResponseDTO {
  classId: number;
  calendarVersionId: number;
  totalSessions: number;
  startDate: string;
  estimatedEndDate: string;
  skippedHolidaysCount: number;
  conflictCount: number;
  sessions: PreviewSessionItemDTO[];
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
