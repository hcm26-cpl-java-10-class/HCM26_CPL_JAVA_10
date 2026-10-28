import { parseRole } from "./assignment-text.ts";
import { validateAssignmentDates } from "./assignment-form.ts";
import { validateNewClass, type NewClassForm } from "./new-class-form.ts";
import { validateTrainerProfile } from "./new-trainer-form.ts";

export interface CreationAssignmentForm {
  subject: string; subjectDurationHours: string; role: string; effectiveFrom: string; effectiveTo: string;
}

export interface CreationErrors {
  classDetails: Partial<Record<keyof NewClassForm, string>>;
  trainer: { name?: string; email?: string };
  assignment: Partial<Record<keyof CreationAssignmentForm, string>>;
}

export function validateAssignmentCreation(classForm: NewClassForm, trainer: { name: string; email: string },
  assignment: CreationAssignmentForm): CreationErrors {
  const errors: CreationErrors = {
    classDetails: validateNewClass({ ...classForm, programVersion: "1.0", subjectIds: [] }, [], true),
    trainer: validateTrainerProfile(trainer.name, trainer.email),
    assignment: validateAssignmentDates(assignment, { startDate: classForm.startDate || undefined, endDate: classForm.endDate || undefined }),
  };
  if (!assignment.subject.trim() || assignment.subject.length > 200) errors.assignment.subject = "Enter a subject name (up to 200 characters).";
  const hours = Number(assignment.subjectDurationHours);
  if (!/^\d+$/.test(assignment.subjectDurationHours) || hours < 1 || hours > 2147483647) errors.assignment.subjectDurationHours = "Enter a positive whole number of hours.";
  if (!parseRole(assignment.role)) errors.assignment.role = "Select Main or Assistant.";
  return errors;
}

export function hasCreationErrors(errors: CreationErrors) {
  return Object.values(errors).some(fields => Object.keys(fields).length > 0);
}
