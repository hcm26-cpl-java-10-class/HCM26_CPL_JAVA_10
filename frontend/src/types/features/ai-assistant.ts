export interface GenerateTemplateRequest {
  projectTitle: string;
  projectDescription: string;
  projectType: string;
  additionalRequirements?: string;
}

export interface GenerateTemplateResponse {
  suggestionId: number;
  status: string;
  output: GeneratedTemplateOutput;
  model: string;
  createdAt: string;
}

export interface GeneratedTemplateOutput {
  projectTemplate: ProjectTemplateOutput | null;
  teamConstraints: TeamConstraintsOutput | null;
  milestones: MilestoneOutput[] | null;
  backlogItems: BacklogItemOutput[] | null;
  modules: ModuleOutput[] | null;
  resources: ResourceOutput[] | null;
}

export interface ProjectTemplateOutput {
  code: string | null;
  name: string | null;
  description: string | null;
  technologyStack: string | null;
  category: string | null;
  level: string | null;
  estimatedDurationWeeks: number | null;
}

export interface TeamConstraintsOutput {
  minMembers: number;
  maxMembers: number;
  roleQuotas: {
    pm: number;
    ba: number;
    dev: number;
    qa: number;
  } | null;
  allowMultiRole: boolean;
}

export interface MilestoneOutput {
  title: string | null;
  description: string | null;
  dueAfter: number | null;
  dueUnit: string | null;
  weight: number | null;
  mandatory: boolean;
  orderIndex: number | null;
  allowLateSubmission: boolean | null;
  maxLateDays: number | null;
  penaltyPerDayPercent: number | null;
  checklistItems: ChecklistItemOutput[] | null;
  rubricCriteria: RubricCriterionOutput[] | null;
}

export interface ChecklistItemOutput {
  content: string | null;
  mandatory: boolean;
  orderIndex: number | null;
}

export interface RubricCriterionOutput {
  code: string | null;
  name: string | null;
  description: string | null;
  weight: number | null;
  maxScore: number | null;
  orderIndex: number | null;
  ratings: RubricRatingOutput[] | null;
}

export interface RubricRatingOutput {
  level: string | null;
  description: string | null;
}

export interface BacklogItemOutput {
  title: string | null;
  description: string | null;
  suggestedRole: string | null;
  orderIndex: number | null;
}

export interface ModuleOutput {
  code: string | null;
  name: string | null;
  description: string | null;
  technologyStack: string | null;
  category: string | null;
  level: string | null;
  estimatedDurationWeeks: number | null;
}

export interface ResourceOutput {
  title: string | null;
  description: string | null;
  kind: string | null;
  url: string | null;
  orderIndex: number | null;
}
