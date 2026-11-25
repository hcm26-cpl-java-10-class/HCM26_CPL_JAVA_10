import { describe, expect, it } from "vitest";
import type { Recommendation } from "@/api/features/recommendations.api";
import { filterAndSortRecommendations, recommendationFiltersFromParams } from "./recommendation-filters";

const item = (id: number, category: string, level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED", duration: number, rating: number, reviews: number): Recommendation => ({
  course: { id, name: `Course ${id}`, categoryName: category, level, totalDuration: duration, averageRating: rating, totalReviews: reviews, lessonCount: 1, isFree: true, enrolled: false },
  reason: `Reason ${id}`,
});
const items = [item(1, "Java", "BEGINNER", 3_600, 4.7, 12), item(2, "Java", "ADVANCED", 40_000, 4.2, 4), item(3, "Data", "BEGINNER", 0, 0, 0)];

describe("recommendation filters", () => {
  it("uses OR within a group and AND between groups", () => {
    const result = filterAndSortRecommendations(items, "", { categories: ["Java", "Data"], levels: ["BEGINNER"], durations: [], ratings: [], sort: "best" });
    expect(result.map(entry => entry.course.id)).toEqual([1, 3]);
  });

  it("does not treat unknown duration or unrated courses as zero-value matches", () => {
    expect(filterAndSortRecommendations(items, "", { categories: [], levels: [], durations: ["under-2h"], ratings: [], sort: "best" }).map(entry => entry.course.id)).toEqual([1]);
    expect(filterAndSortRecommendations(items, "", { categories: [], levels: [], durations: [], ratings: ["under-4"], sort: "best" })).toEqual([]);
  });

  it("preserves ranking by default and puts unknown duration last when sorting", () => {
    expect(filterAndSortRecommendations(items, "", { categories: [], levels: [], durations: [], ratings: [], sort: "best" }).map(entry => entry.course.id)).toEqual([1, 2, 3]);
    expect(filterAndSortRecommendations(items, "", { categories: [], levels: [], durations: [], ratings: [], sort: "duration-asc" }).map(entry => entry.course.id)).toEqual([1, 2, 3]);
  });

  it("restores supported URL state and ignores unknown values", () => {
    expect(recommendationFiltersFromParams(new URLSearchParams("category=Java,Data&level=BEGINNER,NOPE&duration=under-2h&rating=4.5-plus&sort=rating"))).toEqual({ categories: ["Java", "Data"], levels: ["BEGINNER"], durations: ["under-2h"], ratings: ["4.5-plus"], sort: "rating" });
  });
});
