import type { FieldSchema } from "@/types";

export function isEmptyValue(value: any): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || String(value).trim() === "";
}

export function isFieldRequired(field: FieldSchema, isEdit: boolean): boolean {
  const v = field.validation;
  if (!v) return false;
  return !!v.required || (!!v.requiredOnCreate && !isEdit);
}

/** Validates one field and returns its error messages (empty array = valid). */
export function validateField(
  field: FieldSchema,
  value: any,
  form: Record<string, any>,
  isEdit: boolean
): string[] {
  const v = field.validation;
  if (!v) return [];

  const errors: string[] = [];
  const label = field.label;
  const empty = isEmptyValue(value);

  if (empty && isFieldRequired(field, isEdit)) {
    const pick = field.type === "relation" || field.type === "select";
    errors.push(pick ? `Please select ${label.toLowerCase()}.` : `${label} is required.`);
    return errors;
  }

  if (!empty && typeof value === "string") {
    const text = value.trim();
    if (v.minLength !== undefined && text.length < v.minLength) {
      errors.push(`${label} must be at least ${v.minLength} characters.`);
    }
    if (v.maxLength !== undefined && value.length > v.maxLength) {
      errors.push(`${label} must be at most ${v.maxLength} characters.`);
    }
    if (v.pattern && !v.pattern.test(text)) {
      errors.push(v.patternMessage ?? `${label} is not valid.`);
    }
  }

  const custom = v.validate?.(value, form, { isEdit });
  if (custom) errors.push(custom);

  return errors;
}

export function validateForm(
  fields: FieldSchema[],
  form: Record<string, any>,
  isEdit: boolean
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const field of fields) {
    const errors = validateField(field, form[field.name], form, isEdit);
    if (errors.length > 0) result[field.name] = errors;
  }
  return result;
}
