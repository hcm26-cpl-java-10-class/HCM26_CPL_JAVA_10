import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MilestoneRubricDetail } from "@/types";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { RubricCriterionCard } from "@/pages/management/project/rubric/components/RubricCriterionCard";
import { RubricWeightBar } from "@/pages/management/project/rubric/components/RubricWeightBar";

const formatNumber = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);

export function MilestoneRubricCard({ rubric }: { rubric: MilestoneRubricDetail }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const criteria = rubric.criteria;
  const totalWeight = criteria.reduce((total, item) => total + item.weight, 0);
  const totalScore = criteria.reduce((total, item) => total + item.maxScore, 0);
  const invalidWeight = criteria.length > 0 && Math.abs(totalWeight - 100) > 0.0001;
  const allCollapsed = criteria.length > 0 && criteria.every((item) => collapsed.has(item.code));
  const toggle = (code: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });

  return (
    <div className="grid gap-3">
      <Card className="gap-3 py-4">
        <CardHeader className="flex px-5 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5" /> Evaluation rubric</CardTitle>
            <CardDescription className="mt-1 [overflow-wrap:anywhere]">{rubric.name} · Version {rubric.version}</CardDescription>
          </div>
          <div className="flex shrink-0 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Criteria</div><div className="font-semibold">{criteria.length}</div></div>
            <div><div className="text-xs text-muted-foreground">Max score</div><div className="font-semibold">{formatNumber(totalScore)}</div></div>
          </div>
        </CardHeader>
        {criteria.length ? <CardContent className="px-5"><RubricWeightBar criteria={criteria} /></CardContent> : null}
      </Card>

      {invalidWeight ? (
        <Alert variant="destructive"><AlertTriangle /><AlertTitle>Stored rubric weight is invalid</AlertTitle><AlertDescription>The stored criteria total {formatNumber(totalWeight)}%. Values are shown exactly as saved.</AlertDescription></Alert>
      ) : null}

      {criteria.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No rubric criteria were stored.</p>
      ) : (
        <section className="grid gap-2" aria-label="Rubric criteria">
          <div className="-mb-1 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(criteria.map((item) => item.code)))}>
              {allCollapsed ? "Expand all" : "Collapse all"}
            </Button>
          </div>
          {criteria.map((criterion, index) => (
            <RubricCriterionCard key={criterion.code} criterion={criterion} index={index} open={!collapsed.has(criterion.code)} onToggle={() => toggle(criterion.code)} />
          ))}
        </section>
      )}
    </div>
  );
}
