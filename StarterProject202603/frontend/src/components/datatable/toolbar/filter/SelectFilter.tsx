import { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { iconMap } from "@/components/datatable/iconMap";
import { ChevronDown, Search, X } from "lucide-react";
import type { FieldSchema } from "@/types";

interface SelectFilterProps {
  field: FieldSchema;
  /** Mảng giá trị đã chọn (hỗ trợ multi-select) */
  value: any;
  onChange: (value: any) => void;
}

const MAX_VISIBLE = 2;

export function SelectFilter({ field, value, onChange }: SelectFilterProps) {
  const [search, setSearch] = useState("");
  const options = field.filterOptions || field.options || [];
  const isIconField = field.type === "icon" || field.name === "icon";

  // Normalize value to always be an array for multi-select
  const selectedValues: string[] = useMemo(() => {
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return value.map((v: any) => v?.toString());
    return [value.toString()];
  }, [value]);

  const filteredOptions = useMemo(
    () =>
      search.trim()
        ? options.filter((opt) =>
            opt.label?.toString().toLowerCase().includes(search.toLowerCase())
          )
        : options,
    [options, search]
  );

  const allFilteredSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((opt) =>
      selectedValues.includes(opt.value?.toString())
    );

  const toggleValue = (optValue: any) => {
    const strVal = optValue?.toString();
    if (selectedValues.includes(strVal)) {
      const next = selectedValues.filter((v) => v !== strVal);
      onChange(next.length > 0 ? next : undefined);
    } else {
      onChange([...selectedValues, strVal]);
    }
  };

  const selectAll = () => {
    const newValues = [...selectedValues];
    for (const opt of filteredOptions) {
      const v = opt.value?.toString();
      if (!newValues.includes(v)) newValues.push(v);
    }
    onChange(newValues);
  };

  const clearAll = () => {
    if (search.trim()) {
      const filteredIds = new Set(
        filteredOptions.map((o) => o.value?.toString())
      );
      const remaining = selectedValues.filter((v) => !filteredIds.has(v));
      onChange(remaining.length > 0 ? remaining : undefined);
    } else {
      onChange(undefined);
    }
  };

  const selectedLabels = selectedValues
    .map((v) => options.find((o) => o.value?.toString() === v)?.label)
    .filter(Boolean);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 gap-1.5 text-xs font-normal justify-between w-full overflow-hidden"
        >
          <span className="truncate min-w-0">
            {selectedLabels.length === 0
              ? field.label
              : selectedLabels.length <= MAX_VISIBLE
                ? selectedLabels.join(", ")
                : `${selectedLabels.slice(0, MAX_VISIBLE).join(", ")} +${selectedLabels.length - MAX_VISIBLE}`}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {selectedValues.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4 min-w-4 px-1 text-[10px] rounded-full"
              >
                {selectedValues.length}
              </Badge>
            )}
            <ChevronDown size={12} className="text-muted-foreground" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 overflow-hidden" align="start">
        {/* Search */}
        {options.length > 5 && (
          <div className="p-2 border-b">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search..."
                className="h-7 pl-7 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Select all / Clear */}
        {filteredOptions.length > 0 && (
          <div className="px-2 py-1 border-b flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {selectedValues.length}/{options.length}
            </span>
            <div className="flex gap-0.5">
              {!allFilteredSelected && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] px-1.5"
                  onClick={selectAll}
                >
                  All
                </Button>
              )}
              {selectedValues.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] px-1.5 text-destructive hover:text-destructive"
                  onClick={clearAll}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Options */}
        <ScrollArea className="h-[200px]">
          <div className="p-1">
            {filteredOptions.map((option) => {
              const checked = selectedValues.includes(
                option.value?.toString()
              );
              const optionIconKey = option.value?.toString();
              const OptionIcon =
                isIconField && optionIconKey && optionIconKey in iconMap
                  ? iconMap[optionIconKey as keyof typeof iconMap]
                  : null;

              return (
                <div
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-accent cursor-pointer text-xs"
                  onClick={() => toggleValue(option.value)}
                >
                  <Checkbox checked={checked} className="h-3.5 w-3.5" />
                  {OptionIcon ? (
                    <OptionIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </div>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="px-2 py-3 text-xs text-center text-muted-foreground">
                No results
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Selected preview */}
        {selectedValues.length > 0 && (
          <div className="p-1.5 border-t flex flex-wrap gap-1">
            {selectedLabels.slice(0, 3).map((label, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[10px] gap-0.5 h-5"
              >
                {(() => {
                  const selectedValue = options.find((o) => o.label === label)?.value?.toString();
                  const SelectedIcon =
                    isIconField && selectedValue && selectedValue in iconMap
                      ? iconMap[selectedValue as keyof typeof iconMap]
                      : null;

                  return SelectedIcon ? (
                    <SelectedIcon className="h-3 w-3 text-muted-foreground" />
                  ) : null;
                })()}
                {label}
                <X
                  size={10}
                  className="cursor-pointer hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleValue(
                      options.find((o) => o.label === label)?.value
                    );
                  }}
                />
              </Badge>
            ))}
            {selectedLabels.length > 3 && (
              <Badge variant="outline" className="text-[10px] h-5">
                +{selectedLabels.length - 3}
              </Badge>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
