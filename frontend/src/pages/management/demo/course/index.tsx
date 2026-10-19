import { categoryApi, courseApi, userApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import { type EntityConfig, type EntitySchema, auditableFieldsSchema, type FieldSchema } from "@/types";
import { CourseCatalogPage } from "./components/CourseCatalogPage.tsx";
import { CourseDetailPage } from "./pages/CourseDetailPage.tsx";

const courseSchema: EntitySchema = {
  entityName: "course",
  idField: "id",
  fields: [
    {
      name: "name",
      label: "Course Name",
      type: "text",
      sortable: true,
      bold: true,
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
      name: "categoryName",
      label: "Category",
      type: "text",
      sortable: false,
      editable: false,
    },
    {
      name: "categoryId",
      label: "Category",
      type: "relation",
      sortable: false,
      visible: false,
      relation: {
        api: categoryApi,
        valueField: "id",
        labelField: "name",
      },
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
    },
    {
      name: "thumbnailUrl",
      label: "Thumbnail URL",
      type: "text",
      sortable: false,
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
