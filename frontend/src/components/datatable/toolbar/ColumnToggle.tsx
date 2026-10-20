import { Button } from "@/components/ui/button";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Columns3 } from "lucide-react";

interface ColumnToggleProps {
  schema: any;
  columnVisibility: Record<string, boolean>;
  toggleFieldVisibility: (name: string, value: boolean) => void;
  compact?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
  tooltip?: string;
}

export function ColumnToggle({
  schema,
  columnVisibility,
  toggleFieldVisibility,
  compact = false,
  className,
  align = "end",
  tooltip,
}: ColumnToggleProps) {
  const hideableFields = schema.fields.filter((field: any) => field.hideable !== false);

  if (!hideableFields.length) {
    return null;
  }

  return (
    <DropdownMenu>
      <TooltipWrapper content={tooltip ?? (compact ? "Column visibility" : "Toggle columns")}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "icon" : "default"}
            className={compact ? `h-7 w-7 p-0 ${className ?? ""}` : `w-full !outline-none lg:w-auto ${className ?? ""}`}
          >
            <Columns3 size={compact ? 15 : 16} />
            {!compact && <span className="mr-1">Columns</span>}
            {!compact && <ChevronDown size={14} className="opacity-70" />}
          </Button>
        </DropdownMenuTrigger>
      </TooltipWrapper>
      <DropdownMenuContent align={align}>
        {hideableFields.map((field: any) => (
            <DropdownMenuCheckboxItem
              key={field.name}
              className="capitalize"
              checked={columnVisibility[field.name] !== false}
              onCheckedChange={(value) => {
                toggleFieldVisibility(field.name, Boolean(value));
              }}
              onSelect={(e) => e.preventDefault()}
            >
              {field.label ?? field.name}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
