import type { AssignmentEndRequest, AssignmentImpact, AssignmentLifecycleContext, TeachingAssignment } from "@/api/features/class-setup.api";
import { isISODate } from "./assignment-form.ts";

export function validateEndDate(value: string, assignment: Pick<TeachingAssignment, "effectiveFrom" | "effectiveTo">): string | undefined {
  if (!isISODate(value)) return "Enter a valid end date.";
  if (value < assignment.effectiveFrom) return "The end date must be on or after the assignment start date.";
  if (assignment.effectiveTo && value > assignment.effectiveTo) return "Ending an assignment cannot extend its current effective period.";
  return undefined;
}

export function initialEndDate(assignment: Pick<TeachingAssignment, "effectiveFrom" | "effectiveTo">, today: string): string {
  const date = today < assignment.effectiveFrom ? assignment.effectiveFrom : today;
  return assignment.effectiveTo && date > assignment.effectiveTo ? assignment.effectiveTo : date;
}

export function endKey(request: AssignmentEndRequest): string {
  return JSON.stringify([request.effectiveTo, request.revision]);
}

export function canEndAssignment(current: AssignmentEndRequest, previewed: AssignmentEndRequest | null, impact: AssignmentImpact | undefined): boolean {
  return Boolean(previewed && impact?.canSave && current.revision === impact.revision
    && current.effectiveTo === impact.effectiveTo && endKey(current) === endKey(previewed));
}

export function canDeleteUnusedAssignment(context: AssignmentLifecycleContext): boolean {
  return context.canDelete && !context.previouslyUsed && context.linkedSessionCount === 0 && Number.isSafeInteger(context.assignment.revision) && context.assignment.revision >= 0;
}
