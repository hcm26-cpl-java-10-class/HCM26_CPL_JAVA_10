import { lessonApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import type { LessonDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LessonFormModal } from "./LessonFormModal";
import { formatDuration, LessonPreview } from "./LessonPreview";

interface SectionLessonsProps {
  sectionId: number;
}


export function SectionLessons({ sectionId }: SectionLessonsProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("LESSON_CREATE");
  const canUpdate = hasPermission("LESSON_UPDATE");
  const canDelete = hasPermission("LESSON_DELETE");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LessonDTO | null>(null);
  const [previewing, setPreviewing] = useState<LessonDTO | null>(null);
  const [deleting, setDeleting] = useState<LessonDTO | null>(null);

  const lessonsQuery = useQuery({
    queryKey: ["lessons", sectionId],
    queryFn: () => lessonApi.getBySection(sectionId),
  });
  const lessons = lessonsQuery.data ?? [];

  const nextOrderIndex = useMemo(
    () => (lessons.length ? Math.max(...lessons.map((l) => l.orderIndex ?? 0)) + 1 : 0),
    [lessons],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: number) => lessonApi.delete(String(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lessons"] });
      toast.success("Lesson deleted.");
      setDeleting(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not delete the lesson.");
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (lesson: LessonDTO) => {
    setEditing(lesson);
    setFormOpen(true);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Lessons</h2>
          <p className="text-sm text-muted-foreground">
            Section #{sectionId} · {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Add lesson
          </Button>
        )}
      </div>

      {lessonsQuery.isLoading ? (
        <p role="status" className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          Loading lessons...
        </p>
      ) : lessonsQuery.isError ? (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-6">
          <p className="text-sm text-destructive">Could not load lessons of this section.</p>
          <Button variant="outline" onClick={() => void lessonsQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : lessons.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <h3 className="font-semibold">No lessons yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {canCreate ? "Add the first lesson to this section." : "This section has no lessons."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lessons.map((lesson) => (
                <TableRow key={lesson.id}>
                  <TableCell>{lesson.orderIndex}</TableCell>
                  <TableCell className="max-w-xs truncate font-medium">{lesson.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lesson.contentType}</Badge>
                  </TableCell>
                  <TableCell>{formatDuration(lesson.duration)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Preview ${lesson.title}`}
                        onClick={() => setPreviewing(lesson)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      {canUpdate && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${lesson.title}`}
                          onClick={() => openEdit(lesson)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Delete ${lesson.title}`}
                          onClick={() => setDeleting(lesson)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LessonFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        sectionId={sectionId}
        lesson={editing}
        defaultOrderIndex={nextOrderIndex}
      />

      <Dialog open={!!previewing} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewing?.title}</DialogTitle>
            <DialogDescription>Lesson preview</DialogDescription>
          </DialogHeader>
          {previewing && <LessonPreview lesson={previewing} hideHeader />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Delete lesson"
        description={`Delete "${deleting?.title ?? ""}"? This action cannot be undone.`}
        loading={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting?.id !== undefined && deleteMutation.mutate(deleting.id)}
      />
    </section>
  );
}

export default SectionLessons;
