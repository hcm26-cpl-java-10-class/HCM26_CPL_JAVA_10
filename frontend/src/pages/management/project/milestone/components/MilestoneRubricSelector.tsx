import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MilestoneRubricOption } from "@/types";
import { AlertTriangle, ClipboardCheck, ExternalLink, Eye, FileCheck2 } from "lucide-react";
import { useState } from "react";

const formatNumber = (value: number) => new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2,
}).format(value);

export function getMilestoneRubricMetrics(rubric?: MilestoneRubricOption) {
  return {
    criteriaCount: rubric?.criteria.length ?? 0,
    totalWeight: rubric?.criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0) ?? 0,
    totalMaxScore: rubric?.criteria.reduce((sum, criterion) => sum + Number(criterion.maxScore), 0) ?? 0,
  };
}

interface MilestoneRubricSelectorProps {
  rubrics: MilestoneRubricOption[];
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function MilestoneRubricSelector({
  rubrics,
  value,
  error,
  disabled = false,
  onChange,
}: MilestoneRubricSelectorProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const rubric = rubrics.find((item) => item.id === value);
  const metrics = getMilestoneRubricMetrics(rubric);
  const invalidWeight = Boolean(rubric) && Math.abs(metrics.totalWeight - 100) > 0.0001;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-5" /> Evaluation rubric
              </CardTitle>
              <CardDescription className="mt-1">
                Choose the rubric version used to evaluate submissions for this milestone.
              </CardDescription>
            </div>
            <Button asChild type="button" variant="ghost" size="sm" className="w-fit shrink-0">
              <a href="/rubrics" target="_blank" rel="noreferrer">
                Manage rubrics <ExternalLink className="size-4" />
              </a>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="milestone-rubric">
              Rubric version <span className="text-destructive">*</span>
            </Label>
            <Select value={value} onValueChange={onChange} disabled={disabled || !rubrics.length}>
              <SelectTrigger id="milestone-rubric" aria-invalid={Boolean(error)}>
                <SelectValue placeholder="Select a rubric version" />
              </SelectTrigger>
              <SelectContent>
                {rubrics.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          {rubric ? (
            <div className="grid gap-4 rounded-xl border bg-gradient-to-br from-background to-muted/35 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                    <FileCheck2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{rubric.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{rubric.version}</Badge>
                      {rubrics.length === 1 ? (
                        <span className="text-xs text-muted-foreground">Only eligible version</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="size-4" /> View full rubric
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-background/80 px-2 py-3">
                  <p className="text-lg font-semibold">{metrics.criteriaCount}</p>
                  <p className="text-[11px] text-muted-foreground">Criteria</p>
                </div>
                <div className="rounded-lg border bg-background/80 px-2 py-3">
                  <p className={invalidWeight ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>
                    {formatNumber(metrics.totalWeight)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">Total weight</p>
                </div>
                <div className="rounded-lg border bg-background/80 px-2 py-3">
                  <p className="text-lg font-semibold">{formatNumber(metrics.totalMaxScore)}</p>
                  <p className="text-[11px] text-muted-foreground">Max score</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                This rubric version will define the criteria used to evaluate milestone submissions.
              </p>

              {invalidWeight ? (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>Rubric weight needs attention</AlertTitle>
                  <AlertDescription>
                    The selected criteria total {formatNumber(metrics.totalWeight)}% instead of 100%.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : rubrics.length ? (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center">
              <ClipboardCheck className="size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No rubric selected</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Select an eligible rubric version to define how this milestone will be evaluated.
              </p>
            </div>
          ) : (
            <Alert>
              <AlertTriangle />
              <AlertTitle>No eligible rubric versions</AlertTitle>
              <AlertDescription>
                Create and publish a rubric before creating this milestone.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <ClipboardCheck className="size-5" />
              <span>{rubric?.name || "Rubric preview"}</span>
              {rubric ? <Badge variant="secondary">{rubric.version}</Badge> : null}
            </DialogTitle>
            <DialogDescription>
              Review the scoring criteria before assigning this rubric to the milestone.
            </DialogDescription>
          </DialogHeader>

          {rubric ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-lg font-semibold">{metrics.criteriaCount}</p>
                  <p className="text-xs text-muted-foreground">Criteria</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className={invalidWeight ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>
                    {formatNumber(metrics.totalWeight)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Total weight</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-lg font-semibold">{formatNumber(metrics.totalMaxScore)}</p>
                  <p className="text-xs text-muted-foreground">Maximum score</p>
                </div>
              </div>

              {invalidWeight ? (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>Stored rubric weight is invalid</AlertTitle>
                  <AlertDescription>
                    The stored criteria total {formatNumber(metrics.totalWeight)}%. Values are shown exactly as saved.
                  </AlertDescription>
                </Alert>
              ) : null}

              {rubric.criteria.length ? (
                <>
                  <div className="hidden overflow-hidden rounded-md border md:block">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Criterion and rating guidance</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                          <TableHead className="text-right">Max score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rubric.criteria.map((criterion, index) => (
                          <TableRow key={`${criterion.code}-${index}`}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="whitespace-normal">
                              <p className="font-medium">{criterion.name}</p>
                              <p className="mt-1 font-mono text-xs text-muted-foreground">{criterion.code}</p>
                              <div className="mt-2 grid gap-1 text-xs">
                                {criterion.ratings?.map((rating) => (
                                  <div key={`${criterion.code}-${rating.level}`}>
                                    <span className="font-medium">
                                      {rating.level.replace("_", " ")} ({rating.percentage}%):
                                    </span>{" "}
                                    <span className="text-muted-foreground">{rating.description}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(criterion.weight)}%</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(criterion.maxScore)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 md:hidden">
                    {rubric.criteria.map((criterion, index) => (
                      <div key={`${criterion.code}-${index}`} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{criterion.name}</p>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{criterion.code}</p>
                          </div>
                          <Badge variant="outline">#{index + 1}</Badge>
                        </div>
                        <div className="mt-3 grid gap-1 text-xs">
                          {criterion.ratings?.map((rating) => (
                            <div key={`${criterion.code}-${rating.level}`}>
                              <span className="font-medium">
                                {rating.level.replace("_", " ")} ({rating.percentage}%):
                              </span>{" "}
                              <span className="text-muted-foreground">{rating.description}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Weight</p>
                            <p className="mt-1 font-semibold">{formatNumber(criterion.weight)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Maximum score</p>
                            <p className="mt-1 font-semibold">{formatNumber(criterion.maxScore)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No rubric criteria were stored.
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}
