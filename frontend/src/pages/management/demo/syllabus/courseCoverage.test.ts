import { describe, expect, it } from "vitest";
import { compareCourseToSyllabus } from "./courseCoverage";
import { lessonContentIssue, lessonDraftSaveIssue } from "./courseLessonContent";
import type { CourseSyllabusPreview } from "@/api/features/demo/course.api";
const syllabus: CourseSyllabusPreview = { syllabusId: 8, syllabusCode: "DB", syllabusName: "Database", syllabusDescription: "",
  sections: [{ id: 1, title: "Basics", mission: "", topics: [{ id: 101, title: "SQL" }, { id: 102, title: "Keys" }] }] };
const material = "A clear explanation with a detailed practical example, instructions and self-check answers for learners.";
describe("Course ↔ Syllabus comparison", () => {
  it("detects uncovered Topics and missing Materials", () => {
    const result = compareCourseToSyllabus(syllabus, [101, 102], [{ title: "Expanded", lessons: [{title: "New SQL", sourceTopicId: 101, material}] }]);
    expect(result.coveredCount).toBe(1);
    expect(result.isComplete).toBe(false);
    expect(result.rows[1].covered).toBe(false);
  });
  it("allows extra Lessons but requires material for each Lesson", () => {
    const result = compareCourseToSyllabus(syllabus, [101, 102], [{ title: "Expanded", lessons: [
      {title: "SQL", sourceTopicId: 101, material}, {title: "Keys", sourceTopicId: 102, material},
      {title: "Exercise", sourceTopicId: null, material},
    ] }]);
    expect(result.isComplete).toBe(true);
    expect(result.extra).toHaveLength(1);
  });
  it("requires media URLs without losing Lesson teaching content", () => {
    const result = compareCourseToSyllabus(syllabus, [101, 102], [{ title: "Media", lessons: [
      { title: "Audio lesson", sourceTopicId: 101, contentType: "AUDIO", contentUrl: "", material },
      { title: "Video lesson", sourceTopicId: 102, contentType: "VIDEO", contentUrl: "https://example.org/intro.mp4", material },
    ] }]);
    expect(result.missingMaterials).toHaveLength(1);
    expect(result.missingMaterials[0].lesson).toBe("Audio lesson");
    expect(result.isComplete).toBe(false);
  });
  it("recognizes Text, URL-only resources and assessment headings", () => {
    const types = ["TEXT", "VIDEO", "AUDIO", "DOCUMENT", "LINK", "QUIZ", "EXAM", "ASSIGNMENT"] as const;
    const urls = ["", "https://example.com/video.mp4", "https://example.com/audio.mp3", "https://example.com/book.pdf", "https://example.com/guide", "", "", ""];
    const result = compareCourseToSyllabus(syllabus, [101, 102], [{ title: "Expanded", lessons: types.map((contentType, index) => ({
      title: `Lesson ${index}`, sourceTopicId: index < 2 ? [101, 102][index] : null, contentType, contentUrl: urls[index], material: index === 0 ? material : "",
    })) }]);
    expect(result.missingMaterials).toHaveLength(0);
    expect(result.isComplete).toBe(true);
    expect(result.extra).toHaveLength(6);
  });
});

describe("Draft Lesson validation by native type", () => {
  it("accepts assessment headings with no material and no URL", () => {
    for (const contentType of ["QUIZ", "EXAM", "ASSIGNMENT"] as const) {
      expect(lessonContentIssue({ contentType })).toBeNull();
      expect(lessonContentIssue({ contentType, duration: -1 })).not.toBeNull();
    }
  });
  it("requires real Text content and syntactically valid media URLs", () => {
    expect(lessonContentIssue({ contentType: "TEXT", material: "short" })).not.toBeNull();
    expect(lessonContentIssue({ contentType: "TEXT", material })).toBeNull();
    for (const contentType of ["VIDEO", "AUDIO", "DOCUMENT", "LINK"] as const) {
      expect(lessonContentIssue({ contentType, contentUrl: "https://example.org/resource" })).toBeNull();
      expect(lessonContentIssue({ contentType, contentUrl: "" })).not.toBeNull();
      expect(lessonContentIssue({ contentType, contentUrl: "javascript:alert(1)" })).not.toBeNull();
      expect(lessonContentIssue({ contentType, contentUrl: "https://example.org/a b" })).not.toBeNull();
    }
  });
});


it("rejects invalid duration and exposes unconfigured assessment in preview", () => {
  expect(lessonContentIssue({ contentType: "LINK", contentUrl: "https://example.org", duration: -9 })).not.toBeNull();
  expect(lessonContentIssue({ contentType: "LINK", contentUrl: "https://example.org", duration: 2147483648 })).not.toBeNull();
  expect(lessonContentIssue({ contentType: "QUIZ", assessmentIssue: "Configure this assessment" })).toBe("Configure this assessment");
});

 it("shows mapped practice as additional content without losing Topic coverage", () => {
  const result = compareCourseToSyllabus(syllabus, [101], [
    { title: "SQL workshop", lessons: [{ title: "Practice SQL", sourceTopicId: 101, material }] },
    { title: "Basics", lessons: [{ title: "SQL", sourceTopicId: 101, material }] },
  ]);
  expect(result.isComplete).toBe(true);
  expect(result.rows[0].lessons).toHaveLength(2);
  expect(result.extra).toEqual([{ section: "SQL workshop", lesson: "Practice SQL" }]);
  expect(result.extraSections).toEqual(["SQL workshop"]);
});

it("only planned media headings bypass missing URL on Draft save, not invalid URL or duration", () => {
  expect(lessonDraftSaveIssue({ contentType: "VIDEO", planned: true, duration: 480 })).toBeNull();
  expect(lessonContentIssue({ contentType: "VIDEO", planned: true, duration: 480 })).not.toBeNull();
  expect(lessonDraftSaveIssue({ contentType: "VIDEO", planned: true, duration: -1 })).not.toBeNull();
  expect(lessonDraftSaveIssue({ contentType: "VIDEO", planned: true, contentUrl: "javascript:alert(1)" })).not.toBeNull();
  expect(lessonDraftSaveIssue({ contentType: "VIDEO" })).not.toBeNull();
  expect(lessonDraftSaveIssue({ contentType: "TEXT", planned: true })).not.toBeNull();
});
