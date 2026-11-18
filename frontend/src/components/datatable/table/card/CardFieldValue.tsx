import { Switch } from "@/components/ui/switch";
import { TruncatedText } from "@/components/datatable/common/TruncatedText";
import { BadgeList } from "@/components/datatable/common/BadgeList";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { iconMap } from "@/components/datatable/iconMap";
import type { FieldSchema } from "@/types";

interface CardFieldValueProps {
  field: FieldSchema;
  value: any;
  relationOptions: Record<string, any[]>;
  onBooleanToggle?: (fieldName: string, newValue: boolean) => void;
  disableBooleanToggle?: boolean;
}

const MAX_CARD_BADGES = 3;

export function CardFieldValue({
  field,
  value,
  relationOptions,
  onBooleanToggle,
  disableBooleanToggle = false,
}: CardFieldValueProps) {
  if (field.type === "boolean") {
    const labels = field.booleanLabels || { true: "Yes", false: "No" };
    const label = value ? labels.true : labels.false;
    const disableToggle = disableBooleanToggle || !onBooleanToggle || !!field.dynamicChild;

    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={!!value}
          disabled={disableToggle}
          onCheckedChange={(checked) => onBooleanToggle?.(field.name, checked)}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-primary/40 scale-90"
        />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    );
  }

  if (field.type === "icon" || field.name === "icon") {
    const iconKey = value?.toString();
    const Icon =
      iconKey && iconKey in iconMap
        ? iconMap[iconKey as keyof typeof iconMap]
        : null;

    return (
      <>
        {Icon ? (
          <TooltipWrapper content={iconKey || "—"}>
            <span className="inline-flex items-center">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
          </TooltipWrapper>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </>
    );
  }

  if (field.name === "createdBy" || field.name === "updatedBy") {
    const users: any[] = relationOptions[field.name] ?? [];
    const matchedUser = users.find(
      (u) => u?.id?.toString() === value?.toString()
    );
    const displayText = matchedUser?.email ?? String(value ?? "—");

    return (
      <TruncatedText
        content={displayText}
        bold={field.bold}
        className="text-sm"
      />
    );
  }

  if (field.type === "relation" && field.relation) {
    const options: any[] = relationOptions[field.name] ?? [];
    const { valueField, labelField, multiple } = field.relation;

    if (multiple && Array.isArray(value)) {
      const matched = value
        .map((v: any) =>
          options.find((opt) => opt[valueField]?.toString() === v?.toString())
        )
        .filter(Boolean);
      return (
        <BadgeList
          items={matched}
          labelField={labelField}
          valueField={valueField}
          maxVisible={MAX_CARD_BADGES}
        />
      );
    }

    const matched = options.find(
      (opt) => opt[valueField]?.toString() === value?.toString()
    );
    const displayText = matched ? matched[labelField] : (value ?? "—");
    return (
      <TruncatedText
        content={String(displayText)}
        bold={field.bold}
        className="text-sm"
      />
    );
  }

  if (field.type === "date" && value) {
    try {
      const formatted = new Date(value).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return (
        <TruncatedText
          content={formatted}
          bold={field.bold}
          className="text-sm"
        />
      );
    } catch {
      return (
        <TruncatedText
          content={String(value)}
          bold={field.bold}
          className="text-sm"
        />
      );
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }

    const firstItem = value[0];
    if (typeof firstItem === "object" && firstItem !== null && "content" in firstItem) {
      const optionsText = value
        .map((opt: any, idx: number) =>
          `${String.fromCharCode(65 + idx)}. ${opt.content}${opt.correct ? " ✓" : ""}`
        )
        .join("\n");

      return (
        <TooltipWrapper content={optionsText}>
          <span className="text-xs text-muted-foreground cursor-help">
            {value.length} option{value.length !== 1 ? "s" : ""}
          </span>
        </TooltipWrapper>
      );
    }

    return (
      <TruncatedText
        content={value.join(", ")}
        bold={field.bold}
        className="text-sm"
      />
    );
  }

  const displayValue = String(value ?? "—");
  return (
    <TruncatedText
      content={displayValue}
      bold={field.bold}
      className="text-sm"
    />
  );
}
