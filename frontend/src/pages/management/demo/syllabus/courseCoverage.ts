import { lessonContentIssue } from "./courseLessonContent";
import type { CourseSyllabusPreview } from "@/api/features/demo/course.api";

export type CoverageLesson = { title: string; sourceTopicId?: number | null; material?: string; contentType?: import("@/types/features/demo/lesson").LessonContentType; contentUrl?: string; duration?: number };
export type CoverageSection = { title: string; lessons: CoverageLesson[] };
export type TopicCoverageRow = { topicId: number; topic: string; section: string; lessons: string[]; covered: boolean };

/** Coverage is ID-based and recomputed from the CURRENT editable preview. */
export function compareCourseToSyllabus(source: CourseSyllabusPreview, selectedIds: readonly number[],
                                        draft: readonly CoverageSection[]) {
  const required = new Set(selectedIds);
  const rows: TopicCoverageRow[] = source.sections.flatMap(section => section.topics
    .filter(topic => required.has(topic.id))
    .map(topic => {
      const linked = draft.flatMap(courseSection => courseSection.lessons
        .filter(lesson => lesson.sourceTopicId === topic.id).map(lesson => lesson.title));
      return { topicId: topic.id, topic: topic.title, section: section.title,
        lessons: linked, covered: linked.length > 0 };
    }));
  // A source Topic may map to many Lessons. Prefer its original title as the
  // primary Lesson; every other linked Lesson is additional Course content.
  const normalize = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();
  const topics = new Map(source.sections.flatMap(section => section.topics.map(topic => [topic.id, topic.title] as const)));
  const primary = new Map<number, CoverageLesson>();
  for (const section of draft) for (const lesson of section.lessons) {
    const id = lesson.sourceTopicId;
    if (id == null || !required.has(id)) continue;
    const previous = primary.get(id);
    if (!previous || (normalize(previous.title) !== normalize(topics.get(id) ?? "")
        && normalize(lesson.title) === normalize(topics.get(id) ?? ""))) primary.set(id, lesson);
  }
  const extra = draft.flatMap(section => section.lessons
    .filter(lesson => lesson.sourceTopicId == null || (required.has(lesson.sourceTopicId) && primary.get(lesson.sourceTopicId) !== lesson))
    .map(lesson => ({ section: section.title, lesson: lesson.title })));
  const sourceSectionTitles = new Set(source.sections.filter(section => section.topics.some(topic => required.has(topic.id))).map(section => normalize(section.title)));
  const extraSections = draft.filter(section => !sourceSectionTitles.has(normalize(section.title))).map(section => section.title);
  const missingMaterials = draft.flatMap(section => section.lessons
    .filter(lesson => lessonContentIssue(lesson) !== null)
    .map(lesson => ({ section: section.title, lesson: lesson.title })));
  return { rows, extra, extraSections, missingMaterials, coveredCount: rows.filter(row => row.covered).length,
    requiredCount: rows.length, isComplete: rows.length > 0 && rows.every(row => row.covered) && missingMaterials.length === 0 };
}
