import type { ComponentProps } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AssignmentRoleSelect({ value, onChange, allowAll = false, ...props }:
  Omit<ComponentProps<typeof SelectTrigger>, "value" | "onChange"> & {
    value: string; onChange: (value: string) => void; allowAll?: boolean;
  }) {
  return <Select value={value || (allowAll ? "ALL" : "")} onValueChange={(next) => onChange(next === "ALL" ? "" : next)} disabled={props.disabled}>
    <SelectTrigger {...props} className="w-full"><SelectValue placeholder="Select a role" /></SelectTrigger>
    <SelectContent>
      {allowAll && <SelectItem value="ALL">All roles</SelectItem>}
      <SelectItem value="MAIN">Main trainer</SelectItem>
      <SelectItem value="ASSISTANT">Assistant trainer</SelectItem>
    </SelectContent>
  </Select>;
}
