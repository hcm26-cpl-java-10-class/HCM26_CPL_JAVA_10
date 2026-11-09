import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MilestoneProjectOption } from "@/types";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

interface MilestoneProjectPickerDialogProps {
  options: MilestoneProjectOption[];
  onClose: () => void;
  onConfirm: (option: MilestoneProjectOption) => void;
}

/**
 * Lets a mentor choose the target project before creating a milestone
 * while the milestone list is showing "All projects".
 * Mount it only while it should be visible.
 */
export function MilestoneProjectPickerDialog({ options, onClose, onConfirm }: MilestoneProjectPickerDialogProps) {
  const [selectedId, setSelectedId] = useState<string>(() => (options.length === 1 ? String(options[0].id) : ""));
  const selectedOption = options.find((option) => String(option.id) === selectedId);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="min-w-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create milestone</DialogTitle>
          <DialogDescription>
            Choose the project this milestone belongs to. Only projects where you can create milestones are listed.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="min-w-0 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedOption) onConfirm(selectedOption);
          }}
        >
          <div className="min-w-0 space-y-2">
            <Label htmlFor="milestone-create-project">Project</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger id="milestone-create-project" aria-label="Select project" className="w-full bg-background">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                align="start"
                sideOffset={4}
                className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1rem)] max-h-[min(20rem,var(--radix-select-content-available-height))]"
              >
                {options.length > 0 ? (
                  options.map((project) => (
                    <SelectItem key={String(project.id)} value={String(project.id)}>
                      <span className="flex min-w-0 items-center gap-2">
                        {project.code ? (
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            [{project.code}]
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate font-medium" title={project.name}>{project.name}</span>
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No project available for milestone creation.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!selectedOption}>
              Continue
              <ArrowRight />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
