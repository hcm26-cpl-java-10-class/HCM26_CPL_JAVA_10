import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import type { FieldSchema } from "@/types";
import { FormFieldRenderer } from "./FormFieldRenderer";

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
  const [clientErrors, setClientErrors] = useState<Record<string, string[]>>({});

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
    setClientErrors({});
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
  }, [initial, open]);

  const updateField = (name: string, value: any) => {
    if (schema.entityName === "student" && name === "address") {
      const addressValue = String(value ?? "");
      if (addressValue.length > 500) {
        // Keep the input at 500 characters, show the validation message,
        // and prevent additional characters from being entered.
        setForm((prev) => ({ ...prev, address: addressValue.slice(0, 500) }));
        setClientErrors((prev) => ({
          ...prev,
          address: ["Địa chỉ không được vượt quá 500 ký tự."],
        }));
        return;
      }

      setForm((prev) => ({ ...prev, address: addressValue }));
      if (addressValue.length < 500) {
        setClientErrors((prev) => ({ ...prev, address: [] }));
      }
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "email") setClientErrors((prev) => ({ ...prev, email: [] }));
  };

  const handleSubmit = () => {
    if (schema.entityName === "student") {
      const errors: Record<string, string[]> = {};
      schema.fields.filter((field) => field.required).forEach((field) => {
        const value = form[field.name];
        if (value === undefined || value === null || String(value).trim() === "") {
          errors[field.name] = [`${field.label} là bắt buộc.`];
        }
      });

      const email = String(form.email ?? "").trim();
      if (email && !/^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(email)) {
        errors.email = ["Email phải có định dạng @gmail.com."];
      }

      const address = String(form.address ?? "");
      if (address.length > 500) {
        errors.address = ["Địa chỉ không được vượt quá 500 ký tự."];
      }

      if (Object.keys(errors).length > 0) {
        setClientErrors(errors);
        return;
      }
      setClientErrors({});
      onSubmit({ ...form, email });
      return;
    }

    setClientErrors({});
    onSubmit(form);
  };

  const getFieldErrors = (fieldName: string) =>
    clientErrors[fieldName]?.length ? clientErrors[fieldName] : fieldErrors[fieldName];

  const hasError = (fieldName: string) =>
    (clientErrors[fieldName]?.length ?? 0) > 0 || (fieldErrors[fieldName]?.length ?? 0) > 0;

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
      fieldErrors={getFieldErrors(field.name)}
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
