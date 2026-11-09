import type { QueryClient } from "@tanstack/react-query";
import type { CoursePageOptions } from "./course-data";

export const coursePageKey = (email: string, options: CoursePageOptions) => ["course-data", email, options] as const;

export async function refreshCourseViews(client: QueryClient) {
  await Promise.all(["course-data", "course-detail", "my-enrollments", "personal-learning", "admin-learning"]
    .map(key => client.invalidateQueries({ queryKey: [key] })));
}
