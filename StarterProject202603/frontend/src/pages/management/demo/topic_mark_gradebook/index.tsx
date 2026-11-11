import { topicMarkGradebookApi } from "@/api";
import { ProTable } from "@/components/datatable/ProTable";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { MainLayout } from "@/components/layout/MainLayout";
import { createDynamicField, type EntitySchema } from "@/types";

const gradebookSchema: EntitySchema = {
  entityName: "student-score",
  idField: "id",
  fields: [
    {
      name: "fullName",
      label: "Student",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "email",
      label: "Email",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    createDynamicField({
      name: "values",
      label: "Score",
      labelPrefix: false,
      valueType: "number",
      resolveMeta: (row: any) => row?.__dynamicMeta?.values,
      parse: (value: any) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return {};
        }

        return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
          (acc, [key, item]) => {
            if (key === "FINAL_SCORE" || key === "IS_PASSED") {
              return acc;
            }

            acc[key] = item;
            return acc;
          },
          {},
        );
      },
      editable: false,
    }),
    {
      name: "finalScore",
      label: "Final Score",
      type: "number",
      sortable: true,
      editable: false,
    },
    {
      name: "isPassed",
      label: "Passed",
      type: "boolean",
      editable: false,
      booleanLabels: {
        true: "Passed",
        false: "Failed",
        trueColor: "bg-blue-500 text-white",
        falseColor: "bg-red-500 text-white",
      },
    },
  ],
};

export default function TopicMarkGradebookDemoPage() {
  const table = useProTable(topicMarkGradebookApi, gradebookSchema, {
    permissionOverrides: {
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canImport: false,
      canExport: false,
    },
  });

  return (
    <MainLayout pathName={{ "topic-marks": "Topic Marks", "gradebook-demo": "Gradebook Demo" }}>
      <ProTable table={table} hideActions headerActions={<></>} />
    </MainLayout>
  );
}
