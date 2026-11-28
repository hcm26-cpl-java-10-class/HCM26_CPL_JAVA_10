import { describe, expect, it } from "vitest";
import type { CourseDetail } from "@/types";
import { normalizeLearningTitle, resolveTopicCourseReferences } from "./topicCourseMapping";

const course = (
    id: number,
    sections: Array<{ id: number; title: string; lessons: Array<{ id: number; title: string }> }>,
): CourseDetail => ({
    id,
    name: `Course ${id}`,
    isFree: true,
    enrolled: false,
    contentUnlocked: false,
    lessonCount: 0,
    totalDuration: 0,
    sections: sections.map((section) => ({
        ...section,
        lessons: section.lessons.map((lesson) => ({ ...lesson, contentType: "TEXT", locked: true })),
    })),
});
const linked = [{ id: 4, name: "Course 4" }];

describe("student Syllabus topic ↔ Course links (partial Course scope)", () => {
    it("normalizes numbered topic and lesson titles", () => {
        expect(normalizeLearningTitle("1. Entities and Relationships"))
            .toBe(normalizeLearningTitle("Lesson 1: Entities and Relationships"));
    });

    it("shows a link only for an exact Section + Topic match", () => {
        const outline = course(4, [{ id: 10, title: "Section One", lessons: [
            { id: 100, title: "Unrelated" },
            { id: 101, title: "Entities and Relationships" },
        ] }]);
        expect(resolveTopicCourseReferences("Entities and Relationships", "Section One", linked, [outline]))
            .toEqual([{ courseId: 4, courseName: "Course 4", lessonId: 101, lessonTitle: "Entities and Relationships" }]);
    });

    it("does not link omitted Topics within an otherwise selected Section", () => {
        const outline = course(4, [{ id: 10, title: "Section One", lessons: [
            { id: 101, title: "Topic A" },
        ] }]);
        expect(resolveTopicCourseReferences("Topic B", "Section One", linked, [outline])).toEqual([]);
    });

    it("does not link unselected Sections, even when another Section has a same-named Lesson", () => {
        const outline = course(4, [{ id: 10, title: "Section One", lessons: [
            { id: 101, title: "Topic A" },
        ] }]);
        expect(resolveTopicCourseReferences("Topic A", "Section Two", linked, [outline])).toEqual([]);
    });

    it("never guesses a lesson from vague keyword overlap or returns View course fallback", () => {
        const outline = course(4, [{ id: 10, title: "Relational Modeling", lessons: [
            { id: 100, title: "Tables, keys and relationships" },
        ] }]);
        expect(resolveTopicCourseReferences("Entities and Relationships", "Relational Modeling", linked, [outline]))
            .toEqual([]);
    });

    it("does not choose among duplicate matching Lessons in the same Section", () => {
        const outline = course(4, [{ id: 11, title: "Advanced", lessons: [
            { id: 101, title: "Joins" }, { id: 102, title: "Joins" },
        ] }]);
        expect(resolveTopicCourseReferences("Joins", "Advanced", linked, [outline])).toEqual([]);
    });

    it("uses the matching Section when different Sections repeat a Topic title", () => {
        const outline = course(4, [
            { id: 10, title: "Introduction", lessons: [{ id: 100, title: "Joins" }] },
            { id: 11, title: "Advanced", lessons: [{ id: 101, title: "Joins" }] },
        ]);
        expect(resolveTopicCourseReferences("Joins", "Advanced", linked, [outline])[0].lessonId).toBe(101);
        expect(resolveTopicCourseReferences("Joins", "Other Section", linked, [outline])).toEqual([]);
    });

    it("returns Online (no verified links) when the Course outline cannot be loaded", () => {
        expect(resolveTopicCourseReferences("SQL", "Database", linked, [])).toEqual([]);
    });

    it("shows only Courses that implement the requested Topic", () => {
        const other = { id: 5, name: "Course 5" };
        const outlines = [
            course(4, [{ id: 10, title: "Section One", lessons: [{ id: 100, title: "Topic A" }] }]),
            course(5, [{ id: 11, title: "Section Two", lessons: [{ id: 101, title: "Topic A" }] }]),
        ];
        const references = resolveTopicCourseReferences("Topic A", "Section One", [...linked, other], outlines);
        expect(references.map((r) => r.courseId)).toEqual([4]);
    });
});

it("uses stable Topic ID even when Gemini renamed the Lesson", () => {
    const course = { id: 1, name: "AI Database Course" };
    const outline = {
        id: 1,
        name: "AI Database Course",
        sections: [{ id: 7, title: "Completely renamed Section", lessons: [
            { id: 501, title: "Understanding Relational Entities", sourceTopicId: 101 },
        ] }],
    } as unknown as import("@/types").CourseDetail;
    const matches = resolveTopicCourseReferences("Entities and Relationships", "Relational Modelling",
        [course], [outline], 101);
    expect(matches).toHaveLength(1);
    expect(matches[0].lessonId).toBe(501);
    expect(resolveTopicCourseReferences("Other Topic", "Relational Modelling", [course], [outline], 999)).toEqual([]);
});


describe("AI expanded lessons", () => {
    it("returns every Lesson linked by the same source Topic ID", () => {
        const outline = {
            id: 4, name: "Expanded SQL",
            sections: [{ id: 2, title: "Expanded Topics", lessons: [
                { id: 21, title: "Join Concepts", sourceTopicId: 101 },
                { id: 22, title: "Join Exercises", sourceTopicId: 101 },
                { id: 23, title: "Introduction", sourceTopicId: null },
            ] }],
        } as unknown as CourseDetail;
        const result = resolveTopicCourseReferences("Joins", "Anything", linked, [outline], 101);
        expect(result.map((r) => r.lessonId)).toEqual([21, 22]);
    });
});
