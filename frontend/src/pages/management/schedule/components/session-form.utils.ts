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
  if (!form.title.trim()) errors.title = "Vui lòng nhập tiêu đề buổi học.";
  if (form.title.trim().length > 150) errors.title = "Tiêu đề không được vượt quá 150 ký tự.";
  if (!topics.some((topic) => String(topic.id) === form.topicId))
    errors.topicId = "Vui lòng chọn chủ đề đang hoạt động.";
  if (!trainers.some((trainer) => String(trainer.id) === form.trainerId))
    errors.trainerId = "Vui lòng chọn giảng viên đang hoạt động.";
  if (!form.startTime) errors.startTime = "Vui lòng chọn thời gian bắt đầu.";
  if (!form.endTime) errors.endTime = "Vui lòng chọn thời gian kết thúc.";
  if (
    form.startTime &&
    form.endTime &&
    formatSessionTime(form.endTime) <= formatSessionTime(form.startTime)
  )
    errors.endTime = "Thời gian kết thúc phải sau thời gian bắt đầu.";
  if (classInfo?.startDate && form.startTime && form.startTime.slice(0, 10) < classInfo.startDate)
    errors.startTime = "Buổi học bắt đầu trước ngày bắt đầu của lớp.";
  if (classInfo?.endDate && form.endTime && form.endTime.slice(0, 10) > classInfo.endDate)
    errors.endTime = "Buổi học kết thúc sau ngày kết thúc của lớp.";
  if (form.room.trim().length > 80) errors.room = "Phòng học không được vượt quá 80 ký tự.";
  if (form.meetingLink.trim().length > 255)
    errors.meetingLink = "Link học không được vượt quá 255 ký tự.";
  if (form.meetingLink.trim()) {
    try {
      const link = new URL(form.meetingLink.trim());
      if (!["http:", "https:"].includes(link.protocol))
        errors.meetingLink = "Link học phải bắt đầu bằng http:// hoặc https://.";
    } catch {
      errors.meetingLink = "Link học không hợp lệ.";
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
      (Array.isArray(messages) ? messages[0] : messages) || "Dữ liệu không hợp lệ.",
    ]),
  );
}

export function getSessionErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  if (error.response?.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (error.response?.status === 404) return "Không tìm thấy buổi học hoặc buổi học đã bị xóa.";
  if (error.response?.status === 409)
    return "Dữ liệu đã thay đổi hoặc bản lịch không còn ở trạng thái DRAFT. Vui lòng tải lại.";
  return error.response?.data?.message || fallback;
}
