import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import type { FieldSchema } from "@/types";
import { FormFieldRenderer } from "./FormFieldRenderer";
import { isFieldRequired, validateForm } from "@/utils/form-validation";

type SectionField = {
  name: string;
  fullWidth?: boolean;
};

type FormSection = {
  title: string;
  description?: string;
  fields: SectionField[];
};

type FormLayout = {
  description: string;
  maxWidthClass: string;
  sections: FormSection[];
};

const sideMenuFormLayouts: Record<string, FormLayout> = {
  module: {
    description: "Configure menu structure, navigation route, and access control.",
    maxWidthClass: "sm:max-w-2xl",
    sections: [
      {
        title: "Basic Information",
        description: "Core details for this menu entry.",
        fields: [
          { name: "title" },
          { name: "moduleGroupId" },
        ],
      },
      {
        title: "Navigation And Access",
        description: "Define route and required permission to display this menu.",
        fields: [
          { name: "url" },
          { name: "requiredPermission" },
        ],
      },
      {
        title: "Display Settings",
        description: "Control icon, order, and active status in sidebar.",
        fields: [
          { name: "icon" },
          { name: "displayOrder" },
          { name: "isActive", fullWidth: true },
        ],
      },
    ],
  },
  "module-group": {
    description: "Organize sidebar groups with clear naming and display order.",
    maxWidthClass: "sm:max-w-2xl",
    sections: [
      {
        title: "Group Information",
        description: "Main info shown in sidebar grouping.",
        fields: [
          { name: "name" },
          { name: "displayOrder" },
          { name: "description", fullWidth: true },
        ],
      },
      {
        title: "Visibility",
        description: "Enable or disable this group in navigation.",
        fields: [{ name: "isActive", fullWidth: true }],
      },
    ],
  },
};

interface FormModalProps {
  open: boolean;
  onClose: (open: boolean) => void;
  schema: any;
  onSubmit: (data: any) => void;
  initial?: any;
  title?: string;
  isSubmitting?: boolean;
  relationOptions?: Record<string, any[]>;
  fieldErrors?: Record<string, string[]>;
}

export function FormModal({
  open,
  onClose,
  schema,
  onSubmit,
  initial,
  title = "Form",
  isSubmitting = false,
  relationOptions = {},
  fieldErrors = {},
}: FormModalProps) {
  const [form, setForm] = useState<Record<string, any>>({});
  // Fields the user has typed in (live errors are shown for these) and fields changed since the
  // server last reported errors (their old server error is hidden).
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const isEdit = !!initial;

  const editableFields: FieldSchema[] = schema.fields.filter(
    (f: FieldSchema) =>
      f.editable !== false &&
      f.type !== "dynamic" &&
      !f.dynamicChild
  );
  const activeLayout = sideMenuFormLayouts[schema.entityName as string];
  const editableFieldMap = new Map(
    editableFields.map((field) => [field.name, field])
  );

  useEffect(() => {
    if (initial) {
      const next: Record<string, any> = {};

      editableFields.forEach((field) => {
        if (initial[field.name] !== undefined) {
          next[field.name] = initial[field.name];
          return;
        }

        if (field.type === "boolean") next[field.name] = false;
        else if (field.type === "relation" && field.relation?.multiple)
          next[field.name] = [];
        else if (field.type === "number") next[field.name] = "";
        else next[field.name] = "";
      });

      setForm(next);
    } else {
      const defaults: Record<string, any> = {};
      editableFields.forEach((f) => {
        if (f.type === "boolean") defaults[f.name] = false;
        else if (f.type === "relation" && f.relation?.multiple)
          defaults[f.name] = [];
        else if (f.type === "number") defaults[f.name] = "";
        else defaults[f.name] = "";
      });
      setForm(defaults);
    }
    setTouched({});
    setSubmitted(false);
  }, [initial, open]);

  // When the server reports new errors, show them again for those fields.
  const serverErrorKey = JSON.stringify(fieldErrors ?? {});
  useEffect(() => {
    const keys = Object.keys(fieldErrors ?? {});
    if (keys.length === 0) return;
    setTouched((prev) => {
      const next = { ...prev };
      keys.forEach((key) => delete next[key]);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverErrorKey]);

  // Live validation: recalculated on every keystroke.
  const clientErrors = useMemo(
    () => validateForm(editableFields, form, isEdit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, isEdit, schema]
  );

  const updateField = (name: string, value: any) => {
    const rules = editableFieldMap.get(name)?.validation;
    let next = value;

    // Limit what can be typed: filter characters first, then enforce the max length.
    if (typeof next === "string" && rules) {
      if (rules.inputFilter) next = rules.inputFilter(next);
      if (rules.maxLength !== undefined && next.length > rules.maxLength) {
        next = next.slice(0, rules.maxLength);
      }
    }

    setForm((prev) => ({ ...prev, [name]: next }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = () => {
    setSubmitted(true);

    if (Object.keys(clientErrors).length > 0) return;

    const payload: Record<string, any> = { ...form };
    editableFields.forEach((field) => {
      // Form-only fields (like "confirm password") are not sent to the server.
      // A blank password on edit means "keep the current password".
      if (field.transient || (field.type === "password" && !payload[field.name])) {
        delete payload[field.name];
      }
    });

    onSubmit(payload);
  };

  // Errors shown under a field: live client errors first, then (unchanged) server errors.
  const errorsFor = (fieldName: string): string[] => {
    const live = clientErrors[fieldName];
    if (live && live.length > 0 && (touched[fieldName] || submitted)) return live;
    if (touched[fieldName]) return [];
    return fieldErrors[fieldName] ?? [];
  };

  const hasError = (fieldName: string) => errorsFor(fieldName).length > 0;

  const renderField = (field: FieldSchema) => (
    <FormFieldRenderer
      key={field.name}
      field={field}
      value={form[field.name]}
      errorClass={
        hasError(field.name)
          ? "border-destructive focus-visible:ring-destructive"
          : ""
      }
      fieldErrors={errorsFor(field.name)}
      required={isFieldRequired(field, isEdit)}
      relationOptions={relationOptions}
      onChange={updateField}
    />
  );

  const configuredFieldNames = new Set(
    activeLayout?.sections.flatMap((section) =>
      section.fields.map((field) => field.name)
    ) ?? []
  );

  const remainingFields = editableFields.filter(
    (field) => !configuredFieldNames.has(field.name)
  );

  const resolvedTitle =
    activeLayout && (title === "Create" || title === "Edit")
      ? `${title} ${schema.entityName === "module" ? "Menu Item" : "Menu Group"}`
      : title;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className={`w-full ${activeLayout?.maxWidthClass ?? "sm:max-w-xl"}`}
      >
        <SheetHeader className="border-b">
          <SheetTitle>{resolvedTitle}</SheetTitle>
          {activeLayout?.description ? (
            <SheetDescription>{activeLayout.description}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="grid content-start auto-rows-min flex-1 gap-4 overflow-y-auto px-4 py-3">
          {activeLayout ? (
            <>
              {activeLayout.sections.map((section) => {
                const sectionFields = section.fields
                  .map((item) => ({
                    ...item,
                    schema: editableFieldMap.get(item.name),
                  }))
                  .filter((item) => !!item.schema);

                if (!sectionFields.length) {
                  return null;
                }

                return (
                  <section
                    key={section.title}
                    className="rounded-xl border bg-muted/30 p-4"
                  >
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        {section.title}
                      </h3>
                      {section.description ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          {section.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid content-start auto-rows-min gap-4 md:grid-cols-2">
                      {sectionFields.map((item) => (
                        <div
                          key={item.name}
                          className={item.fullWidth ? "md:col-span-2" : ""}
                        >
                          {renderField(item.schema as FieldSchema)}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              {remainingFields.length ? (
                <section className="rounded-xl border p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Additional Settings
                    </h3>
                  </div>

                  <div className="grid content-start auto-rows-min gap-4 md:grid-cols-2">
                    {remainingFields.map((field) => (
                      <div key={field.name}>{renderField(field)}</div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            editableFields.map((field) => renderField(field))
          )}
        </div>

        <SheetFooter className="border-t sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onClose(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
