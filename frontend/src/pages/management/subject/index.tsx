import { subjectApi } from "@/api";
import { AutoCrudPage } from "@/pages/management/AutoCrudPage";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const subjectSchema: EntitySchema = {
  entityName: "subject",
  idField: "id",
  fields: [
    {
      name: "code",
      label: "Subject Code",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "name",
      label: "Subject Name",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "version",
      label: "Version",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "technicalGroup",
      label: "Technical Group",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "durationHours",
      label: "Duration (Hours)",
      type: "number",
      sortable: true,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      sortable: true,
      filterable: true,
      filterType: "select",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
        { label: "Draft", value: "DRAFT" },
      ],
      filterOptions: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
        { label: "Draft", value: "DRAFT" },
      ],
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
  name: "Subject",
  path: "/subjects",
  api: subjectApi,
  schema: subjectSchema,
};

export default function SubjectManagementPage() {
  return <AutoCrudPage entity={entityConfig} />;
}
