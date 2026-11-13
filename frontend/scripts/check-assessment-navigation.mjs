import assert from "node:assert/strict";
import { assessmentReturnPath } from "../src/utils/assessment-navigation.ts";
assert.equal(assessmentReturnPath("/courses/1#course-assessments"), "/courses/1#course-assessments");
assert.equal(assessmentReturnPath("/course-enrollments/2?tab=grades#course-assessments"), "/course-enrollments/2?tab=grades#course-assessments");
assert.equal(assessmentReturnPath("/exams/curriculum?courseId=3#course-assessments"), "/exams/curriculum?courseId=3#course-assessments");
for (const value of [null,"","https://example.com","//example.com","/\\example.com","/login","javascript:alert(1)","/courses/nope","/courses/0"," /courses/1"]) {
  assert.equal(assessmentReturnPath(value), "/exams", `Unexpected return destination: ${value}`);
}
console.log("Assessment return navigation checks passed.");
