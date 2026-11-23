import type { CourseDetail } from "@/types";
import type { StudentRelatedCourse } from "@/api/features/demo/student-syllabus.api";

/**
 * Syllabus topics are academic outline nodes, not lesson/material records.
 * Without a persisted Topic ↔ Lesson relation, a link is safe ONLY when BOTH
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
        const matches = (outline?.sections ?? [])
            .filter((section) => normalizeLearningTitle(section.title) === normalizedSection)
            .flatMap((section) => section.lessons.filter((lesson) =>
                normalizeLearningTitle(lesson.title) === normalizedTopic));
        if (matches.length !== 1) return []; // Missing/ambiguous => Online, never View course.
        return [{
            courseId: course.id,
            courseName: course.name,
            lessonId: matches[0].id,
            lessonTitle: matches[0].title,
        }];
    });
}
