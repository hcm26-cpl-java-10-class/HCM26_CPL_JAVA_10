import axios from "@/api/axios";
import { courseApi } from "@/api/features/demo/course.api";
import type { CourseDTO } from "@/types";

export interface BackendCourse extends CourseDTO { id: number; name: string; isActive: boolean }
export interface CoursePage { content: BackendCourse[]; totalElements: number; totalPages: number }
export interface CoursePageOptions { category?:string; courseLevel?:string; instructor?:string; publicationStatus?:string; page: number; size: number; search?: string; sort?: string; isActive?: boolean }
export interface CourseWrite { category?: string | null; courseLevel?: string | null; publicationStatus?: string | null; instructorEmail?: string | null; name: string; instructor?: string | null; description?: string | null; thumbnailUrl?: string | null; isActive: boolean }

export function courseError(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error as { response?: { data?: { message?: string; errors?: Record<string, string> } } }).response?.data;
    if (data?.errors) return Object.entries(data.errors).map(([field, message]) => `${field}: ${message}`).join("; ");
    if (data?.message) return data.message;
  }
  return error instanceof Error ? error.message : "The course request failed. Please try again.";
}

export function validateCourse(input: CourseWrite) {
  const value = { name: input.name?.trim() ?? "", instructor: input.instructor ?? "",
    description: input.description ?? "", thumbnailUrl: input.thumbnailUrl ?? "", isActive: input.isActive, category: input.category ?? undefined, courseLevel: input.courseLevel ?? undefined, publicationStatus: input.publicationStatus ?? undefined, instructorEmail: input.instructorEmail ?? undefined };
  if (!value.name) throw new Error("Course name is required.");
  for (const [field, limit] of [["name", 150], ["instructor", 100], ["description", 500], ["thumbnailUrl", 255], ["category", 255], ["courseLevel", 50], ["publicationStatus", 50], ["instructorEmail", 255]] as const) {
    if (value[field] != null && (typeof value[field] !== "string" || value[field]!.length > limit)) throw new Error(`${field} must contain at most ${limit} characters.`);
  }
  if (typeof value.isActive !== "boolean") throw new Error("Active must be true or false.");
  return value;
}

function confirmed(course: CourseDTO): BackendCourse {
  if (!Number.isSafeInteger(course?.id) || course.id! <= 0 || typeof course.name !== "string" || typeof course.isActive !== "boolean") {
    throw new Error("The Course API returned an incomplete record. Reload before trying again.");
  }
  return course as BackendCourse;
}

// Shared transport over existing Course endpoints; browser storage never supplies records.
export const courseData = {
  page: async (options: CoursePageOptions, signal?: AbortSignal): Promise<CoursePage> => {
    const { data } = await axios.get<CoursePage>("/courses", { signal, params: { ...options, category:options.category || undefined, courseLevel:options.courseLevel || undefined, instructor:options.instructor || undefined, publicationStatus:options.publicationStatus || undefined, search: options.search?.trim() || undefined, sort: options.sort || "id,asc" } });
    if (!Array.isArray(data.content) || !Number.isInteger(data.totalElements) || !Number.isInteger(data.totalPages)) throw new Error("The Course API returned an invalid page.");
    return { ...data, content: data.content.map(confirmed) };
  },
  all: async (signal?: AbortSignal): Promise<BackendCourse[]> => {
    const result: BackendCourse[] = [];
    const ids = new Set<number>();
    let expected: number | undefined;
    for (let page = 0; ; page++) {
      const data = await courseData.page({ page, size: 100, sort: "id,asc" }, signal);
      expected ??= data.totalElements;
      if (expected !== data.totalElements) throw new Error("Courses changed while loading. Please try again.");
      for (const course of data.content) {
        if (ids.has(course.id)) throw new Error("Courses changed while loading. Please try again.");
        ids.add(course.id); result.push(course);
      }
      if (page + 1 >= data.totalPages) {
        if (result.length !== expected) throw new Error("The full Course dataset could not be confirmed. Please try again.");
        return result;
      }
    }
  },
  create: async (input: CourseWrite): Promise<BackendCourse> => confirmed(await courseApi.create(validateCourse(input))),
  update: async (id: number, input: CourseWrite): Promise<BackendCourse> => confirmed(await courseApi.update(String(id), validateCourse(input))),
  remove: async (id: number): Promise<void> => courseApi.delete(String(id)),
};

export function legacyCourseSummary(): { local: number; session: number; unreadable: boolean } {
  const result = { local: 0, session: 0, unreadable: false };
  if (typeof window === "undefined") return result;
  for (const [kind, storage] of [["local", window.localStorage], ["session", window.sessionStorage]] as const) {
    try {
      const raw = storage?.getItem("app_courses_state");
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) result[kind] = parsed.length;
      else result.unreadable = true;
    } catch { result.unreadable = true; }
  }
  return result;
}
