import { qnaApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import type { LessonAnswer, LessonQuestion } from "@/types";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, MessageSquare, Pencil, Reply, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 10;
const MAX_LENGTH = 2000;

function errorMessage(error: any, fallback: string): string {
  const data = error?.response?.data;
  const firstFieldError = data?.errors
    ? (Object.values(data.errors).flat()[0] as string | undefined)
    : undefined;
  return firstFieldError || data?.message || fallback;
}

function formatWhen(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

interface ComposerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  placeholder: string;
  submitLabel: string;
  pending: boolean;
  rows?: number;
}

function Composer({
  id,
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  submitLabel,
  pending,
  rows = 3,
}: ComposerProps) {
  const trimmed = value.trim();
  return (
    <div className="space-y-2">
      <Textarea
        id={id}
        aria-label={placeholder}
        value={value}
        rows={rows}
        maxLength={MAX_LENGTH}
        placeholder={placeholder}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {value.length}/{MAX_LENGTH} characters
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="button" size="sm" disabled={pending || !trimmed} onClick={onSubmit}>
            {pending ? "Saving..." : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

type Editing = { type: "question" | "answer"; questionId: number; answerId?: number; draft: string };
type Replying = { questionId: number; draft: string };
type Deleting = { questionId: number; answerId?: number };

interface LessonQnAProps {
  lessonId: number;
  className?: string;
}

/**
 * Hỏi đáp dưới từng bài học: học viên đặt câu hỏi, giảng viên (chủ khóa học) / admin trả lời.
 * Quyền sửa / xóa / trả lời do backend tính sẵn trong từng item (canEdit, canDelete, canAnswer).
 */
export function LessonQnA({ lessonId, className }: LessonQnAProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("LESSON_QUESTION_READ");
  const canAsk = hasPermission("LESSON_QUESTION_CREATE");

  const queryKey = ["lesson-qna", lessonId];

  const [askDraft, setAskDraft] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [replying, setReplying] = useState<Replying | null>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);

  const questionsQuery = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => qnaApi.list(lessonId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.number + 1 < last.totalPages ? last.number + 1 : undefined),
    enabled: canRead && Number.isInteger(lessonId) && lessonId > 0,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const onError = (fallback: string) => (error: unknown) =>
    toast.error(errorMessage(error, fallback));

  const askMutation = useMutation({
    mutationFn: (content: string) => qnaApi.ask(lessonId, content),
    onSuccess: async () => {
      setAskDraft("");
      await refresh();
      toast.success("Question posted.");
    },
    onError: onError("Could not post your question."),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ questionId, content }: { questionId: number; content: string }) =>
      qnaApi.updateQuestion(lessonId, questionId, content),
    onSuccess: async () => {
      setEditing(null);
      await refresh();
      toast.success("Question updated.");
    },
    onError: onError("Could not update the question."),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: number) => qnaApi.deleteQuestion(lessonId, questionId),
    onSuccess: async () => {
      setDeleting(null);
      await refresh();
      toast.success("Question deleted.");
    },
    onError: onError("Could not delete the question."),
  });

  const answerMutation = useMutation({
    mutationFn: ({ questionId, content }: { questionId: number; content: string }) =>
      qnaApi.answer(lessonId, questionId, content),
    onSuccess: async () => {
      setReplying(null);
      await refresh();
      toast.success("Answer posted.");
    },
    onError: onError("Could not post the answer."),
  });

  const updateAnswerMutation = useMutation({
    mutationFn: ({
      questionId,
      answerId,
      content,
    }: {
      questionId: number;
      answerId: number;
      content: string;
    }) => qnaApi.updateAnswer(lessonId, questionId, answerId, content),
    onSuccess: async () => {
      setEditing(null);
      await refresh();
      toast.success("Answer updated.");
    },
    onError: onError("Could not update the answer."),
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: ({ questionId, answerId }: { questionId: number; answerId: number }) =>
      qnaApi.deleteAnswer(lessonId, questionId, answerId),
    onSuccess: async () => {
      setDeleting(null);
      await refresh();
      toast.success("Answer deleted.");
    },
    onError: onError("Could not delete the answer."),
  });

  if (!canRead) return null;

  const questions: LessonQuestion[] =
    questionsQuery.data?.pages.flatMap((page) => page.content) ?? [];
  const total = questionsQuery.data?.pages[0]?.totalElements ?? 0;

  const confirmDelete = () => {
    if (!deleting) return;
    if (deleting.answerId !== undefined) {
      deleteAnswerMutation.mutate({
        questionId: deleting.questionId,
        answerId: deleting.answerId,
      });
    } else {
      deleteQuestionMutation.mutate(deleting.questionId);
    }
  };

  const isEditingQuestion = (question: LessonQuestion) =>
    editing?.type === "question" && editing.questionId === question.id;
  const isEditingAnswer = (answer: LessonAnswer) =>
    editing?.type === "answer" && editing.answerId === answer.id;

  return (
    <section aria-labelledby={`qna-title-${lessonId}`} className={className}>
      <div className="flex items-center gap-2">
        <MessageSquare className="size-5 text-muted-foreground" />
        <h2 id={`qna-title-${lessonId}`} className="text-lg font-semibold">
          Questions &amp; answers
        </h2>
        {total > 0 && <Badge variant="secondary">{total}</Badge>}
      </div>

      {canAsk && (
        <div className="mt-4 rounded-xl border bg-muted/20 p-4">
          <label htmlFor={`qna-ask-${lessonId}`} className="mb-2 block text-sm font-medium">
            Ask about this lesson
          </label>
          <Composer
            id={`qna-ask-${lessonId}`}
            value={askDraft}
            onChange={setAskDraft}
            placeholder="Write your question for the instructor..."
            submitLabel="Post question"
            pending={askMutation.isPending}
            onSubmit={() => askMutation.mutate(askDraft.trim())}
          />
        </div>
      )}

      <div className="mt-5 space-y-4">
        {questionsQuery.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading questions...
          </p>
        ) : questionsQuery.isError ? (
          <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 p-4">
            <p className="text-sm text-destructive">
              {errorMessage(questionsQuery.error, "Could not load questions.")}
            </p>
            <Button variant="outline" size="sm" onClick={() => void questionsQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : questions.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No questions yet.{canAsk ? " Be the first to ask!" : ""}
          </p>
        ) : (
          questions.map((question) => (
            <article key={question.id} className="space-y-3 rounded-xl border p-4">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{question.authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(question.createdAt)}
                  </span>
                  <Badge variant={question.answered ? "default" : "outline"}>
                    {question.answered ? "Answered" : "Awaiting answer"}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  {question.canEdit && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit question"
                      onClick={() =>
                        setEditing({
                          type: "question",
                          questionId: question.id,
                          draft: question.content,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {question.canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete question"
                      onClick={() => setDeleting({ questionId: question.id })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </header>

              {isEditingQuestion(question) && editing ? (
                <Composer
                  id={`qna-edit-question-${question.id}`}
                  value={editing.draft}
                  onChange={(draft) => setEditing({ ...editing, draft })}
                  placeholder="Edit your question"
                  submitLabel="Save"
                  pending={updateQuestionMutation.isPending}
                  onCancel={() => setEditing(null)}
                  onSubmit={() =>
                    updateQuestionMutation.mutate({
                      questionId: question.id,
                      content: editing.draft.trim(),
                    })
                  }
                />
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm">{question.content}</p>
              )}

              {question.answers.length > 0 && (
                <div className="space-y-3 border-l-2 pl-4">
                  {question.answers.map((answer) => (
                    <div key={answer.id} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{answer.authorName}</span>
                          {answer.byInstructor && (
                            <Badge variant="secondary">
                              <GraduationCap /> Instructor
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatWhen(answer.createdAt)}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {answer.canEdit && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Edit answer"
                              onClick={() =>
                                setEditing({
                                  type: "answer",
                                  questionId: question.id,
                                  answerId: answer.id,
                                  draft: answer.content,
                                })
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {answer.canDelete && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete answer"
                              onClick={() =>
                                setDeleting({ questionId: question.id, answerId: answer.id })
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {isEditingAnswer(answer) && editing ? (
                        <Composer
                          id={`qna-edit-answer-${answer.id}`}
                          value={editing.draft}
                          onChange={(draft) => setEditing({ ...editing, draft })}
                          placeholder="Edit your answer"
                          submitLabel="Save"
                          pending={updateAnswerMutation.isPending}
                          onCancel={() => setEditing(null)}
                          onSubmit={() =>
                            updateAnswerMutation.mutate({
                              questionId: question.id,
                              answerId: answer.id,
                              content: editing.draft.trim(),
                            })
                          }
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-sm">{answer.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {question.canAnswer &&
                hasPermission("LESSON_ANSWER_CREATE") &&
                (replying?.questionId === question.id ? (
                  <Composer
                    id={`qna-reply-${question.id}`}
                    value={replying.draft}
                    onChange={(draft) => setReplying({ questionId: question.id, draft })}
                    placeholder="Write your answer..."
                    submitLabel="Post answer"
                    pending={answerMutation.isPending}
                    onCancel={() => setReplying(null)}
                    onSubmit={() =>
                      answerMutation.mutate({
                        questionId: question.id,
                        content: replying.draft.trim(),
                      })
                    }
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReplying({ questionId: question.id, draft: "" })}
                  >
                    <Reply className="size-4" /> Answer
                  </Button>
                ))}
            </article>
          ))
        )}

        {questionsQuery.hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              disabled={questionsQuery.isFetchingNextPage}
              onClick={() => void questionsQuery.fetchNextPage()}
            >
              {questionsQuery.isFetchingNextPage ? "Loading..." : "Load more questions"}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleting}
        title={deleting?.answerId !== undefined ? "Delete answer" : "Delete question"}
        description={
          deleting?.answerId !== undefined
            ? "Delete this answer? This action cannot be undone."
            : "Delete this question and all of its answers? This action cannot be undone."
        }
        loading={deleteQuestionMutation.isPending || deleteAnswerMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

export default LessonQnA;