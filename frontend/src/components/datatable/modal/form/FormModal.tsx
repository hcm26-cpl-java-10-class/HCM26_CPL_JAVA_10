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

const resolveDefaultValue = (field: FieldSchema) => {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "boolean") return false;
  if (field.type === "relation" && field.relation?.multiple) return [];
  if (field.type === "number") return "";
  return "";
};

const EMPTY_FIELD_ERRORS: Record<string, string[]> = {};

/** Field dạng chọn/bật tắt: validate ngay khi đổi giá trị (blur của Radix Select không đáng tin). */
const CHOICE_TYPES = new Set(["select", "icon", "relation", "boolean"]);

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
  fieldErrors,
}: FormModalProps) {
  const serverErrors = fieldErrors ?? EMPTY_FIELD_ERRORS;

  const [form, setForm] = useState<Record<string, any>>({});
  const [clientErrors, setClientErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  /**
   * Server-side errors (422 / 404 / 409) that the user already reacted to: once
   * a field is edited again the stale highlight is dropped, so a Milestone that
   * was rejected as "no longer existing" stops being red as soon as another one
   * is picked - while the rest of the form is preserved.
   */
  const [touchedServerErrorFields, setTouchedServerErrorFields] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    setTouchedServerErrorFields(new Set());
  }, [serverErrors]);

  /** `initial` is only given when an existing record is edited. */
  const isEditMode = Boolean(initial);

  const editableFields: FieldSchema[] = schema.fields.filter(
    (f: FieldSchema) =>
      f.editable !== false &&
      f.type !== "dynamic" &&
      !f.dynamicChild &&
      !(isEditMode ? f.hideOnEdit : f.hideOnCreate)
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

        next[field.name] = resolveDefaultValue(field);
      });

      setForm(next);
    } else {
      const defaults: Record<string, any> = {};
      editableFields.forEach((f) => {
        defaults[f.name] = resolveDefaultValue(f);
      });
      setForm(defaults);
    }
    setClientErrors({});
    setTouched({});
  }, [initial, open]);

  const validateForm = (
    values: Record<string, any>,
    fields: FieldSchema[] = editableFields,
  ) => {
    const errors: Record<string, string[]> = {};

    fields.forEach((field) => {
      const value = values[field.name];
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === "string" && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);

      if (field.required && isEmpty) {
        errors[field.name] = [
          field.requiredMessage ?? `${field.label} là bắt buộc`,
        ];
        return;
      }

      if (!isEmpty && typeof value === "string") {
        if (field.minLength && value.trim().length < field.minLength) {
          errors[field.name] = [
            `${field.label} phải có ít nhất ${field.minLength} ký tự`,
          ];
        }

        if (field.maxLength && value.length > field.maxLength) {
          errors[field.name] = [
            field.maxLengthMessage ??
              `${field.label} không vượt quá ${field.maxLength} ký tự`,
          ];
        }
      }
    });

    const crossFieldErrors: Record<string, string[]> =
      (schema.validate?.(values) as Record<string, string[]> | undefined) ?? {};

    Object.entries(crossFieldErrors).forEach(([fieldName, messages]) => {
      if (messages && messages.length) {
        errors[fieldName] = messages;
      }
    });

    return errors;
  };

  /** Validate đúng 1 field với state form mới nhất, cập nhật lỗi của field đó. */
  const validateSingleField = (name: string, nextForm: Record<string, any>) => {
    const field = editableFieldMap.get(name);
    if (!field) return;
    const errors = validateForm(nextForm, [field]);
    setClientErrors((prev) => {
      const { [name]: _removed, ...rest } = prev;
      return errors[name] ? { ...rest, [name]: errors[name] } : rest;
    });
  };

  const updateField = (name: string, value: any) => {
    const nextForm = { ...form, [name]: value };
    setForm(nextForm);
    setTouchedServerErrorFields((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });

    const field = editableFieldMap.get(name);
    const isChoice = !!field && CHOICE_TYPES.has(field.type);

    if (isChoice || touched[name]) {
      // Đã rời field hoặc là ô chọn: báo lỗi/xoá lỗi ngay khi giá trị đổi
      validateSingleField(name, nextForm);
    } else {
      setClientErrors((prev) => {
        if (!prev[name]) return prev;
        const { [name]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  /** Rời khỏi ô nhập (Tab, click ra ngoài...) -> báo lỗi luôn. */
  const handleFieldBlur = (field: FieldSchema) => {
    if (CHOICE_TYPES.has(field.type)) return;
    setTouched((prev) => (prev[field.name] ? prev : { ...prev, [field.name]: true }));
    validateSingleField(field.name, form);
  };

  const mergedErrors: Record<string, string[]> = { ...serverErrors, ...clientErrors };

  touchedServerErrorFields.forEach((fieldName) => {
    if (!clientErrors[fieldName]) {
      delete mergedErrors[fieldName];
    }
  });

  const handleSubmit = () => {
    if (schema.entityName === "student") {
      const errors: Record<string, string[]> = {};
      schema.fields.filter((field: FieldSchema) => field.required).forEach((field: FieldSchema) => {
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
      if (address.length > 1000) {
        errors.address = ["Địa chỉ không được vượt quá 1000 ký tự."];
      }

      if (Object.keys(errors).length > 0) {
        setClientErrors(errors);
        return;
      }
      setClientErrors({});
      onSubmit({ ...form, email });
      return;
    }

    const errors = validateForm(form);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSubmit(form);
  };

  const getFieldErrors = (fieldName: string) => mergedErrors[fieldName];

  const hasError = (fieldName: string) =>
    Boolean(mergedErrors[fieldName]?.length);

  /**
   * A field can offer different option lists while creating / editing (e.g. a
   * status that is fixed on create). The current value is kept in the list so a
   * record whose stored value is no longer selectable still displays it.
   */
  const resolveFieldOptions = (field: FieldSchema) => {
    const modeOptions = isEditMode ? field.editOptions : field.createOptions;

    if (!modeOptions) {
      return null;
    }

    const currentOption = (field.options ?? []).find(
      (option) => String(option.value) === String(form[field.name]),
    );

    if (
      currentOption &&
      !modeOptions.some(
        (option) => String(option.value) === String(currentOption.value),
      )
    ) {
      return [currentOption, ...modeOptions];
    }

    return modeOptions;
  };

  const renderField = (field: FieldSchema) => {
    const modeOptions = resolveFieldOptions(field);
    const resolvedField = modeOptions ? { ...field, options: modeOptions } : field;

    return (
      <div key={field.name} onBlur={() => handleFieldBlur(field)}>
        <FormFieldRenderer
          field={resolvedField}
          value={form[field.name]}
          errorClass={
            hasError(field.name)
              ? "border-destructive focus-visible:ring-destructive"
              : ""
          }
          fieldErrors={getFieldErrors(field.name)}
          relationOptions={relationOptions}
          initial={initial}
          onChange={updateField}
        />
      </div>
    );
  };

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