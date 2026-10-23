import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MilestoneRubricDetail } from "@/types";
import { AlertTriangle, ClipboardCheck } from "lucide-react";

const formatNumber = (value: number) => new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2,
}).format(value);

export function MilestoneRubricCard({ rubric }: { rubric: MilestoneRubricDetail }) {
  const totalWeight = rubric.criteria.reduce((total, item) => total + item.weight, 0);
  const totalScore = rubric.criteria.reduce((total, item) => total + item.maxScore, 0);
  const invalidWeight = Math.abs(totalWeight - 100) > 0.0001;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5" /> Evaluation rubric</CardTitle>
        <CardDescription>{rubric.name} · Version {rubric.version}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {rubric.criteria.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No rubric criteria were stored.</p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border md:block">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow><TableHead>Criterion</TableHead><TableHead className="text-right">Weight</TableHead><TableHead className="text-right">Maximum score</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {rubric.criteria.map((criterion) => (
                    <TableRow key={criterion.code}>
                      <TableCell className="whitespace-normal"><p className="font-medium">{criterion.name}</p><p className="mt-1 text-xs text-muted-foreground">{criterion.code}</p></TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(criterion.weight)}%</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(criterion.maxScore)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 md:hidden">
              {rubric.criteria.map((criterion) => (
                <div key={criterion.code} className="rounded-xl border p-4">
                  <p className="font-medium">{criterion.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{criterion.code}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Weight</p><p className="mt-1 font-semibold">{formatNumber(criterion.weight)}%</p></div>
                    <div><p className="text-xs text-muted-foreground">Maximum score</p><p className="mt-1 font-semibold">{formatNumber(criterion.maxScore)}</p></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-4 text-sm">
              <span>Total weight: <strong>{formatNumber(totalWeight)}%</strong></span>
              <span>Maximum score: <strong>{formatNumber(totalScore)}</strong></span>
            </div>
          </>
        )}

        {invalidWeight ? (
          <Alert variant="destructive"><AlertTriangle /><AlertTitle>Stored rubric weight is invalid</AlertTitle><AlertDescription>The stored criteria total {formatNumber(totalWeight)}%. Values are shown exactly as saved.</AlertDescription></Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
