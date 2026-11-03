import { studentScoreApi } from "@/api";
import {
  auditableFieldsSchema,
  createDynamicField,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";
import { ScoreReleaseActions } from "./ScoreReleaseActions";

const scoreColumnOrder = ["quiz1", "quiz2", "assignment", "midterm", "final"];

const scoreColumnLabels: Record<string, string> = {
  quiz1: "Quiz 1",
  quiz2: "Quiz 2",
  assignment: "Assignment",
  midterm: "Midterm",
  final: "Final",
};

const statusOptions = [
  { label: "Draft", value: "DRAFT" },
  { label: "Reviewed", value: "REVIEWED" },
  { label: "Released", value: "RELEASED" },
  { label: "Adjusted", value: "ADJUSTED" },
];

const studentScoreSchema: EntitySchema = {
  entityName: "student-score",
  idField: "id",
  fields: [
    {
      name: "studentCode",
      label: "Student Code",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "studentName",
      label: "Student Name",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "className",
      label: "Class",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    createDynamicField({
      name: "scores",
      label: "Score",
      keyOrder: scoreColumnOrder,
      keyLabelMap: scoreColumnLabels,
    }),
    {
      name: "overallScore",
      label: "Overall",
      type: "number",
      sortable: true,
      filterable: true,
      filterType: "numberRange",
      editable: false,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: statusOptions,
      sortable: true,
      filterable: true,
      filterType: "select",
      filterOptions: statusOptions,
      editable: false,
    },
    { name: "releasedAt", label: "Released At", type: "datetime", editable: false },
    { name: "approvedBy", label: "Approved By", type: "text", editable: false },
    {
      name: "adjustmentLog",
      label: "Adjustment Log",
      type: "textarea",
      editable: false,
      visible: false,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Student Score",
  path: "/student-scores",
  api: studentScoreApi,
  schema: studentScoreSchema,
  headerActions: ({ table }) => <ScoreReleaseActions table={table} />,
};
