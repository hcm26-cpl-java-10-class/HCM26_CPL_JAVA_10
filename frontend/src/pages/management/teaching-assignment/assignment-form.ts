import type { AssignmentClassContext } from "@/api/features/class-setup.api";
import { parseRole } from "./assignment-text.ts";

export interface AssignmentForm {
  classId: string;
  programSubjectId: string;
  trainerId: string;
  role: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export type AssignmentErrors = Partial<Record<keyof AssignmentForm, string>>;

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateAssignmentForm(
  form: AssignmentForm,
  context: (Pick<AssignmentClassContext, "classProfile"> & { subjects: { programSubjectId: number }[] }) | undefined,
  classIds: number[],
  trainerIds: number[],
): AssignmentErrors {
  const errors: AssignmentErrors = {};
  if (!form.classId || !classIds.includes(Number(form.classId))) errors.classId = "Create the class before completing its assignment.";
  if (!context || context.classProfile.id !== Number(form.classId)) {
    errors.programSubjectId = "Load the subjects for the selected class first.";
  } else if (!context.subjects.some((subject) => subject.programSubjectId === Number(form.programSubjectId))) {
    errors.programSubjectId = "Enter an active subject from this class.";
  }
  if (!form.trainerId || !trainerIds.includes(Number(form.trainerId))) errors.trainerId = "Enter an active trainer name or email.";
  if (!parseRole(form.role)) errors.role = "Select Main or Assistant.";
  return { ...errors, ...validateAssignmentDates(form, context?.classProfile) };
}

export function validateAssignmentDates(form: Pick<AssignmentForm, "effectiveFrom" | "effectiveTo">,
  bounds?: { startDate?: string | null; endDate?: string | null }): AssignmentErrors {
  const errors: AssignmentErrors = {};
  const validStart = isISODate(form.effectiveFrom);
  if (!validStart) errors.effectiveFrom = "Enter a valid start date.";
  if (form.effectiveTo && !isISODate(form.effectiveTo)) errors.effectiveTo = "Enter a valid end date.";
  if (validStart && form.effectiveTo && isISODate(form.effectiveTo) && form.effectiveTo < form.effectiveFrom) {
    errors.effectiveTo = "The end date must be on or after the start date.";
  }
  const { startDate, endDate } = bounds ?? {};
  if (validStart && ((startDate && form.effectiveFrom < startDate) || (endDate && form.effectiveFrom > endDate))) {
    errors.effectiveFrom = "The start date must be within the class dates.";
  }
  if (endDate && form.effectiveTo && isISODate(form.effectiveTo) && form.effectiveTo > endDate) {
    errors.effectiveTo = "The end date must not be after the class end date.";
  }
  return errors;
}
