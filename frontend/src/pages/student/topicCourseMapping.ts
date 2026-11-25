import type { CourseDetail } from "@/types";
import type { StudentRelatedCourse } from "@/api/features/demo/student-syllabus.api";

/**
 * Syllabus topics are academic outline nodes, not lesson/material records.
 * Prefer stable sourceTopicId mapping for new Courses. For legacy Courses only,
 * fall back to matching BOTH
 * its Syllabus Section ↔ Course Section AND Topic ↔ Lesson names match.
 * Never infer that all topics in a Syllabus are covered by a linked Course.
 * Return ONLY verified matches; all other topics show Online.
 */
export function normalizeLearningTitle(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .replace(/^\s*(?:(?:topic|lesson|bai)\s*)?\d+\s*[:.)\-–]\s*/, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export type TopicCourseReference = {
    courseId: number;
    courseName: string;
    lessonId: number | null;
    lessonTitle: string | null;
};

export function resolveTopicCourseReferences(
    topicTitle: string,
    sectionTitle: string,
    courses: StudentRelatedCourse[],
    outlines: CourseDetail[],
    topicId?: number,
): TopicCourseReference[] {
    const normalizedTopic = normalizeLearningTitle(topicTitle);
    const normalizedSection = normalizeLearningTitle(sectionTitle);
    const byId = new Map(outlines.map((detail) => [detail.id, detail]));

    if (!normalizedTopic || !normalizedSection) return [];

    return courses.flatMap((course): TopicCourseReference[] => {
        const outline = byId.get(course.id);
        // Course-from-Syllabus preserves selected Section and Topic titles.
        // Enforce BOTH titles to avoid linking a topic from an unselected Section,
        // including when a same-named Lesson exists elsewhere in the Course.
        const allLessons = (outline?.sections ?? []).flatMap((section) => section.lessons);
        const idMappingsExist = allLessons.some((lesson) => lesson.sourceTopicId != null);
        const matches = idMappingsExist
            ? (topicId == null ? [] : allLessons.filter((lesson) => lesson.sourceTopicId === topicId))
            : (outline?.sections ?? [])
                .filter((section) => normalizeLearningTitle(section.title) === normalizedSection)
                .flatMap((section) => section.lessons.filter((lesson) =>
                    normalizeLearningTitle(lesson.title) === normalizedTopic));
        // ID mapping can intentionally point to several Lessons for one Topic.
        // Legacy title-only matches remain ambiguous unless exactly one exists.
        if (!matches.length || (!idMappingsExist && matches.length !== 1)) return [];
        return matches.map((lesson) => ({
            courseId: course.id,
            courseName: course.name,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
        }));
    });
}
