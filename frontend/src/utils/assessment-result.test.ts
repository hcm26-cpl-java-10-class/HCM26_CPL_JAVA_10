import { expect, it } from "vitest";
import { assessmentResult, claimResultNotice } from "./assessment-result";
import { assessmentPreparationPath, learnerAssessmentReturnPath } from "./assessment-navigation";
import { validateWeightDraft } from "./course-weight-draft";
it("restricts result notices to finished published grades", () => {
 const a={status:"SUBMITTED" as const,resultPublished:true,finalScore:8,passed:true};
 expect(assessmentResult(a)).toBe("PASSED"); expect(assessmentResult({...a,passed:false})).toBe("FAILED");
 expect(assessmentResult({...a,passed:null})).toBe("COMPLETED");
 expect(assessmentResult({...a,resultPublished:false})).toBeNull(); expect(assessmentResult({...a,finalScore:null})).toBeNull();
 expect(assessmentResult({...a,status:"IN_PROGRESS"})).toBeNull();
});
it("scopes announcement memory by account and attempt", () => {
 expect(claimResultNotice("alice:881")).toBe(true); expect(claimResultNotice("alice:881")).toBe(false);
 expect(claimResultNotice("bob:881")).toBe(true); expect(claimResultNotice("alice:882")).toBe(true);
});
it("preserves lesson and assessment through reloadable course links", () => {
 expect(assessmentPreparationPath(5,"/enrollments/183/learn?lessonId=8")).toBe("/enrollments/183/learn?lessonId=8&assessmentId=5");
 expect(assessmentPreparationPath(6,"/enrollments/183/learn?lessonId=8&assessmentId=5")).toBe("/enrollments/183/learn?lessonId=8&assessmentId=6");
 expect(assessmentPreparationPath(5,"/invitations")).toContain("/student/exams/5/prepare?");
 expect(learnerAssessmentReturnPath("//evil.test")).toBe("/student/exams");
});
it("validates draft precision and totals while allowing practice and incomplete plans", () => {
 expect(validateWeightDraft({a:"0",b:"33.33"})).toEqual({total:33.33,error:null});
 expect(validateWeightDraft({a:"33.33",b:"66.67"})).toEqual({total:100,error:null});
 for(const value of ["-1","100.01","1.001","no","1e2"]) expect(validateWeightDraft({a:value}).error).toBeTruthy();
 expect(validateWeightDraft({a:"60",b:"41"}).error).toBeTruthy();
});
