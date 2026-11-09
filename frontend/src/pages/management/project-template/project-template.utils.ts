import axios from "axios";
import type { ProjectTemplateDTO, ProjectTemplateLevel, TemplateMilestone } from "@/types/features/project-template";

export const templateLevelOptions = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
] as const;

export const templateStatusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

export interface TemplateFormValues {
  code: string;
  name: string;
  description: string;
  category: string;
  level: ProjectTemplateLevel | "";
  estimatedDurationWeeks: string;
}

export type TemplateFieldErrors = Partial<Record<keyof TemplateFormValues, string[]>>;

export const maxDescriptionWords = 1000;

export function descriptionWordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

export function toTemplateFormValues(template?: ProjectTemplateDTO): TemplateFormValues {
  return {
    code: template?.code ?? "",
    name: template?.name ?? "",
    description: template?.description ?? "",
    category: template?.category ?? "",
    level: template?.level ?? "",
    estimatedDurationWeeks: template?.estimatedDurationWeeks?.toString() ?? "",
  };
}

export function minimumTemplateDurationWeeks(milestones: TemplateMilestone[]): number {
  const latestDay = milestones.reduce((latest, milestone) => Math.max(latest,
    milestone.dueAfter * (milestone.dueUnit === "WEEKS" ? 7 : 1)), 0);
  return Math.ceil(latestDay / 7);
}

export function validateTemplateForm(values: TemplateFormValues, minimumDurationWeeks = 0): TemplateFieldErrors {
  const errors: TemplateFieldErrors = {};
  for (const [field, label, maximum] of [
    ["code", "Code", 100],
    ["name", "Name", 255],
    ["category", "Category", 255],
  ] as const) {
    if (!values[field].trim()) errors[field] = [`${label} is required`];
    else if (values[field].trim().length > maximum) {
      errors[field] = [`${label} must not exceed ${maximum} characters`];
    }
  }
  if (!values.description.trim()) errors.description = ["Description is required"];
  else if (descriptionWordCount(values.description) > maxDescriptionWords) {
    errors.description = ["Description must not exceed 1000 words"];
  }
  if (!templateLevelOptions.some((option) => option.value === values.level)) {
    errors.level = ["Select Beginner, Intermediate or Advanced"];
  }
  const duration = values.estimatedDurationWeeks.trim();
  if (!/^\d+$/.test(duration) || Number(duration) <= 0 || Number(duration) > 2147483647) {
    errors.estimatedDurationWeeks = ["Estimated duration must be a positive whole number of weeks"];
  } else if (Number(duration) < minimumDurationWeeks) {
    errors.estimatedDurationWeeks = [`Estimated duration must be at least ${minimumDurationWeeks} weeks to include all saved milestones. Update the milestone schedule first or increase the duration.`];
  }
  return errors;
}

export function getTemplateError(error: unknown): {
  status: number | undefined;
  message: string;
  fields: Record<string, string[]>;
} {
  if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(error)) {
    return {
      status: error.response?.status,
      message: error.response?.data?.message ?? "Unable to reach the server. Please try again.",
      fields: error.response?.data?.errors ?? {},
    };
  }
  return { status: undefined, message: "Unable to complete this request. Please try again.", fields: {} };
}

export function templateLevelLabel(level: ProjectTemplateLevel) {
  return templateLevelOptions.find((option) => option.value === level)?.label ?? level;
}
