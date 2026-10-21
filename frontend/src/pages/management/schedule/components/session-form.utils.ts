import type { LessonDTO, SessionClassInfo, SessionDTO, UserDTO } from "@/types";
import axios from "axios";

export interface SessionFormValues {
  title: string;
  topicId: string;
  trainerId: string;
  startTime: string;
  endTime: string;
  room: string;
  meetingLink: string;
}

export function getTrainerName(trainer: UserDTO) {
  return (
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    trainer.email ||
    "Trainer #" + trainer.id
  );
}

export function toSessionForm(session: SessionDTO): SessionFormValues {
  return {
    title: session.title,
    topicId: session.topicId != null ? String(session.topicId) : "",
    trainerId: String(session.trainerId),
    startTime: session.startTime.slice(0, 16),
    endTime: session.endTime.slice(0, 16),
    room: session.room || "",
    meetingLink: session.meetingLink || "",
  };
}

export function formatSessionTime(value: string) {
  return value ? value.slice(0, 16) + ":00" : "";
}

export function validateSessionForm(
  form: SessionFormValues,
  topics: LessonDTO[],
  trainers: UserDTO[],
  classInfo?: SessionClassInfo,
) {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "Please enter a session title.";
  if (form.title.trim().length > 150) errors.title = "Title must not exceed 150 characters.";
  if (!topics.some((topic) => String(topic.id) === form.topicId))
    errors.topicId = "Please select an active topic.";
  if (!trainers.some((trainer) => String(trainer.id) === form.trainerId))
    errors.trainerId = "Please select an active trainer.";
  if (!form.startTime) errors.startTime = "Please select a start time.";
  if (!form.endTime) errors.endTime = "Please select an end time.";
  if (
    form.startTime &&
    form.endTime &&
    formatSessionTime(form.endTime) <= formatSessionTime(form.startTime)
  )
    errors.endTime = "End time must be after start time.";
  if (classInfo?.startDate && form.startTime && form.startTime.slice(0, 10) < classInfo.startDate)
    errors.startTime = "Session starts before the class start date.";
  if (classInfo?.endDate && form.endTime && form.endTime.slice(0, 10) > classInfo.endDate)
    errors.endTime = "Session ends after the class end date.";
  if (form.room.trim().length > 80) errors.room = "Room must not exceed 80 characters.";
  if (form.meetingLink.trim().length > 255)
    errors.meetingLink = "Meeting link must not exceed 255 characters.";
  if (form.meetingLink.trim()) {
    try {
      const link = new URL(form.meetingLink.trim());
      if (!["http:", "https:"].includes(link.protocol))
        errors.meetingLink = "Meeting link must start with http:// or https://.";
    } catch {
      errors.meetingLink = "Invalid meeting link.";
    }
  }
  return errors;
}

export function getSessionFieldErrors(error: unknown): Record<string, string> {
  const data = axios.isAxiosError(error) ? error.response?.data : undefined;
  const fields: Record<string, string | string[]> = data?.errors || data?.fieldErrors || {};
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [
      field,
      (Array.isArray(messages) ? messages[0] : messages) || "Invalid data.",
    ]),
  );
}

export function getSessionErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  if (error.response?.status === 403) return "You do not have permission to perform this action.";
  if (error.response?.status === 404) return "Session not found or has been deleted.";
  if (error.response?.status === 409)
    return "Data has changed or the calendar version is no longer DRAFT. Please reload.";
  return error.response?.data?.message || fallback;
}
