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
