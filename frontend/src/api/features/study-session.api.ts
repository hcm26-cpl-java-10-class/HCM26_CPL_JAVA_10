import axios from "../axios";
import type { AssignmentPage, AssignmentSessionStatus } from "./class-setup.api";

export interface StudySessionRow {
  id: number; classId: number | null; subjectId: number; subjectName: string;
  programSubjectId: number | null; teachingAssignmentId: number | null; trainerId: number | null;
  title: string; sessionDate: string; startTime: string; endTime: string; lecturer: string;
  room: string | null; roomId: number | null; meetingUrl: string | null;
  type: "LECTURE" | "LAB" | "EXAM"; status: AssignmentSessionStatus; isActive: boolean;
}
export type StudySessionWrite = Omit<StudySessionRow, "id" | "status" | "subjectName">;
export const studySessionApi = {
  list: async (params: { page: number; search?: string; classId?: number }, signal?: AbortSignal) =>
    (await axios.get<AssignmentPage<StudySessionRow>>("/study-sessions", { params: { ...params, size: 20, sort: "sessionDate,desc" }, signal })).data,
  create: async (body: StudySessionWrite) => (await axios.post<StudySessionRow>("/study-sessions", body)).data,
  update: async (id: number, body: StudySessionWrite) => (await axios.put<StudySessionRow>(`/study-sessions/${id}`, body)).data,
  cancel: async (id: number, reason: string) => (await axios.patch(`/study-sessions/${id}/cancel`, { reason })).data,
  complete: async (id: number, notes: string) => (await axios.patch(`/study-sessions/${id}/complete`, { notes })).data,
  delete: async (id: number) => (await axios.delete(`/study-sessions/${id}`)).data,
  deleteBulk: async (ids: number[]) => (await axios.delete<{ message: string; count: number }>("/study-sessions/bulk", { data: ids })).data,
  deleteByClass: async (classId: number) => (await axios.delete<{ message: string; count: number }>(`/study-sessions/classes/${classId}`)).data,
};
