import { Checkbox } from "@/components/ui/checkbox";

interface RowSelectionProps {
  id: string | number;
  table: any;
}

export function RowSelection({ id, table }: RowSelectionProps) {
  const checked = table.selected?.includes(id) || false;

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={() => {
        table.setSelected((prev: any[]) =>
          checked ? prev.filter((x) => x !== id) : [...prev, id]
        );
      }}
      aria-label="Select row"
    />
  );
}