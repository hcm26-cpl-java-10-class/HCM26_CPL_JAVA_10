import { courseApi, lessonApi } from "@/api";
import { sectionApi } from "@/api/features/demo/section.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { type EntityConfig, type EntitySchema, auditableFieldsSchema, type FieldSchema } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SectionLessons } from "./components/SectionLessons";

const lessonSchema: EntitySchema = {
  entityName: "lesson",
  idField: "id",
  fields: [
    { name: "title", label: "Title", type: "text", sortable: true, bold: true },
    {
      name: "contentType",
      label: "Content Type",
      type: "select",
      sortable: true,
      options: [
        { label: "Video", value: "VIDEO" },
        { label: "Text", value: "TEXT" },
        { label: "Document", value: "DOCUMENT" },
        { label: "Link", value: "LINK" },
      ],
    },
    { name: "contentUrl", label: "Content URL", type: "text", sortable: false },
    { name: "textContent", label: "Text Content", type: "textarea", sortable: false, visible: false },
    { name: "duration", label: "Duration (s)", type: "number", sortable: true },
    { name: "orderIndex", label: "Order", type: "number", sortable: true },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

// build-router.ts tự đăng ký route "/lessons" từ entityConfig này
export const entityConfig: EntityConfig = {
  name: "Lesson",
  path: "/lessons",
  api: lessonApi,
  schema: lessonSchema,
};

/**
 * Manage lessons by choosing an existing course and one of its sections.
 * Khi vào trang sẽ tự chọn course đầu tiên và section đầu tiên để nút
 * "Add lesson" xuất hiện ngay (nút nằm trong SectionLessons).
 */
export default function LessonManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("LESSON_CREATE");
  const courseId = Number(searchParams.get("courseId")) || 0;
  const sectionId = Number(searchParams.get("sectionId")) || 0;

  const coursesQuery = useQuery({
    queryKey: ["lesson-course-options"],
    queryFn: () => courseApi.getPage({ page: 0, size: 100, sort: "name,asc" }),
  });
  const courses = coursesQuery.data?.content ?? coursesQuery.data?.items ?? [];

  const sectionsQuery = useQuery({
    queryKey: ["lesson-section-options", courseId],
    queryFn: () => sectionApi.getByCourse(courseId),
    enabled: courseId > 0,
  });
  const sections = sectionsQuery.data?.content ?? sectionsQuery.data?.items ?? [];

  const firstCourseId = courses.find((course) => course.id)?.id;
  const firstSectionId = sections.find((section) => section.id)?.id;

  // Tự chọn course đầu tiên khi chưa chọn gì
  useEffect(() => {
    if (courseId === 0 && coursesQuery.isSuccess && firstCourseId) {
      setSearchParams({ courseId: String(firstCourseId) }, { replace: true });
    }
  }, [courseId, coursesQuery.isSuccess, firstCourseId, setSearchParams]);

  // Tự chọn section đầu tiên của course đang chọn
  useEffect(() => {
    if (courseId > 0 && sectionId === 0 && sectionsQuery.isSuccess && firstSectionId) {
      setSearchParams(
        { courseId: String(courseId), sectionId: String(firstSectionId) },
        { replace: true },
      );
    }
  }, [courseId, sectionId, sectionsQuery.isSuccess, firstSectionId, setSearchParams]);

  const chooseCourse = (value: string) => {
    setSearchParams({ courseId: value });
  };

  const chooseSection = (value: string) => {
    setSearchParams({ courseId: String(courseId), sectionId: value });
  };

  const emptyMessage = coursesQuery.isError
    ? "Courses could not be loaded."
    : courses.length === 0 && !coursesQuery.isLoading
      ? "Create a course first."
      : courseId > 0 && sections.length === 0 && !sectionsQuery.isLoading
        ? "This course has no sections yet. Create one in Sections."
        : courseId > 0
          ? "Choose a section to manage its lessons."
          : "Choose a course, then choose one of its sections.";

  return (
    <MainLayout pathName={{ lessons: "Lessons" }}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Course</Label>
            <Select value={courseId ? String(courseId) : undefined} onValueChange={chooseCourse}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={coursesQuery.isLoading ? "Loading courses..." : "Choose a course"} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => course.id && (
                  <SelectItem key={course.id} value={String(course.id)}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Section</Label>
            <Select
              value={sectionId ? String(sectionId) : undefined}
              onValueChange={chooseSection}
              disabled={!courseId || sectionsQuery.isLoading || sections.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={sectionsQuery.isLoading ? "Loading sections..." : "Choose a section"} />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => section.id && (
                  <SelectItem key={section.id} value={String(section.id)}>
                    {section.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!canCreate && (
          <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Your account does not have the <code>LESSON_CREATE</code> permission, so the
            "Add lesson" button is hidden. If you are an admin or teacher, log out and log in
            again to refresh your permissions.
          </p>
        )}

        {sectionId > 0 ? (
          <SectionLessons key={sectionId} sectionId={sectionId} />
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Lessons</h2>
                <p className="text-sm text-muted-foreground">No section selected</p>
              </div>
              {canCreate && (
                <Button disabled>
                  <Plus className="size-4" /> Add lesson
                </Button>
              )}
            </div>
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          </section>
        )}
      </div>
    </MainLayout>
  );
}
