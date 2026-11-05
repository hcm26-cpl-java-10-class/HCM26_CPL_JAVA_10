import { z } from "zod";
import type { LatePolicyType } from "@/types";

export const MILESTONE_FORM_LIMITS = {
  title: 120,
  description: 1000,
  checklistItemContent: 500,
  checklistItems: 100,
} as const;

export const milestoneFormSchema = z
  .object({
    title: z.string().trim().min(1, "Milestone name is required").max(MILESTONE_FORM_LIMITS.title, "Milestone name must not exceed 120 characters"),
    description: z.string().max(MILESTONE_FORM_LIMITS.description, "Description must not exceed 1,000 characters"),
    deadline: z.string().min(1, "Deadline is required"),
    startDate: z.iso.date({ error: "Start date is required" }),
    mandatory: z.boolean(),
    checklist: z
      .array(
        z.object({
          content: z
            .string()
            .trim()
            .min(1, "Checklist content is required")
            .max(MILESTONE_FORM_LIMITS.checklistItemContent, "Checklist content must not exceed 500 characters"),
          mandatory: z.boolean(),
        }),
      )
      .min(1, "At least one checklist item is required")
      .max(MILESTONE_FORM_LIMITS.checklistItems, "Checklist must not contain more than 100 items"),
    rubricSnapshotId: z.string().min(1, "Please select a rubric"),
    latePolicy: z.object({
      type: z.enum(["NO_LATE", "ALLOW_LATE"]),
      lateUntil: z.string().optional(),
      penaltyPercent: z.number().min(0, "Penalty must be at least 0%").max(100, "Penalty must not exceed 100%").optional(),
    }),
    resubmissionPolicy: z.object({
      allowed: z.boolean(),
      maxAttempts: z.number().int("Attempts must be a whole number").min(2, "At least 2 attempts are required").max(99, "Attempts must not exceed 99").optional(),
    }),
  })
  .superRefine((value, context) => {
    const deadline = value.deadline ? new Date(value.deadline) : null;

    if (deadline && Number.isNaN(deadline.getTime())) {
      context.addIssue({ code: "custom", path: ["deadline"], message: "Deadline is invalid" });
    } else if (deadline && deadline.getTime() <= Date.now()) {
      context.addIssue({ code: "custom", path: ["deadline"], message: "Deadline must be in the future" });
    }

    if (value.latePolicy.type === "ALLOW_LATE") {
      if (!value.latePolicy.lateUntil) {
        context.addIssue({ code: "custom", path: ["latePolicy", "lateUntil"], message: "Late submission deadline is required" });
      } else {
        const lateUntil = new Date(value.latePolicy.lateUntil);
        if (Number.isNaN(lateUntil.getTime())) {
          context.addIssue({ code: "custom", path: ["latePolicy", "lateUntil"], message: "Late submission deadline is invalid" });
        } else if (deadline && !Number.isNaN(deadline.getTime()) && lateUntil.getTime() <= deadline.getTime()) {
          context.addIssue({ code: "custom", path: ["latePolicy", "lateUntil"], message: "Late submission deadline must be after the milestone deadline" });
        }
      }

      if (value.latePolicy.penaltyPercent === undefined) {
        context.addIssue({ code: "custom", path: ["latePolicy", "penaltyPercent"], message: "Late penalty is required" });
      }
    }

  });

export function tenantToday(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function milestoneFormSchemaForTenant(timeZone: string) {
  return milestoneFormSchema.superRefine((value, context) => {
    if (value.startDate && value.startDate <= tenantToday(timeZone)) {
      context.addIssue({ code: "custom", path: ["startDate"], message: "Start date must be after today in the tenant time zone" });
    }
  });
}

export interface MilestoneFormValues {
  title: string;
  description: string;
  deadline: string;
  startDate: string;
  mandatory: boolean;
  checklist: Array<{ content: string; mandatory: boolean }>;
  rubricSnapshotId: string;
  latePolicy: {
    type: LatePolicyType;
    lateUntil?: string;
    penaltyPercent?: number;
  };
  resubmissionPolicy: {
    allowed: boolean;
    maxAttempts?: number;
  };
}

export const milestoneDefaultValues: MilestoneFormValues = {
  title: "",
  description: "",
  deadline: "",
  startDate: "",
  mandatory: true,
  checklist: [{ content: "", mandatory: true }],
  rubricSnapshotId: "",
  latePolicy: { type: "NO_LATE" },
  resubmissionPolicy: { allowed: true, maxAttempts: 3 },
};
