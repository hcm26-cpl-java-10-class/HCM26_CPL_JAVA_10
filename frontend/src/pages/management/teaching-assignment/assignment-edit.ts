import type { AssignmentEditContext, AssignmentImpact, TeachingAssignmentUpdateRequest } from "@/api/features/class-setup.api";
import { validateAssignmentForm, type AssignmentForm } from "./assignment-form.ts";

export function validateAssignmentEdit(form: AssignmentForm, context: AssignmentEditContext) {
  return validateAssignmentForm(form, {
    classProfile: context.classProfile, subjects: [{ programSubjectId: context.assignment.programSubjectId }],
  }, [context.assignment.classId], context.trainers.map((trainer) => trainer.id));
}

export function updateKey(request: TeachingAssignmentUpdateRequest): string {
  return JSON.stringify([request.classId, request.programSubjectId, request.trainerId, request.role,
    request.effectiveFrom, request.effectiveTo || null, request.revision,
    request.teachingSlots?.map(slot => [slot.date, slot.startTime, slot.endTime]) ?? null]);
}

export function canSaveAssignmentEdit(current: TeachingAssignmentUpdateRequest,
  previewed: TeachingAssignmentUpdateRequest | null, impact: AssignmentImpact | undefined): boolean {
  return Boolean(previewed && impact?.canSave && impact.revision === current.revision && updateKey(current) === updateKey(previewed));
}
