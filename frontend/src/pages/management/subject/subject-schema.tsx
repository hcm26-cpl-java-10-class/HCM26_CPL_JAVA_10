import { Input } from "@/components/ui/input";
import { auditableFieldsSchema, type EntitySchema, type FieldSchema } from "@/types";
import { TechnicalGroupSelect } from "./TechnicalGroupSelect";

export const subjectSchema: EntitySchema = {
  entityName: "subject",
  idField: "id",
  fields: [
    {
      name: "code",
      label: "Code",
      type: "text",
      sortable: true,
      filterable: true,
      filterType: "text",
      bold: true,
    },
    {
      name: "name",
      label: "Name",
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
      type: "select",
      renderInput: (props) => <TechnicalGroupSelect {...props} />,
      sortable: true,
      filterable: true,
      filterType: "select",
      filterOptions: [],
    },
    {
      name: "durationHours",
      label: "Hours",
      type: "number",
      renderInput: ({ id, value, onChange, invalid }) => (
        <Input
          id={id}
          type="number"
          min={0.000000001}
          step="any"
          value={value ?? ""}
          aria-invalid={invalid}
          className={invalid ? "border-destructive focus-visible:ring-destructive" : ""}
          placeholder="Enter hours..."
          onKeyDown={(event) => {
            if (event.key === "-") event.preventDefault();
          }}
          onPaste={(event) => {
            const pasted = Number(event.clipboardData.getData("text"));
            if (!Number.isFinite(pasted) || pasted <= 0 || pasted > 2147483647) event.preventDefault();
          }}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") onChange("");
            else if (Number.isFinite(Number(raw)) && Number(raw) >= 0 && Number(raw) <= 2147483647) onChange(Number(raw));
          }}
        />
      ),
      sortable: true,
      filterable: true,
      filterType: "numberRange",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      maxWords: 500,
      sortable: false,
    },
    { name: "objectives", label: "Objectives", type: "textarea", visible: false },
    { name: "skills", label: "Skills", type: "textarea", visible: false },
    { name: "deliveryMode", label: "Delivery Mode", type: "select", visible: false,
      options: [{label: "Online", value: "ONLINE"}, {label: "Offline", value: "OFFLINE"}, {label: "Hybrid", value: "HYBRID"}] },
    { name: "outline", label: "Outline", type: "textarea", visible: false },
    {
      name: "isActive",
      label: "Status",
      type: "boolean",
      sortable: true,
      filterable: true,
      filterType: "boolean",
      booleanLabels: {
        true: "Active",
        false: "Inactive",
        trueColor: "green",
        falseColor: "gray",
      },
    },
    ...((auditableFieldsSchema as FieldSchema[]).filter((f) => f.name !== "isActive")),
  ],
};
