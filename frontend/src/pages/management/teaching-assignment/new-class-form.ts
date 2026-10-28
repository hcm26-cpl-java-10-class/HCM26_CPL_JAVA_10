import { isISODate } from "./assignment-form.ts";

export interface NewClassForm {
  name: string; programName: string; programVersion: string; subjectIds: number[];
  startDate: string; endDate: string; plannedSize: string;
}

export function validateNewClass(form: NewClassForm, subjectIds: number[], allowEmptySubjects = false) {
  const errors: Partial<Record<keyof NewClassForm, string>> = {};
  if (!form.name.trim() || form.name.length > 200) errors.name = "Enter a class name (up to 200 characters).";
  if (!form.programName.trim() || form.programName.length > 200) errors.programName = "Enter a program name (up to 200 characters).";
  if (!form.programVersion.trim() || form.programVersion.length > 30) errors.programVersion = "Enter a program version (up to 30 characters).";
  if ((!form.subjectIds.length && !allowEmptySubjects) || form.subjectIds.length > 200 || new Set(form.subjectIds).size !== form.subjectIds.length
    || form.subjectIds.some(id => !subjectIds.includes(id))) errors.subjectIds = "Add 1 to 200 active subjects to the program.";
  if (!isISODate(form.startDate)) errors.startDate = "Enter a valid class start date.";
  if (!isISODate(form.endDate)) errors.endDate = "Enter a valid class end date.";
  if (isISODate(form.startDate) && isISODate(form.endDate) && form.endDate < form.startDate) errors.endDate = "Class end date must be on or after the start date.";
  const size = Number(form.plannedSize);
  if (!/^\d+$/.test(form.plannedSize) || size < 1 || size > 10000) errors.plannedSize = "Enter a whole number from 1 to 10000.";
  return errors;
}
