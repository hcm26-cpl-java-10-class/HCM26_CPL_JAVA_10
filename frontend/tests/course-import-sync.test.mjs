import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { build } from "esbuild";
import * as XLSX from "xlsx";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = {
  location: { href: "", pathname: "/courses" },
  matchMedia: () => ({ matches: false }),
};

const outfile = new URL("./.course-sync.generated.mjs", import.meta.url);
const result = await build({
  stdin: {
    contents: `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { Provider } from "react-redux";
    import { configureStore } from "@reduxjs/toolkit";
    import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
    import { MemoryRouter } from "react-router-dom";
    import { RoleSwitchProvider } from "./src/contexts/RoleSwitchContext";
    import {
      CourseProvider,
      useCourse,
      mapCategoryCode,
      normalizePublicationStatus,
      normalizeCourseLevel,
      parseBooleanStatus,
      formatDuration,
      formatCurrentTimestamp,
    } from "./src/contexts/CourseContext";
    import { coursePageKey } from "./src/integrations/courses/course-queries";
    import CourseManagementPage from "./src/pages/management/demo/course/index";
    import CourseEnrollmentsPage from "./src/pages/management/demo/enrollment/CourseEnrollmentsPage";
    import { LearningRecordsPanel } from "./src/pages/management/learning/components/LearningRecordsPanel";
    import { EnrollConfirmationModal } from "./src/pages/management/demo/enrollment/components/EnrollConfirmationModal";

    export {
      EnrollConfirmationModal,
      mapCategoryCode,
      normalizePublicationStatus,
      normalizeCourseLevel,
      parseBooleanStatus,
      formatDuration,
      formatCurrentTimestamp,
    };

    function createTestWrapper(initialCourses = [], initialLessons = []) {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, retryOnMount: false, gcTime: 0, staleTime: 0 },
        },
      });
      const store = configureStore({
        reducer: () => ({
          auth: { email: "admin@example.com", isAuthenticated: true, permissions: ["ADMIN_ACCESS", "COURSE_READ", "COURSE_CREATE"] },
        }),
      });

      function TestProvider({ children }) {
        return (
          <Provider store={store}>
            <QueryClientProvider client={client}>
              <RoleSwitchProvider>
                <MemoryRouter>
                  <CourseProvider initialCourses={initialCourses} initialLessons={initialLessons}>
                    {children}
                  </CourseProvider>
                </MemoryRouter>
              </RoleSwitchProvider>
            </QueryClientProvider>
          </Provider>
        );
      }

      return { TestProvider, client };
    }

    export function renderCoursesEmpty() {
      const { TestProvider, client } = createTestWrapper();
      client.setQueryData(coursePageKey("admin@example.com", { page: 0, size: 10, search: "", sort: "id,asc" }), { content: [], totalElements: 0, totalPages: 0 });
      const html = renderToStaticMarkup(
        <TestProvider>
          <CourseManagementPage />
        </TestProvider>
      );
      client.clear();
      return html;
    }

    export function renderEnrollmentsEmpty() {
      const { TestProvider, client } = createTestWrapper();
      const html = renderToStaticMarkup(
        <TestProvider>
          <CourseEnrollmentsPage />
        </TestProvider>
      );
      client.clear();
      return html;
    }

    export function renderEnrollmentsWithCourses(courses, lessons = []) {
      const { TestProvider, client } = createTestWrapper(courses, lessons);
      const html = renderToStaticMarkup(
        <TestProvider>
          <CourseEnrollmentsPage />
        </TestProvider>
      );
      client.clear();
      return html;
    }

    export function renderProfileLearningCompact(courses = [], enrolledIds = [1], progress = 15) {
      const { TestProvider, client } = createTestWrapper(courses);
      globalThis.window.sessionStorage = {
        getItem: (key) => {
          if (key === "app_enrolled_records") {
            return JSON.stringify(
              enrolledIds.map((id) => {
                const c = courses.find((x) => x.id === id) || { id, name: "Java 21 Fundamentals" };
                return {
                  id,
                  courseId: id,
                  courseName: c.courseName || c.name || "Java 21 Fundamentals",
                  instructor: c.instructor || "Teacher User",
                  category: c.category || "Java Programming",
                  progress,
                  status: progress >= 100 ? "completed" : "in_progress",
                  enrolledAt: new Date().toISOString(),
                  lastAccessed: "Recently",
                };
              })
            );
          }
          if (key === "app_enrolled_state") return JSON.stringify(enrolledIds);
          return null;
        },
        setItem: () => {},
        removeItem: () => {},
      };
      const html = renderToStaticMarkup(
        <TestProvider>
          <LearningRecordsPanel compact />
        </TestProvider>
      );
      client.clear();
      return html;
    }

    export function renderMyLearningFull(courses = [], enrolledIds = [1], progress = 15) {
      const { TestProvider, client } = createTestWrapper(courses);
      globalThis.window.sessionStorage = {
        getItem: (key) => {
          if (key === "app_enrolled_records") {
            return JSON.stringify(
              enrolledIds.map((id) => {
                const c = courses.find((x) => x.id === id) || { id, name: "Java 21 Fundamentals" };
                return {
                  id,
                  courseId: id,
                  courseName: c.courseName || c.name || "Java 21 Fundamentals",
                  instructor: c.instructor || "Teacher User",
                  category: c.category || "Java Programming",
                  progress,
                  status: progress >= 100 ? "completed" : "in_progress",
                  enrolledAt: new Date().toISOString(),
                  lastAccessed: "Recently",
                };
              })
            );
          }
          if (key === "app_enrolled_state") return JSON.stringify(enrolledIds);
          return null;
        },
        setItem: () => {},
        removeItem: () => {},
      };
      const html = renderToStaticMarkup(
        <TestProvider>
          <LearningRecordsPanel compact={false} />
        </TestProvider>
      );
      client.clear();
      return html;
    }

    export function renderEnrollConfirmationModal(course, isOpen = true) {
      return renderToStaticMarkup(
        <EnrollConfirmationModal
          isOpen={isOpen}
          course={course}
          onClose={() => {}}
          onConfirm={() => {}}
          lessonCount={course.lessonCount || 10}
          duration={course.duration || "57m"}
        />
      );
    }

    export function renderEnrollmentsWithEnrolled(courses, enrollmentsList = []) {
      const { TestProvider, client } = createTestWrapper(courses);
      const storageMock = (key) => {
        if (key === "app_enrolled_records") return JSON.stringify(enrollmentsList);
        if (key === "app_enrolled_state") return JSON.stringify(enrollmentsList.map(e => e.courseId || e.id));
        return null;
      };
      globalThis.window.localStorage = {
        getItem: storageMock,
        setItem: () => {},
        removeItem: () => {},
      };
      globalThis.window.sessionStorage = {
        getItem: storageMock,
        setItem: () => {},
        removeItem: () => {},
      };
      const html = renderToStaticMarkup(
        <TestProvider>
          <CourseEnrollmentsPage />
        </TestProvider>
      );
      client.clear();
      return html;
    }
  `,
    resolveDir: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  packages: "external",
  tsconfig: new URL("../tsconfig.app.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  define: { "import.meta.env": "{}" },
});

writeFileSync(outfile, result.outputFiles[0].text);
let renderCoursesEmpty,
  renderEnrollmentsEmpty,
  renderEnrollmentsWithCourses,
  renderEnrollmentsWithEnrolled,
  renderEnrollConfirmationModal,
  renderProfileLearningCompact,
  renderMyLearningFull,
  mapCategoryCode,
  normalizePublicationStatus,
  normalizeCourseLevel,
  parseBooleanStatus,
  formatDuration,
  formatCurrentTimestamp;

try {
  ({
    renderCoursesEmpty,
    renderEnrollmentsEmpty,
    renderEnrollmentsWithCourses,
    renderEnrollmentsWithEnrolled,
    renderEnrollConfirmationModal,
    renderProfileLearningCompact,
    renderMyLearningFull,
    mapCategoryCode,
    normalizePublicationStatus,
    normalizeCourseLevel,
    parseBooleanStatus,
    formatDuration,
    formatCurrentTimestamp,
  } = await import(outfile.href));
} finally {
  unlinkSync(outfile);
}

test("1. Column mapping and normalizations adhere to specifications", () => {
  // Category Codes mapping
  assert.equal(mapCategoryCode("JAVA"), "Java Programming");
  assert.equal(mapCategoryCode("WEB_DEV"), "Web Development");
  assert.equal(mapCategoryCode("DATA_ANALYSIS"), "Data Analysis");
  assert.equal(mapCategoryCode("PROGRAMMING"), "Programming & Technology");
  assert.equal(mapCategoryCode("CLOUD_COMPUTING"), "Cloud Computing");
  assert.equal(mapCategoryCode(null, "Java 21 Fundamentals"), "Java Programming");
  assert.equal(mapCategoryCode(null, "Frontend with React"), "Web Development");
  assert.equal(mapCategoryCode(null, "SQL Database Design"), "Data Analysis");

  // Publication status normalization
  assert.equal(normalizePublicationStatus("PUBLISHED"), "Published");
  assert.equal(normalizePublicationStatus("DRAFT"), "Draft");
  assert.equal(normalizePublicationStatus("published"), "Published");

  // Course level normalization
  assert.equal(normalizeCourseLevel("BEGINNER"), "Beginner");
  assert.equal(normalizeCourseLevel("INTERMEDIATE"), "Intermediate");
  assert.equal(normalizeCourseLevel("ADVANCED"), "Advanced");

  // Active boolean parsing
  assert.equal(parseBooleanStatus(true), true);
  assert.equal(parseBooleanStatus("TRUE"), true);
  assert.equal(parseBooleanStatus("true"), true);
  assert.equal(parseBooleanStatus(1), true);
  assert.equal(parseBooleanStatus(false), false);
  assert.equal(parseBooleanStatus("FALSE"), false);
  assert.equal(parseBooleanStatus(0), false);

  // Duration formatting
  assert.equal(formatDuration(3420), "57m");
  assert.equal(formatDuration(6300), "1h 45m");
  assert.equal(formatDuration(0), "57m");

  // Timestamp format: HH:mm dd/MM/yyyy
  const ts = formatCurrentTimestamp();
  assert.match(ts, /^\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}$/);
});

test("2. /courses initial startup renders clean empty state with Import .xlsx button", () => {
  const html = renderCoursesEmpty();
  assert.match(
    html,
    /No courses available\. Click &#x27;Import&#x27; to upload an \.xlsx file or &#x27;\+ Create&#x27; to add a new course\./
  );
  assert.match(html, /Import \.xlsx/);
});

test("3. Learning waits for the Course API instead of claiming an empty local catalog", () => {
  const html = renderEnrollmentsEmpty();
  assert.match(html, /Loading courses/);
  assert.match(html, /Not available/);
  assert.doesNotMatch(html, /0%|No learners enrolled|Confirm Course Enrollment/);
});


test("4. Excel sample dataset can be parsed and populates courses and lessons correctly", () => {
  const filePath = "D:/FPT_OJT/course-reference/test-data/course-import-15-courses-150-lessons.xlsx";
  if (!existsSync(filePath)) {
    return;
  }

  const fileBuffer = readFileSync(filePath);
  const wb = XLSX.read(fileBuffer, { type: "buffer" });
  assert.ok(wb.SheetNames.includes("Courses"));
  assert.ok(wb.SheetNames.includes("Lessons"));

  const rawCourses = XLSX.utils.sheet_to_json(wb.Sheets["Courses"]);
  assert.equal(rawCourses.length, 15);

  const rawLessons = XLSX.utils.sheet_to_json(wb.Sheets["Lessons"]);
  assert.equal(rawLessons.length, 150);
});

test("5. Learning Catalog does not treat browser-imported Course records as backend data", () => {
  const html = renderEnrollmentsWithCourses([{ id: 1, name: "Browser-only course", courseName: "Browser-only course", instructor: "Local instructor", category: "Local category", courseLevel: "Beginner", publicationStatus: "Published", isActive: true }]);
  assert.match(html, /Loading courses/);
  assert.doesNotMatch(html, /Browser-only course|Local instructor|10 lessons|57m/);
});


test("6. My Learning and Overview ignore browser-only enrollments and progress", () => {
  const courses = [{ id: 1, name: "Browser-only achievement", courseName: "Browser-only achievement" }];
  for (const html of [renderProfileLearningCompact(courses, [1], 15), renderMyLearningFull(courses, [1], 100)]) {
    assert.match(html, /Loading learning records/);
    assert.doesNotMatch(html, /Browser-only achievement|15%|100%|Completed \(1\)/);
  }
});


test("7. EnrollConfirmationModal renders course details, category/level badges, and confirmation actions", () => {
  const targetCourse = {
    id: 1,
    name: "Full-Stack Course Project",
    courseName: "Full-Stack Course Project",
    instructor: "Teacher User",
    category: "Web Development",
    courseLevel: "Intermediate",
    publicationStatus: "Published",
    lessonCount: 10,
    duration: "57m",
  };

  const modalHtml = renderEnrollConfirmationModal(targetCourse, true);

  // 1. Header with title, category, and level badge
  assert.match(modalHtml, /Confirm Course Enrollment/);
  assert.match(modalHtml, /Web Development/);
  assert.match(modalHtml, /Intermediate/);

  // 2. Body summary box with course details
  assert.match(modalHtml, /Full-Stack Course Project/);
  assert.match(modalHtml, /Teacher User/);
  assert.match(modalHtml, /10 lessons/);
  assert.match(modalHtml, /57m/);
  assert.match(
    modalHtml,
    /Are you sure you want to enroll in this course\? Your learning progress will be tracked automatically\./
  );

  // 3. Footer actions
  assert.match(modalHtml, /Cancel/);
  assert.match(modalHtml, /Confirm &amp; Start Learning/);
});

test("8. A browser enrollment cannot mark a catalog course as enrolled", () => {
  const html = renderEnrollmentsWithEnrolled([{ id: 1, name: "Local course" }], [{ id: 1, courseId: 1, courseName: "Local course", progress: 15 }]);
  assert.match(html, /Loading courses/);
  assert.doesNotMatch(html, /Continue learning|15% Complete|Confirm Course Enrollment/);
});


test("9. Browser completion data cannot populate Learning statistics", () => {
  const html = renderEnrollmentsWithEnrolled([{ id: 1, name: "Local course" }], [{ id: 1, courseId: 1, courseName: "Local course", progress: 100, status: "completed" }]);
  assert.match(html, /Not available/);
  assert.doesNotMatch(html, /100%|1 completed|1 learner enrolled/);
});
