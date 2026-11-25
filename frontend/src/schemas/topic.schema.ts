import { z } from "zod";
import { normalizeSubjectIdentity } from "@/utils/subject-identity.utils";

export const TECHNICAL_GROUP_OPTIONS = [
  { value: "Java", label: "Java" },
  { value: "React", label: "React" },
  { value: "Frontend", label: "Frontend" },
  { value: "Backend", label: "Backend" },
  { value: "Database", label: "Database" },
  { value: "DevOps", label: "DevOps" },
  { value: "Testing", label: "Testing" },
  { value: "Cloud", label: "Cloud" },
  { value: "Security", label: "Security" },
  { value: "Mobile", label: "Mobile" },
  { value: "Data_Engineering", label: "Data Engineering" },
  { value: "AI_ML", label: "AI / Machine Learning" },
  { value: "Soft Skills", label: "Soft Skills" },
] as const;

export const TECHNICAL_GROUP_VALUES = TECHNICAL_GROUP_OPTIONS.map((o) => o.value);

const NUMERIC_ONLY_REGEX = /^[0-9]+(\.[0-9]+)?$/;

export function isNumericOnly(value: string): boolean {
  return NUMERIC_ONLY_REGEX.test(value.trim());
}

export function getTechnicalGroupBadgeClass(group?: string): string {
  const g = (group || "").toLowerCase();
  if (g.includes("java")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (g.includes("react") || g.includes("frontend")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
  if (g.includes("backend")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (g.includes("database")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (g.includes("devops")) return "bg-violet-50 text-violet-700 border-violet-200";
  if (g.includes("testing") || g.includes("qa")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (g.includes("soft")) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export const topicFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Topic Code is required")
    .max(50, "Topic Code cannot exceed 50 characters")
    .transform((v) => v.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(1, "Topic Name is required")
    .max(255, "Topic Name cannot exceed 255 characters"),
  version: z
    .string()
    .trim()
    .min(1, "Version is required")
    .max(20, "Version cannot exceed 20 characters")
    .transform((v) => normalizeSubjectIdentity({ version: v }).version ?? v),
  technicalGroup: z
    .string()
    .trim()
    .max(100, "Technical Group cannot exceed 100 characters")
    .refine((v) => v === "" || !isNumericOnly(v), {
      message: "Technical Group must be text (cannot be only numbers)",
    })
    .optional()
    .default(""),
  durationHours: z
    .union([z.number(), z.string()])
    .transform((v) => (v === "" ? NaN : Number(v)))
    .refine((v) => !Number.isNaN(v), { message: "Duration must be a valid number" })
    .refine((v) => v > 0, { message: "Duration must be a positive integer greater than 0" })
    .refine((v) => Number.isInteger(v), { message: "Duration must be an integer number of hours" })
    .refine((v) => v <= 1000, { message: "Duration cannot exceed 1000 hours" }),
  description: z
    .string()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional()
    .default(""),
  isActive: z.boolean().default(true),
});

export type TopicFormInput = z.input<typeof topicFormSchema>;
export type TopicFormValues = z.output<typeof topicFormSchema>;

export const cloneTopicSchema = z.object({
  version: z
    .string()
    .trim()
    .min(1, "New version is required")
    .max(20, "Version cannot exceed 20 characters")
    .transform((v) => normalizeSubjectIdentity({ version: v }).version ?? v),
});

export type CloneTopicValues = z.output<typeof cloneTopicSchema>;
