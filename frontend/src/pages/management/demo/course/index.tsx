import { courseApi } from "@/api";
import { type EntityConfig, type EntitySchema, auditableFieldsSchema, type FieldSchema } from "@/types";

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
};
