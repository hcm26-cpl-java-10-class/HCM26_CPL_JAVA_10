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
import { Label } from "@/components/ui/label";
import { ChevronDown, Search, X } from "lucide-react";
import type { FieldSchema, RelationConfig } from "@/types";
import { FieldError } from "./FieldError";

const MAX_VISIBLE_BADGES = 3;

interface MultiRelationSelectProps {
  field: FieldSchema;
  rel: RelationConfig;
  items: any[];
  value: any;
  errorClass: string;
  onChange: (val: any[]) => void;
  fieldErrors?: string[];
}

export function MultiRelationSelect({
  field,
  rel,
  items,
  value,
  errorClass,
  onChange,
  fieldErrors,
}: MultiRelationSelectProps) {
  const [search, setSearch] = useState("");
  const selectedValues: any[] = Array.isArray(value) ? value : [];

  const selectedItems = useMemo(
    () =>
      items.filter((item) =>
        selectedValues.some(
          (v) => v?.toString() === item[rel.valueField]?.toString()
        )
      ),
    [items, selectedValues, rel.valueField]
  );

  const filteredItems = useMemo(
    () =>
      search.trim()
        ? items.filter((item) =>
            item[rel.labelField]
              ?.toString()
              .toLowerCase()
              .includes(search.toLowerCase())
          )
        : items,
    [items, search, rel.labelField]
  );

  const groupedItems = useMemo(() => {
    if (!rel.groupField) return null;

    const groups = new Map<string, any[]>();
    filteredItems.forEach((item) => {
      const group = item[rel.groupField!]?.toString() || "Other";
      const groupItems = groups.get(group) ?? [];
      groupItems.push(item);
      groups.set(group, groupItems);
    });

    return [...groups.entries()];
  }, [filteredItems, rel.groupField]);

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) =>
      selectedValues.some(
        (v) => v?.toString() === item[rel.valueField]?.toString()
      )
    );

  const toggleItem = (itemValue: any) => {
    const strVal = itemValue?.toString();
    const exists = selectedValues.some((v) => v?.toString() === strVal);
    if (exists) {
      onChange(selectedValues.filter((v) => v?.toString() !== strVal));
    } else {
      onChange([...selectedValues, itemValue]);
    }
  };

  const selectAllFiltered = () => {
    const newValues = [...selectedValues];
    for (const item of filteredItems) {
      const val = item[rel.valueField];
      if (!newValues.some((v) => v?.toString() === val?.toString())) {
        newValues.push(val);
      }
    }
    onChange(newValues);
  };

  const deselectAllFiltered = () => {
    const filteredIds = new Set(
      filteredItems.map((i) => i[rel.valueField]?.toString())
    );
    onChange(selectedValues.filter((v) => !filteredIds.has(v?.toString())));
  };

  const toggleGroup = (groupItems: any[]) => {
    const groupValues = groupItems.map((item) => item[rel.valueField]);
    const allGroupSelected = groupValues.every((groupValue) =>
      selectedValues.some((selected) => selected?.toString() === groupValue?.toString())
    );

    if (allGroupSelected) {
      const groupIds = new Set(groupValues.map((groupValue) => groupValue?.toString()));
      onChange(selectedValues.filter((selected) => !groupIds.has(selected?.toString())));
      return;
    }

    const nextValues = [...selectedValues];
    groupValues.forEach((groupValue) => {
      if (!nextValues.some((selected) => selected?.toString() === groupValue?.toString())) {
        nextValues.push(groupValue);
      }
    });
    onChange(nextValues);
  };

  return (
    <div className="grid gap-2">
      <Label>{field.label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-between font-normal h-auto min-h-9 ${errorClass}`}
          >
            <div className="flex flex-wrap gap-1 flex-1 overflow-hidden">
              {selectedItems.length > 0 ? (
                <>
                  {selectedItems.slice(0, MAX_VISIBLE_BADGES).map((item) => (
                    <Badge
                      key={item[rel.valueField]}
                      variant="secondary"
                      className="text-xs gap-1"
                    >
                      {item[rel.labelField]}
                      <X
                        size={12}
                        className="cursor-pointer hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleItem(item[rel.valueField]);
                        }}
                      />
                    </Badge>
                  ))}
                  {selectedItems.length > MAX_VISIBLE_BADGES && (
                    <Badge variant="outline" className="text-xs">
                      +{selectedItems.length - MAX_VISIBLE_BADGES} more
                    </Badge>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">
                  Select {field.label.toLowerCase()}...
                </span>
              )}
            </div>
            <ChevronDown
              size={14}
              className="shrink-0 ml-2 text-muted-foreground"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search..."
                className="h-8 pl-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Select all / Clear */}
          {filteredItems.length > 0 && (
            <div className="px-2 py-1.5 border-b flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedValues.length}/{items.length} selected
              </span>
              <div className="flex gap-1">
                {!allFilteredSelected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={selectAllFiltered}
                  >
                    Select all{search.trim() ? " filtered" : ""}
                  </Button>
                )}
                {selectedValues.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                    onClick={
                      search.trim() ? deselectAllFiltered : () => onChange([])
                    }
                  >
                    Clear{search.trim() ? " filtered" : " all"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Options */}
          <div
            className="max-h-60 overflow-y-auto overscroll-contain touch-pan-y pointer-events-auto"
            onWheel={(e) => e.stopPropagation()}
            tabIndex={0}
          >
            <div className="p-1">
              {groupedItems
                ? groupedItems.map(([group, groupItems]) => {
                    const allGroupSelected = groupItems.every((item) =>
                      selectedValues.some(
                        (selected) =>
                          selected?.toString() ===
                          item[rel.valueField]?.toString()
                      )
                    );
                    const someGroupSelected = groupItems.some((item) =>
                      selectedValues.some(
                        (selected) =>
                          selected?.toString() ===
                          item[rel.valueField]?.toString()
                      )
                    );

                    return (
                      <div key={group}>
                        <div
                          className="flex items-center gap-2 border-b bg-muted/50 px-2 py-1.5 cursor-pointer"
                          onClick={() => toggleGroup(groupItems)}
                        >
                          <Checkbox
                            checked={
                              allGroupSelected
                                ? true
                                : someGroupSelected
                                  ? "indeterminate"
                                  : false
                            }
                            aria-label={`Select all in ${group}`}
                          />
                          <span className="text-xs font-semibold">
                            Select All in {group}
                          </span>
                        </div>
                        {groupItems.map((item) => {
                          const itemVal = item[rel.valueField];
                          const checked = selectedValues.some(
                            (selected) =>
                              selected?.toString() === itemVal?.toString()
                          );
                          return (
                            <div
                              key={itemVal}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
                              onClick={() => toggleItem(itemVal)}
                            >
                              <Checkbox checked={checked} />
                              <span className="text-sm">
                                {item[rel.labelField]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                : filteredItems.map((item) => {
                    const itemVal = item[rel.valueField];
                    const checked = selectedValues.some(
                      (v) => v?.toString() === itemVal?.toString()
                    );
                    return (
                      <div
                        key={itemVal}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
                        onClick={() => toggleItem(itemVal)}
                      >
                        <Checkbox checked={checked} />
                        <span className="text-sm">{item[rel.labelField]}</span>
                      </div>
                    );
                  })}
              {filteredItems.length === 0 && (
                <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                  {items.length === 0
                    ? "No options available"
                    : "No results found"}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <FieldError errors={fieldErrors} />
    </div>
  );
}
