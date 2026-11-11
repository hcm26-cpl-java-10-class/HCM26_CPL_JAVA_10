import type { StudySessionDTO } from "@/types/features/academic/study_session";

// Identity, audit and lifecycle fields are excluded from the new form.
export function toDuplicateInitial(source: StudySessionDTO): StudySessionDTO {
  return {
    subjectId: source.subjectId,
    title: source.title,
    sessionDate: source.sessionDate,
    startTime: source.startTime,
    endTime: source.endTime,
    room: source.room,
    lecturer: source.lecturer,
    type: source.type,
    description: source.description,
  };
}
