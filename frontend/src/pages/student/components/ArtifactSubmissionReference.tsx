import { Badge } from "@/components/ui/badge";
import type { MilestoneRubricDetail } from "@/types";
import { ChevronDown, ClipboardCheck, Info, ListChecks } from "lucide-react";

type Props = {
  checklist: Array<{ id: string; content: string; mandatory: boolean }>;
  rubric?: MilestoneRubricDetail | null;
};

const number = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);

export function ArtifactSubmissionReference({ checklist, rubric }: Props) {
  const totalWeight = rubric?.criteria.reduce((total, criterion) => total + criterion.weight, 0) ?? 0;
  const totalScore = rubric?.criteria.reduce((total, criterion) => total + criterion.maxScore, 0) ?? 0;

  return <aside className="min-w-0 space-y-4" aria-label="Submission requirements">
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="size-4 shrink-0 text-blue-600" /><h2>Acceptance checklist</h2></div>
        <Badge variant="secondary" className="shrink-0">{checklist.length} {checklist.length === 1 ? "criterion" : "criteria"}</Badge>
      </div>
      <p className="px-5 pt-2 text-sm leading-relaxed text-muted-foreground">Reference only. Your reviewer assesses these criteria after submission.</p>
      <ul className="space-y-2 px-5 py-4">
        {checklist.map((item, index) => <li key={item.id} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-sm">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium text-muted-foreground">{index + 1}</span>
          <div className="min-w-0 flex-1 space-y-1.5"><p className="break-words leading-relaxed [overflow-wrap:anywhere]">{item.content}</p>{item.mandatory && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">Required</Badge>}</div>
        </li>)}
        {!checklist.length && <li className="text-sm text-muted-foreground">No acceptance criteria configured.</li>}
      </ul>
      <p className="flex items-start gap-2 border-t px-5 py-3 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" />You do not need to tick these items to submit.</p>
    </section>

    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="px-5 pt-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="size-4 text-blue-600" />Evaluation rubric</h2><p className="mt-2 break-words text-sm text-muted-foreground">{rubric ? `${rubric.name} · Version ${rubric.version}` : "No evaluation rubric configured."}</p></div>
      {rubric && <>
        <div className="mx-5 mt-4 flex flex-wrap justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"><span>Total weight <strong>{number(totalWeight)}%</strong></span><span>Maximum score <strong>{number(totalScore)}</strong></span></div>
        <div className="space-y-2 p-5 pt-3">
          {rubric.criteria.map((criterion) => <details key={criterion.code} className="group overflow-hidden rounded-lg border">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 break-words text-sm font-medium [overflow-wrap:anywhere]">{criterion.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground" aria-label={`Weight ${number(criterion.weight)} percent, maximum score ${number(criterion.maxScore)}`}>{number(criterion.weight)}% · {number(criterion.maxScore)} pts</span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t bg-muted/20 p-3">
              {criterion.ratings?.map((rating) => <div key={rating.level} className="text-sm"><p className="text-xs font-semibold">{rating.level.replaceAll("_", " ")} ({number(rating.percentage)}%)</p><p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{rating.description}</p></div>)}
              {!criterion.ratings?.length && <p className="text-sm text-muted-foreground">No rating guidance provided.</p>}
            </div>
          </details>)}
          {!rubric.criteria.length && <p className="text-sm text-muted-foreground">No rubric criteria configured.</p>}
          {Math.abs(totalWeight - 100) > 0.0001 && <p role="status" className="text-xs text-destructive">Stored rubric weights total {number(totalWeight)}%. Values are displayed as configured.</p>}
          {!!rubric.criteria.length && <p className="pt-1 text-xs text-muted-foreground">Expand a criterion to view its rating guidance.</p>}
        </div>
      </>}
    </section>
  </aside>;
}
