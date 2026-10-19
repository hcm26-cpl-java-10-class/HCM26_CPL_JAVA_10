import type { FieldSchema, FieldValidation } from "@/types";

/**
 * Shared validation for ALL CRUD forms (FormModal).
 *
 * - Defaults are applied by field type, no schema config needed:
 *     text      -> max 255 characters
 *     textarea  -> max 2000 characters
 *     password  -> max 128 characters
 *     number    -> must be a valid number
 *     fields named *Url  -> must be an http/https URL, max 500 characters
 *     fields named email -> must be a valid email
 * - To add/override rules for one field: set `validation` on that field in the schema.
 * - To remove the default limit: `validation: { maxLength: null }`.
 */
export const DEFAULT_MAX_LENGTH = {
  text: 255,
  textarea: 2000,
  password: 128,
  url: 500,
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isBlank = (v: any) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const looksLikeUrlField = (name: string) => /url$/i.test(name);
const looksLikeEmailField = (name: string) => /^email$/i.test(name);

/** Effective rule of a field = type defaults + the field's own `validation`. */
export function getEffectiveRule(field: FieldSchema): FieldValidation {
  const own = field.validation ?? {};
  const isUrl = own.url ?? looksLikeUrlField(field.name);
  const isEmail = own.email ?? looksLikeEmailField(field.name);

  let defaultMax: number | undefined;
  if (field.type === "textarea") defaultMax = DEFAULT_MAX_LENGTH.textarea;
  else if (field.type === "password") defaultMax = DEFAULT_MAX_LENGTH.password;
  else if (field.type === "text") {
    defaultMax = isUrl ? DEFAULT_MAX_LENGTH.url : DEFAULT_MAX_LENGTH.text;
  }

  const maxLength =
    own.maxLength === null ? undefined : own.maxLength ?? defaultMax;

  return { ...own, url: isUrl, email: isEmail, maxLength };
}

/**
 * Returns { fieldName: [messages] }; an empty object means valid.
 */
export function validateForm(
  fields: FieldSchema[],
  form: Record<string, any>,
  ctx: { isEdit: boolean; initial?: any }
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const field of fields) {
    const rule = getEffectiveRule(field);
    const value = form[field.name];
    const messages: string[] = [];

    if (rule.required && isBlank(value)) {
      messages.push(
        rule.requiredMessage ??
          (field.type === "select" || field.type === "relation"
            ? `Please select ${field.label}`
            : `${field.label} is required`)
      );
    } else if (!isBlank(value)) {
      if (field.type === "number") {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          messages.push(`${field.label} must be a valid number`);
        } else {
          if (rule.min !== undefined && n < rule.min) {
            messages.push(`${field.label} must be at least ${rule.min}`);
          }
          if (rule.max !== undefined && n > rule.max) {
            messages.push(`${field.label} must be at most ${rule.max}`);
          }
        }
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (rule.minLength !== undefined && trimmed.length < rule.minLength) {
          messages.push(`${field.label} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          messages.push(`${field.label} must be at most ${rule.maxLength} characters`);
        }
        if (rule.url && !isHttpUrl(trimmed)) {
          messages.push("Invalid URL (must start with http:// or https://)");
        }
        if (rule.email && !EMAIL_REGEX.test(trimmed)) {
          messages.push("Invalid email address");
        }
        if (rule.pattern && !rule.pattern.regex.test(trimmed)) {
          messages.push(rule.pattern.message);
        }
      }
    }

    const custom = rule.custom?.(value, form, ctx);
    if (custom) messages.push(custom);

    if (messages.length) errors[field.name] = messages;
  }

  return errors;
}