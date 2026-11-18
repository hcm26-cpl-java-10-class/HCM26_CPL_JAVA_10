import api from "@/api/axios";

/** Preview DTOs deliberately use CLO positions, not database identifiers. */
export type SyllabusAiTopic = { title: string; cloNumbers: number[] };
export type SyllabusAiSection = { title: string; mission: string; topics: SyllabusAiTopic[] };
export type SyllabusAiMaterial = {
  title: string;
  type: "BOOK" | "DOCUMENT" | "SLIDE" | "VIDEO" | "LINK";
  url: string;
  author: string;
  publisher: string;
  mainMaterial: boolean;
  note: string;
  sectionIndex: number | null;
  topicIndex: number | null;
  include: boolean;
};
export type SyllabusAiDraft = {
  code: string;
  name: string;
  description: string;
  teachingMethods: string;
  degreeLevel: string;
  timeAllocation: string;
  studentResponsibilities: string;
  requiredTools: string;
  scoringScale: number | null;
  clos: string[];
  sections: SyllabusAiSection[];
  materials: SyllabusAiMaterial[];
};
export type SyllabusAiGenerateRequest = {
  code: string;
  name: string;
  focus: string;
  degreeLevel: string;
  language: string;
  sectionCount: number;
  topicsPerSection: number;
  cloCount: number;
  notes: string;
};
export const syllabusAiApi = {
  status: async (): Promise<{ configured: boolean }> =>
    (await api.get("/syllabuses/templates/ai/status")).data,
  generate: async (body: SyllabusAiGenerateRequest): Promise<SyllabusAiDraft> =>
    (await api.post("/syllabuses/templates/ai/generate", body, { timeout: 210000 })).data,
  save: async (body: SyllabusAiDraft): Promise<{ id: number; savedMaterialCount: number }> =>
    (await api.post("/syllabuses/templates/ai/save", body, { timeout: 120000 })).data,
};
