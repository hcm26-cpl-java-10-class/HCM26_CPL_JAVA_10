import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { CourseItem } from "../types";

interface CourseDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CourseItem | null;
}

export const CourseDetailModal: React.FC<CourseDetailModalProps> = ({
  open,
  onOpenChange,
  course,
}) => {
  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Course Overview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Thumbnail Preview */}
          <div className="relative h-44 rounded-lg overflow-hidden bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 flex items-center justify-center">
            {course.thumbnailUrl ? (
              <img
                src={course.thumbnailUrl}
                alt={course.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <GraduationCap className="w-12 h-12 text-slate-400 dark:text-zinc-500" />
            )}
            <Badge className="absolute top-2.5 left-2.5 bg-white/90 text-slate-800 border border-slate-200 dark:bg-zinc-900/90 dark:text-zinc-200 dark:border-zinc-700">
              {course.category || "Not available"}
            </Badge>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
              {course.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Instructor: <span className="font-medium text-slate-700 dark:text-zinc-300">{course.instructor}</span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-zinc-800 text-xs">
            <div>
              <span className="text-slate-400 dark:text-zinc-500 block">Level</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{course.courseLevel || "Not available"}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-zinc-500 block">Publication</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{course.publicationStatus || "Not available"}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-zinc-500 block">Status</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                {course.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Description
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border border-slate-100 dark:border-zinc-800">
              {course.description || "No description provided."}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 pt-1">
            <span>Created: {course.createdAt}</span>
            <span className="truncate max-w-[200px]" title={course.thumbnailUrl}>
              Media: {course.thumbnailUrl || "None"}
            </span>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between sm:justify-between">
          <Button asChild variant="outline" size="sm" className="text-xs gap-1.5 border-slate-200 dark:border-zinc-800">
            <Link to={`/courses/${course.id}`}>
              Full Page <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
