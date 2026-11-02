import { isISODate } from "./assignment-form.ts";

export interface NewClassForm {
  name: string; programName: string; programVersion: string; subjectIds: number[];
  startDate: string; endDate: string; plannedSize: string;
}

/** Calendar tomorrow in Vietnam, independent of the browser's timezone. */
export function minimumClassStartDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find(item => item.type === type)!.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day") + 1)).toISOString().slice(0, 10);
}

export function validateNewClass(form: NewClassForm, subjectIds: number[], allowEmptySubjects = false, now = new Date()) {
  const errors: Partial<Record<keyof NewClassForm, string>> = {};
  if (!form.name.trim() || form.name.length > 200) errors.name = "Enter a class name (up to 200 characters).";
  if (!form.programName.trim() || form.programName.length > 200) errors.programName = "Enter a program name (up to 200 characters).";
  if (!form.programVersion.trim() || form.programVersion.length > 30) errors.programVersion = "Enter a program version (up to 30 characters).";
  if ((!form.subjectIds.length && !allowEmptySubjects) || form.subjectIds.length > 200 || new Set(form.subjectIds).size !== form.subjectIds.length
    || form.subjectIds.some(id => !subjectIds.includes(id))) errors.subjectIds = "Add 1 to 200 active subjects to the program.";
  if (!isISODate(form.startDate)) errors.startDate = "Enter a valid class start date.";
  else if (form.startDate < minimumClassStartDate(now)) errors.startDate = "Class start date must be tomorrow or later (Vietnam time).";
  if (!isISODate(form.endDate)) errors.endDate = "Enter a valid class end date.";
  if (isISODate(form.startDate) && isISODate(form.endDate) && form.endDate < form.startDate) errors.endDate = "Class end date must be on or after the start date.";
  const size = Number(form.plannedSize);
  if (!/^\d+$/.test(form.plannedSize) || size < 1 || size > 10000) errors.plannedSize = "Enter a whole number from 1 to 10000.";
  return errors;
}
