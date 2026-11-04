import api from "@/api/axios";
import type { SyllabusDetail } from "@/api/features/demo/syllabus.api";

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

  copyFromTemplate: async (input: CopySyllabusInput): Promise<SyllabusDetail> =>
    (await api.post<SyllabusDetail>("/syllabuses/templates/copy", input)).data,
};
