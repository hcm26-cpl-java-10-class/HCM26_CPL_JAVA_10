/** Shared Syllabus General Information degree levels. Keep the AI generator in sync. */
export const SYLLABUS_DEGREE_LEVEL_OPTIONS = [
  "Undergraduate",
  "Postgraduate",
  "Master's",
  "Doctoral",
  "Vocational / Professional",
] as const;

export function isStandardSyllabusDegreeLevel(value: string): boolean {
  return SYLLABUS_DEGREE_LEVEL_OPTIONS.some((option) => option === value);
}
