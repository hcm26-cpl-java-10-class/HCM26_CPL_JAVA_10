import { courseApi, lessonApi } from "@/api";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const lessonSchema: EntitySchema = {
  entityName: "lesson",
  idField: "id",
  fields: [
    {
      name: "title",
      label: "Lesson Title",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "courseId",
      label: "Course",
      type: "relation",
      relation: {
        api: courseApi,
        valueField: "id",
        labelField: "name",
      },
      filterable: true,
      filterType: "select",
    },
    {
      name: "orderIndex",
      label: "Order",
      type: "number",
      sortable: true,
    },
    {
      name: "durationMinutes",
      label: "Duration (min)",
      type: "number",
      sortable: true,
    },
    {
      name: "videoUrl",
      label: "Video URL",
      type: "text",
      sortable: false,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      sortable: false,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Lesson",
  path: "/lessons",
  api: lessonApi,
  schema: lessonSchema,
};
