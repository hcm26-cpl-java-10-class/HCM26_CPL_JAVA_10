import type { CSSProperties } from "react";
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
import { getEffectiveRule } from "./validateForm";
import { MultiRelationSelect } from "./MultiRelationSelect";

// Textarea mặc định có field-sizing: content (tự giãn theo nội dung) -> ép về kích thước cố định, nội dung dài sẽ cuộn.
const FIXED_TEXTAREA_STYLE = { fieldSizing: "fixed" } as CSSProperties;

interface FormFieldRendererProps {
  field: FieldSchema;
  value: any;
  errorClass: string;
  fieldErrors?: string[];
  relationOptions?: Record<string, any[]>;
  /** Bản ghi đang sửa (undefined khi tạo mới) - dùng cho relation.filterItems. */
  initial?: any;
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
  initial,
  onChange,
}: FormFieldRendererProps) {
  const rule = getEffectiveRule(field);
  const noNegative = rule.min !== undefined && rule.min >= 0;
  const requiredMark = rule.required ? (
    <span className="text-destructive"> *</span>
  ) : null;

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
          <Label htmlFor={field.name}>{field.label}{requiredMark}</Label>
          <Select
            value={value?.toString() || ""}
            onValueChange={(val) => onChange(field.name, val)}
          >
            <SelectTrigger className={`w-full ${errorClass}`}>
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
            <SelectContent
              position="popper"
              sideOffset={4}
              className="max-h-60 w-(--radix-select-trigger-width)"
            >
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
      const allItems: any[] = relationOptions[field.name] ?? [];
      const items: any[] = rel.filterItems
        ? rel.filterItems(allItems, { initial, isEdit: initial?.id != null })
        : allItems;

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
          <Label htmlFor={field.name}>{field.label}{requiredMark}</Label>
          <Select
            value={value?.toString() || ""}
            onValueChange={(val) => onChange(field.name, val)}
          >
            <SelectTrigger className={`w-full ${errorClass}`}>
              <SelectValue
                placeholder={`Select ${field.label.toLowerCase()}...`}
              />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={4}
              className="max-h-60 w-(--radix-select-trigger-width)"
            >
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
          <Label htmlFor={field.name}>{field.label}{requiredMark}</Label>
          <Input
            id={field.name}
            type="number"
            className={errorClass}
            value={value ?? ""}
            min={rule.min}
            max={rule.max}
            onKeyDown={(e) => {
              // Không cho gõ dấu âm / số mũ khi field không cho phép số âm
              if (noNegative && ["-", "+", "e", "E"].includes(e.key)) {
                e.preventDefault();
              }
            }}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return onChange(field.name, "");
              const n = Number(raw);
              // Chặn luôn số âm (kể cả dán vào) / vượt min, max
              if (rule.min !== undefined && n < rule.min && noNegative) return;
              if (rule.max !== undefined && n > rule.max) return;
              onChange(field.name, n);
            }}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
          <FieldError errors={fieldErrors} />
        </div>
      );

    case "date":
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{field.label}{requiredMark}</Label>
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

    case "datetime-local":
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
          <Label htmlFor={field.name}>{field.label}{requiredMark}</Label>
          <Input
            id={field.name}
            type="password"
            className={errorClass}
            value={value || ""}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            autoComplete="new-password"
            maxLength={rule.maxLength}
          />
          <FieldError errors={fieldErrors} />
        </div>
      );

    case "textarea":
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{field.label}{requiredMark}</Label>
          <Textarea
            id={field.name}
            className={`h-32 resize-none overflow-y-auto ${errorClass}`}
            value={value || ""}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            rows={4}
            maxLength={rule.maxLength}
            style={FIXED_TEXTAREA_STYLE}
          />
          {rule.maxLength ? (
            <p className="text-xs text-muted-foreground text-right">
              {(value || "").length}/{rule.maxLength}
            </p>
          ) : null}
          <FieldError errors={fieldErrors} />
        </div>
      );

    case "text":
    default:
      return (
        <div className="grid gap-2">
          <Label htmlFor={field.name}>{field.label}{requiredMark}</Label>
          <Input
            id={field.name}
            className={errorClass}
            value={value || ""}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            maxLength={rule.maxLength}
          />
          <FieldError errors={fieldErrors} />
        </div>
      );
  }
}