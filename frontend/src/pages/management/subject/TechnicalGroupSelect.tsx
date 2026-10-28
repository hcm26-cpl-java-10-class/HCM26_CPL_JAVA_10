import { subjectApi, technicalGroupQueryKey } from "@/api/features/subject.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  id: string;
  value: unknown;
  onChange: (value: string) => void;
  invalid: boolean;
}

export function TechnicalGroupSelect({ id, value, onChange, invalid }: Props) {
  const client = useQueryClient();
  const { hasPermission } = usePermissions();
  const canAdd = hasPermission("SUBJECT_CREATE") || hasPermission("SUBJECT_UPDATE");
  const groups = useQuery({ queryKey: technicalGroupQueryKey, queryFn: subjectApi.getTechnicalGroups });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const selected = typeof value === "string" ? value : "";
  // Keep an existing record visible while its catalogue loads; never replace its saved value.
  const options = selected && !groups.data?.includes(selected)
    ? [selected, ...(groups.data ?? [])] : groups.data ?? [];

  const create = useMutation({
    mutationFn: subjectApi.createTechnicalGroup,
    onSuccess: (group) => {
      client.setQueryData<string[]>(technicalGroupQueryKey, (current) =>
        Array.from(new Set([...(current ?? []), group.name])).sort((a, b) => a.localeCompare(b)));
      void client.invalidateQueries({ queryKey: technicalGroupQueryKey });
      onChange(group.name);
      setOpen(false);
      setName("");
      setError(undefined);
      toast.success("Technical group added.");
    },
    onError: (failure) => {
      setError(axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(failure)
        ? failure.response?.data?.errors?.name?.[0] ?? failure.response?.data?.message ?? "Unable to add the technical group. Try again."
        : "Unable to add the technical group. Try again.");
    },
  });

  return (
    <>
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select value={selected} onValueChange={(next) => {
            // A refreshed option list may emit an empty native-select event inside a form.
            if (next) onChange(next);
          }} disabled={groups.isPending}>
            <SelectTrigger id={id} className="w-full" title={selected} aria-invalid={invalid}>
              <SelectValue placeholder={groups.isPending ? "Loading technical groups..." : "Select technical group..."} />
            </SelectTrigger>
            <SelectContent position="popper">
              {options.map((group) => <SelectItem key={group} value={group}>{group}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canAdd && (
          <Button type="button" variant="outline" className="shrink-0" onClick={() => {
            setName(""); setError(undefined); setOpen(true);
          }}>
            <Plus className="size-4" /> Add group
          </Button>
        )}
      </div>
      {groups.isError && (
        <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
          <span>Unable to load technical groups.</span>
          <Button type="button" variant="link" size="sm" onClick={() => void groups.refetch()}>Retry</Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (!create.isPending) setOpen(next); }}>
        <DialogContent showCloseButton={!create.isPending}>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (create.isPending) return;
            const normalized = name.normalize("NFC").replace(/[\s\p{Z}\uFEFF]+/gu, " ").trim();
            if (!normalized) { setError("Technical group name is required"); return; }
            if (normalized.length > 100) { setError("Technical group name must not exceed 100 characters"); return; }
            setError(undefined);
            create.mutate(normalized);
          }}>
            <DialogHeader>
              <DialogTitle>Add technical group</DialogTitle>
              <DialogDescription>The new group will be available when creating or editing subjects.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-new-name`}>Group name</Label>
              <Input id={`${id}-new-name`} value={name} autoFocus maxLength={100} disabled={create.isPending}
                aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-group-error` : undefined}
                placeholder="e.g. Data Science" onChange={(event) => { setName(event.target.value); setError(undefined); }} />
              {error && <p id={`${id}-group-error`} role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={create.isPending} onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || !name.trim()}>{create.isPending ? "Adding..." : "Add group"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
