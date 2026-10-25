import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TaskDTO } from "@/types/features/task";
import { Loader2, Trash2 } from "lucide-react";

export function TaskDeleteDialog({
  task,
  dependencyCount,
  pending,
  onClose,
  onConfirm,
}: {
  task: TaskDTO;
  dependencyCount: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Delete task?</DialogTitle>
          <DialogDescription className="break-words">
            You are about to delete "{task.title}" from this project.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {dependencyCount > 0
            ? `${dependencyCount} related dependencies will be removed.`
            : "This task has no dependencies."}
        </p>
        <p className="text-sm text-muted-foreground">
          Tasks linked to an artifact or review cannot be deleted.
        </p>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {pending ? "Deleting..." : "Confirm delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
