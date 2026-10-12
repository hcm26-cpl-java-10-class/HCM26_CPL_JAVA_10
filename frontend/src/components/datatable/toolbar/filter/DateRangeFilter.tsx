import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FieldSchema } from "@/types";

interface DateRangeFilterProps {
  field: FieldSchema;
  value: { from?: string; to?: string } | undefined;
  onChange: (value: { from?: string; to?: string } | undefined) => void;
}

export function DateRangeFilter({
  field: _field,
  value,
  onChange,
}: DateRangeFilterProps) {
  const hasValue = value?.from || value?.to;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">From</label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={value?.from ?? ""}
            onChange={(e) => {
              const from = e.target.value || undefined;
              onChange(from || value?.to ? { ...value, from } : undefined);
            }}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">To</label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={value?.to ?? ""}
            onChange={(e) => {
              const to = e.target.value || undefined;
              onChange(value?.from || to ? { ...value, to } : undefined);
            }}
          />
        </div>
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
