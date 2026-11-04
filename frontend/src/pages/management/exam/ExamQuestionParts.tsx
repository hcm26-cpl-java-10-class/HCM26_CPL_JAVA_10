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

export function isExamStarted(exam: ExamDTO | null | undefined): boolean {
  return Boolean(exam?.startTime && new Date(exam.startTime).getTime() <= Date.now());
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre">{code.trimEnd()}</pre>
    </div>
  );
}

/** Coding question details for the teacher: function signature, starter code, Main class and all test cases. */
function CodingDetails({ question }: { question: QuestionDTO }) {
  const spec = question.code;
  if (!spec) {
    return <span className="mt-2 block text-xs italic text-muted-foreground">Lập trình - chấm theo test cases tự động.</span>;
  }
  const signature = `public static ${spec.returnType} ${spec.functionName}(${spec.params.map((p) => `${p.type} ${p.name}`).join(", ")})`;
  const tests = spec.tests ?? [];
  return (
    <div className="mt-3 grid gap-3">
      <span className="block text-xs italic text-muted-foreground">Lập trình - chấm theo test cases tự động.</span>
      <CodeBlock title="Function signature" code={signature} />
      {spec.starterCode?.trim() && <CodeBlock title="Starter code (shown to students)" code={spec.starterCode} />}
      {spec.referenceCode?.trim() && <CodeBlock title="Reference solution (teacher's demo code)" code={spec.referenceCode} />}
      {spec.mainCode?.trim() && (
        <CodeBlock title={spec.customMain ? "Main class (written by teacher)" : "Main class (auto-generated)"} code={spec.mainCode} />
      )}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Test cases ({tests.length}){spec.timeLimitSeconds ? ` · ${spec.timeLimitSeconds}s per test` : ""}
        </p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-1.5 font-medium">#</th>
                <th className="px-2 py-1.5 font-medium">Input ({spec.params.map((p) => p.name).join(", ")})</th>
                <th className="px-2 py-1.5 font-medium">Expected</th>
                <th className="w-20 px-2 py-1.5 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5 font-mono">{t.inputs.join(" | ")}</td>
                  <td className="px-2 py-1.5 font-mono">{t.expected}</td>
                  <td className="px-2 py-1.5">
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">{t.visible ? "Visible" : "Hidden"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function QuestionAnswers({ question }: { question: QuestionDTO }) {
  if (question.type === "ESSAY") {
    return <span className="mt-2 block text-xs italic text-muted-foreground">Tự luận - chấm tay, không có đáp án.</span>;
  }
  if (question.type === "CODING") {
    return <CodingDetails question={question} />;
  }
  return (
    <ul className="mt-2 grid gap-1.5">
      {(question.options ?? []).map((option, index) => {
        const optionLetter = String.fromCharCode(65 + index);
        const isCorrect = Boolean(option.correct);
        return (
          <li
            key={option.id ?? index}
            className={`flex items-start gap-2 rounded px-2 py-1 text-xs transition-colors ${
              isCorrect
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-500/30"
                : "text-muted-foreground hover:bg-muted/40"
            }`}
          >
            <span className={`font-semibold shrink-0 ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/70"}`}>
              {optionLetter}.
            </span>
            <span className="min-w-0 flex-1 break-words">{option.content}</span>
            {isCorrect && (
              <Badge variant="outline" className="h-4 px-1 text-[10px] text-emerald-600 border-emerald-500/40 dark:text-emerald-400 bg-emerald-500/15 shrink-0 flex items-center gap-0.5">
                <Check className="size-2.5" /> Đúng
              </Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface EditExamQuestionDialogProps {
  exam: ExamDTO | null;
  question: QuestionDTO | null;
  onClose: () => void;
  onSaved: (exam: ExamDTO) => void;
}

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
      imageUrl: question.imageUrl ?? "",
      gradingCriteria: question.gradingCriteria ?? [],
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
