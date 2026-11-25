import type { CourseLevel } from "@/types";
import type { SyllabusSection } from "@/api/features/demo/syllabus.api";

/** A browser-session preview, NOT a Course stored in the LMS database. */
export type WorkspaceLesson = {
  key: string;
  sourceTopicId: number | null;
  title: string;
  titleCustomized: boolean;
  detached?: boolean;
};
export type WorkspaceSection = {
  key: string;
  sourceSectionId: number | null;
  title: string;
  titleCustomized: boolean;
  detached?: boolean;
  lessons: WorkspaceLesson[];
};
export type WorkspaceCourseDraft = {
  version: 1;
  syllabusId: number;
  name: string;
  nameCustomized: boolean;
  description: string;
  descriptionCustomized: boolean;
  level: CourseLevel;
  levelCustomized: boolean;
  categoryIds: number[];
  categoryCustomized: boolean;
  sections: WorkspaceSection[];
  ignoredSectionIds: number[];
  ignoredTopicIds: number[];
};

const storageKey = (id: number) => `lms:syllabus-course-workspace:v1:${id}`;
export const normalizeTitle = (value: string) => value.trim().replace(/\s+/g, " ");

export function makeWorkspaceDraft(
  syllabusId: number,
  name: string,
  description: string,
  level: CourseLevel,
): WorkspaceCourseDraft {
  return {
    version: 1, syllabusId, name: `${name} - Class 01`.slice(0, 150),
    nameCustomized: false, description: description.slice(0, 500), descriptionCustomized: false,
    level, levelCustomized: false,
    categoryIds: [], categoryCustomized: false, sections: [],
    ignoredSectionIds: [], ignoredTopicIds: [],
  };
}

export function readWorkspaceDraft(id: number): WorkspaceCourseDraft | null {
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    if (!raw || raw.length > 250000) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Partial<WorkspaceCourseDraft>;
    if (p.version !== 1 || p.syllabusId !== id || !Array.isArray(p.sections) ||
      !Array.isArray(p.ignoredSectionIds) || !Array.isArray(p.ignoredTopicIds) ||
      !Array.isArray(p.categoryIds) || typeof p.name !== "string" ||
      typeof p.description !== "string" || !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(p.level ?? "")) return null;
    if (p.sections.length > 100 || p.sections.some((s) => !s || typeof s.key !== "string" || !Array.isArray(s.lessons) || s.lessons.length > 200)) return null;
    return p as WorkspaceCourseDraft;
  } catch { return null; }
}

export function writeWorkspaceDraft(draft: WorkspaceCourseDraft): void {
  try { sessionStorage.setItem(storageKey(draft.syllabusId), JSON.stringify(draft)); }
  catch { /* Storage blocked/full. UI must still work in memory. */ }
}

export function clearWorkspaceDraft(id: number): void {
  try { sessionStorage.removeItem(storageKey(id)); } catch { /* ignore */ }
}

/**
 * Reconcile by stable Syllabus IDs rather than titles. User-customized fields
 * never get overwritten. Rows intentionally removed from Course Preview stay
 * removed (tombstones). Independently-created rows survive source changes.
 */
export function syncWorkspaceDraft(
  previous: WorkspaceCourseDraft,
  source: SyllabusSection[],
): WorkspaceCourseDraft {
  const presentSections = new Set(source.map((s) => s.id));
  const ignoredSections = new Set(previous.ignoredSectionIds);
  const ignoredTopics = new Set(previous.ignoredTopicIds);
  const currentSections = new Map(source.map((s) => [s.id, s]));
  const existing = new Map(previous.sections.filter((s) => s.sourceSectionId != null)
    .map((s) => [s.sourceSectionId, s]));

  const syncLessons = (section: SyllabusSection, old: WorkspaceSection | undefined): WorkspaceLesson[] => {
    const sourceTopics = new Map(section.topics.map((topic) => [topic.id, topic]));
    const previousLessons = old?.lessons ?? [];
    const taken = new Set<number>();
    const result: WorkspaceLesson[] = [];
    for (const lesson of previousLessons) {
      if (lesson.sourceTopicId == null) { result.push(lesson); continue; }
      const topic = sourceTopics.get(lesson.sourceTopicId);
      if (topic && !ignoredTopics.has(topic.id)) {
        taken.add(topic.id);
        result.push({ ...lesson, title: lesson.titleCustomized ? lesson.title : topic.title, detached: false });
      } else if (!topic && lesson.titleCustomized) {
        result.push({ ...lesson, sourceTopicId: null, detached: true });
      }
    }
    for (const topic of section.topics) {
      if (!taken.has(topic.id) && !ignoredTopics.has(topic.id)) {
        result.push({ key: `topic-${topic.id}`, sourceTopicId: topic.id, title: topic.title, titleCustomized: false });
      }
    }
    return result;
  };

  const result: WorkspaceSection[] = [];
  const consumed = new Set<number>();
  for (const old of previous.sections) {
    if (old.sourceSectionId == null) { result.push(old); continue; }
    const section = currentSections.get(old.sourceSectionId);
    if (section && !ignoredSections.has(section.id)) {
      consumed.add(section.id);
      result.push({ ...old, title: old.titleCustomized ? old.title : section.title,
        detached: false, lessons: syncLessons(section, old) });
    } else if (!presentSections.has(old.sourceSectionId) &&
      (old.titleCustomized || old.lessons.some((l) => l.sourceTopicId === null || l.titleCustomized))) {
      result.push({ ...old, sourceSectionId: null, detached: true,
        lessons: old.lessons.map((l) => ({ ...l, sourceTopicId: null, detached: true })) });
    }
  }
  for (const section of source) {
    if (!consumed.has(section.id) && !ignoredSections.has(section.id)) {
      result.push({ key: `section-${section.id}`, sourceSectionId: section.id,
        title: section.title, titleCustomized: false, lessons: syncLessons(section, existing.get(section.id)) });
    }
  }
  return { ...previous, sections: result };
}

export function validateWorkspaceCourse(draft: WorkspaceCourseDraft): string | null {
  const name = normalizeTitle(draft.name);
  if (!name || name.length > 150) return "Course name must have 1–150 characters.";
  if (draft.description.length > 500) return "Course description must not exceed 500 characters.";
  if (draft.sections.length === 0) return "Add at least one Course Section.";
  if (draft.sections.length > 100) return "Course cannot contain more than 100 Sections.";
  const sectionNames = new Set<string>();
  let lessons = 0;
  for (const section of draft.sections) {
    const title = normalizeTitle(section.title);
    if (title.length < 3 || title.length > 150 || !/\p{L}/u.test(title)) return "Section titles must contain letters (3–150 characters).";
    if (sectionNames.has(title.toLocaleLowerCase("vi"))) return `Duplicate Course Section: ${title}`;
    sectionNames.add(title.toLocaleLowerCase("vi"));
    if (!section.lessons.length) return `Add at least one Lesson to “${title}”.`;
    if (section.lessons.length > 200) return `Too many Lessons in “${title}”.`;
    lessons += section.lessons.length;
    for (const lesson of section.lessons) {
      if (!normalizeTitle(lesson.title) || normalizeTitle(lesson.title).length > 200) return `Lesson titles must have 1–200 characters in “${title}”.`;
    }
  }
  if (lessons > 1000) return "Course cannot contain more than 1000 Lessons.";
  return null;
}
