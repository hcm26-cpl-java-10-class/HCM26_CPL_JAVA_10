import { CurriculumAssessment } from "./CurriculumAssessment";
import type { CourseExam } from "@/types";
import { invalidateAssessmentViews } from "@/utils/assessment-queries";
import { ConfigureAssessmentLink } from "./ConfigureAssessmentLink";
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
import { Eye, Lock, LockOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LessonFormModal } from "./LessonFormModal";
import { LessonQnA } from "./LessonQnA";
import { formatDuration, LessonPreview } from "./LessonPreview";

interface SectionLessonsProps {
  sectionId: number;
  assessments?: CourseExam[];
  assessmentsReady?: boolean;
  canManageAssessments?: boolean;
  /**
   * Open this lesson's preview (and jump to one of its questions) once the lessons are loaded.
   * Used by the instructor's "Unanswered questions" inbox and notification emails.
   */
  deepLink?: { lessonId: number; questionId?: number | null } | null;
  /** Called once the deep link has been handled, so it is not re-applied on the next expand. */
  onDeepLinkConsumed?: () => void;
}


export function SectionLessons({ sectionId, deepLink, onDeepLinkConsumed, assessments = [], assessmentsReady = false, canManageAssessments = false }: SectionLessonsProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("LESSON_CREATE");
  const canUpdate = hasPermission("LESSON_UPDATE");
  const canDelete = hasPermission("LESSON_DELETE");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LessonDTO | null>(null);
  const [previewing, setPreviewing] = useState<LessonDTO | null>(null);
  const [focusQuestionId, setFocusQuestionId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LessonDTO | null>(null);

  const lessonsQuery = useQuery({
    queryKey: ["lessons", sectionId],
    queryFn: () => lessonApi.getBySection(sectionId),
  });
  const lessons = [...(lessonsQuery.data ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || (a.id ?? 0) - (b.id ?? 0));
  const uniqueAssessments = [...new Map(assessments.filter(exam => exam.sectionId === sectionId).map(exam => [exam.id, exam])).values()];
  const extraAssessments = uniqueAssessments.filter(exam => !lessons.some(lesson =>
    lesson.id === exam.lessonId && ["QUIZ", "EXAM", "ASSIGNMENT"].includes(lesson.contentType ?? "")));


  useEffect(() => {
    if (!deepLink || !lessonsQuery.isSuccess) return;
    const target = lessonsQuery.data.find((lesson) => lesson.id === deepLink.lessonId);
    if (target) {
      setPreviewing(target);
      setFocusQuestionId(deepLink.questionId ?? null);
    } else {
      toast.info("That lesson no longer exists.");
    }
    onDeepLinkConsumed?.();
  }, [deepLink, lessonsQuery.isSuccess, lessonsQuery.data, onDeepLinkConsumed]);

  const nextOrderIndex = useMemo(
    () => (lessons.length ? Math.max(...lessons.map((l) => l.orderIndex ?? 0)) + 1 : 0),
    [lessons],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: number) => lessonApi.delete(String(id)),
    onSuccess: async () => {
      await invalidateAssessmentViews(queryClient);
      toast.success("Lesson deleted.");
      setDeleting(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not delete the lesson.");
    },
  });

  // Bật/tắt cho phép học viên tua video của một lesson (cần quyền LESSON_UPDATE)
  const seekingMutation = useMutation({
    mutationFn: ({ id, allowSeeking }: { id: number; allowSeeking: boolean }) =>
      lessonApi.update(String(id), { allowSeeking }),
    onSuccess: async (saved) => {
      await invalidateAssessmentViews(queryClient);
      toast.success(saved.allowSeeking ? "Seeking enabled." : "Seeking disabled.");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not change seeking.");
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
            Section #{sectionId} · {lessons.length} lesson{lessons.length === 1 ? "" : "s"}{assessmentsReady ? ` · ${uniqueAssessments.length} assessments` : ""}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Add lesson
          </Button>
        )}
      </div>

      {lessonsQuery.isLoading ? (
        <p role="status" className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
          Loading lessons...
        </p>
      ) : lessonsQuery.isError ? (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4">
          <p className="text-sm text-destructive">Could not load lessons of this section.</p>
          <Button variant="outline" onClick={() => void lessonsQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : lessons.length === 0 && extraAssessments.length === 0 ? (
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
                  <TableCell>{["QUIZ", "EXAM", "ASSIGNMENT"].includes(lesson.contentType ?? "") && uniqueAssessments.some(exam => exam.lessonId === lesson.id)
                    ? `${uniqueAssessments.find(exam => exam.lessonId === lesson.id)!.durationMinutes} min` : formatDuration(lesson.duration)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <ConfigureAssessmentLink lesson={lesson} />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Preview ${lesson.title}`}
                        onClick={() => setPreviewing(lesson)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      {canUpdate && (lesson.contentType === "VIDEO" || lesson.contentType === "AUDIO") && lesson.id !== undefined && (
                        <Button
                          size="sm"
                          variant={lesson.allowSeeking ? "outline" : "secondary"}
                          disabled={seekingMutation.isPending}
                          aria-pressed={!!lesson.allowSeeking}
                          aria-label={`${lesson.allowSeeking ? "Disable" : "Enable"} video seeking for ${lesson.title}`}
                          title={
                            lesson.allowSeeking
                              ? "Learners can skip ahead. Click to lock seeking."
                              : "Seeking is locked. Click to let learners skip ahead."
                          }
                          onClick={() =>
                            seekingMutation.mutate({ id: lesson.id!, allowSeeking: !lesson.allowSeeking })
                          }
                        >
                          {lesson.allowSeeking ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                          {lesson.allowSeeking ? "Seek on" : "Seek off"}
                        </Button>
                      )}
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
              {extraAssessments.map(exam => <TableRow key={`assessment-${exam.id}`}>
                <TableCell>—</TableCell>
                <TableCell colSpan={4}>{canManageAssessments ? <CurriculumAssessment exam={exam} /> : <div>{exam.title} · {exam.category} · {exam.durationMinutes} min</div>}</TableCell>
              </TableRow>)}
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

      <Dialog
        open={!!previewing}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewing(null);
            setFocusQuestionId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewing?.title}</DialogTitle>
            <DialogDescription>Lesson preview</DialogDescription>
          </DialogHeader>
          {previewing && <LessonPreview lesson={previewing} hideHeader />}
          {previewing?.id !== undefined && (
            <LessonQnA
              key={previewing.id}
              lessonId={previewing.id}
              focusQuestionId={focusQuestionId}
              className="mt-3 border-t pt-3"
            />
          )}
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