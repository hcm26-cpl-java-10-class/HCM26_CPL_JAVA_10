import { Label } from "@/components/ui/label";
import type { FieldSchema } from "@/types";
import { getFilterType } from "./getFilterType";
import { TextFilter } from "./TextFilter";
import { SelectFilter } from "./SelectFilter";
import { BooleanFilter } from "./BooleanFilter";
import { NumberRangeFilter } from "./NumberRangeFilter";
import { DateRangeFilter } from "./DateRangeFilter";

interface FiltersProps {
  table: any;
}

export function Filters({ table }: FiltersProps) {
  const filterableFields = table.schema.fields.filter(
    (f: FieldSchema) => f.filterable
  );

  if (filterableFields.length === 0) return null;

  const setFilterValue = (fieldName: string, val: any) => {
    table.setFilters((prev: any) => ({
      ...prev,
      [fieldName]: val,
    }));
  };

  return (
    <div className="grid gap-3">
      {filterableFields.map((field: FieldSchema) => {
        const filterType = getFilterType(field);
        const value = table.filters?.[field.name];

        const renderFilter = () => {
          switch (filterType) {
            case "text":
              return (
                <TextFilter
                  field={field}
                  value={value}
                  onChange={(val) =>
                    setFilterValue(field.name, val || undefined)
                  }
                />
              );
            case "select": {
              const filterField =
                field.type === "relation" && field.relation
                  ? {
                      ...field,
                      filterOptions: (
                        table.relationOptions?.[field.name] ?? []
                      ).map((item: any) => ({
                        label: item[field.relation!.labelField],
                        value: item[field.relation!.valueField],
                      })),
                    }
                  : field;
              return (
                <SelectFilter
                  field={filterField}
                  value={value}
                  onChange={(val) => setFilterValue(field.name, val)}
                />
              );
            }
            case "boolean":
              return (
                <BooleanFilter
                  field={field}
                  value={value}
                  onChange={(val) => setFilterValue(field.name, val)}
                />
              );
            case "numberRange":
              return (
                <NumberRangeFilter
                  field={field}
                  value={value}
                  onChange={(val) => setFilterValue(field.name, val)}
                />
              );
            case "dateRange":
              return (
                <DateRangeFilter
                  field={field}
                  value={value}
                  onChange={(val) => setFilterValue(field.name, val)}
                />
              );
            default:
              return null;
          }
        };

        return (
          <div key={field.name} className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {field.label}
            </Label>
            {renderFilter()}
          </div>
        );
      })}
    </div>
  );
}