import { subjectApi, studySessionApi } from "@/api";
import { StudySessionDetailPage } from "./StudySessionDetailPage";
import { validateStudySession } from "./validation";
import {
  auditableFieldsSchema,
  type EntityConfig,
  type EntitySchema,
  type FieldSchema,
} from "@/types";

const studySessionSchema: EntitySchema = {
  entityName: "study-session",
  idField: "id",
  validateForm: validateStudySession,
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
      name: "status",
      label: "Status",
      type: "select",
      editable: false,
      sortable: true,
      filterable: true,
      filterType: "select",
      options: [
        { label: "Scheduled", value: "SCHEDULED" },
        { label: "Completed", value: "COMPLETED" },
        { label: "Cancelled", value: "CANCELLED" },
      ],
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      maxLength: 500,
      showCharacterCount: true,
      sortable: false,
    },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

import { StudySessionStatisticsPanel } from "./StudySessionStatisticsPanel";

export const entityConfig: EntityConfig = {
  name: "Study Session",
  path: "/study-sessions",
  api: studySessionApi,
  schema: studySessionSchema,
  listHeader: StudySessionStatisticsPanel,
  actionPages: {
    detail: {
      path: "/study-sessions/:id/detail",
      component: StudySessionDetailPage,
    },
  },
};
