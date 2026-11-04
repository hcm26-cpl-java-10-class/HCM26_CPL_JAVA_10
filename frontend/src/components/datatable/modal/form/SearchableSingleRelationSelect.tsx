import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FieldSchema, RelationConfig } from "@/types";
import { ChevronDown } from "lucide-react";
import { FieldError } from "./FieldError";
import { FieldHint } from "./FieldHint";
import { getEffectiveRule } from "./validateForm";

interface Props {
  field: FieldSchema;
  rel: RelationConfig;
  value: number | string | null | undefined;
  onChange: (value: number | "") => void;
  errorClass: string;
  fieldErrors?: string[];
}

export function SearchableSingleRelationSelect({
  field, rel, value, onChange, errorClass, fieldErrors,
}: Props) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 350);
    return () => clearTimeout(timer);
  }, [keyword]);

  const selectedId = value === "" || value == null ? null : Number(value);
  const optionsQuery = useQuery({
    queryKey: ["relation-search", field.name, debounced],
    queryFn: () => rel.api.getPage({ page: 0, size: 10 }, debounced),
    enabled: open,
    staleTime: 30_000,
  });
  const selectedQuery = useQuery({
    queryKey: ["relation-selected", field.name, selectedId],
    queryFn: () => rel.api.getById(String(selectedId)),
    enabled: selectedId != null && selectedId > 0,
    retry: false,
  });
  const options = (optionsQuery.data?.content ?? []) as Array<Record<string, string | number>>;
  const selected = selectedQuery.data as Record<string, string | number> | undefined;
  const selectedLabel = selected
    ? `${selected.code ? `${selected.code} - ` : ""}${selected[rel.labelField]}`
    : selectedId ? `Syllabus #${selectedId} (unavailable)` : `Select ${field.label.toLowerCase()}...`;

  return (
    <div className="grid gap-2">
      <Label>{field.label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline"
            className={`w-full justify-between font-normal ${errorClass}`}>
            <span className="truncate text-left">{selectedLabel}</span>
            <ChevronDown className="ml-2 size-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(26rem,90vw)] space-y-2 p-3">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search by syllabus code or name..." aria-label="Search syllabuses" />
          <div className="max-h-52 space-y-1 overflow-y-auto">
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start"
              onClick={() => { onChange(""); setOpen(false); }}>
              No syllabus
            </Button>
            {optionsQuery.isLoading && <p className="p-2 text-sm text-muted-foreground">Searching...</p>}
            {optionsQuery.isError && <p className="p-2 text-sm text-destructive">Unable to load syllabuses.</p>}
            {!optionsQuery.isLoading && !optionsQuery.isError && options.length === 0 &&
              <p className="p-2 text-sm text-muted-foreground">No syllabuses found.</p>}
            {options.map((item) => (
              <Button key={String(item[rel.valueField])} type="button"
                variant="ghost" size="sm" className="h-auto w-full justify-start whitespace-normal text-left"
                onClick={() => { onChange(Number(item[rel.valueField])); setOpen(false); }}>
                {String(item.code)} - {String(item[rel.labelField])}
              </Button>
            ))}
          </div>
          {optionsQuery.data && optionsQuery.data.totalElements > 10 && (
            <p className="text-xs text-muted-foreground">Showing first 10 results. Refine your search.</p>
          )}
          {selectedId != null && selectedQuery.data && (
            <a className="text-sm underline" href={`/student/syllabuses/${selectedId}`}
              target="_blank" rel="noopener noreferrer">Preview selected syllabus</a>
          )}
        </PopoverContent>
      </Popover>
      <FieldHint field={field} rule={getEffectiveRule(field)} />
      <FieldError errors={fieldErrors} />
    </div>
  );
}
