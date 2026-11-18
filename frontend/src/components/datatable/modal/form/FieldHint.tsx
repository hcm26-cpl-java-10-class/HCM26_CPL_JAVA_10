import type { FieldSchema } from "@/types";
import type { getEffectiveRule } from "./validateForm";

interface FieldHintProps {
  field: FieldSchema;
  rule: ReturnType<typeof getEffectiveRule>;
}

/** Dòng gợi ý dưới ô nhập: giá trị cần nhập + các giới hạn lấy từ rule validation. */
export function buildHintParts(field: FieldSchema, rule: FieldHintProps["rule"]): string[] {
  const parts: string[] = [];
  if (field.hint) parts.push(field.hint);

  const isChoice = field.type === "select" || field.type === "relation";
  parts.push(rule.required ? (isChoice ? "Required – please select" : "Required") : "Optional");

  if (field.type === "number") {
    if (rule.min !== undefined && rule.max !== undefined) parts.push(`${rule.min} – ${rule.max}`);
    else if (rule.min !== undefined) parts.push(`min ${rule.min}`);
    else if (rule.max !== undefined) parts.push(`max ${rule.max}`);
  }

  if (field.type === "text" || field.type === "textarea" || field.type === "password") {
    if (rule.minLength !== undefined) parts.push(`min ${rule.minLength} characters`);
    // textarea đã có bộ đếm ký tự
    if (rule.maxLength !== undefined && field.type !== "textarea") {
      parts.push(`max ${rule.maxLength} characters`);
    }
    if (rule.url) parts.push("must start with http:// or https://");
    if (rule.email) parts.push("valid email, e.g. name@example.com");
  }

  return parts;
}

export function FieldHint({ field, rule }: FieldHintProps) {
  const parts = buildHintParts(field, rule);
  if (parts.length === 0) return null;
  return <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>;
}