import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { iconMap } from "@/components/datatable/iconMap";
import type { FieldSchema } from "@/types";
import { FieldError } from "./FieldError";
import { MultiRelationSelect } from "./MultiRelationSelect";
import { PasswordRules } from "./PasswordRules";
import type { CSSProperties } from "react";

interface FormFieldRendererProps {
  field: FieldSchema;
  value: any;
  errorClass: string;
  fieldErrors?: string[];
  relationOptions?: Record<string, any[]>;
  /** Shows a red * next to the label. */
  required?: boolean;
  onChange: (name: string, value: any) => void;
}

function RequiredMark({ show }: { show?: boolean }) {
  return show ? <span className="ml-0.5 text-destructive">*</span> : null;
}

/** Small helper text / character counter under an input. */
function FieldMeta({
  hint,
  hasError,
  length,
  maxLength,
}: {
  hint?: string;
  hasError: boolean;
  length: number;
  maxLength?: number;
}) {
  const showCounter = maxLength !== undefined && length > 0;
  if ((!hint || hasError) && !showCounter) return null;

  return (
    <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
      <span>{!hasError ? hint : null}</span>
      {showCounter ? (
        <span className={length >= (maxLength as number) ? "text-amber-600" : ""}>
          {length}/{maxLength}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Render input phù hợp cho từng loại field trong form.
 */
export function FormFieldRenderer({
  field,
  value,
  errorClass,
  fieldErrors,
  relationOptions = {},
  required = false,
  onChange,
}: FormFieldRendererProps) {
  const rules = field.validation;
  const hasError = !!fieldErrors && fieldErrors.length > 0;
  const textValue = typeof value === "string" ? value : "";
  const placeholder =
    rules?.placeholder ?? `Enter ${field.label.toLowerCase()}...`;

  switch (field.type) {
    case "boolean":
      return (
        <div className="flex items-center justify-between gap-4 py-1">
          <Label htmlFor={field.name} className="flex-1">
            {field.label}
          </Label>
          <Switch
            id={field.name}
            checked={!!value}
            onCheckedChange={(checked) => onChange(field.name, checked)}
          />
        </div>
      );

    case "dynamic":
      return null;

    case "icon":
    case "select":
      const isIconField = field.type === "icon" || field.name === "icon";
      const options = field.options || [];
      const selectedOption = options.find(
        (opt) => opt.value?.toString() === value?.toString()
      );

      const selectedIconKey = selectedOption?.value?.toString();
      const SelectedIcon =
        isIconField && selectedIconKey && selectedIconKey in iconMap
          ? iconMap[selectedIconKey as keyof typeof iconMap]
          : null;

      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>
            {field.label}
            <RequiredMark show={required} />
          </Label>
          <Select
            value={value?.toString() || ""}
            onValueChange={(val) => onChange(field.name, val)}
          >
            <SelectTrigger className={errorClass}>
              <SelectValue
                placeholder={`Select ${field.label.toLowerCase()}...`}
              >
                {selectedOption ? (
                  <div className="flex items-center gap-2">
                    {SelectedIcon ? <SelectedIcon className="h-4 w-4" /> : null}
                    <span>{selectedOption.label}</span>
                  </div>
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => {
                const optionIconKey = opt.value?.toString();
                const OptionIcon =
                  isIconField && optionIconKey && optionIconKey in iconMap
                    ? iconMap[optionIconKey as keyof typeof iconMap]
                    : null;

                return (
                  <SelectItem key={opt.value} value={opt.value?.toString()}>
                    <div className="flex items-center gap-2">
                      {OptionIcon ? <OptionIcon className="h-4 w-4" /> : null}
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <FieldError errors={fieldErrors} />
        </div>
      );

    case "relation": {
      const rel = field.relation;
      if (!rel) return null;
      const items: any[] = relationOptions[field.name] ?? [];

      if (rel.multiple) {
        return (
          <MultiRelationSelect
            field={field}
            rel={rel}
            items={items}
            value={value}
            errorClass={errorClass}
            onChange={(val) => onChange(field.name, val)}
            fieldErrors={fieldErrors}
          />
        );
      }

      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>
            {field.label}
            <RequiredMark show={required} />
          </Label>
          <Select
            value={value?.toString() || ""}
            onValueChange={(val) => onChange(field.name, val)}
          >
            <SelectTrigger className={errorClass}>
              <SelectValue
                placeholder={`Select ${field.label.toLowerCase()}...`}
              />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem
                  key={item[rel.valueField]}
                  value={item[rel.valueField]?.toString()}
                >
                  {item[rel.labelField]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={fieldErrors} />
        </div>
      );
    }

    case "number":
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>
            {field.label}
            <RequiredMark show={required} />
          </Label>
          <Input
            id={field.name}
            type="number"
            className={errorClass}
            value={value ?? ""}
            onChange={(e) =>
              onChange(
                field.name,
                e.target.value === "" ? "" : Number(e.target.value)
              )
            }
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
          <FieldError errors={fieldErrors} />
        </div>
      );

    case "date":
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>
            {field.label}
            <RequiredMark show={required} />
          </Label>
          <Input
            id={field.name}
            type="date"
            className={errorClass}
            value={value || ""}
            onChange={(e) => onChange(field.name, e.target.value)}
          />
          <FieldError errors={fieldErrors} />
        </div>
      );

      case "datetime":
          return (
              <div className="grid gap-2">
                  <Label htmlFor={field.name}>
            {field.label}
            <RequiredMark show={required} />
          </Label>
                  <Input
                      id={field.name}
                      type="datetime-local"
                      className={errorClass}
                      value={value || ""}
                      onChange={(e) => onChange(field.name, e.target.value)}
                  />
                  <FieldError errors={fieldErrors} />
              </div>
          );

    case "password":
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>
            {field.label}
            <RequiredMark show={required} />
          </Label>
          <Input
            id={field.name}
            type="password"
            className={errorClass}
            value={textValue}
            maxLength={rules?.maxLength}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={placeholder}
            autoComplete="new-password"
          />
          <FieldError errors={fieldErrors} />
          {rules?.passwordRules && (textValue.length > 0 || required) ? (
            <PasswordRules value={textValue} />
          ) : null}
          <FieldMeta
            hint={rules?.hint}
            hasError={hasError}
            length={0}
            maxLength={undefined}
          />
        </div>
      );

    case "textarea":
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>
            {field.label}
            <RequiredMark show={required} />
          </Label>
          <Textarea
            id={field.name}
            // Fixed height: long text scrolls inside the box instead of growing it.
            className={`${errorClass} h-28 resize-none overflow-y-auto`}
            style={{ fieldSizing: "fixed" } as CSSProperties}
            value={textValue}
            maxLength={rules?.maxLength}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={placeholder}
            rows={4}
          />
          <FieldError errors={fieldErrors} />
          <FieldMeta
            hint={rules?.hint}
            hasError={hasError}
            length={textValue.length}
            maxLength={rules?.maxLength}
          />
        </div>
      );

    case "text":
    default:
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>
            {field.label}
            <RequiredMark show={required} />
          </Label>
          <Input
            id={field.name}
            className={errorClass}
            value={textValue}
            maxLength={rules?.maxLength}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={placeholder}
          />
          <FieldError errors={fieldErrors} />
          <FieldMeta
            hint={rules?.hint}
            hasError={hasError}
            length={textValue.length}
            maxLength={rules?.maxLength}
          />
        </div>
      );
  }
}
