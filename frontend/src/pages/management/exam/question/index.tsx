import { questionApi } from "@/api";
import { QuestionCreatePage } from "./pages/QuestionCreatePage";
import { QuestionDetailPage } from "./pages/QuestionDetailPage";
import { QuestionEditPage } from "./pages/QuestionEditPage";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

import { QuestionImport } from "@/components/datatable/dataio/QuestionImport";

const typeOptions = [
  { label: "Single choice", value: "SINGLE_CHOICE" },
  { label: "Multi choice", value: "MULTI_CHOICE" },
];

const difficultyOptions = [
  { label: "Easy", value: "EASY" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Hard", value: "HARD" },
];

const questionSchema: EntitySchema = {
  entityName: "question",
  idField: "id",
  fields: [
    {
      name: "content",
      label: "Content",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "type",
      label: "Type",
      type: "select",
      options: typeOptions,
      sortable: true,
      filterable: true,
      filterType: "select",
      filterOptions: typeOptions,
    },
    {
      name: "difficulty",
      label: "Difficulty",
      type: "select",
      options: difficultyOptions,
      sortable: true,
      filterable: true,
      filterType: "select",
      filterOptions: difficultyOptions,
    },
    {
      name: "topic",
      label: "Topic",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "points",
      label: "Points",
      type: "number",
      sortable: true,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

export const entityConfig: EntityConfig = {
  name: "Questions",
  path: "/questions",
  api: questionApi,
  schema: questionSchema,

  headerActions: ({ table }) => (
      <QuestionImport table={table} />
  ),

  actionPages: {
    create: { path: "/questions/create", component: QuestionCreatePage },
    edit: { path: "/questions/:id/edit", component: QuestionEditPage },
    detail: { path: "/questions/:id/detail", component: QuestionDetailPage },
  },
};
