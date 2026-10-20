import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Pen, Trash2 } from "lucide-react";
import ActionButton from "../../common/ActionButton";
import type { FieldSchema } from "@/types";
import { CardFieldValue } from "./CardFieldValue";
import { cn } from "@/lib/utils";

interface CardItemProps {
  row: any;
  index: number;
  idField: string;
  isSelected: boolean;
  showActions?: boolean;
  visibleFields: FieldSchema[];
  relationOptions: Record<string, any[]>;
  onSelect: (id: any) => void;
  onRowClick?: (row: any) => void;
  renderRowActions?: (row: any) => React.ReactNode;
  onView: (row: any) => void;
  onEdit: (row: any) => void;
  onDelete: (row: any) => void;
  onBooleanToggle: (id: any, fieldName: string, newValue: boolean) => void;
  disableBooleanToggle?: boolean;
  isRowProtected?: (row: any) => boolean;
  selectable?: boolean;
  showIndex?: boolean;
}

export function CardItem({
  row,
  index,
  idField,
  isSelected,
  showActions = true,
  visibleFields,
  relationOptions,
  onSelect,
  onRowClick,
  renderRowActions,
  onView,
  onEdit,
  onDelete,
  onBooleanToggle,
  disableBooleanToggle = false,
  isRowProtected,
  selectable = true,
  showIndex = true,
}: CardItemProps) {
  const id = row[idField];
  const isClickable = typeof onRowClick === "function";
  const hasHeader = selectable || showIndex || showActions;

  // Default row actions
  const defaultActions = (
    <>
      <ActionButton
        onClick={() => onView(row)}
        tooltip="View detail"
        icon={<Eye size={10} className="text-gray-500" />}
      />
      <ActionButton
        onClick={() => onEdit(row)}
        tooltip="Edit"
        icon={<Pen size={10} className="text-gray-500" />}
      />
      <ActionButton
        onClick={() => onDelete(row)}
        tooltip="Delete"
        icon={<Trash2 size={10} className="text-red-500" />}
      />
    </>
  );

  return (
    <Card
      className={cn(
        "relative group transition-all hover:shadow-md",
        isClickable ? "cursor-pointer" : "cursor-default",
        isSelected ? "ring-2 ring-primary" : "",
      )}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest("button, a, input, label, [role=switch]")) return;
        onRowClick?.(row);
      }}
    >
      {hasHeader && (
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
          <div className="flex items-center gap-2">
            {selectable && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(id)}
                aria-label="Select card"
              />
            )}

            {showIndex && (
              <span className="text-xs text-muted-foreground font-medium">
                #{index + 1}
              </span>
            )}
          </div>

          {showActions && (
            <div className="flex gap-1">
              {renderRowActions ? renderRowActions(row) : defaultActions}
            </div>
          )}
        </CardHeader>
      )}

      <CardContent className={cn("space-y-2 overflow-hidden", hasHeader ? "pt-0" : "pt-4")}> 
        {visibleFields
          .filter((f) => f.type !== "password")
          .map((f) => (
            <div key={f.name} className="flex items-start gap-2 min-w-0">
              <span className="text-xs font-medium text-muted-foreground min-w-[80px] shrink-0 pt-0.5">
                {f.label}
              </span>
              <div className="min-w-0 flex-1">
                <CardFieldValue
                  field={f}
                  value={row[f.name]}
                  relationOptions={relationOptions}
                  disableBooleanToggle={
                    disableBooleanToggle ||
                    (f.name === "isActive" && (isRowProtected?.(row) ?? false))
                  }
                  onBooleanToggle={(fieldName, newValue) =>
                    onBooleanToggle(id, fieldName, newValue)
                  }
                />
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
