import http from "@/api/axios";

export interface ScheduleCandidate {
    id?: number;
    classId?: number;
    topicId?: number;
    trainerId?: number;
    teachingAssignmentId?: number;
    roomId?: number;
    location?: string;
    meetingUrl?: string;
    title: string;
    startTime: string;
    endTime: string;
}
export interface ScheduleIssue {
    code: string;
    field: string;
    message: string;
    candidateIndex: number;
    relatedCandidateIndex: number | null;
    relatedSessionId: number | null;
    relatedTitle: string | null;
    relatedStart: string | null;
    relatedEnd: string | null;
}
export interface ScheduleValidationResult {
    valid: boolean;
    timezone: string;
    issues: ScheduleIssue[];
}
export interface ScheduleResources {
    references: {
        classes: { id: number; name: string; code: string; startDate: string; endDate: string; status: string }[];
        trainers: { id: number; name: string; status: string }[];
        rooms: { id: number; name: string }[];
        assignments: { id: number; classId: number; topicId: number; trainerId: number; effectiveFrom: string; effectiveTo: string | null; status: string }[];
        holidays: { date: string; endDate: string | null; name: string }[];
    };
    rules: { timezone: string; openingTime: string; closingTime: string; workingDays: number[]; maxBatchSize: number };
}
export const scheduleValidationApi = {
    resources: async () => (await http.get<ScheduleResources>("/schedule-checks/resources")).data,
    validate: async (sessions: ScheduleCandidate[]) =>
        (await http.post<ScheduleValidationResult>("/schedule-checks", { sessions })).data,
};
