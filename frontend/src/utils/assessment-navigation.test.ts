import { describe, expect, it } from "vitest";
import { assessmentCourseReturnPath, assessmentReturnPath } from "./assessment-navigation";
describe("management course return destinations", () => {
  it("retains course queries and anchors and resolves direct entry", () => {
    expect(assessmentCourseReturnPath("/courses/7?tab=details#course-assessments", 7)).toBe("/courses/7?tab=details#course-assessments");
    expect(assessmentCourseReturnPath(null, 7)).toBe("/courses/7#course-assessments");
    expect(assessmentCourseReturnPath(null, null)).toBe("/exams");
    expect(assessmentCourseReturnPath("/exams/curriculum?courseId=7", 7)).toBe("/exams/curriculum?courseId=7");
  });
  it.each(["https://evil.test/courses/7", "//evil.test/courses/7", "/\\evil.test/courses/7", "javascript:alert(1)", " /courses/7", "/courses/7/../../admin", "/courses/0", "/exams/7"]) ("rejects unsafe context %s", value => {
    expect(assessmentReturnPath(value)).toBe("/exams");
    expect(assessmentCourseReturnPath(value, 7)).toBe("/courses/7#course-assessments");
  });
});
