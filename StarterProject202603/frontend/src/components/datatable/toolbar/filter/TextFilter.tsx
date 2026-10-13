import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { FieldSchema } from "@/types";

interface TextFilterProps {
  field: FieldSchema;
  value: string;
  onChange: (value: string) => void;
}

export function TextFilter({ field, value, onChange }: TextFilterProps) {
  return (
    <div className="relative">
      <Search size={13} className="absolute text-muted-foreground top-1/2 -translate-y-1/2 left-2" />
      <Input
        placeholder={`Filter ${field.label.toLowerCase()}...`}
        className="pl-7 h-8 text-xs"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
