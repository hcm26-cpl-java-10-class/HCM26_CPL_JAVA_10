import type {
  TemplateMilestonePlan,
  TemplateMilestonePlanPayload,
  TemplateMilestoneTimeUnit,
  TemplateLatePolicy,
  TemplateRubricCriterion,
} from "@/types/features/project-template";

export interface MilestoneChecklistValues {
  key: string;
  id?: number;
  content: string;
  mandatory: boolean;
}

export interface LatePolicyValues {
  allowLateSubmission: boolean;
  maxLateDays: string;
  penaltyPerDayPercent: string;
}

export function emptyLatePolicy(): LatePolicyValues {
  return { allowLateSubmission: false, maxLateDays: "", penaltyPerDayPercent: "" };
}

export interface MilestoneValues {
  key: string;
  id?: number;
  title: string;
  description: string;
  dueAfter: string;
  dueUnit: TemplateMilestoneTimeUnit;
  weight: string;
  mandatory: boolean;
  rubricVersionId: string;
  checklistItems: MilestoneChecklistValues[];
  legacyRubricCriteria: TemplateRubricCriterion[];
  latePolicy: LatePolicyValues | null;
}

export type MilestonePlanErrors = Record<string, string[] | undefined>;

export function newMilestone(first: boolean): MilestoneValues {
  return {
    key: crypto.randomUUID(),
    title: "",
    description: "",
    dueAfter: "",
    dueUnit: "WEEKS",
    weight: first ? "100" : "",
    mandatory: true,
    rubricVersionId: "",
    checklistItems: [],
    legacyRubricCriteria: [],
    latePolicy: emptyLatePolicy(),
  };
}

export function toMilestoneValues(plan: TemplateMilestonePlan): MilestoneValues[] {
  return plan.milestones.map((milestone) => ({
    key: milestone.id == null ? crypto.randomUUID() : `milestone-${milestone.id}`,
    id: milestone.id ?? undefined,
    title: milestone.title,
    description: milestone.description ?? "",
    dueAfter: String(milestone.dueAfter),
    dueUnit: milestone.dueUnit,
    weight: String(milestone.weight),
    mandatory: milestone.mandatory,
    rubricVersionId: milestone.rubricVersionId ?? "",
    checklistItems: milestone.checklistItems.map((item) => ({
      key: item.id == null ? crypto.randomUUID() : `checklist-${item.id}`,
      id: item.id ?? undefined,
      content: item.content,
      mandatory: item.mandatory,
    })),
    legacyRubricCriteria: milestone.legacyRubricCriteria ?? [],
    latePolicy: milestone.latePolicy ? {
      allowLateSubmission: milestone.latePolicy.allowLateSubmission,
      maxLateDays: milestone.latePolicy.allowLateSubmission ? milestone.latePolicy.maxLateDays?.toString() ?? "" : "",
      penaltyPerDayPercent: milestone.latePolicy.allowLateSubmission ? milestone.latePolicy.penaltyPerDayPercent?.toString() ?? "" : "",
    } : null,
  }));
}

export function weightHundredths(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed) || Number(trimmed) > 100) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function totalWeightHundredths(milestones: MilestoneValues[]): number | null {
  let total = 0;
  for (const milestone of milestones) {
    const weight = weightHundredths(milestone.weight);
    if (weight === null) return null;
    total += weight;
  }
  return total;
}

export function milestoneFieldId(path: string) {
  return `plan-${path.replace(/[.[\]]+/g, "-").replace(/-$/, "")}`;
}

export function validateMilestonePlan(milestones: MilestoneValues[], durationWeeks: number | null): MilestonePlanErrors {
  const errors: MilestonePlanErrors = {};
  const validDuration = durationWeeks !== null && Number.isInteger(durationWeeks) && durationWeeks > 0;
  if (!validDuration) {
    errors.estimatedDurationWeeks = ["Set a valid estimated duration in General information before saving milestones"];
  }
  if (!milestones.length) errors.milestones = ["Add at least one milestone before saving"];
  milestones.forEach((milestone, index) => {
    const path = `milestones[${index}]`;
    if (!milestone.title.trim() || milestone.title.trim().length > 120) {
      errors[`${path}.title`] = ["Milestone name must contain 1 to 120 characters"];
    }
    if (milestone.description.trim().length > 1000) {
      errors[`${path}.description`] = ["Description must not exceed 1000 characters"];
    }
    const dueAfter = milestone.dueAfter.trim();
    if (!/^\d+$/.test(dueAfter) || Number(dueAfter) <= 0 || Number(dueAfter) > 2147483647) {
      errors[`${path}.dueAfter`] = ["Due after must be a positive whole number"];
    } else if (validDuration && (milestone.dueUnit === "DAYS" || milestone.dueUnit === "WEEKS")
      && Number(dueAfter) * (milestone.dueUnit === "WEEKS" ? 7 : 1) > durationWeeks * 7) {
      errors[`${path}.dueAfter`] = [`Due after must not exceed the template duration of ${durationWeeks} weeks (${durationWeeks * 7} days)`];
    }
    if (milestone.dueUnit !== "DAYS" && milestone.dueUnit !== "WEEKS") {
      errors[`${path}.dueUnit`] = ["Select days or weeks"];
    }
    if (weightHundredths(milestone.weight) === null) {
      errors[`${path}.weight`] = ["Weight must be between 0 and 100 with up to 2 decimal places"];
    }
    if (!milestone.checklistItems.length || milestone.checklistItems.length > 100) {
      errors[`${path}.checklistItems`] = ["Provide between 1 and 100 checklist items"];
    }
    milestone.checklistItems.forEach((item, itemIndex) => {
      if (!item.content.trim() || item.content.trim().length > 500) {
        errors[`${path}.checklistItems[${itemIndex}].content`] = ["Checklist item must contain 1 to 500 characters"];
      }
    });
    if (!milestone.rubricVersionId) errors[`${path}.rubricVersionId`] = ["Select a published rubric version"];
    if (milestone.latePolicy?.allowLateSubmission) {
      const days = milestone.latePolicy.maxLateDays.trim();
      if (!/^\d+$/.test(days) || Number(days) <= 0 || Number(days) > 2147483647) {
        errors[`${path}.latePolicy.maxLateDays`] = ["Maximum late days must be a positive whole number"];
      }
      if (weightHundredths(milestone.latePolicy.penaltyPerDayPercent) === null) {
        errors[`${path}.latePolicy.penaltyPerDayPercent`] = ["Daily penalty must be between 0 and 100 with up to 2 decimal places"];
      }
    }
  });
  const total = totalWeightHundredths(milestones);
  if (milestones.length && total !== null && total !== 10000) errors.totalWeight = ["Milestone weights must total 100%"];
  return errors;
}

function toLatePolicyPayload(policy: LatePolicyValues | null): TemplateLatePolicy {
  return {
    allowLateSubmission: policy?.allowLateSubmission ?? false,
    maxLateDays: policy?.allowLateSubmission ? Number(policy.maxLateDays) : null,
    penaltyPerDayPercent: policy?.allowLateSubmission ? Number(policy.penaltyPerDayPercent) : null,
  };
}

export function toMilestonePlanPayload(milestones: MilestoneValues[], lockVersion: number): TemplateMilestonePlanPayload {
  return {
    lockVersion,
    milestones: milestones.map((milestone) => ({
      ...(milestone.id !== undefined ? { id: milestone.id } : {}),
      title: milestone.title.trim(),
      description: milestone.description.trim(),
      dueAfter: Number(milestone.dueAfter),
      dueUnit: milestone.dueUnit,
      weight: Number(milestone.weight),
      mandatory: milestone.mandatory,
      rubricVersionId: milestone.rubricVersionId,
      checklistItems: milestone.checklistItems.map((item) => ({
        ...(item.id !== undefined ? { id: item.id } : {}),
        content: item.content.trim(),
        mandatory: item.mandatory,
      })),
      latePolicy: toLatePolicyPayload(milestone.latePolicy),
    })),
  };
}
