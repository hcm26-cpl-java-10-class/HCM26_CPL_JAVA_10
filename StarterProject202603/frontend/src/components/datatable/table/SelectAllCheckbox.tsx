import { Checkbox } from "@/components/ui/checkbox";

interface SelectAllCheckboxProps {
  table: any;
  idField: string;
}

export function SelectAllCheckbox({ table, idField }: SelectAllCheckboxProps) {
  const allIds = table.data?.map((row: any) => row[idField]) ?? [];
  const allSelected =
    allIds.length > 0 && allIds.every((id: any) => table.selected?.includes(id));
  const someSelected =
    !allSelected && allIds.some((id: any) => table.selected?.includes(id));

  return (
    <Checkbox
      checked={allSelected}
      data-state={someSelected ? "indeterminate" : undefined}
      onCheckedChange={(checked) => {
        if (checked) {
          table.setSelected((prev: any[]) => {
            const newIds = allIds.filter((id: any) => !prev.includes(id));
            return [...prev, ...newIds];
          });
        } else {
          table.setSelected((prev: any[]) =>
            prev.filter((id: any) => !allIds.includes(id))
          );
        }
      }}
      aria-label="Select all rows"
    />
  );
}
