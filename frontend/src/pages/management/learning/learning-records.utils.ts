import type { Enrollment } from "@/types";
import type { LearningCourse } from "./learning.types";

export const enrollmentToCourse = (course: Enrollment): LearningCourse => ({
  id: String(course.id),
  courseId: course.courseId,
  title: course.courseName,
  description: (course as any).courseDescription ?? "",
  thumbnailUrl: course.thumbnailUrl,
  provider: course.instructor ?? "",
  skill: "",
  lastAccessed: "",
  enrolledAt: course.enrolledAt,
  progress: null,
  status: "enrolled",
});
