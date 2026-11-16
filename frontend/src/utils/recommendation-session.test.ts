import { describe, expect, it } from "vitest";
import { courseReplyText, readRecommendationHistory, recommendationHistoryKey, recommendationPage, RecommendationRequest } from "./recommendation-session";
import { assessmentReturnPath, learnerAssessmentReturnPath, assessmentPreparationPath } from "./assessment-navigation";

describe("learner presentation and navigation", () => {
  it("cleans existing assistant history and provider prose without changing learner input or legitimate numbers", () => {
    const raw = JSON.stringify([{role:"assistant", content:"Java (ID 1), Spring (ID 2)"}, {role:"user",content:"ID 1, Java 21"}]);
    expect(readRecommendationHistory(raw)).toEqual([{role:"assistant",content:"Java, Spring"},{role:"user",content:"ID 1, Java 21"}]);
    expect(courseReplyText("Java 21 (10 lessons), Course ID: 23")).toBe("Java 21 (10 lessons), ");
    expect(courseReplyText("Java [ID: 12], Python (mã khóa học 5)")).toBe("Java, Python");
    expect(recommendationHistoryKey("a")).not.toBe(recommendationHistoryKey("b"));
  });
  it.each([0, 1, 5, 6, 7, 12, 13, 30])("paginates %i recommendations six at a time and clamps after changes", count => {
    const items=Array.from({length:count}, (_,i) => i);
    const first=recommendationPage(items,1);expect(first.items.length).toBe(Math.min(count,6));
    const last=recommendationPage(items,99);expect(last.page).toBe(Math.max(1,Math.ceil(count/6)));
    expect(last.items.length).toBeLessThanOrEqual(6);
    expect(Array.from({length:first.total},(_,i)=>recommendationPage(items,i+1).items).flat()).toEqual(items);
    expect(recommendationPage(items.slice(0,6),last.page).page).toBe(1);
  });
  it("rejects stale responses after cancellation, clear, and a newer request", () => {
    const r=new RecommendationRequest();const a=r.next();const b=r.next();expect(a.current()).toBe(false);expect(b.current()).toBe(true);r.cancel();expect(b.current()).toBe(false);
  });
  it("preserves safe learner return context without changing management defaults", () => {
    const path="/enrollments/183/learn?lessonId=5#lesson";
    expect(learnerAssessmentReturnPath(path)).toBe(path);
    expect(assessmentPreparationPath(5,path)).toContain(encodeURIComponent(path));
    for (const bad of ["/exams", "//evil.test", "/\\evil.test", "https://evil.test", "/courses/5/../exams", null]) expect(learnerAssessmentReturnPath(bad)).toBe("/student/exams");
    expect(assessmentReturnPath(null)).toBe("/exams");
  });
});
