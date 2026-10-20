import { courseApi, lessonApi } from "@/api";
import { sectionApi } from "@/api/features/demo/section.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type EntityConfig, type EntitySchema, auditableFieldsSchema, type FieldSchema } from "@/types";
import { useQuery } from "@tanstack/react-query";
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
 */
export default function LessonManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
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

  const chooseCourse = (value: string) => {
    setSearchParams({ courseId: value });
  };

  const chooseSection = (value: string) => {
    setSearchParams({ courseId: String(courseId), sectionId: value });
  };

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

        {sectionId > 0 ? (
          <SectionLessons key={sectionId} sectionId={sectionId} />
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {coursesQuery.isError
              ? "Courses could not be loaded."
              : courses.length === 0 && !coursesQuery.isLoading
                ? "Create a course first."
                : courseId > 0 && sections.length === 0 && !sectionsQuery.isLoading
                  ? "This course has no sections yet. Create one in Sections."
                  : courseId > 0
                    ? "Choose a section to manage its lessons."
                    : "Choose a course, then choose one of its sections."}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
