import type { CourseExam, LessonProgressItem } from "@/types";

export type LearningItem = { lesson: LessonProgressItem } | { exam: CourseExam };

/** Mirrors the sidebar: lessons and their assessments, section assessments, final exams. */
export function learningCurriculum(lessons: LessonProgressItem[], exams: CourseExam[]): LearningItem[] {
  const sections = new Map<number, LessonProgressItem[]>();
  for (const lesson of lessons) {
    const group = sections.get(lesson.sectionId) ?? [];
    group.push(lesson); sections.set(lesson.sectionId, group);
  }
  const items: LearningItem[] = [];
  for (const [sectionId, group] of sections) {
    for (const lesson of group) {
      const linked = exams.filter(e => e.lessonId === lesson.lessonId);
      // An assessment lesson already displays its first assessment; don't visit it twice.
      if (!linked.length || !["QUIZ", "EXAM", "ASSIGNMENT"].includes(lesson.contentType)) items.push({ lesson });
      items.push(...linked.map(exam => ({ exam })));
    }
    items.push(...exams.filter(e => e.sectionId === sectionId && e.lessonId == null).map(exam => ({ exam })));
  }
  items.push(...exams.filter(e => e.sectionId == null && e.lessonId == null && e.category === "FINAL_TEST").map(exam => ({ exam })));
  return items;
}
