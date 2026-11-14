import { aiAssistantApi } from "@/api/features/ai-assistant.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AiSuggestionDetail,
  GeneratedTemplateOutput,
  MilestoneOutput,
  ResourceOutput,
  RubricCriterionOutput,
  RubricRatingOutput,
  TeamConstraintsOutput,
  ProjectTemplateApplyResult,
} from "@/types/features/ai-assistant";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Flag,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Users,
  Boxes,
  Trash2,
  X,
} from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AiTemplateResult } from "../components/AiTemplateResult";

const statusStyles: Record<AiSuggestionDetail["status"], string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  REJECTED: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
  APPLIED: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
};

const ratingLevels = ["EXCELLENT", "GOOD", "FAIR", "NOT_MET"] as const;
const REVIEW_PAGE_SIZE = 3;

function useReviewPagination(total: number) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * REVIEW_PAGE_SIZE;
  return { currentPage, pageCount, start, setPage };
}

function ReviewPagination({
  label,
  total,
  currentPage,
  pageCount,
  start,
  setPage,
}: {
  label: string;
  total: number;
  currentPage: number;
  pageCount: number;
  start: number;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-indigo-100 pt-3 text-xs text-muted-foreground dark:border-indigo-900/60">
      <span>Showing {start + 1}–{Math.min(start + REVIEW_PAGE_SIZE, total)} of {total} {label}</span>
      <nav aria-label={`${label} pagination`} className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 border-indigo-200 px-2 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
          disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label={`Previous ${label} page`}>
          <ChevronLeft className="size-4" /><span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="whitespace-nowrap font-medium tabular-nums text-indigo-700 dark:text-indigo-300">Page {currentPage + 1} of {pageCount}</span>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 border-indigo-200 px-2 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
          disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} aria-label={`Next ${label} page`}>
          <span className="hidden sm:inline">Next</span><ChevronRight className="size-4" />
        </Button>
      </nav>
    </div>
  );
}

function redistributeMilestoneWeights(milestones: MilestoneOutput[]): MilestoneOutput[] {
  if (milestones.length === 0) return [];

  const weightsInCents = milestones.map((milestone) =>
    Number.isFinite(milestone.weight) ? Math.max(0, Math.round((milestone.weight ?? 0) * 100)) : 0,
  );
  const totalWeight = weightsInCents.reduce((total, weight) => total + weight, 0);
  const allocations = weightsInCents.map((weight) => totalWeight > 0
    ? (weight * 10_000) / totalWeight
    : 10_000 / milestones.length);
  const roundedDown = allocations.map(Math.floor);
  let remainingCents = 10_000 - roundedDown.reduce((total, weight) => total + weight, 0);

  const remainderOrder = allocations
    .map((allocation, index) => ({ index, fraction: allocation - roundedDown[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  for (let index = 0; remainingCents > 0; index += 1, remainingCents -= 1) {
    roundedDown[remainderOrder[index % remainderOrder.length].index] += 1;
  }

  return milestones.map((milestone, index) => ({
    ...milestone,
    orderIndex: index + 1,
    weight: roundedDown[index] / 100,
  }));
}

function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: unknown; error?: unknown }>(error)) {
    const body = error.response?.data;
    if (typeof body?.message === "string") return body.message;
    if (typeof body?.error === "string") return body.error;
    return error.message || "The request could not be completed.";
  }
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function ProjectOverviewEditor({
  output,
  onChange,
}: {
  output: GeneratedTemplateOutput;
  onChange: (output: GeneratedTemplateOutput) => void;
}) {
  const project = output.projectTemplate;
  if (!project) return null;

  const update = (field: keyof NonNullable<GeneratedTemplateOutput["projectTemplate"]>, value: string | number | null) => {
    onChange({ ...output, projectTemplate: { ...project, [field]: value } });
  };

  return (
    <Card className="overflow-hidden border-indigo-200/70 shadow-sm dark:border-indigo-900/60">
      <CardHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-background dark:border-indigo-900/60 dark:from-indigo-950/30">
        <CardTitle className="text-indigo-950 dark:text-indigo-100">Project template</CardTitle>
        <CardDescription>Edit the draft template details before accepting this suggestion.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 bg-indigo-50/20 sm:grid-cols-2 dark:bg-indigo-950/10">
        <div className="grid gap-2">
          <Label htmlFor="review-template-code">Code</Label>
          <Input id="review-template-code" maxLength={100} value={project.code ?? ""}
            onChange={(event) => update("code", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="review-template-name">Name</Label>
          <Input id="review-template-name" maxLength={255} value={project.name ?? ""}
            onChange={(event) => update("name", event.target.value)} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="review-template-description">Description</Label>
          <Textarea id="review-template-description" rows={4} value={project.description ?? ""}
            onChange={(event) => update("description", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="review-template-stack">Technology stack</Label>
          <Input id="review-template-stack" maxLength={2000} value={project.technologyStack ?? ""}
            onChange={(event) => update("technologyStack", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="review-template-category">Category</Label>
          <Input id="review-template-category" maxLength={255} value={project.category ?? ""}
            onChange={(event) => update("category", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="review-template-level">Level</Label>
          <Input id="review-template-level" maxLength={20} value={project.level ?? ""}
            onChange={(event) => update("level", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="review-template-duration">Estimated duration (weeks)</Label>
          <Input id="review-template-duration" type="number" min={1} step={1}
            value={project.estimatedDurationWeeks ?? ""}
            onChange={(event) => update("estimatedDurationWeeks", event.target.value ? Number(event.target.value) : null)} />
        </div>
      </CardContent>
    </Card>
  );
}

function MilestoneEditor({
  milestones,
  onChange,
}: {
  milestones: MilestoneOutput[];
  onChange: (milestones: MilestoneOutput[]) => void;
}) {
  const pagination = useReviewPagination(milestones.length);
  const [collapsedMilestones, setCollapsedMilestones] = useState<Set<number>>(() => new Set());
  const update = (index: number, patch: Partial<MilestoneOutput>) => {
    onChange(milestones.map((milestone, itemIndex) => itemIndex === index
      ? { ...milestone, ...patch }
      : milestone));
  };
  const removeMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    setCollapsedMilestones(new Set());
    onChange(redistributeMilestoneWeights(milestones.filter((_, milestoneIndex) => milestoneIndex !== index)));
  };
  const updateCriterion = (
    milestoneIndex: number,
    criterionIndex: number,
    patch: Partial<RubricCriterionOutput>,
  ) => {
    const criteria = milestones[milestoneIndex].rubricCriteria ?? [];
    update(milestoneIndex, {
      rubricCriteria: criteria.map((criterion, index) => index === criterionIndex
        ? { ...criterion, ...patch }
        : criterion),
    });
  };
  const updateRating = (
    milestoneIndex: number,
    criterionIndex: number,
    level: typeof ratingLevels[number],
    description: string,
  ) => {
    const criterion = milestones[milestoneIndex].rubricCriteria?.[criterionIndex];
    if (!criterion) return;
    const ratings = criterion.ratings ?? [];
    const existing = ratings.findIndex((rating) => rating.level === level);
    const nextRating: RubricRatingOutput = { level, description };
    const nextRatings = existing < 0
      ? [...ratings, nextRating]
      : ratings.map((rating, index) => index === existing ? nextRating : rating);
    updateCriterion(milestoneIndex, criterionIndex, { ratings: nextRatings });
  };

  return (
    <Card>
      <CardHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-sky-50/40 to-background dark:border-indigo-900/60 dark:from-indigo-950/40 dark:via-sky-950/20">
        <CardTitle className="flex items-center gap-2 text-indigo-950 dark:text-indigo-100"><span className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300"><CheckCircle2 className="size-4" /></span>Milestones</CardTitle>
        <CardDescription className="pl-10">
          Edit milestone details and rubric criteria. Removing a milestone redistributes the remaining milestone weights proportionally.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {milestones.slice(pagination.start, pagination.start + REVIEW_PAGE_SIZE).map((milestone, pageIndex) => {
          const index = pagination.start + pageIndex;
          return (
          <section key={`${milestone.orderIndex ?? index}-${index}`} className="grid gap-4 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-background p-3.5 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/20 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 font-semibold text-indigo-950 dark:text-indigo-100">
                <span className="flex size-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">{index + 1}</span>
                {milestone.title || `Milestone ${index + 1}`}
              </h4>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                  aria-expanded={!collapsedMilestones.has(index)}
                  aria-label={`${collapsedMilestones.has(index) ? "Expand" : "Collapse"} milestone ${index + 1}`}
                  onClick={() => setCollapsedMilestones((current) => {
                    const next = new Set(current);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  })}
                >
                  {collapsedMilestones.has(index) ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                  {collapsedMilestones.has(index) ? "Expand" : "Collapse"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
                  disabled={milestones.length <= 1}
                  aria-label={`Remove milestone ${index + 1}`}
                  title={milestones.length <= 1 ? "At least one milestone is required" : `Remove ${milestone.title || `milestone ${index + 1}`}`}
                  onClick={() => removeMilestone(index)}
                >
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline">Remove</span>
                </Button>
              </div>
            </div>
            {!collapsedMilestones.has(index) && <>
            <div className="grid gap-2">
              <Label htmlFor={`milestone-title-${index}`}>Milestone {index + 1} title</Label>
              <Input id={`milestone-title-${index}`} maxLength={120} value={milestone.title ?? ""}
                onChange={(event) => update(index, { title: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`milestone-description-${index}`}>Description</Label>
              <Textarea id={`milestone-description-${index}`} rows={3} value={milestone.description ?? ""}
                onChange={(event) => update(index, { description: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor={`milestone-due-${index}`}>Due after</Label>
                <Input id={`milestone-due-${index}`} type="number" min={1} step={1}
                  value={milestone.dueAfter ?? ""}
                  onChange={(event) => update(index, { dueAfter: event.target.value ? Number(event.target.value) : null })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`milestone-unit-${index}`}>Time unit</Label>
                <select id={`milestone-unit-${index}`} value={milestone.dueUnit ?? "WEEKS"}
                  onChange={(event) => update(index, { dueUnit: event.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <option value="DAYS">Days</option>
                  <option value="WEEKS">Weeks</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`milestone-weight-${index}`}>Weight (%)</Label>
                <Input id={`milestone-weight-${index}`} type="number" min={0} max={100} step="0.01"
                  value={milestone.weight ?? ""}
                  onChange={(event) => update(index, { weight: event.target.value ? Number(event.target.value) : null })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={milestone.mandatory}
                onCheckedChange={(checked) => update(index, { mandatory: checked === true })} />
              This milestone is mandatory
            </label>
            <div className="grid gap-3 border-t pt-4">
              <div>
                <h4 className="font-semibold text-violet-900 dark:text-violet-200">Rubric</h4>
                <p className="text-sm text-muted-foreground">
                  Criterion weights and maximum scores must each total 100. Each criterion needs all four rating levels.
                </p>
              </div>
              {(milestone.rubricCriteria ?? []).length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No rubric criteria are present for this milestone.
                </p>
              ) : (milestone.rubricCriteria ?? []).map((criterion, criterionIndex) => (
                <div key={`${criterion.code ?? criterionIndex}-${criterionIndex}`} className="grid min-w-0 gap-4 rounded-xl border border-violet-100 bg-violet-50/40 p-3.5 dark:border-violet-900/60 dark:bg-violet-950/20 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="font-semibold text-violet-900 dark:text-violet-200">Criterion {criterionIndex + 1}</h5>
                    <Badge variant="outline" className="border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">{criterion.weight ?? 0}% · {criterion.maxScore ?? 0} pts</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor={`rubric-code-${index}-${criterionIndex}`}>Code</Label>
                      <Input id={`rubric-code-${index}-${criterionIndex}`} maxLength={30}
                        value={criterion.code ?? ""}
                        onChange={(event) => updateCriterion(index, criterionIndex, { code: event.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`rubric-name-${index}-${criterionIndex}`}>Name</Label>
                      <Input id={`rubric-name-${index}-${criterionIndex}`} maxLength={100}
                        value={criterion.name ?? ""}
                        onChange={(event) => updateCriterion(index, criterionIndex, { name: event.target.value })} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor={`rubric-description-${index}-${criterionIndex}`}>Description</Label>
                      <Textarea id={`rubric-description-${index}-${criterionIndex}`} maxLength={500} rows={2}
                        value={criterion.description ?? ""}
                        onChange={(event) => updateCriterion(index, criterionIndex, { description: event.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`rubric-weight-${index}-${criterionIndex}`}>Weight (%)</Label>
                      <Input id={`rubric-weight-${index}-${criterionIndex}`} type="number" min={0.01} max={100} step="0.01"
                        value={criterion.weight ?? ""}
                        onChange={(event) => {
                          const weight = event.target.value ? Number(event.target.value) : null;
                          updateCriterion(index, criterionIndex, { weight, maxScore: weight });
                        }} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`rubric-score-${index}-${criterionIndex}`}>Maximum score</Label>
                      <Input id={`rubric-score-${index}-${criterionIndex}`} type="number" min={0.01} max={100} step="0.01"
                        value={criterion.maxScore ?? ""}
                        onChange={(event) => updateCriterion(index, criterionIndex, {
                          maxScore: event.target.value ? Number(event.target.value) : null,
                        })} />
                      <p className="text-xs text-muted-foreground">Must equal the criterion weight.</p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <h6 className="text-sm font-medium">Rating descriptions</h6>
                    {ratingLevels.map((level) => {
                      const rating = (criterion.ratings ?? []).find((item) => item.level === level);
                      return (
                        <div key={level} className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
                          <Label htmlFor={`rubric-rating-${index}-${criterionIndex}-${level}`} className="pt-2">{level}</Label>
                          <Textarea id={`rubric-rating-${index}-${criterionIndex}-${level}`} maxLength={500} rows={2}
                            value={rating?.description ?? ""}
                            onChange={(event) => updateRating(index, criterionIndex, level, event.target.value)}
                            placeholder={`Describe ${level.toLowerCase()} performance`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            </>}
          </section>
          );
        })}
        <ReviewPagination label="milestones" total={milestones.length} {...pagination} />
      </CardContent>
    </Card>
  );
}

function TeamConstraintsEditor({
  constraints,
  onChange,
}: {
  constraints: TeamConstraintsOutput | null;
  onChange: (constraints: TeamConstraintsOutput) => void;
}) {
  if (!constraints) return (
    <Card>
      <CardHeader><CardTitle>Team constraints</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-destructive">Team constraints are missing from this suggestion.</p></CardContent>
    </Card>
  );

  const quotas = constraints.roleQuotas ?? { pm: 0, ba: 0, dev: 1, qa: 0 };
  const updateQuota = (role: keyof typeof quotas, value: string) => {
    onChange({
      ...constraints,
      roleQuotas: { ...quotas, [role]: value === "" ? 0 : Number(value) },
    });
  };

  return (
    <Card className="overflow-hidden border-sky-200/70 shadow-sm dark:border-sky-900/60">
      <CardHeader className="border-b border-sky-100 bg-gradient-to-r from-sky-50/80 to-background dark:border-sky-900/60 dark:from-sky-950/30">
        <CardTitle className="text-sky-950 dark:text-sky-100">Team constraints</CardTitle>
        <CardDescription>Adjust the suggested team size, role quotas, and multi-role policy.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 bg-sky-50/20 dark:bg-sky-950/10">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="team-min-members">Minimum members</Label>
            <Input id="team-min-members" type="number" min={1} step={1} value={constraints.minMembers}
              onChange={(event) => onChange({ ...constraints, minMembers: Number(event.target.value) })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="team-max-members">Maximum members</Label>
            <Input id="team-max-members" type="number" min={1} step={1} value={constraints.maxMembers}
              onChange={(event) => onChange({ ...constraints, maxMembers: Number(event.target.value) })} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["pm", "Project Manager"],
            ["ba", "Business Analyst"],
            ["dev", "Developer"],
            ["qa", "Quality Assurance"],
          ] as const).map(([role, label]) => (
            <div key={role} className="grid gap-2">
              <Label htmlFor={`team-quota-${role}`}>{label} quota</Label>
              <Input id={`team-quota-${role}`} type="number" min={role === "dev" ? 1 : 0} step={1}
                value={quotas[role]} onChange={(event) => updateQuota(role, event.target.value)} />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-sky-200 bg-white/80 p-3 text-sm dark:border-sky-900 dark:bg-slate-950/50">
          <Checkbox checked={constraints.allowMultiRole}
            onCheckedChange={(checked) => onChange({ ...constraints, allowMultiRole: checked === true })} />
          Allow a team member to take multiple roles
        </label>
        <p className="text-xs text-muted-foreground">
          Total role quotas: {quotas.pm + quotas.ba + quotas.dev + quotas.qa} / {constraints.maxMembers} maximum members.
          At least one Developer is required.
        </p>
      </CardContent>
    </Card>
  );
}

function ResourceEditor({
  resources,
  onChange,
}: {
  resources: ResourceOutput[];
  onChange: (resources: ResourceOutput[]) => void;
}) {
  const pagination = useReviewPagination(resources.length);
  const update = (index: number, patch: Partial<ResourceOutput>) => {
    onChange(resources.map((resource, resourceIndex) => resourceIndex === index
      ? { ...resource, ...patch }
      : resource));
  };
  const remove = (index: number) => onChange(resources
    .filter((_, resourceIndex) => resourceIndex !== index)
    .map((resource, orderIndex) => ({ ...resource, orderIndex: orderIndex + 1 })));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-background dark:border-emerald-900/60 dark:from-emerald-950/30">
        <div>
          <CardTitle className="flex items-center gap-2 text-emerald-950 dark:text-emerald-100"><span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300"><Plus className="size-4" /></span>Resources</CardTitle>
          <CardDescription>Edit, add, or remove links included with the template.</CardDescription>
        </div>
        <Button type="button" size="sm" className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          onClick={() => {
            onChange([...resources, { title: "", description: "", kind: "LINK", url: "", orderIndex: resources.length + 1 }]);
            pagination.setPage(Math.floor(resources.length / REVIEW_PAGE_SIZE));
          }}>
          <Plus className="size-4" />Add resource
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        {resources.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No resources will be included in the draft.
          </p>
        )}
        {resources.slice(pagination.start, pagination.start + REVIEW_PAGE_SIZE).map((resource, pageIndex) => {
          const index = pagination.start + pageIndex;
          return (
          <div key={`resource-${index}`} className="grid min-w-0 gap-3 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-background p-3.5 dark:border-emerald-900/60 dark:from-emerald-950/20 sm:grid-cols-2 sm:p-4">
            <div className="grid gap-2">
              <Label htmlFor={`resource-title-${index}`}>Title</Label>
              <Input id={`resource-title-${index}`} maxLength={255} value={resource.title ?? ""}
                onChange={(event) => update(index, { title: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`resource-url-${index}`}>URL</Label>
              <Input id={`resource-url-${index}`} type="url" maxLength={2000} value={resource.url ?? ""}
                onChange={(event) => update(index, { url: event.target.value })} placeholder="https://example.com" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`resource-description-${index}`}>Description</Label>
              <Textarea id={`resource-description-${index}`} maxLength={1000} rows={2}
                value={resource.description ?? ""}
                onChange={(event) => update(index, { description: event.target.value })} />
            </div>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Link · order {index + 1}</Badge>
              <Button type="button" variant="outline" size="sm" className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950" onClick={() => remove(index)}>
                <Trash2 className="size-4" />Remove
              </Button>
            </div>
          </div>
          );
        })}
        <ReviewPagination label="resources" total={resources.length} {...pagination} />
      </CardContent>
    </Card>
  );
}

function SelectionEditor({
  title,
  description,
  labels,
  selected,
  onChange,
  emptyMessage,
}: {
  title: string;
  description: string;
  labels: string[];
  selected: boolean[];
  onChange: (index: number, included: boolean) => void;
  emptyMessage: string;
}) {
  const pagination = useReviewPagination(labels.length);
  const visibleLabels = labels.slice(pagination.start, pagination.start + REVIEW_PAGE_SIZE);
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b border-sky-100 bg-gradient-to-r from-sky-50/80 to-background dark:border-sky-900/60 dark:from-sky-950/30">
        <CardTitle className="text-sky-950 dark:text-sky-100">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {labels.length === 0 ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : (
          <ul className="grid gap-2">
            {visibleLabels.map((label, pageIndex) => {
              const index = pagination.start + pageIndex;
              return (
              <li key={`${label}-${index}`} className={`flex items-start gap-3 rounded-lg border p-3 ${selected[index] === false ? "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/30" : "border-sky-100 bg-sky-50/40 dark:border-sky-900/60 dark:bg-sky-950/20"}`}>
                <Checkbox checked={selected[index] ?? true}
                  aria-label={`Include ${label}`}
                  onCheckedChange={(checked) => onChange(index, checked === true)}
                  className="mt-0.5" />
                <span className={`min-w-0 text-sm ${selected[index] === false ? "text-muted-foreground line-through" : ""}`}>
                  {label}
                </span>
                <Badge variant={selected[index] === false ? "outline" : "secondary"} className={`ml-auto shrink-0 ${selected[index] === false ? "" : "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}`}>
                  {selected[index] === false ? "Rejected" : "Accepted"}
                </Badge>
              </li>
              );
            })}
          </ul>
        )}
        {labels.length > 0 && <div className="mt-3"><ReviewPagination label={title.toLowerCase()} total={labels.length} {...pagination} /></div>}
      </CardContent>
    </Card>
  );
}

function SuggestionReviewEditor({
  suggestion,
  onSaved,
  onApproved,
}: {
  suggestion: AiSuggestionDetail;
  onSaved: (suggestion: AiSuggestionDetail) => void;
  onApproved: (suggestion: AiSuggestionDetail) => void;
}) {
  const [output, setOutput] = useState(suggestion.output);
  const [selectedModules, setSelectedModules] = useState(() => (suggestion.output.modules ?? []).map(() => true));
  const [selectedBacklog, setSelectedBacklog] = useState(() => (suggestion.output.backlogItems ?? []).map(() => true));

  const modules = output.modules ?? [];
  const backlogItems = output.backlogItems ?? [];
  const milestones = output.milestones ?? [];
  const resources = output.resources ?? [];
  const filteredOutput = (): GeneratedTemplateOutput => ({
    ...output,
    modules: modules.filter((_, index) => selectedModules[index] !== false),
    backlogItems: backlogItems
      .filter((_, index) => selectedBacklog[index] !== false)
      .map((item, index) => ({ ...item, orderIndex: index + 1 })),
  });

  const saveMutation = useMutation({
    mutationFn: (updated: GeneratedTemplateOutput) => aiAssistantApi.updateSuggestion(suggestion.suggestionId, updated),
    onSuccess: (updated) => {
      setOutput(updated.output);
      setSelectedModules((updated.output.modules ?? []).map(() => true));
      setSelectedBacklog((updated.output.backlogItems ?? []).map(() => true));
      onSaved(updated);
      toast.success("Suggestion changes saved.");
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (updatedOutput: GeneratedTemplateOutput) => {
      await aiAssistantApi.updateSuggestion(suggestion.suggestionId, updatedOutput);
      return aiAssistantApi.approveSuggestion(suggestion.suggestionId);
    },
    onSuccess: (approved) => {
      onApproved(approved);
      toast.success("Suggestion accepted.");
    },
  });

  const updateMilestone = (updated: MilestoneOutput[]) => setOutput((current) => ({ ...current, milestones: updated }));
  const updateTeamConstraints = (teamConstraints: TeamConstraintsOutput) =>
    setOutput((current) => ({ ...current, teamConstraints }));
  const updateResources = (resources: ResourceOutput[]) =>
    setOutput((current) => ({ ...current, resources }));
  const isPending = saveMutation.isPending || approveMutation.isPending;
  const mutationError = saveMutation.error ?? approveMutation.error;

  return (
    <div className="grid gap-4">
      {mutationError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>Could not update suggestion</AlertTitle>
          <AlertDescription>{apiErrorMessage(mutationError)}</AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="overview" className="w-full min-w-0 max-w-full gap-3">
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-indigo-200/80 bg-gradient-to-r from-indigo-50/80 via-slate-50 to-sky-50/80 p-1 dark:border-indigo-900/70 dark:from-indigo-950/40 dark:via-slate-950 dark:to-sky-950/30">
          <TabsList aria-label="Suggestion review sections" className="!grid !h-auto !w-full min-w-0 grid-cols-2 gap-1.5 bg-transparent sm:grid-cols-3">
            <TabsTrigger value="overview" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200">
              <LayoutDashboard className="size-4" /><span className="max-w-full break-words">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200">
              <Users className="size-4" /><span className="max-w-full break-words">Team constraints</span>
            </TabsTrigger>
            <TabsTrigger value="milestones" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200">
              <Flag className="size-4" /><span className="max-w-full break-words">Milestones{milestones.length > 0 ? ` (${milestones.length})` : ""}</span>
            </TabsTrigger>
            <TabsTrigger value="backlog" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200">
              <ListChecks className="size-4" /><span className="max-w-full break-words">Backlog{backlogItems.length > 0 ? ` (${backlogItems.length})` : ""}</span>
            </TabsTrigger>
            <TabsTrigger value="modules" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200">
              <Boxes className="size-4" /><span className="max-w-full break-words">Modules{modules.length > 0 ? ` (${modules.length})` : ""}</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="h-auto min-h-12 !w-full min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950 dark:data-[state=active]:text-indigo-200">
              <ExternalLink className="size-4" /><span className="max-w-full break-words">Resources{resources.length > 0 ? ` (${resources.length})` : ""}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-0 min-w-0">
          <ProjectOverviewEditor output={output} onChange={setOutput} />
        </TabsContent>
        <TabsContent value="team" className="mt-0 min-w-0">
          <TeamConstraintsEditor constraints={output.teamConstraints} onChange={updateTeamConstraints} />
        </TabsContent>
        <TabsContent value="milestones" className="mt-0 min-w-0">
          <MilestoneEditor milestones={milestones} onChange={updateMilestone} />
        </TabsContent>
        <TabsContent value="backlog" className="mt-0 min-w-0">
          <SelectionEditor
            title="Accept or reject backlog items"
            description="Accepted backlog items are included in the template draft. Rejected items are removed when saved."
            labels={backlogItems.map((item) => item.title ?? "Untitled backlog item")}
            selected={selectedBacklog}
            onChange={(index, included) => setSelectedBacklog((current) =>
              current.map((value, itemIndex) => itemIndex === index ? included : value))}
            emptyMessage="No backlog items were generated."
          />
        </TabsContent>
        <TabsContent value="modules" className="mt-0 min-w-0">
          <SelectionEditor
            title="Select modules"
            description="Only accepted modules are created as child templates when this suggestion is applied."
            labels={modules.map((module) => `${module.code ?? ""} ${module.name ?? "Untitled module"}`.trim())}
            selected={selectedModules}
            onChange={(index, included) => setSelectedModules((current) =>
              current.map((value, itemIndex) => itemIndex === index ? included : value))}
            emptyMessage="No modules were generated."
          />
        </TabsContent>
        <TabsContent value="resources" className="mt-0 min-w-0">
          <ResourceEditor resources={resources} onChange={updateResources} />
        </TabsContent>
      </Tabs>
      <div className="flex flex-col-reverse gap-2 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 to-violet-50/70 p-3 sm:flex-row sm:justify-end dark:border-indigo-900 dark:from-indigo-950/30 dark:to-violet-950/20">
        <Button type="button" variant="outline" className="border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-950 dark:text-indigo-200 dark:hover:bg-indigo-950" disabled={isPending}
          onClick={() => saveMutation.mutate(filteredOutput())}>
          {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save changes
        </Button>
        <Button type="button" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500" disabled={isPending}
          onClick={() => approveMutation.mutate(filteredOutput())}>
          {approveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Accept suggestion
        </Button>
      </div>
    </div>
  );
}

export default function AiSuggestionDetailPage() {
  const { id: idParam } = useParams();
  const suggestionId = Number(idParam);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<ProjectTemplateApplyResult | null>(null);

  const suggestionQuery = useQuery({
    queryKey: ["ai-assistant", "suggestion", suggestionId],
    queryFn: () => aiAssistantApi.getSuggestion(suggestionId),
    enabled: Number.isSafeInteger(suggestionId) && suggestionId > 0,
    retry: false,
  });

  const updateCachedSuggestion = (updated: AiSuggestionDetail) => {
    queryClient.setQueryData(["ai-assistant", "suggestion", suggestionId], updated);
    void queryClient.invalidateQueries({ queryKey: ["ai-assistant", "suggestions"] });
  };

  const rejectMutation = useMutation({
    mutationFn: () => aiAssistantApi.rejectSuggestion(suggestionId, rejectReason.trim()),
    onSuccess: (rejected) => {
      updateCachedSuggestion(rejected);
      setShowRejectForm(false);
      setRejectReason("");
      toast.success("Suggestion rejected.");
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => aiAssistantApi.applySuggestion(suggestionId),
    onSuccess: async (template) => {
      setAppliedTemplate(template);
      setShowApplyDialog(false);
      if (suggestionQuery.data) {
        updateCachedSuggestion({ ...suggestionQuery.data, status: "APPLIED" });
      }
      await queryClient.invalidateQueries({ queryKey: ["ai-assistant", "suggestions"] });
      toast.success(`Draft template "${template.name}" is ready.`);
    },
  });

  const suggestion = suggestionQuery.data;
  const pageError = suggestionQuery.error ?? rejectMutation.error ?? applyMutation.error;

  return (
    <MainLayout pathName={{
      "ai-assistant": "AI Assistant",
      suggestions: "Suggestions",
      [idParam ?? ""]: suggestion?.projectTitle ?? "Suggestion",
    }}>
      <section className="mx-auto grid w-full max-w-7xl min-w-0 gap-4 pb-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-background to-sky-50/70 p-4 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-sky-950/20 sm:p-5">
          <div className="min-w-0">
            <Badge className="mb-2 gap-1.5 border-indigo-200 bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"><Bot className="size-3.5" /> AI Suggestion Review</Badge>
            <h1 className="break-words text-xl font-semibold tracking-tight text-indigo-950 dark:text-indigo-100 sm:text-2xl">
              {suggestion?.projectTitle ?? "Suggestion details"}
            </h1>
            {suggestion && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">Suggestion #{suggestion.suggestionId}</span>
                <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{new Date(suggestion.createdAt).toLocaleString()}</span>
                {suggestion.model && <span>Model: {suggestion.model}</span>}
              </p>
            )}
          </div>
          <Button type="button" variant="outline" className="border-indigo-200 bg-white/80 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60" onClick={() => navigate("/ai-assistant/suggestions")}>
            <ArrowLeft className="size-4" />All suggestions
          </Button>
        </header>

        {suggestionQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" />Loading suggestion...
          </div>
        ) : suggestionQuery.isError || !suggestion ? (
          <Alert variant="destructive" role="alert">
            <AlertCircle />
            <AlertTitle>Could not load suggestion</AlertTitle>
            <AlertDescription>{pageError ? apiErrorMessage(pageError) : "The suggestion could not be found."}</AlertDescription>
          </Alert>
        ) : (
          <>
            <Card className="overflow-hidden border-indigo-200/70 shadow-sm dark:border-indigo-900/60">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/70 via-background to-violet-50/50 py-4 dark:from-indigo-950/30 dark:to-violet-950/20">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className={statusStyles[suggestion.status]}>{suggestion.status}</Badge>
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200">{suggestion.projectType}</Badge>
                  {suggestion.status === "PENDING" && <span className="text-sm text-muted-foreground">Edit and review the generated contents below.</span>}
                </div>
                {suggestion.status === "APPROVED" && !appliedTemplate && (
                  <Button type="button" className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500" onClick={() => setShowApplyDialog(true)}>
                    <CheckCircle2 className="size-4" />Apply to Draft
                  </Button>
                )}
                {suggestion.status === "APPLIED" && !appliedTemplate && (
                  <Badge variant="secondary">Applied to a Draft template</Badge>
                )}
                {appliedTemplate && (
                  <Button asChild className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500">
                    <Link to={`/project-templates/${appliedTemplate.id}/detail`}>
                      Open Draft: {appliedTemplate.name}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {pageError && !suggestionQuery.isError && (
              <Alert variant="destructive" role="alert">
                <AlertCircle />
                <AlertTitle>Action failed</AlertTitle>
                <AlertDescription>{apiErrorMessage(pageError)}</AlertDescription>
              </Alert>
            )}

            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b border-sky-100 bg-gradient-to-r from-sky-50/80 to-background dark:border-sky-900/60 dark:from-sky-950/30">
                <CardTitle className="text-sky-950 dark:text-sky-100">Project request</CardTitle>
                <CardDescription>Original brief submitted to the AI assistant.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 bg-sky-50/10 sm:grid-cols-2">
                <div className="grid gap-1 rounded-lg border border-sky-100 bg-white/70 p-3 dark:border-sky-900/60 dark:bg-slate-950/30">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Project type</span>
                  <span className="text-sm font-medium">{suggestion.projectType}</span>
                </div>
                <div className="grid gap-1 rounded-lg border border-sky-100 bg-white/70 p-3 sm:col-span-2 dark:border-sky-900/60 dark:bg-slate-950/30">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Description</span>
                  <p className="whitespace-pre-wrap text-sm leading-6">{suggestion.projectDescription}</p>
                </div>
                {suggestion.additionalRequirements && (
                  <div className="grid gap-1 rounded-lg border border-sky-100 bg-white/70 p-3 sm:col-span-2 dark:border-sky-900/60 dark:bg-slate-950/30">
                    <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Additional requirements</span>
                    <p className="whitespace-pre-wrap text-sm leading-6">{suggestion.additionalRequirements}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {suggestion.status === "PENDING" ? (
              <>
                <SuggestionReviewEditor
                  key={`${suggestion.suggestionId}-${suggestion.updatedAt ?? "initial"}`}
                  suggestion={suggestion}
                  onSaved={updateCachedSuggestion}
                  onApproved={updateCachedSuggestion}
                />
                <div className="grid gap-3 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50/70 to-background p-4 shadow-sm dark:border-rose-900/60 dark:from-rose-950/20">
                  {!showRejectForm ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-rose-900 dark:text-rose-200">Reject this suggestion</h2>
                        <p className="text-sm text-muted-foreground">A rejection reason is required and will be saved with the suggestion.</p>
                      </div>
                      <Button type="button" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-900 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950" disabled={rejectMutation.isPending}
                        onClick={() => setShowRejectForm(true)}>
                        <X className="size-4" />Reject suggestion
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Label htmlFor="suggestion-rejection-reason">Rejection reason</Label>
                      <Textarea id="suggestion-rejection-reason" maxLength={2000} rows={3}
                        value={rejectReason} onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="Explain why this suggestion is not suitable." />
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => { setShowRejectForm(false); setRejectReason(""); }}>
                          Cancel
                        </Button>
                        <Button type="button" variant="destructive"
                          disabled={rejectMutation.isPending || !rejectReason.trim()}
                          onClick={() => rejectMutation.mutate()}>
                          {rejectMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                          Confirm reject
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <AiTemplateResult output={suggestion.output} />
            )}

            <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply suggestion to a Draft?</DialogTitle>
                  <DialogDescription>
                    This creates a Project Template Draft with accepted content. Applying again will return the existing draft instead of creating duplicates.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{suggestion.output.projectTemplate?.name ?? suggestion.projectTitle}</p>
                  <p className="mt-1 text-muted-foreground">
                    {(suggestion.output.modules ?? []).length} modules · {(suggestion.output.milestones ?? []).length} milestones · {(suggestion.output.backlogItems ?? []).length} backlog items · {(suggestion.output.resources ?? []).length} resources
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" disabled={applyMutation.isPending} onClick={() => setShowApplyDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="button" disabled={applyMutation.isPending} onClick={() => applyMutation.mutate()}>
                    {applyMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    {applyMutation.isPending ? "Applying..." : "Confirm Apply"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </section>
    </MainLayout>
  );
}
