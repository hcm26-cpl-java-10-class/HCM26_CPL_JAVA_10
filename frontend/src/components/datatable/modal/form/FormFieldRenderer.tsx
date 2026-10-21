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

function validIntegerInput(text: string, field: FieldSchema) {
  if (!/^\d+$/.test(text)) return false;
  if (field.max !== undefined && text.length > String(field.max).length) return false;
  const number = Number(text);
  return Number.isSafeInteger(number)
    && (field.min === undefined || number >= field.min)
    && (field.max === undefined || number <= field.max);
}

function FieldHint({ field, value }: { field: FieldSchema; value: unknown }) {
  if (field.maxLength === undefined && !field.helpText) return null;
  return <div id={`${field.name}-hint`} className="flex justify-between gap-3 text-xs text-muted-foreground">
    <span>{field.helpText}</span>
    {field.maxLength !== undefined && <span className="shrink-0">{String(value ?? "").length}/{field.maxLength} characters</span>}
  </div>;
}

interface FormFieldRendererProps {
  field: FieldSchema;
  value: any;
  errorClass: string;
  fieldErrors?: string[];
  relationOptions?: Record<string, any[]>;
  onChange: (name: string, value: any) => void;
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
  onChange,
}: FormFieldRendererProps) {
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
          <Label htmlFor={field.name}>{field.label}</Label>
          <Select
            value={value?.toString() || ""}
            disabled={field.disabled}
            onValueChange={(val) => onChange(field.name, val)}
          >
            <SelectTrigger id={field.name} className={errorClass} aria-describedby={field.helpText ? `${field.name}-hint` : undefined}>
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
          <FieldHint field={field} value={value} />
          <FieldError errors={fieldErrors} />
        </div>
      );

    case "relation": {
      const rel = field.relation;
      if (!rel) return null;
      const items: any[] = relationOptions[field.name] ?? [];

      // Multiple select with checkboxes
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

      // Single select
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{field.label}</Label>
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
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? (field.integerOnly ? 1 : undefined)}
            inputMode={field.integerOnly ? "numeric" : undefined}
            aria-describedby={field.helpText ? `${field.name}-hint` : undefined}
            className={errorClass}
            value={value ?? ""}
            onKeyDown={(event) => {
              if (field.integerOnly && ["e", "E", "+", "-", ".", ","].includes(event.key)) event.preventDefault();
            }}
            onPaste={(event) => {
              if (field.integerOnly && !validIntegerInput(event.clipboardData.getData("text"), field)) event.preventDefault();
            }}
            onChange={(event) => {
              const next = event.target.value;
              if (field.integerOnly && next !== "" && !validIntegerInput(next, field)) return;
              onChange(field.name, next === "" ? "" : Number(next));
            }}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
          <FieldHint field={field} value={value} />
          <FieldError errors={fieldErrors} />
        </div>
      );

    case "date":
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{field.label}</Label>
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
          <Label htmlFor={field.name}>{field.label}</Label>
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
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            type="password"
            className={errorClass}
            value={value || ""}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            autoComplete="new-password"
          />
          <FieldError errors={fieldErrors} />
        </div>
      );

    case "textarea":
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Textarea
            id={field.name}
            maxLength={field.maxLength}
            aria-describedby={field.maxLength !== undefined || field.helpText ? `${field.name}-hint` : undefined}
            className={errorClass}
            value={value || ""}
            onChange={(e) => onChange(field.name, field.maxLength === undefined ? e.target.value : e.target.value.slice(0, field.maxLength))}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            rows={4}
          />
          <FieldHint field={field} value={value} />
          <FieldError errors={fieldErrors} />
        </div>
      );

    case "text":
    default:
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            maxLength={field.maxLength}
            aria-describedby={field.maxLength !== undefined || field.helpText ? `${field.name}-hint` : undefined}
            className={errorClass}
            value={value || ""}
            onChange={(e) => onChange(field.name, field.maxLength === undefined ? e.target.value : e.target.value.slice(0, field.maxLength))}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
          <FieldHint field={field} value={value} />
          <FieldError errors={fieldErrors} />
        </div>
      );
  }
}
