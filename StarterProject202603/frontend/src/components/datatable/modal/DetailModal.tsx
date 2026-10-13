import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { iconMap } from "@/components/datatable/iconMap";
import type { EntitySchema, FieldSchema } from "@/types";

interface DetailModalProps {
  open: boolean;
  onClose: (open: boolean) => void;
  schema: EntitySchema;
  row: any;
  relationOptions?: Record<string, any[]>;
}

export function DetailModal({
  open,
  onClose,
  schema,
  row,
  relationOptions = {},
}: DetailModalProps) {
  if (!row) return null;

  const renderValue = (field: FieldSchema) => {
    const value = row[field.name];

    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">—</span>;
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
            <span className="text-muted-foreground">—</span>
          )}
        </>
      );
    }

    if (field.name === "createdBy" || field.name === "updatedBy") {
      const users: any[] = relationOptions[field.name] ?? [];
      const matchedUser = users.find(
        (u) => u?.id?.toString() === value?.toString()
      );
      return matchedUser?.email ?? String(value);
    }

    switch (field.type) {
      case "boolean": {
        const labels = field.booleanLabels || { true: "Yes", false: "No" };
        const colorClass = value
          ? (labels.trueColor || "bg-green-500 text-white")
          : (labels.falseColor || "bg-red-400 text-white");
        return (
          <Badge className={colorClass}>
            {value ? labels.true : labels.false}
          </Badge>
        );
      }

      case "relation": {
        const rel = field.relation;
        if (!rel) return String(value);
        const options: any[] = relationOptions[field.name] ?? [];

        if (rel.multiple && Array.isArray(value)) {
          const matched = value
            .map((v: any) =>
              options.find(
                (opt) => opt[rel.valueField]?.toString() === v?.toString()
              )
            )
            .filter(Boolean);
          return matched.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {matched.map((m: any) => (
                <Badge key={m[rel.valueField]} variant="secondary" className="text-xs">
                  {m[rel.labelField]}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        }

        const matched = options.find(
          (opt) => opt[rel.valueField]?.toString() === value?.toString()
        );
        return matched ? matched[rel.labelField] : String(value);
      }

      case "date": {
        try {
          const date = new Date(value);
          return date.toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return String(value);
        }
      }

      default: {
        // Handle arrays of objects (like question options)
        if (Array.isArray(value)) {
          if (value.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }

          // Check if array items are objects with known structure
          const firstItem = value[0];
          if (typeof firstItem === "object" && firstItem !== null) {
            // Special handling for question options
            if ("content" in firstItem && "correct" in firstItem) {
              return (
                <div className="flex flex-col gap-2 w-full">
                  {value.map((option: any, idx: number) => (
                    <div
                      key={option.id || idx}
                      className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                    >
                      <Badge
                        variant={option.correct ? "default" : "outline"}
                        className="shrink-0 mt-0.5"
                      >
                        {option.correct ? "✓" : String.fromCharCode(65 + idx)}
                      </Badge>
                      <span className="text-sm flex-1">{option.content}</span>
                    </div>
                  ))}
                </div>
              );
            }
            // Generic object array
            return (
              <div className="flex flex-col gap-1">
                {value.map((item: any, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs w-fit">
                    {JSON.stringify(item)}
                  </Badge>
                ))}
              </div>
            );
          }

          // Array of primitives
          return (
            <div className="flex flex-wrap gap-1">
              {value.map((item: any, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {String(item)}
                </Badge>
              ))}
            </div>
          );
        }

        return String(value);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>Detail</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="grid gap-3">
            {schema.fields.filter((f) => f.type !== "password").map((field, index) => (
              <div key={field.name}>
                {index > 0 && <Separator className="mb-3" />}
                <div className="flex items-start gap-4">
                  <span className="text-sm font-medium text-muted-foreground min-w-[140px] shrink-0">
                    {field.label}
                  </span>
                  <div className="text-sm break-all flex-1">
                    {renderValue(field)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
