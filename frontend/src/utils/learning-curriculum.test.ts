import { it, expect } from "vitest";
import { learningCurriculum } from "./learning-curriculum";
import { courseMappingReturnPath } from "./assessment-navigation";
import type { CourseExam, LessonProgressItem } from "@/types";
it("orders lesson quizzes, section exams and finals without duplicating assessment lessons",()=>{
 const lessons=[{lessonId:1,sectionId:1,contentType:"VIDEO"},{lessonId:2,sectionId:1,contentType:"QUIZ"},{lessonId:3,sectionId:2,contentType:"VIDEO"}] as LessonProgressItem[];
 const exams=[{id:10,lessonId:1,sectionId:1},{id:11,lessonId:2,sectionId:1},{id:12,sectionId:1},{id:13,sectionId:2},{id:14,category:"FINAL_TEST"}] as unknown as CourseExam[];
 expect(learningCurriculum(lessons,exams).map(item=>"exam" in item ? `exam:${item.exam.id}` : `lesson:${item.lesson.lessonId}`)).toEqual(["lesson:1","exam:10","exam:11","exam:12","lesson:3","exam:13","exam:14"]);
});
it("keeps an unconfigured assessment lesson visible and handles courses with only final exams",()=>{
 expect(learningCurriculum([{lessonId:1,sectionId:1,contentType:"QUIZ"}] as LessonProgressItem[],[])).toHaveLength(1);
 expect(learningCurriculum([],[{id:10,category:"FINAL_TEST"}] as CourseExam[])).toEqual([{exam:{id:10,category:"FINAL_TEST"}}]);
});
it("mapping return links preserve course context and reject external or recursive destinations",()=>{
 expect(courseMappingReturnPath("/courses/7?tab=details#course-assessments",7)).toBe("/courses/7?tab=details#course-assessments");
 expect(courseMappingReturnPath("/course-enrollments/7#course-assessments",7)).toBe("/course-enrollments/7#course-assessments");
 for(const bad of [null,"//evil.test","https://evil.test","/exams/curriculum?courseId=7","/exams"]) expect(courseMappingReturnPath(bad,7)).toBe("/courses/7#course-assessments");
 expect(courseMappingReturnPath(null,0)).toBe("/courses");
});
