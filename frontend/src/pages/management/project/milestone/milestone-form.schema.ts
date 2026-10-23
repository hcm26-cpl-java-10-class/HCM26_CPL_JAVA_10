import { z } from "zod";
import type { LatePolicyType } from "@/types";

export const milestoneFormSchema = z
  .object({
    title: z.string().trim().min(1, "Milestone name is required").max(200, "Milestone name must not exceed 200 characters"),
    description: z.string().max(2000, "Description must not exceed 2,000 characters"),
    deadline: z.string().min(1, "Deadline is required"),
    mandatory: z.boolean(),
    checklist: z
      .array(
        z.object({
          content: z.string().trim().min(1, "Checklist content is required").max(500, "Checklist content must not exceed 500 characters"),
          mandatory: z.boolean(),
        }),
      )
      .min(1, "At least one checklist item is required")
      .max(100, "Checklist must not contain more than 100 items"),
    rubricSnapshotId: z.string().min(1, "Please select a rubric"),
    reviewerId: z.string().min(1, "Please select a reviewer"),
    latePolicy: z.object({
      type: z.enum(["NO_LATE", "ALLOW_LATE"]),
      lateUntil: z.string().optional(),
      penaltyPercent: z.number().min(0, "Penalty must be at least 0%").max(100, "Penalty must not exceed 100%").optional(),
    }),
  })
  .superRefine((value, context) => {
    const deadline = value.deadline ? new Date(value.deadline) : null;

    if (deadline && Number.isNaN(deadline.getTime())) {
      context.addIssue({ code: "custom", path: ["deadline"], message: "Deadline is invalid" });
    } else if (deadline && deadline.getTime() <= Date.now()) {
      context.addIssue({ code: "custom", path: ["deadline"], message: "Deadline must be in the future" });
    }

    if (value.latePolicy.type !== "ALLOW_LATE") return;

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
  });

export interface MilestoneFormValues {
  title: string;
  description: string;
  deadline: string;
  mandatory: boolean;
  checklist: Array<{ content: string; mandatory: boolean }>;
  rubricSnapshotId: string;
  reviewerId: string;
  latePolicy: {
    type: LatePolicyType;
    lateUntil?: string;
    penaltyPercent?: number;
  };
}

export const milestoneDefaultValues: MilestoneFormValues = {
  title: "",
  description: "",
  deadline: "",
  mandatory: true,
  checklist: [{ content: "", mandatory: true }],
  rubricSnapshotId: "",
  reviewerId: "",
  latePolicy: { type: "NO_LATE" },
};
