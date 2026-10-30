import { categoryApi, courseApi, userApi } from "@/api";
import { courseSyllabusOptionsApi } from "@/api/features/demo/course.api";
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
      name: "syllabusId",
      label: "Syllabus",
      hint: "Optional. Search by code or name; only Published and Active syllabuses are available.",
      type: "relation",
      visible: false,
      sortable: false,
      relation: {
        api: courseSyllabusOptionsApi,
        valueField: "id",
        labelField: "name",
        searchable: true,
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
  const { activeRole } = usePermissions();

  if (activeRole?.toUpperCase() !== "STUDENT") {
    return <AutoCrudPage entity={entityConfig} />;
  }

  return <CourseCatalogPage />;
}