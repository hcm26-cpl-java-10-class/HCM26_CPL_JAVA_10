import { z } from "zod";
import type { LatePolicyType } from "@/types";

export const MILESTONE_FORM_LIMITS = {
  title: 120,
  description: 1000,
  checklistItemContent: 500,
  checklistItems: 100,
} as const;

const milestoneFormFields = {
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
};

function validateScheduleRules(value: Pick<MilestoneFormValues, "deadline" | "latePolicy">, context: z.RefinementCtx) {
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
}

export const milestoneFormSchema = z.object(milestoneFormFields).superRefine(validateScheduleRules);

export function tenantToday(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const tenantStartCache = new Map<string, number>();

/** First instant of a calendar date in the tenant zone, including dates with DST changes. */
export function tenantStartOfDay(date: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const anchor = new Date(`${date}T00:00:00Z`).getTime();
  if (Number.isNaN(anchor)) return null;

  const key = `${timeZone}:${date}`;
  const cached = tenantStartCache.get(key);
  if (cached !== undefined) return new Date(cached);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const localDate = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };

  // Every IANA offset is within 24 hours. Find the first millisecond in the date,
  // so a midnight gap or repeated hour follows the same rule as LocalDate.atStartOfDay.
  let low = anchor - 2 * 86_400_000;
  let high = anchor + 2 * 86_400_000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(middle) < date) low = middle + 1;
    else high = middle;
  }

  tenantStartCache.set(key, low);
  return new Date(low);
}

export function milestoneFormSchemaForTenant(timeZone: string) {
  return milestoneFormSchema.superRefine((value, context) => validateTenantSchedule(value, context, timeZone));
}

function validateTenantSchedule(value: Pick<MilestoneFormValues, "startDate" | "deadline">, context: z.RefinementCtx, timeZone: string) {
    if (value.startDate && value.startDate < tenantToday(timeZone)) {
      context.addIssue({ code: "custom", path: ["startDate"], message: "Start date must be today or later in the tenant time zone" });
    }
    const start = tenantStartOfDay(value.startDate, timeZone);
    const deadline = value.deadline ? new Date(value.deadline) : null;
    if (start && deadline && !Number.isNaN(deadline.getTime()) && start.getTime() >= deadline.getTime()) {
      context.addIssue({ code: "custom", path: ["startDate"], message: "Start date must be before the deadline" });
    }
}

export function milestoneStepSchemaForTenant(step: number, timeZone: string) {
  if (step === 0) {
    return z.object({ title: milestoneFormFields.title, description: milestoneFormFields.description, mandatory: milestoneFormFields.mandatory });
  }
  if (step === 1) {
    return z.object({
      startDate: milestoneFormFields.startDate,
      deadline: milestoneFormFields.deadline,
      latePolicy: milestoneFormFields.latePolicy,
      resubmissionPolicy: milestoneFormFields.resubmissionPolicy,
    }).superRefine((value, context) => {
      validateScheduleRules(value, context);
      validateTenantSchedule(value, context, timeZone);
    });
  }
  return z.object({ checklist: milestoneFormFields.checklist, rubricSnapshotId: milestoneFormFields.rubricSnapshotId });
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
