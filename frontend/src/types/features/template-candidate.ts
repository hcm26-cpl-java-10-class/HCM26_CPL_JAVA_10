export interface TemplateCandidate {
  templateId: number;
  versionId: number;
  version: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  durationWeeks: number | null;
  minMembers: number;
  maxMembers: number;
  capacityMatch: boolean;
}

export interface TemplateCandidatePreview {
  template: TemplateCandidate;
  brief: Record<string, unknown>;
}

export interface TemplateCandidateFilter {
  q: string;
  level: string;
  category: string;
  page: number;
  size: number;
}
