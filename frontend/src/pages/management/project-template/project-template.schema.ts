import type { EntitySchema } from "@/types";
import { templateLevelOptions, templateStatusOptions } from "./project-template.utils";

export const projectTemplateSchema: EntitySchema = {
  entityName: "project-template",
  idField: "id",
  fields: [
    { name: "code", label: "Code", type: "text", sortable: true, width: 130 },
    { name: "name", label: "Template name", type: "text", sortable: true, hideable: false, width: 220, minWidth: 180 },
    {
      name: "status", label: "Status", type: "select", sortable: true, width: 110,
      filterable: true, filterType: "select", filterMultiple: false,
      options: [...templateStatusOptions], filterOptions: [...templateStatusOptions],
    },
    { name: "category", label: "Category", type: "text", sortable: true, width: 130 },
    {
      name: "level", label: "Level", type: "select", sortable: true, width: 120,
      filterable: true, filterType: "select", filterMultiple: false,
      options: [...templateLevelOptions], filterOptions: [...templateLevelOptions],
    },
    { name: "estimatedDurationWeeks", label: "Duration", type: "number", sortable: true, width: 120 },
    { name: "templateVersion", label: "Version", type: "number", sortable: true, width: 100 },
    { name: "updatedAt", label: "Updated at", type: "date", sortable: true, visible: false, width: 180 },
  ],
};
