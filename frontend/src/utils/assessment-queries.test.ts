import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidateAssessmentViews } from "./assessment-queries";
it("refreshes old and new course outlines, links, details and grading after assessment mutations", async () => {
  const client = new QueryClient();
  const keys = [["course-exams", 1], ["course-exams", 2], ["course-detail", 1], ["course-assessment-plan", 1], ["lessons", 3], ["section-lessons", 3], ["exam-detail", 8], ["available-exams-for-course", 2], ["notifications"]];
  keys.forEach(key => client.setQueryData(key, []));
  await invalidateAssessmentViews(client);
  keys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(key[0] !== "notifications"));
});
