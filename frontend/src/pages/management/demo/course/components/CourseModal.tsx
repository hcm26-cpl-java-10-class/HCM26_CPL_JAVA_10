import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { courseError } from "@/integrations/courses/course-data";
import type { CourseFormData, CourseItem } from "../types";

interface CourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CourseItem | null;
  onSave: (formData: CourseFormData) => Promise<void>;
}



export const CourseModal: React.FC<CourseModalProps> = ({
  open,
  onOpenChange,
  course,
  onSave,
}) => {
  const isEditing = !!course;

  const [formData, setFormData] = useState<CourseFormData>({
    name: "",
    instructor: "",
    category: "",
    publicationStatus: "",
    courseLevel: "",
    description: "",
    thumbnailUrl: "",
    isActive: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (course) {
      setFormData({
        name: course.name,
        instructor: course.instructor,
        category: course.category === "Not available" ? "" : course.category,
        publicationStatus: course.publicationStatus === "Not available" ? "" : course.publicationStatus.toUpperCase(),
        courseLevel: course.courseLevel === "Not available" ? "" : course.courseLevel.toUpperCase(),
        instructorEmail: course.instructorEmail,
        description: course.description || "",
        thumbnailUrl: course.thumbnailUrl || "",
        isActive: course.isActive,
      });
    } else {
      setFormData({
        name: "",
        instructor: "",
        category: "",
        publicationStatus: "",
        courseLevel: "",
        description: "",
        thumbnailUrl: "",
        isActive: true,
      });
    }
    setErrors({});
  }, [course, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    if (submitting) return;
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Course name is required";
    }
    if (!formData.instructor.trim()) {
      newErrors.instructor = "Instructor name is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try { await onSave(formData); onOpenChange(false); }
    catch (error) { setErrors({ form: courseError(error) }); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {isEditing ? "Edit Course" : "Create New Course"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Course Name */}
          <div className="space-y-1.5">
            <Label htmlFor="course-name" className="text-xs font-semibold">
              Course Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="course-name" maxLength={150}
              placeholder="e.g. Java Fundamentals"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Instructor & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="course-instructor" className="text-xs font-semibold">
                Instructor <span className="text-red-500">*</span>
              </Label>
              <Input
                id="course-instructor" maxLength={100}
                placeholder="e.g. Teacher User"
                value={formData.instructor}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, instructor: e.target.value }))
                }
                className="h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
              />
              {errors.instructor && (
                <p className="text-xs text-red-500">{errors.instructor}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Input aria-label="Category codes" maxLength={255} value={formData.category || ""} placeholder="JAVA, WEB_DEV" onChange={e=>setFormData(p=>({...p,category:e.target.value}))} className="h-9 text-xs" />
            </div>
          </div>

          {/* Publication Status & Course Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Publication Status</Label>
              <Select
                value={formData.publicationStatus}
                onValueChange={(val: any) =>
                  setFormData((prev) => ({ ...prev, publicationStatus: val }))
                }
              >
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
                  <SelectValue placeholder="Not available" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                  <SelectItem value="PUBLISHED" className="text-xs">
                    Published
                  </SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                  <SelectItem value="DRAFT" className="text-xs">
                    Draft
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Course Level</Label>
              <Select
                value={formData.courseLevel}
                onValueChange={(val: any) =>
                  setFormData((prev) => ({ ...prev, courseLevel: val }))
                }
              >
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
                  <SelectValue placeholder="Not available" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                  <SelectItem value="BEGINNER" className="text-xs">
                    Beginner
                  </SelectItem>
                  <SelectItem value="INTERMEDIATE" className="text-xs">
                    Intermediate
                  </SelectItem>
                  <SelectItem value="ADVANCED" className="text-xs">
                    Advanced
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Metadata is saved with the Course. Publication status is separate from Active.</p>
          <div className="space-y-1.5"><Label htmlFor="course-instructor-email">Instructor Email</Label><Input id="course-instructor-email" type="email" maxLength={255} value={formData.instructorEmail||""} onChange={e=>setFormData(p=>({...p,instructorEmail:e.target.value}))} /></div>
          {/* Thumbnail URL */}
          <div className="space-y-1.5">
            <Label htmlFor="course-thumbnail" className="text-xs font-semibold">
              Thumbnail URL
            </Label>
            <Input
              id="course-thumbnail" maxLength={255}
              placeholder="https://img.youtube.com/vi/..."
              value={formData.thumbnailUrl}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, thumbnailUrl: e.target.value }))
              }
              className="h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="course-desc" className="text-xs font-semibold">
              Description
            </Label>
            <Textarea
              id="course-desc" maxLength={500}
              rows={3}
              placeholder="Brief course overview and learning objectives..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="course-active"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="size-4 rounded border-slate-300 text-slate-900 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <Label htmlFor="course-active" className="text-xs cursor-pointer">
              Active Status (Visible to students)
            </Label>
          </div>

          {errors.form && <p role="alert" className="text-sm text-destructive">{errors.form}</p>}
          <DialogFooter className="pt-4 border-t border-slate-200 dark:border-zinc-800">
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
              type="submit"
              disabled={submitting}
              size="sm"
              className="text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
