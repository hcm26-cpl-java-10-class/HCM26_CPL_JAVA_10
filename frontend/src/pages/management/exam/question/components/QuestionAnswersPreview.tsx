import { Badge } from "@/components/ui/badge";
import type { QuestionDTO } from "@/types";
import { Check } from "lucide-react";

export function QuestionAnswersPreview({ question }: { question: QuestionDTO }) {
  if (question.type === "ESSAY") {
    const criteria = question.gradingCriteria ?? [];
    if (criteria.length === 0) {
      return (
        <div className="p-3 rounded-lg bg-muted/30 text-xs italic text-muted-foreground border">
          Essay — evaluated based on student response and grading rubric.
        </div>
      );
    }
    return (
      <div className="p-3 rounded-lg bg-muted/20 border space-y-2">
        <span className="text-xs font-semibold text-muted-foreground">Grading Rubric ({criteria.length}):</span>
        <ul className="space-y-1.5 divide-y divide-border/60">
          {criteria.map((c, i) => (
            <li key={i} className="pt-1.5 flex items-start justify-between gap-2 text-xs">
              <div>
                <span className="font-medium text-foreground">{c.name}</span>
                {c.description && <p className="text-muted-foreground text-[11px] mt-0.5">{c.description}</p>}
              </div>
              <span className="font-semibold text-primary shrink-0">{c.weightPercentage}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (question.type === "CODING") {
    const code = question.code;
    if (!code) {
      return (
        <div className="p-3 rounded-lg bg-muted/20 border text-xs italic text-muted-foreground">
          Coding problem — automated grading via test cases (no code configuration).
        </div>
      );
    }
    const params = (code.params ?? []).map((p) => `${p.type} ${p.name}`).join(", ");
    const signature = `public static ${code.returnType} ${code.functionName}(${params})`;
    const tests = code.tests ?? [];
    const codeBlock = (title: string, body?: string | null) => (
      <div className="space-y-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
        <pre className="p-2.5 rounded bg-muted/60 border font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre max-h-80 overflow-y-auto">
          {body && body.trim() ? body : "(empty)"}
        </pre>
      </div>
    );
    return (
      <div className="p-3 rounded-lg bg-muted/20 border space-y-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-muted-foreground">Coding Problem Specification:</span>
          <code className="font-mono text-[11px] text-primary">{signature}</code>
          {code.timeLimitSeconds ? (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{code.timeLimitSeconds}s / test</Badge>
          ) : null}
        </div>

        {codeBlock("Class Solution (starter code)", code.starterCode)}
        {codeBlock(code.customMain ? "Class Main (custom)" : "Class Main (auto-generated)", code.mainCode)}

        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Test cases ({tests.length})
          </span>
          {tests.length === 0 ? (
            <p className="text-muted-foreground italic">No test cases configured.</p>
          ) : (
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium w-8">#</th>
                    <th className="px-2 py-1 text-left font-medium">Input</th>
                    <th className="px-2 py-1 text-left font-medium">Expected</th>
                    <th className="px-2 py-1 text-left font-medium w-16">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {tests.map((t, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1 whitespace-pre-wrap break-all">
                        {(code.params ?? []).map((p, k) => `${p.name} = ${t.inputs?.[k] ?? ""}`).join(", ")}
                      </td>
                      <td className="px-2 py-1 whitespace-pre-wrap break-all">{t.expected}</td>
                      <td className="px-2 py-1 font-sans">
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                          {t.visible ? "Visible" : "Hidden"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // MULTIPLE_CHOICE
  const options = question.options ?? [];
  if (options.length === 0) {
    return <p className="text-xs italic text-muted-foreground p-2">No answer choices provided.</p>;
  }

  return (
    <div className="p-3 rounded-lg bg-muted/20 border space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground block mb-1">Answer Choices:</span>
      <ul className="grid gap-1.5">
        {options.map((option, index) => {
          const letter = String.fromCharCode(65 + index);
          const isCorrect = Boolean(option.correct);
          return (
            <li
              key={option.id ?? index}
              className={`flex items-start gap-2 rounded px-2.5 py-1.5 text-xs transition-colors border ${
                isCorrect
                  ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-medium border-emerald-500/30"
                  : "bg-background/60 text-muted-foreground border-transparent"
              }`}
            >
              <span className={`font-semibold shrink-0 ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/70"}`}>
                {letter}.
              </span>
              <span className="min-w-0 flex-1 break-words">{option.content}</span>
              {isCorrect && (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-emerald-600 border-emerald-500/40 dark:text-emerald-400 bg-emerald-500/15 shrink-0 flex items-center gap-0.5">
                  <Check className="size-2.5" /> Correct
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
