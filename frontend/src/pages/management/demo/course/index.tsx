import { categoryApi, courseApi, userApi } from "@/api";
import { syllabusApi } from "@/api/features/demo/syllabus.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { CourseDTO } from "@/types/features/demo/course";
import { usePermissions } from "@/hooks/usePermissions";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import {
  type CourseStatus,
  type EntityConfig,
  type EntitySchema,
  auditableFieldsSchema,
  type FieldSchema,
} from "@/types";
import { CourseCatalogPage } from "./components/CourseCatalogPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";

const courseStatusOptions: { label: string; value: CourseStatus }[] = [
  { label: "Draft (hidden from students)", value: "DRAFT" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Archived", value: "ARCHIVED" },
];

const courseSchema: EntitySchema = {
  entityName: "course",
  idField: "id",
  fields: [
    {
      name: "courseType",
      label: "Course type",
      type: "select",
      editable: false,
      sortable: true,
      filterable: true,
      options: [
        { label: "Standard course", value: "STANDARD" },
        { label: "From Syllabus", value: "FROM_SYLLABUS" },
      ],
    },
    {
      name: "name",
      label: "Course Name",
      hint: "Unique course title, e.g. Java Programming Basics",
      type: "text",
      sortable: true,
      bold: true,
      validation: {
        required: true,
        requiredMessage: "Course name is required",
        maxLength: 150, // khớp CourseDTO @Size(max = 150)
      },
    },
    {
      name: "instructor",
      label: "Instructor",
      type: "text",
      sortable: true,
      editable: false,
    },
    {
      name: "instructorId",
      label: "Instructor (User)",
      hint: "Pick the teacher account that owns this course",
      type: "relation",
      sortable: false,
      visible: false,
      relation: {
        api: userApi,
        valueField: "id",
        labelField: "email",
      },
    },
    {
      name: "categoryIds",
      label: "Categories",
      hint: "Choose one or more active categories",
      type: "relation",
      relation: {
        api: categoryApi,
        valueField: "id",
        labelField: "name",
        multiple: true,
      },
    },
    {
      name: "status",
      label: "Publication status",
      hint: "New courses must start as Draft; publish after adding sections and lessons",
      type: "select",
      sortable: true,
      options: courseStatusOptions,
      validation: {
        // Backend (CourseServiceImpl.beforeCreate) từ chối tạo mới với status PUBLISHED.
        // Khi sửa sang PUBLISHED, backend sẽ kiểm tra giáo trình (>=1 section, mỗi section >=1 lesson).
        custom: (value, _form, { isEdit }) =>
          !isEdit && value === "PUBLISHED"
            ? "A new course has no sections or lessons yet. Save it as Draft, add content, then publish."
            : null,
      },
    },
    {
      name: "level",
      label: "Course level",
      hint: "Difficulty of the course",
      type: "select",
      sortable: true,
      filterable: true,
      options: [
        { label: "Beginner", value: "BEGINNER" },
        { label: "Intermediate", value: "INTERMEDIATE" },
        { label: "Advanced", value: "ADVANCED" },
      ],
    },
    {
      name: "description",
      label: "Description",
      hint: "Short summary shown to students",
      type: "textarea",
      sortable: false,
      validation: { maxLength: 500 }, // khớp CourseDTO @Size(max = 500)
    },
    {
      name: "thumbnailUrl",
      label: "Thumbnail URL",
      hint: "Link to the cover image, e.g. https://example.com/cover.jpg",
      type: "text",
      sortable: false,
      validation: { url: true, maxLength: 255 }, // khớp CourseDTO @Size(max = 255)
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Course",
  path: "/courses",
  api: courseApi,
  schema: courseSchema,
  actionPages: {
    // /courses/:id — chi tiết khóa học (giáo trình, nút Ghi danh / Tiếp tục học)
    detail: {
      path: "/courses/:id",
      component: CourseDetailPage,
      requiredPermission: "COURSE_READ",
    },
  },
};

export default function CourseManagementPage() {
  const { activeRole, hasPermission } = usePermissions();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const canCreateFromSyllabus = [
    "SYLLABUS_READ", "COURSE_CREATE", "SECTION_CREATE", "LESSON_CREATE",
  ].every(hasPermission);
  const requested = params.has("fromSyllabus");
  const syllabusId = Number(params.get("fromSyllabus"));
  const validId = requested && Number.isSafeInteger(syllabusId) && syllabusId > 0;
  const student = activeRole?.toUpperCase() === "STUDENT";

  const syllabusQuery = useQuery({
    queryKey: ["course-create-from-syllabus", syllabusId],
    queryFn: () => syllabusApi.get(syllabusId),
    enabled: validId && !student && canCreateFromSyllabus,
  });
  const syllabus = syllabusQuery.data;
  const selectable = syllabus?.status === "PUBLISHED" && syllabus.isActive;

  const prefilledEntity = useMemo<EntityConfig>(() => {
    if (!selectable || !syllabus) return entityConfig;
    const name = `${syllabus.name} - Class 01`.slice(0, 150);
    const description = (syllabus.description ?? "").slice(0, 500);

    return {
      ...entityConfig,
      api: {
        ...courseApi,
        create: async (data: CourseDTO) => {
          const created = await courseApi.createFromSyllabus({
            ...data, syllabusId: syllabus.id, status: "DRAFT",
          });
          navigate(`/curriculum?courseId=${created.id}`);
          return created;
        },
      },
      schema: {
        ...courseSchema,
        fields: courseSchema.fields.map((field) => {
          if (field.name === "name") return { ...field, defaultValue: name };
          if (field.name === "description") return { ...field, defaultValue: description };
          if (field.name === "status") {
            return {
              ...field,
              defaultValue: "DRAFT",
              createOptions: [
                { label: "Draft (hidden from students)", value: "DRAFT" },
              ],
            };
          }
          return field;
        }),
      },
    };
  }, [selectable, syllabus, navigate]);

  if (student) return <CourseCatalogPage />;
  if (!requested) return <AutoCrudPage entity={entityConfig} />;

  let message = "";
  if (!validId) message = "Invalid Syllabus ID.";
  else if (!canCreateFromSyllabus)
    message = "Creating a course from Syllabus requires Syllabus read and Course, Section, Lesson create permissions.";
  else if (syllabusQuery.isPending) message = "Loading Syllabus...";
  else if (syllabusQuery.isError || !syllabus)
    message = "Cannot load this Syllabus.";
  else if (!selectable)
    message = "Publish and activate this Syllabus before creating a Course.";

  if (message) {
    return (
      <MainLayout pathName={{ courses: "Courses" }}>
        <div className="space-y-4 rounded-xl border bg-card p-6">
          <p>{message}</p>
          <Link className="text-sm underline" to="/courses">Back to Courses</Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <AutoCrudPage
      key={syllabusId}
      entity={prefilledEntity}
      openCreateOnMount
      createNotice={`Create a Draft Course from ${syllabus?.code} - ${syllabus?.name}. Sections and Topics become editable Sections and Lessons. Add lesson content in Curriculum before publishing.`}
    />
  );
}