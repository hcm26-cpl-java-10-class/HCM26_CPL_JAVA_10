import type { CourseSyllabusPreview } from "@/api/features/demo/course.api";

/** Full = whole published outline; Focused = only the selected, active source Topics. */
export type CourseScopeMode = "FULL" | "FOCUSED";
export type ScopedDraftSection = {
  key: string;
  title: string;
  lessons: { key: string; title: string }[];
};

export const allSourceTopicIds = (source: CourseSyllabusPreview): number[] =>
  source.sections.flatMap((section) => section.topics.map((topic) => topic.id));

export function scopeSignature(mode: CourseScopeMode, selectedTopicIds: readonly number[]): string {
  if (mode === "FULL") return "FULL";
  return `FOCUSED:${[...new Set(selectedTopicIds)].sort((a, b) => a - b).join(",")}`;
}

/**
 * Creates a detached, editable snapshot. No DB writes, no changes to the Syllabus.
 * Sections without selected Topics are excluded, because Course requires >= 1 Lesson per Section.
 */
export function buildCourseOutline(
  source: CourseSyllabusPreview,
  mode: CourseScopeMode,
  selectedTopicIds: readonly number[],
): ScopedDraftSection[] {
  const included = new Set(selectedTopicIds);
  return source.sections.flatMap((section) => {
    const topics = mode === "FULL"
      ? section.topics
      : section.topics.filter((topic) => included.has(topic.id));
    if (!topics.length) return [];
    return [{
      key: `source-section-${section.id}`,
      title: section.title,
      lessons: topics.map((topic) => ({ key: `source-topic-${topic.id}`, title: topic.title })),
    }];
  });
}

/** Course titles describe the learning focus, NOT a Class/cohort. Advisory only. */
export function suggestFocusedCourseTitle(
  source: CourseSyllabusPreview,
  selectedTopicIds: readonly number[],
): string | null {
  const included = new Set(selectedTopicIds);
  const usedSections = source.sections.filter((s) => s.topics.some((t) => included.has(t.id)));
  if (usedSections.length !== 1) return null;
  const section = usedSections[0];
  const usedTopics = section.topics.filter((topic) => included.has(topic.id));
  const focus = usedTopics.length === 1 ? usedTopics[0].title : section.title;
  const suffix = " - Course";
  return focus.trim().slice(0, 150 - suffix.length).trimEnd() + suffix;
}
