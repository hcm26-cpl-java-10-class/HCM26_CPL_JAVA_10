import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FieldSchema } from "@/types";

interface NumberRangeFilterProps {
  field: FieldSchema;
  value: { min?: number; max?: number } | undefined;
  onChange: (value: { min?: number; max?: number } | undefined) => void;
}

export function NumberRangeFilter({
  field: _field,
  value,
  onChange,
}: NumberRangeFilterProps) {
  const hasValue = value?.min !== undefined || value?.max !== undefined;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          placeholder="Min"
          className="h-8 text-xs"
          value={value?.min ?? ""}
          onChange={(e) => {
            const min = e.target.value
              ? Number(e.target.value)
              : undefined;
            onChange(
              min !== undefined || value?.max !== undefined
                ? { ...value, min }
                : undefined
            );
          }}
        />
        <span className="text-muted-foreground text-xs">—</span>
        <Input
          type="number"
          placeholder="Max"
          className="h-8 text-xs"
          value={value?.max ?? ""}
          onChange={(e) => {
            const max = e.target.value
              ? Number(e.target.value)
              : undefined;
            onChange(
              value?.min !== undefined || max !== undefined
                ? { ...value, max }
                : undefined
            );
          }}
        />
      </div>
      {hasValue && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs w-full text-destructive hover:text-destructive"
          onClick={() => onChange(undefined)}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
