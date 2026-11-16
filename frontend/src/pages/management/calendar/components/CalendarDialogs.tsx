import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RemovalTarget } from "../calendar.types";

export function RemoveConfirmDialog({
  removal,
  onClose,
  onConfirm,
}: {
  removal: RemovalTarget | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={removal !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove {removal?.kind}?</DialogTitle>
          <DialogDescription className="text-xs">
            Are you sure you want to remove this {removal?.kind} and all nested items from the schedule?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SaveScheduleDialog({
  open,
  onOpenChange,
  classCode,
  changeNote,
  onChangeNote,
  isSaving,
  onConfirmSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classCode: string;
  changeNote: string;
  onChangeNote: (note: string) => void;
  isSaving: boolean;
  onConfirmSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Training Calendar : {classCode}</DialogTitle>
          <DialogDescription className="text-xs">
            Provide an optional change note explaining the schedule adjustments for class {classCode}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-xs">
          <label className="space-y-1 block font-medium">
            Change note / reason
            <Input
              maxLength={500}
              className="h-9 text-xs"
              value={changeNote}
              onChange={(e) => onChangeNote(e.target.value)}
              placeholder={`e.g. Điều chỉnh thời gian các buổi học cho lớp ${classCode}`}
            />
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" disabled={isSaving} onClick={onConfirmSave}>
            {isSaving ? "Saving..." : "Confirm & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UnsavedLeaveDialog({
  open,
  onOpenChange,
  onConfirmLeave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmLeave?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Discard Unsaved Changes?</DialogTitle>
          <DialogDescription className="text-xs">
            You have unsaved changes in this calendar. Leaving now will discard all edits made since your last save.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Keep Editing
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirmLeave}>
            Discard & Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

