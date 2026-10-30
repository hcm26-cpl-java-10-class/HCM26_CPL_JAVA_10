import type { FormValidationContext } from "@/types/common/datatable";

const roomPattern = /^[\p{L}\p{M}\p{N} .,/#()_:&-]+$/u;
const lecturerPattern = /^[\p{L}\p{M}\p{N} .'’()-]+$/u;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function timeValue(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/.exec(value);
  if (!match) return undefined;
  const [, hours, minutes, seconds = "0", fraction = "0"] = match;
  if (+hours > 23 || +minutes > 59 || +seconds > 59) return undefined;
  return +hours * 3600 + +minutes * 60 + +seconds + Number(`0.${fraction}`);
}

export function validateStudySession(
  values: Record<string, unknown>,
  context: FormValidationContext,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const text = (name: string) => typeof values[name] === "string" ? values[name] as string : "";
  const error = (name: string, message: string) => { errors[name] = [message]; };
  const subjectId = values.subjectId;
  if (subjectId === undefined || subjectId === null || String(subjectId).trim() === "") {
    error("subjectId", "Vui lòng chọn môn học.");
  } else if (context.relationLoading.subjectId || context.relationErrors.subjectId) {
    error("subjectId", "Chưa thể xác nhận môn học. Vui lòng chờ tải xong hoặc tải lại danh sách.");
  } else if (!(context.relationOptions.subjectId ?? []).some(subject => String(subject.id) === String(subjectId))) {
    error("subjectId", "Vui lòng chọn một môn học hiện có trong danh sách.");
  }

  const title = text("title");
  if (!title.trim() || title.length < 5 || title.length > 150) {
    error("title", "Tiêu đề bắt buộc, từ 5–150 ký tự và không chỉ có khoảng trắng.");
  }
  if (!validDate(text("sessionDate"))) error("sessionDate", "Vui lòng nhập ngày hợp lệ theo định dạng yyyy-MM-dd.");
  const start = timeValue(text("startTime"));
  const end = timeValue(text("endTime"));
  if (start === undefined) error("startTime", "Vui lòng nhập giờ bắt đầu hợp lệ.");
  if (end === undefined) error("endTime", "Vui lòng nhập giờ kết thúc hợp lệ.");
  else if (start !== undefined && end <= start) error("endTime", "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.");

  const room = text("room");
  if (room && (!room.trim() || room.length > 30 || !roomPattern.test(room))) {
    error("room", "Phòng tối đa 30 ký tự, gồm chữ, số, khoảng trắng và dấu phân cách thông dụng.");
  }
  const lecturer = text("lecturer");
  if (!lecturer.trim() || lecturer.length < 2 || lecturer.length > 100 ||
      !/\p{L}/u.test(lecturer) || !lecturerPattern.test(lecturer)) {
    error("lecturer", "Giảng viên bắt buộc, từ 2–100 ký tự, có chữ cái và chỉ dùng dấu thông dụng trong tên.");
  }
  if (!["LECTURE", "LAB", "EXAM"].includes(text("type"))) error("type", "Loại buổi học phải là LECTURE, LAB hoặc EXAM.");
  if (text("description").length > 500) error("description", "Mô tả tối đa 500 ký tự.");
  return errors;
}
