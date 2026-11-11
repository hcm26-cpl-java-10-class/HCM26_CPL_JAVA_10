import { studentScoreApi } from "@/api";
import {
  auditableFieldsSchema,
  createDynamicField,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const scoreColumnOrder = ["quiz1", "quiz2", "assignment", "midterm", "final"];

const scoreColumnLabels: Record<string, string> = {
  quiz1: "Quiz 1",
  quiz2: "Quiz 2",
  assignment: "Assignment",
  midterm: "Midterm",
  final: "Final",
};

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
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Student Score",
  path: "/student-scores",
  api: studentScoreApi,
  schema: studentScoreSchema,
};
