import { examApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExamDTO, QuestionDTO } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { initialQuestionForm, QuestionForm, type QuestionFormValues } from "./question/components/QuestionForm";

function getErrorMessage(error: any, fallback: string): string {
  const data = error?.response?.data;
  const firstFieldError = data?.errors ? (Object.values(data.errors).flat()[0] as string | undefined) : undefined;
  return firstFieldError || data?.message || fallback;
}

// Đề đã đến giờ bắt đầu thì không còn được sửa câu hỏi
export function isExamStarted(exam: ExamDTO | null | undefined): boolean {
  return Boolean(exam?.startTime && new Date(exam.startTime).getTime() <= Date.now());
}

export function QuestionAnswers({ question }: { question: QuestionDTO }) {
  if (question.type === "ESSAY") {
    return <span className="mt-2 block text-xs italic text-muted-foreground">Tự luận - chấm tay, không có đáp án.</span>;
  }
  return (
    <ul className="mt-2 grid gap-1">
      {(question.options ?? []).map((option, index) => (
        <li
          key={option.id ?? index}
          className={`flex items-start gap-1.5 text-xs ${option.correct ? "font-medium text-green-700" : "text-muted-foreground"}`}
        >
          {option.correct ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
          <span className="min-w-0 break-words">{option.content}</span>
          {option.correct && <Badge variant="outline" className="h-4 px-1 text-[10px] text-green-700">Đúng</Badge>}
        </li>
      ))}
    </ul>
  );
}

interface EditExamQuestionDialogProps {
  exam: ExamDTO | null;
  question: QuestionDTO | null;
  onClose: () => void;
  onSaved: (exam: ExamDTO) => void;
}

// Sửa bản sao của câu hỏi trong đề; câu hỏi gốc trong ngân hàng không bị thay đổi
export function EditExamQuestionDialog({ exam, question, onClose, onSaved }: EditExamQuestionDialogProps) {
  const [form, setForm] = useState<QuestionFormValues>(initialQuestionForm);

  useEffect(() => {
    if (!question) return;
    setForm({
      content: question.content || "",
      type: question.type || "MULTIPLE_CHOICE",
      difficulty: question.difficulty || "EASY",
      topic: question.topic || "",
      points: question.points ?? 1,
      isActive: question.isActive ?? true,
      options: (question.options ?? []).map((option) => ({
        id: option.id,
        content: option.content,
        correct: !!option.correct,
      })),
    });
  }, [question]);

  const saveMutation = useMutation({
    mutationFn: (values: QuestionFormValues) =>
      examApi.updateQuestion(exam!.id!, question!.id, { ...question, ...values } as QuestionDTO),
    onSuccess: (updated) => {
      toast.success("Đã cập nhật câu hỏi trong đề");
      onSaved(updated);
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Không thể cập nhật câu hỏi")),
  });

  return (
    <Dialog open={Boolean(question)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sửa câu hỏi trong đề</DialogTitle>
          <DialogDescription>
            Đây là bản sao riêng của đề "{exam?.title}". Thay đổi ở đây không ảnh hưởng câu hỏi gốc trong ngân hàng.
          </DialogDescription>
        </DialogHeader>
        <QuestionForm
          form={form}
          setForm={setForm}
          onSubmit={(values) => saveMutation.mutate(values)}
          isSaving={saveMutation.isPending}
          submitLabel="Lưu"
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
