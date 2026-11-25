import type { Recommendation } from "@/api/features/recommendations.api";
import type { CategoryTreeDTO, CourseLevel } from "@/types";

export type DurationFilter = "under-2h" | "2h-10h" | "10h-plus";
export type RatingFilter = "4.5-plus" | "4.0-4.49" | "under-4";
export type RecommendationSort = "best" | "rating" | "duration-asc" | "duration-desc";

export interface RecommendationFilters {
  categories: string[];
  levels: CourseLevel[];
  durations: DurationFilter[];
  ratings: RatingFilter[];
  sort: RecommendationSort;
}

const allowedLevels = new Set<CourseLevel>(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const allowedDurations = new Set<DurationFilter>(["under-2h", "2h-10h", "10h-plus"]);
const allowedRatings = new Set<RatingFilter>(["4.5-plus", "4.0-4.49", "under-4"]);
const allowedSorts = new Set<RecommendationSort>(["best", "rating", "duration-asc", "duration-desc"]);
const values = (params: URLSearchParams, key: string) => (params.get(key) ?? "").split(",").map(value => value.trim()).filter(Boolean);

export function recommendationFiltersFromParams(params: URLSearchParams): RecommendationFilters {
  const sort = params.get("sort") as RecommendationSort | null;
  return {
    categories: values(params, "category"),
    levels: values(params, "level").filter((value): value is CourseLevel => allowedLevels.has(value as CourseLevel)),
    durations: values(params, "duration").filter((value): value is DurationFilter => allowedDurations.has(value as DurationFilter)),
    ratings: values(params, "rating").filter((value): value is RatingFilter => allowedRatings.has(value as RatingFilter)),
    sort: sort && allowedSorts.has(sort) ? sort : "best",
  };
}

function durationMatches(seconds: number, filter: DurationFilter) {
  if (seconds <= 0) return false;
  if (filter === "under-2h") return seconds < 7_200;
  if (filter === "2h-10h") return seconds >= 7_200 && seconds < 36_000;
  return seconds >= 36_000;
}

function ratingMatches(rating: number, reviews: number, filter: RatingFilter) {
  if (reviews <= 0) return false;
  if (filter === "4.5-plus") return rating >= 4.5;
  if (filter === "4.0-4.49") return rating >= 4 && rating < 4.5;
  return rating < 4;
}

export function catalogCategoryNames(nodes: CategoryTreeDTO[]): string[] {
  return nodes.flatMap(node => [node.name, ...catalogCategoryNames(node.children ?? [])]);
}

export function recommendationCategoryNames(course: Recommendation["course"], tree: CategoryTreeDTO[] = []): string[] {
  const names = new Set([course.categoryName, ...(course.categoryNames ?? [])].filter((name): name is string => Boolean(name)));
  const visit = (nodes: CategoryTreeDTO[], parents: string[]) => {
    for (const node of nodes) {
      if (names.has(node.name)) parents.forEach(name => names.add(name));
      visit(node.children ?? [], [...parents, node.name]);
    }
  };
  visit(tree, []);
  return [...names];
}

export function filterAndSortRecommendations(items: Recommendation[], search: string, filters: RecommendationFilters, categoryTree: CategoryTreeDTO[] = []) {
  const keyword = search.trim().toLocaleLowerCase();
  const filtered = items.filter(item => {
    const course = item.course;
    const matchesSearch = !keyword || [course.name, course.description, course.instructor, ...recommendationCategoryNames(course, categoryTree), item.reason]
      .some(value => value?.toLocaleLowerCase().includes(keyword));
    const matchesCategory = !filters.categories.length || recommendationCategoryNames(course, categoryTree).some(name => filters.categories.includes(name));
    const matchesLevel = !filters.levels.length || (course.level != null && filters.levels.includes(course.level));
    const matchesDuration = !filters.durations.length || filters.durations.some(filter => durationMatches(course.totalDuration, filter));
    const matchesRating = !filters.ratings.length || filters.ratings.some(filter => ratingMatches(course.averageRating, course.totalReviews, filter));
    return matchesSearch && matchesCategory && matchesLevel && matchesDuration && matchesRating;
  });
  if (filters.sort === "best") return filtered;
  return filtered.map((item, rank) => ({ item, rank })).sort((left, right) => {
    const a = left.item.course;
    const b = right.item.course;
    if (filters.sort === "rating") return b.averageRating - a.averageRating || b.totalReviews - a.totalReviews || left.rank - right.rank;
    if (a.totalDuration <= 0) return b.totalDuration <= 0 ? left.rank - right.rank : 1;
    if (b.totalDuration <= 0) return -1;
    return (filters.sort === "duration-asc" ? a.totalDuration - b.totalDuration : b.totalDuration - a.totalDuration) || left.rank - right.rank;
  }).map(entry => entry.item);
}

export const recommendationFilterLabels = {
  levels: { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" },
  durations: { "under-2h": "Under 2 hours", "2h-10h": "2–10 hours", "10h-plus": "10+ hours" },
  ratings: { "4.5-plus": "4.5 and up", "4.0-4.49": "4.0–4.49", "under-4": "Under 4.0" },
} as const;
