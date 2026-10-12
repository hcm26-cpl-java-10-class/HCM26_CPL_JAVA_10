import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FieldSchema } from "@/types";

interface BooleanFilterProps {
  field: FieldSchema;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
}

export function BooleanFilter({ field, value, onChange }: BooleanFilterProps) {
  const labels = field.booleanLabels || { true: "Yes", false: "No" };

  const displayValue =
    value === undefined ? "All" : value ? labels.true : labels.false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8 gap-1.5 text-xs font-normal w-full justify-between">
          {displayValue}
          <ChevronDown size={12} className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={value === undefined ? "" : value.toString()}
          onValueChange={(val) => {
            if (val === "") onChange(undefined);
            else onChange(val === "true");
          }}
        >
          <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="true">
            {labels.true}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="false">
            {labels.false}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
