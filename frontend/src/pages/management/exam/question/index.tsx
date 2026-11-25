import { questionExportApi } from "@/api/features/question-export.api";
import { QuestionCreatePage } from "./pages/QuestionCreatePage";
import { QuestionDetailPage } from "./pages/QuestionDetailPage";
import { QuestionEditPage } from "./pages/QuestionEditPage";
import QuestionListPage from "./pages/QuestionListPage";
import {
  type EntityConfig,
  type EntitySchema,
} from "@/types";

const typeOptions = [
  { label: "Multiple choice", value: "MULTIPLE_CHOICE" },
  { label: "Essay", value: "ESSAY" },
  { label: "Coding", value: "CODING" },
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
      filterType: "select",
      filterOptions: [],
    },
    {
      name: "points",
      label: "Points",
      type: "number",
      sortable: true,
    },
    {
      name: "isActive",
      label: "Status",
      type: "boolean",
      booleanLabels: {
        true: "Active",
        false: "Inactive",
        trueColor: "bg-blue-500 text-white",
        falseColor: "bg-red-500 text-white",
      },
      filterable: true,
      filterType: "boolean",
    },
    {
      name: "createdAt",
      label: "Created At",
      type: "date",
      sortable: true,
      editable: false,
      filterable: true,
      filterType: "dateRange",
    },
    {
      name: "updatedAt",
      label: "Updated At",
      type: "date",
      sortable: true,
      editable: false,
      filterable: true,
      filterType: "dateRange",
      visible: true,
    },
    {
      name: "createdBy",
      label: "Created By",
      type: "number",
      sortable: true,
      editable: false,
      filterable: true,
      filterType: "text",
      visible: false,
    },
    {
      name: "updatedBy",
      label: "Updated By",
      type: "number",
      sortable: true,
      editable: false,
      filterable: true,
      filterType: "text",
      visible: false,
    },
  ],
};

export const entityConfig: EntityConfig = {
  name: "Questions",
  path: "/questions",
  api: questionExportApi,
  schema: questionSchema,
  actionPages: {
    create: { path: "/questions/create", component: QuestionCreatePage },
    edit: { path: "/questions/:id/edit", component: QuestionEditPage },
    detail: { path: "/questions/:id/detail", component: QuestionDetailPage },
  },
};

export default QuestionListPage;
