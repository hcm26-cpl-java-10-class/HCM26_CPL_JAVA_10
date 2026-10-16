import { subjectApi, studySessionApi } from "@/api";
import { StudySessionDetailPage } from "./StudySessionDetailPage";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const studySessionSchema: EntitySchema = {
  entityName: "study-session",
  idField: "id",
  fields: [
    {
      name: "subjectId",
      label: "Subject",
      type: "relation",
      relation: {
        api: subjectApi,
        valueField: "id",
        labelField: "subjectName",
      },
      sortable: true,
      filterable: true,
      filterType: "select",
    },
    {
      name: "title",
      label: "Title",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "sessionDate",
      label: "Date",
      type: "date",
      sortable: true,
      filterable: true,
      filterType: "dateRange",
    },
    {
      name: "startTime",
      label: "Start",
      type: "time",
      sortable: true,
    },
    {
      name: "endTime",
      label: "End",
      type: "time",
      sortable: true,
    },
    {
      name: "room",
      label: "Room",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "lecturer",
      label: "Lecturer",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
    },
    {
      name: "type",
      label: "Type",
      type: "select",
      sortable: true,
      filterable: true,
      filterType: "select",
      options: [
        { label: "Lecture", value: "LECTURE" },
        { label: "Lab", value: "LAB" },
        { label: "Exam", value: "EXAM" },
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
  name: "Study Session",
  path: "/study-sessions",
  api: studySessionApi,
  schema: studySessionSchema,
  actionPages: {
    detail: {
      path: "/study-sessions/:id/detail",
      component: StudySessionDetailPage,
    },
  },
};