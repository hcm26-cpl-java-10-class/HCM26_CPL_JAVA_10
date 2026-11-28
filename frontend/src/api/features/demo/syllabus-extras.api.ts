import api from "@/api/axios";
import type { SyllabusDetail } from "@/api/features/demo/syllabus.api";

export type CourseCandidate = {
  id: number;
  name: string;
  status: string;
  active: boolean;
};

export type LinkedCourse = {
  id: number;
  name: string;
  status: string;
  active: boolean;
};

export type SyllabusCourseUsage = {
  syllabusId: number;
  syllabusCode: string;
  syllabusName: string;
  syllabusStatus: "DRAFT" | "PUBLISHED";
  syllabusActive: boolean;
  courseCount: number;
  courses: LinkedCourse[];
};

export type CopySyllabusInput = {
  sourceId: number;
  code: string;
  name: string;
};

export const syllabusExtrasApi = {
  courseUsage: async (): Promise<SyllabusCourseUsage[]> =>
    (await api.get<SyllabusCourseUsage[]>("/syllabuses/course-usage")).data,

  availableCourses: async (search: string): Promise<CourseCandidate[]> =>
    (await api.get<CourseCandidate[]>("/syllabuses/course-usage/available-courses", { params: { search } })).data,

  linkCourse: async (syllabusId: number, courseId: number): Promise<void> => {
    await api.put(`/syllabuses/course-usage/${syllabusId}/courses/${courseId}`);
  },

  unlinkCourse: async (syllabusId: number, courseId: number): Promise<void> => {
    await api.delete(`/syllabuses/course-usage/${syllabusId}/courses/${courseId}`);
  },

  copyFromTemplate: async (input: CopySyllabusInput): Promise<SyllabusDetail> =>
    (await api.post<SyllabusDetail>("/syllabuses/templates/copy", input)).data,
};
