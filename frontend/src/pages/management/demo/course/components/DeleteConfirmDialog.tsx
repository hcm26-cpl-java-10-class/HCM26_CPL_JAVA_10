import { useState } from "react";
import { courseError } from "@/integrations/courses/course-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { CourseItem } from "../types";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CourseItem | null;
  onConfirm: (course: CourseItem) => Promise<void>;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  course,
  onConfirm,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400">
              <Trash2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Delete Course
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Are you sure you want to delete this course?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          <p className="text-xs text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border border-slate-100 dark:border-zinc-800">
            Course: <strong className="text-slate-900 dark:text-zinc-100">{course.name}</strong>
            <br />
            Instructor: <span>{course.instructor}</span>
          </p>
          <p className="text-[11px] text-red-500 mt-2">
            This action cannot be undone. Courses referenced by enrollments or lessons may be rejected by the server. Referenced records will not be deleted by this action.
          </p>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs border-slate-200 dark:border-zinc-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={submitting}
            onClick={async () => {
              if (submitting) return;
              setSubmitting(true); setError("");
              try { await onConfirm(course); onOpenChange(false); }
              catch (failure) { setError(courseError(failure)); }
              finally { setSubmitting(false); }
            }}
            className="text-xs bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting ? "Deleting..." : "Delete Course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
