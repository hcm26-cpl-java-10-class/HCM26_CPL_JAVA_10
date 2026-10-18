export type FieldType =
  | "text"
  | "textarea"
  | "password"
  | "number"
  | "date"
  | "datetime-local"
  | "icon"
  | "select"
  | "boolean"
  | "relation"
  | "dynamic";

export type DynamicValueFieldType = Exclude<
  FieldType,
  "dynamic" | "relation" | "select" | "icon" | "password"
>;

export interface DynamicChildMeta {
  parentField: string;
  sourceKey: string;
}

export interface DynamicFieldConfig {
  keyOrder?: string[];
  keyLabelMap?: Record<string, string>;
  labelPrefix?: boolean;
  valueType?: DynamicValueFieldType;
  parse?: (value: any, row: any) => Record<string, any>;
  resolveMeta?: (row: any) => {
    keyOrder?: string[];
    keyLabelMap?: Record<string, string>;
  };
}

export type FilterType =
  | "text"
  | "select"
  | "boolean"
  | "dateRange"
  | "numberRange";

export interface FieldSchema {
  name: string;

  label: string;

  type: FieldType;

  sortable?: boolean;

  filterable?: boolean;

  filterType?: FilterType;

  filterOptions?: { label: string; value: any }[];

  editable?: boolean;

  visible?: boolean;

  hideable?: boolean;

  width?: number;

  minWidth?: number;

  options?: { label: string; value: any }[];

  booleanLabels?: {
    true: string;
    false: string;
    trueColor?: string;
    falseColor?: string;
  };

  relation?: RelationConfig;

  dynamic?: DynamicFieldConfig;

  dynamicChild?: DynamicChildMeta;

  bold?: boolean;

  expandable?: boolean;

  renderExpanded?: (value: any, row: any) => React.ReactNode;
}

export interface EntitySchema {
  entityName: string;
  idField: string;
  fields: FieldSchema[];
}

export interface RelationConfig {
  api: any;

  valueField: string;

  labelField: string;

  multiple?: boolean;
}

export interface DynamicFieldBuilderOptions {
  name: string;
  label: string;
  keyOrder?: string[];
  keyLabelMap?: Record<string, string>;
  labelPrefix?: boolean;
  valueType?: DynamicValueFieldType;
  parse?: DynamicFieldConfig["parse"];
  resolveMeta?: DynamicFieldConfig["resolveMeta"];
  editable?: boolean;
  visible?: boolean;
  hideable?: boolean;
  width?: number;
  minWidth?: number;
}

export function createDynamicField({
  name,
  label,
  keyOrder,
  keyLabelMap,
  labelPrefix = true,
  valueType = "number",
  parse,
  resolveMeta,
  editable = false,
  visible,
  hideable,
  width,
  minWidth,
}: DynamicFieldBuilderOptions): FieldSchema {
  return {
    name,
    label,
    type: "dynamic",
    editable,
    visible,
    hideable,
    width,
    minWidth,
    dynamic: {
      keyOrder,
      keyLabelMap,
      labelPrefix,
      valueType,
      parse,
      resolveMeta,
    },
  };
}

export const auditableFieldsSchema = [
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
    visible: false,
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
];
