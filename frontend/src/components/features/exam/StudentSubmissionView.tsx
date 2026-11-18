import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExamAttemptReview, ExamReviewQuestion } from "@/api/exam.api";
import { formatScore } from "@/utils/examScore";

interface StudentSubmissionViewProps {
  review: ExamAttemptReview;
  /**
   * Diem va dap an dung/sai da duoc cong bo hay chua.
   * `false` = chi hien thi cau da lam cua hoc sinh.
   */
  revealAnswers?: boolean;
}

function optionClass(correct: boolean, selected: boolean, revealAnswers: boolean) {
  if (!revealAnswers) {
    if (selected) return "border-cyan-400 bg-cyan-50 text-cyan-900";
    return "border-slate-200 bg-white text-slate-700";
  }
  if (correct) return "border-emerald-400 bg-emerald-50 text-emerald-900";
  if (selected) return "border-red-400 bg-red-50 text-red-900";
  return "border-slate-200 bg-white text-slate-700";
}

function QuestionReview({
  question,
  index,
  revealAnswers,
}: {
  question: ExamReviewQuestion;
  index: number;
  revealAnswers: boolean;
}) {
  const isCoding = question.type === "CODING";
  const isEssay = question.type === "ESSAY" || isCoding;
  const showScore = revealAnswers && question.score != null;

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-base">
          Question {index + 1}: {question.content}
        </CardTitle>
        {isEssay ? (
          <Badge variant="outline">{isCoding ? "Coding" : "Essay"}</Badge>
        ) : revealAnswers ? (
          question.correct ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Correct</Badge>
          ) : (
            <Badge variant="destructive">Incorrect</Badge>
          )
        ) : (
          <Badge variant="outline">Answered</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {question.imageUrl && (
          <img src={question.imageUrl} alt="" className="max-h-60 rounded border" />
        )}
        {isEssay ? (
          <div className="space-y-2 text-sm">
            <p
              className={`whitespace-pre-wrap rounded border bg-slate-50 p-3 ${isCoding ? "font-mono text-xs" : ""}`}
            >
              {question.textAnswer || "No answer"}
            </p>
            {showScore && (
              <p className="text-slate-600">
                Score: {formatScore(question.score ?? 0)}/{formatScore(question.maxScore ?? question.points)}
              </p>
            )}
            {revealAnswers && question.feedback && (
              <p className="text-slate-600">Feedback: {question.feedback}</p>
            )}
          </div>
        ) : (
          <>
            {question.options.map((option) => (
              <div
                key={option.id}
                className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm ${optionClass(
                  option.correct,
                  option.selected,
                  revealAnswers,
                )}`}
              >
                <span>{option.content}</span>
                <span className="shrink-0 text-xs font-medium">
                  {option.selected && "Your answer"}
                  {revealAnswers && option.selected && option.correct && " · "}
                  {revealAnswers && option.correct && "Correct answer"}
                </span>
              </div>
            ))}
            <p className="text-xs text-slate-500">
              {formatScore(question.maxScore ?? question.points)} point(s)
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function StudentSubmissionView({
  review,
  revealAnswers,
}: StudentSubmissionViewProps) {
  const effectiveReveal = revealAnswers ?? review.revealAnswers ?? true;

  if (!review.questions || review.questions.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        This attempt has no questions to display.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {review.questions.map((question, index) => (
        <QuestionReview
          key={question.questionId}
          question={question}
          index={index}
          revealAnswers={effectiveReveal}
        />
      ))}
    </div>
  );
}
