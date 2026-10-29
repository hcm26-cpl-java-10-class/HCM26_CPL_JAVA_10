import { parseRole } from "./assignment-text.ts";
import { validateNewClass, type NewClassForm } from "./new-class-form.ts";
import { validateTrainerProfile } from "./new-trainer-form.ts";
import { validateTeachingSlots, type SlotErrors } from "./assignment-slots.ts";
import type { AssignmentTeachingSlot } from "@/api/features/class-setup.api";

export interface CreationAssignmentForm {
  subject: string; role: string; teachingSlots: AssignmentTeachingSlot[];
}

export interface CreationErrors {
  classDetails: Partial<Record<keyof NewClassForm, string>>;
  trainer: { name?: string; email?: string };
  assignment: Partial<Record<keyof CreationAssignmentForm, string>>;
  slots: SlotErrors;
}

export function validateAssignmentCreation(classForm: NewClassForm, trainer: { name: string; email: string },
  assignment: CreationAssignmentForm): CreationErrors {
  const errors: CreationErrors = {
    classDetails: validateNewClass({ ...classForm, programVersion: "1.0", subjectIds: [] }, [], true),
    trainer: validateTrainerProfile(trainer.name, trainer.email),
    assignment: {},
    slots: validateTeachingSlots(assignment.teachingSlots, classForm.startDate, classForm.endDate),
  };
  if (!assignment.subject.trim() || assignment.subject.length > 200) errors.assignment.subject = "Enter a subject name (up to 200 characters).";
  if (!parseRole(assignment.role)) errors.assignment.role = "Select Main or Assistant.";
  return errors;
}

export function hasCreationErrors(errors: CreationErrors) {
  return Object.values(errors).some(fields => Object.keys(fields).length > 0);
}
