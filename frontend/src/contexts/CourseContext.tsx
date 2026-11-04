import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import type { CourseItem } from "@/pages/management/demo/course/types";

export interface LessonItem {
  id?: number;
  courseName: string;
  sectionTitle?: string;
  lessonTitle: string;
  contentType?: string;
  contentUrl?: string;
  textContent?: string;
  durationSeconds?: number;
  orderIndex?: number;
  active?: boolean;
}

export interface SectionItem {
  courseName: string;
  sectionTitle: string;
  orderIndex?: number;
  active?: boolean;
}

export interface CourseEnrollmentRecord {
  id: number;
  courseId: number;
  courseName: string;
  courseDescription?: string;
  instructor?: string;
  instructorEmail?: string;
  thumbnailUrl?: string;
  category?: string;
  courseLevel?: string;
  enrolledAt: string;
  lastAccessed: string;
  progress: number;
  status: "enrolled" | "in_progress" | "completed";
  lessonCount?: number;
  duration?: string;
  learnerName?: string;
  learnerEmail?: string;
}

export interface CourseContextType {
  courses: CourseItem[];
  lessons: LessonItem[];
  enrollments: CourseEnrollmentRecord[];
  enrolledCourseIds: Set<number>;
  setCourses: React.Dispatch<React.SetStateAction<CourseItem[]>>;
  setLessons: React.Dispatch<React.SetStateAction<LessonItem[]>>;
  importExcelWorkbook: (file: File | ArrayBuffer) => Promise<{ courseCount: number; lessonCount: number }>;
  addCourse: (course: Omit<CourseItem, "id" | "createdAt"> & Partial<CourseItem>) => CourseItem;
  updateCourse: (id: number, data: Partial<CourseItem>) => void;
  deleteCourse: (id: number) => void;
  toggleCourseStatus: (id: number) => void;
  toggleEnroll: (
    courseId: number,
    courseData?: Partial<CourseItem> & { learnerName?: string; learnerEmail?: string }
  ) => boolean;
  updateEnrollmentProgress: (courseId: number | string, progress: number) => void;
  getEnrollment: (courseIdOrName: number | string) => CourseEnrollmentRecord | undefined;
  clearAll: () => void;
}

export function formatCurrentTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

export function mapCategoryCode(code: any, courseName?: string): string {
  if (code !== undefined && code !== null && String(code).trim() !== "") {
    const raw = String(code).trim();
    const upper = raw.toUpperCase();
    if (upper === "JAVA") return "Java Programming";
    if (upper === "WEB_DEV") return "Web Development";
    if (upper === "DATA_ANALYSIS") return "Data Analysis";
    if (upper === "PROGRAMMING") return "Programming & Technology";
    // Fallback: format raw code nicely
    return raw
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // Fallback inferred from courseName
  if (courseName) {
    const lower = courseName.toLowerCase();
    if (lower.includes("java") || lower.includes("spring")) return "Java Programming";
    if (
      lower.includes("web") ||
      lower.includes("react") ||
      lower.includes("frontend") ||
      lower.includes("typescript") ||
      lower.includes("javascript") ||
      lower.includes("html") ||
      lower.includes("css")
    ) {
      return "Web Development";
    }
    if (
      lower.includes("data") ||
      lower.includes("sql") ||
      lower.includes("python") ||
      lower.includes("analytics")
    ) {
      return "Data Analysis";
    }
  }

  return "Programming & Technology";
}

export function normalizePublicationStatus(status: any): "Published" | "Draft" {
  if (!status) return "Published";
  const upper = String(status).trim().toUpperCase();
  if (upper === "PUBLISHED") return "Published";
  if (upper === "DRAFT") return "Draft";
  return "Published";
}

export function normalizeCourseLevel(level: any): "Beginner" | "Intermediate" | "Advanced" {
  if (!level) return "Beginner";
  const upper = String(level).trim().toUpperCase();
  if (upper === "BEGINNER") return "Beginner";
  if (upper === "INTERMEDIATE") return "Intermediate";
  if (upper === "ADVANCED") return "Advanced";
  return "Beginner";
}

export function parseBooleanStatus(val: any): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "57m";
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

const STORAGE_KEY_COURSES = "app_courses_state";
const STORAGE_KEY_LESSONS = "app_lessons_state";
const STORAGE_KEY_ENROLLED = "app_enrolled_state";
const STORAGE_KEY_ENROLLED_RECORDS = "app_enrolled_records";

export function matchEnrollment(
  e: CourseEnrollmentRecord,
  target: { id?: number | string; courseId?: number | string; name?: string; courseName?: string }
): boolean {
  if (!target) return false;
  const targetCourseId = target.courseId !== undefined ? String(target.courseId) : "";
  const targetId = target.id !== undefined ? String(target.id) : "";
  if (targetCourseId && (String(e.courseId) === targetCourseId || String(e.id) === targetCourseId)) return true;
  if (targetId && (String(e.courseId) === targetId || String(e.id) === targetId)) return true;
  const tName = (target.courseName || target.name || "").trim().toLowerCase();
  if (tName && e.courseName && e.courseName.trim().toLowerCase() === tName) return true;
  return false;
}

function getStorageItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const local = window.localStorage?.getItem(key);
    if (local) return JSON.parse(local);
  } catch {}
  try {
    const session = window.sessionStorage?.getItem(key);
    if (session) return JSON.parse(session);
  } catch {}
  return fallback;
}

function setStorageItem(key: string, val: any) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(val);
    window.localStorage?.setItem(key, raw);
    window.sessionStorage?.setItem(key, raw);
  } catch {}
}

function removeStorageItem(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(key);
    window.sessionStorage?.removeItem(key);
  } catch {}
}

// Aliases for backwards compatibility
export const getSessionItem = getStorageItem;
export const setSessionItem = setStorageItem;
export const removeSessionItem = removeStorageItem;

export const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{
  children: React.ReactNode;
  initialCourses?: CourseItem[];
  initialLessons?: LessonItem[];
}> = ({ children, initialCourses = [], initialLessons = [] }) => {
  // Storage backed state (empty on fresh startup, persists during browser sessions)
  const [courses, setCoursesState] = useState<CourseItem[]>(() => {
    if (initialCourses.length > 0) return initialCourses;
    return getStorageItem<CourseItem[]>(STORAGE_KEY_COURSES, []);
  });

  const [lessons, setLessonsState] = useState<LessonItem[]>(() => {
    if (initialLessons.length > 0) return initialLessons;
    return getStorageItem<LessonItem[]>(STORAGE_KEY_LESSONS, []);
  });

  const [enrollments, setEnrollmentsState] = useState<CourseEnrollmentRecord[]>(() => {
    return getStorageItem<CourseEnrollmentRecord[]>(STORAGE_KEY_ENROLLED_RECORDS, []);
  });

  const [enrolledCourseIds, setEnrolledCourseIdsState] = useState<Set<number>>(() => {
    const recs = getStorageItem<CourseEnrollmentRecord[]>(STORAGE_KEY_ENROLLED_RECORDS, []);
    if (recs.length > 0) {
      return new Set(recs.map((r) => Number(r.courseId)).filter((n) => !isNaN(n)));
    }
    const arr = getStorageItem<number[]>(STORAGE_KEY_ENROLLED, []);
    return new Set(Array.isArray(arr) ? arr.map(Number).filter((n) => !isNaN(n)) : []);
  });

  // Keep enrolledCourseIds automatically in sync with enrollments
  useEffect(() => {
    const ids = new Set<number>();
    for (const e of enrollments) {
      const num = Number(e.courseId ?? e.id);
      if (!isNaN(num)) ids.add(num);
    }
    setEnrolledCourseIdsState(ids);
    setStorageItem(STORAGE_KEY_ENROLLED, Array.from(ids));
  }, [enrollments]);

  const setCourses: React.Dispatch<React.SetStateAction<CourseItem[]>> = useCallback((action) => {
    setCoursesState((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      setStorageItem(STORAGE_KEY_COURSES, next);
      return next;
    });
  }, []);

  const setLessons: React.Dispatch<React.SetStateAction<LessonItem[]>> = useCallback((action) => {
    setLessonsState((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      setStorageItem(STORAGE_KEY_LESSONS, next);
      return next;
    });
  }, []);

  const toggleEnroll = useCallback(
    (
      courseId: number,
      courseData?: Partial<CourseItem> & { learnerName?: string; learnerEmail?: string }
    ): boolean => {
      let nowEnrolled = false;
      const targetCourse = courseData || courses.find((c) => c.id === courseId);
      const displayName =
        targetCourse?.courseName || targetCourse?.name || `Course #${courseId}`;

      const learnerName = (() => {
        if (courseData?.learnerName) return courseData.learnerName;
        try {
          const fn = localStorage.getItem("firstName");
          const ln = localStorage.getItem("lastName");
          const full = [fn, ln].filter(Boolean).join(" ").trim();
          if (full) return full;
        } catch {}
        return "Admin User";
      })();

      const numericId = Number(courseId) || 1;

      setEnrollmentsState((prev) => {
        const isCurrentlyEnrolled = prev.some((e) =>
          matchEnrollment(e, { id: numericId, courseId: numericId, courseName: displayName })
        );

        let next: CourseEnrollmentRecord[];
        if (!isCurrentlyEnrolled) {
          nowEnrolled = true;
          const newRecord: CourseEnrollmentRecord = {
            id: numericId,
            courseId: numericId,
            courseName: displayName,
            courseDescription: targetCourse?.description || "",
            instructor: targetCourse?.instructor || "Teacher User",
            instructorEmail: targetCourse?.instructorEmail || "",
            thumbnailUrl: targetCourse?.thumbnailUrl || "",
            category: targetCourse?.category || "Programming & Technology",
            courseLevel: targetCourse?.courseLevel || "Beginner",
            enrolledAt: new Date().toISOString(),
            lastAccessed: formatCurrentTimestamp(),
            progress: 15,
            status: "in_progress",
            lessonCount: targetCourse?.lessonCount ?? 10,
            duration: targetCourse?.duration ?? "57m",
            learnerName,
            learnerEmail: courseData?.learnerEmail || "",
          };
          next = [newRecord, ...prev.filter((e) => !matchEnrollment(e, { id: numericId, courseName: displayName }))];
        } else {
          nowEnrolled = false;
          next = prev.filter((e) => !matchEnrollment(e, { id: numericId, courseName: displayName }));
        }

        setStorageItem(STORAGE_KEY_ENROLLED_RECORDS, next);
        return next;
      });

      return nowEnrolled;
    },
    [courses]
  );

  const updateEnrollmentProgress = useCallback((courseIdOrName: number | string, progress: number) => {
    const queryStr = String(courseIdOrName).trim();
    const queryNum = Number(courseIdOrName);

    setEnrollmentsState((prev) => {
      const next = prev.map((e) => {
        const matches =
          (!isNaN(queryNum) && (e.courseId === queryNum || e.id === queryNum)) ||
          String(e.courseId) === queryStr ||
          String(e.id) === queryStr ||
          (e.courseName && e.courseName.trim().toLowerCase() === queryStr.toLowerCase());

        if (matches) {
          const clamped = Math.min(100, Math.max(0, progress));
          const status =
            clamped >= 100
              ? ("completed" as const)
              : clamped > 0
                ? ("in_progress" as const)
                : ("enrolled" as const);
          return {
            ...e,
            progress: clamped,
            status,
            lastAccessed: formatCurrentTimestamp(),
          };
        }
        return e;
      });
      setStorageItem(STORAGE_KEY_ENROLLED_RECORDS, next);
      return next;
    });
  }, []);

  const getEnrollment = useCallback(
    (courseIdOrName: number | string) => {
      const queryStr = String(courseIdOrName).trim();
      const queryNum = Number(courseIdOrName);

      return enrollments.find(
        (e) =>
          (!isNaN(queryNum) && (e.courseId === queryNum || e.id === queryNum)) ||
          String(e.courseId) === queryStr ||
          String(e.id) === queryStr ||
          (e.courseName && e.courseName.trim().toLowerCase() === queryStr.toLowerCase())
      );
    },
    [enrollments]
  );

  const addCourse = useCallback(
    (courseData: Omit<CourseItem, "id" | "createdAt"> & Partial<CourseItem>): CourseItem => {
      let createdItem!: CourseItem;
      setCoursesState((prev) => {
        const nextId = prev.length > 0 ? Math.max(...prev.map((c) => c.id)) + 1 : 1;
        const name = courseData.courseName || courseData.name || "Untitled Course";
        const isActive = courseData.status !== undefined ? courseData.status : courseData.isActive ?? true;
        createdItem = {
          id: nextId,
          name,
          courseName: name,
          description: courseData.description || "",
          instructor: courseData.instructor || "Teacher User",
          instructorEmail: courseData.instructorEmail || "teacher@example.com",
          thumbnailUrl: courseData.thumbnailUrl || "",
          publicationStatus: normalizePublicationStatus(courseData.publicationStatus),
          courseLevel: normalizeCourseLevel(courseData.courseLevel),
          isActive,
          status: isActive,
          category: courseData.category || "Java Programming",
          createdAt: formatCurrentTimestamp(),
          lessonCount: courseData.lessonCount ?? 10,
          duration: courseData.duration ?? "57m",
        };
        const updated = [createdItem, ...prev];
        setSessionItem(STORAGE_KEY_COURSES, updated);
        return updated;
      });
      return createdItem;
    },
    []
  );

  const updateCourse = useCallback((id: number, data: Partial<CourseItem>) => {
    setCoursesState((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c;
        const name = data.courseName || data.name || c.name;
        const isActive =
          data.status !== undefined
            ? data.status
            : data.isActive !== undefined
            ? data.isActive
            : c.isActive;
        return {
          ...c,
          ...data,
          name,
          courseName: name,
          isActive,
          status: isActive,
        };
      });
      setSessionItem(STORAGE_KEY_COURSES, updated);
      return updated;
    });
  }, []);

  const deleteCourse = useCallback((id: number) => {
    setCoursesState((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      setSessionItem(STORAGE_KEY_COURSES, updated);
      return updated;
    });
    setEnrolledCourseIdsState((prev) => {
      const next = new Set(prev);
      next.delete(id);
      setSessionItem(STORAGE_KEY_ENROLLED, Array.from(next));
      return next;
    });
  }, []);

  const toggleCourseStatus = useCallback((id: number) => {
    setCoursesState((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c;
        const nextActive = !c.isActive;
        return {
          ...c,
          isActive: nextActive,
          status: nextActive,
        };
      });
      setSessionItem(STORAGE_KEY_COURSES, updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setCoursesState([]);
    setLessonsState([]);
    setEnrollmentsState([]);
    setEnrolledCourseIdsState(new Set());
    removeSessionItem(STORAGE_KEY_COURSES);
    removeSessionItem(STORAGE_KEY_LESSONS);
    removeSessionItem(STORAGE_KEY_ENROLLED);
    removeSessionItem(STORAGE_KEY_ENROLLED_RECORDS);
  }, []);

  const importExcelWorkbook = useCallback(
    async (fileOrBuffer: File | ArrayBuffer): Promise<{ courseCount: number; lessonCount: number }> => {
      let buffer: ArrayBuffer;
      if (fileOrBuffer instanceof ArrayBuffer) {
        buffer = fileOrBuffer;
      } else {
        buffer = await fileOrBuffer.arrayBuffer();
      }

      const wb = XLSX.read(buffer, { type: "array" });

      // 1. Target sheet: look for "Courses" (case-insensitive)
      let courseSheetName = wb.SheetNames.find((n) => /^courses$/i.test(n.trim()));
      if (!courseSheetName) {
        // Fallback to first data sheet (excluding readme/instructions)
        courseSheetName =
          wb.SheetNames.find(
            (n) => !/^(readme|read\s*me|instruction|instructions|about)$/i.test(n.trim())
          ) || wb.SheetNames[0];
      }

      if (!courseSheetName || !wb.Sheets[courseSheetName]) {
        throw new Error("No Courses sheet found in the uploaded Excel file.");
      }

      const rawCourses = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[courseSheetName]);
      if (!Array.isArray(rawCourses) || rawCourses.length === 0) {
        throw new Error("The Courses sheet contains no course records.");
      }

      // 2. Parse Lessons sheet if present
      const lessonSheetName = wb.SheetNames.find((n) => /^lessons$/i.test(n.trim()));
      const rawLessons =
        lessonSheetName && wb.Sheets[lessonSheetName]
          ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[lessonSheetName])
          : [];

      const parsedLessons: LessonItem[] = rawLessons.map((l, idx) => ({
        id: idx + 1,
        courseName: String(l["Course Name"] || l["courseName"] || l["Course"] || "").trim(),
        sectionTitle: String(l["Section Title"] || l["sectionTitle"] || l["Section"] || "").trim(),
        lessonTitle: String(l["Lesson Title"] || l["lessonTitle"] || l["Title"] || `Lesson ${idx + 1}`).trim(),
        contentType: String(l["Content Type"] || l["contentType"] || "TEXT").trim(),
        contentUrl: String(l["Content URL"] || l["contentUrl"] || "").trim(),
        textContent: String(l["Text Content"] || l["textContent"] || "").trim(),
        durationSeconds: Number(l["Duration (seconds)"] || l["Duration"] || l["durationSeconds"]) || 0,
        orderIndex: Number(l["Order Index"] || l["orderIndex"] || idx + 1),
        active: parseBooleanStatus(l["Active"] !== undefined ? l["Active"] : true),
      }));

      // Group lessons by course name
      const lessonsByCourseName: Record<string, { count: number; totalSeconds: number }> = {};
      for (const lesson of parsedLessons) {
        const key = lesson.courseName.toLowerCase();
        if (!lessonsByCourseName[key]) {
          lessonsByCourseName[key] = { count: 0, totalSeconds: 0 };
        }
        lessonsByCourseName[key].count += 1;
        lessonsByCourseName[key].totalSeconds += lesson.durationSeconds || 0;
      }

      const timestamp = formatCurrentTimestamp();

      // 3. Exact column mapping from Courses sheet
      const parsedCourses: CourseItem[] = rawCourses.map((row, index) => {
        const courseName = String(
          row["Name"] || row["courseName"] || row["Course Name"] || `Course ${index + 1}`
        ).trim();
        const description = String(row["Description"] || row["description"] || "").trim();
        const instructor = String(row["Instructor"] || row["instructor"] || "Teacher User").trim();
        const thumbnailUrl = String(
          row["Thumbnail URL"] || row["thumbnailUrl"] || row["Thumbnail"] || ""
        ).trim();
        const pubStatusRaw = row["Status"] || row["publicationStatus"] || "PUBLISHED";
        const publicationStatus = normalizePublicationStatus(pubStatusRaw);
        const levelRaw = row["Level"] || row["courseLevel"] || "BEGINNER";
        const courseLevel = normalizeCourseLevel(levelRaw);
        const activeRaw =
          row["Active"] !== undefined ? row["Active"] : row["status"] !== undefined ? row["status"] : true;
        const status = parseBooleanStatus(activeRaw);
        const instructorEmail = String(row["Instructor Email"] || row["instructorEmail"] || "").trim();
        const categoryRaw = row["Category Codes"] || row["Category"] || row["category"];
        const category = mapCategoryCode(categoryRaw, courseName);

        // Lesson count and duration computed or default 10 lessons • 57m
        const lessonInfo = lessonsByCourseName[courseName.toLowerCase()];
        const lessonCount = lessonInfo && lessonInfo.count > 0 ? lessonInfo.count : 10;
        const duration =
          lessonInfo && lessonInfo.totalSeconds > 0
            ? formatDuration(lessonInfo.totalSeconds)
            : "57m";

        return {
          id: index + 1,
          name: courseName,
          courseName,
          description,
          instructor,
          instructorEmail: instructorEmail || `${instructor.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          thumbnailUrl,
          publicationStatus,
          courseLevel,
          isActive: status,
          status,
          category,
          createdAt: timestamp,
          lessonCount,
          duration,
        };
      });

      setCoursesState(parsedCourses);
      setLessonsState(parsedLessons);
      setEnrollmentsState([]);
      setEnrolledCourseIdsState(new Set());
      setSessionItem(STORAGE_KEY_COURSES, parsedCourses);
      setSessionItem(STORAGE_KEY_LESSONS, parsedLessons);
      setSessionItem(STORAGE_KEY_ENROLLED, []);
      setSessionItem(STORAGE_KEY_ENROLLED_RECORDS, []);

      return {
        courseCount: parsedCourses.length,
        lessonCount: parsedLessons.length,
      };
    },
    []
  );

  const value: CourseContextType = {
    courses,
    lessons,
    enrollments,
    enrolledCourseIds,
    setCourses,
    setLessons,
    importExcelWorkbook,
    addCourse,
    updateCourse,
    deleteCourse,
    toggleCourseStatus,
    toggleEnroll,
    updateEnrollmentProgress,
    getEnrollment,
    clearAll,
  };

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
};

export function useCourse(): CourseContextType {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error("useCourse must be used within a CourseProvider");
  }
  return context;
}

export function useOptionalCourse(): CourseContextType | undefined {
  return useContext(CourseContext);
}
