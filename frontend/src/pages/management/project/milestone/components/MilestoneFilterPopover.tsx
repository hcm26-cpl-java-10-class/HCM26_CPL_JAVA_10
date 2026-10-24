import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LatePolicyType, MilestoneListParams, MilestoneStatus } from "@/types";
import { Filter, X } from "lucide-react";
import { countMilestoneFilters } from "../milestone-list-query.utils";

const STATUS_OPTIONS: Array<{ value: MilestoneStatus; label: string }> = [
  { value: "PLANNED", label: "Planned" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const LATE_POLICY_OPTIONS: Array<{ value: LatePolicyType; label: string }> = [
  { value: "NO_LATE", label: "No late submissions" },
  { value: "ALLOW_LATE", label: "Allow late submissions" },
];

interface MilestoneFilterPopoverProps {
  value: MilestoneListParams;
  onChange: (patch: Partial<MilestoneListParams>) => void;
  onClear: () => void;
}

function toggleValue<T extends string>(values: T[] | undefined, value: T): T[] | undefined {
  const current = values ?? [];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return next.length > 0 ? next : undefined;
}

export function MilestoneFilterPopover({ value, onChange, onClear }: MilestoneFilterPopoverProps) {
  const activeCount = countMilestoneFilters(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="gap-1.5">
          <Filter className="size-4" /> Filters
          {activeCount > 0 ? <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs">{activeCount}</Badge> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium"><Filter className="size-4" /> Filters</span>
          {activeCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={onClear}>
              <X className="size-3" /> Clear all
            </Button>
          ) : null}
        </div>

        <div className="grid gap-5 p-3">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Status</legend>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <Label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={value.status?.includes(option.value) ?? false}
                    onCheckedChange={() => onChange({ status: toggleValue(value.status, option.value) })}
                  />
                  {option.label}
                </Label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-1.5">
            <Label htmlFor="milestone-mandatory-filter" className="text-xs text-muted-foreground">Requirement</Label>
            <Select
              value={value.mandatory === undefined ? "all" : String(value.mandatory)}
              onValueChange={(next) => onChange({ mandatory: next === "all" ? undefined : next === "true" })}
            >
              <SelectTrigger id="milestone-mandatory-filter" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All milestones</SelectItem>
                <SelectItem value="true">Mandatory</SelectItem>
                <SelectItem value="false">Optional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Late policy</legend>
            {LATE_POLICY_OPTIONS.map((option) => (
              <Label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={value.latePolicyType?.includes(option.value) ?? false}
                  onCheckedChange={() => onChange({ latePolicyType: toggleValue(value.latePolicyType, option.value) })}
                />
                {option.label}
              </Label>
            ))}
          </fieldset>

          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Deadline</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <span className="text-[10px] text-muted-foreground">From</span>
                <Input
                  type="date"
                  max={value.deadlineTo}
                  value={value.deadlineFrom ?? ""}
                  onChange={(event) => {
                    const deadlineFrom = event.target.value || undefined;
                    onChange({
                      deadlineFrom,
                      deadlineTo: deadlineFrom && value.deadlineTo && deadlineFrom > value.deadlineTo
                        ? deadlineFrom
                        : value.deadlineTo,
                    });
                  }}
                />
              </div>
              <div className="grid gap-1">
                <span className="text-[10px] text-muted-foreground">To</span>
                <Input
                  type="date"
                  min={value.deadlineFrom}
                  value={value.deadlineTo ?? ""}
                  onChange={(event) => {
                    const deadlineTo = event.target.value || undefined;
                    onChange({
                      deadlineFrom: deadlineTo && value.deadlineFrom && deadlineTo < value.deadlineFrom
                        ? deadlineTo
                        : value.deadlineFrom,
                      deadlineTo,
                    });
                  }}
                />
              </div>
            </div>
            {value.deadlineFrom && value.deadlineTo && value.deadlineFrom > value.deadlineTo ? (
              <p className="text-xs text-destructive">The start date must be before the end date.</p>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
