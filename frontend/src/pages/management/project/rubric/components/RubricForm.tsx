import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { RubricCriterionInput, RubricRatingInput, RubricRatingLevel, SaveRubricDraftRequest } from "@/types";
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Calculator, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const LIMITS = {
  rubricName: 50,
  rubricDescription: 500,
  criterionCode: 30,
  criterionName: 100,
  criterionDescription: 500,
  criteria: 100,
} as const;

const DEFAULT_TOTAL_SCORE = 10;
const WEIGHT_TOLERANCE = 0.001;

const RATING_LEVELS: Array<{
  level: RubricRatingLevel;
  label: string;
  percentage: number;
  prompt: string;
}> = [
  { level: "EXCELLENT", label: "Excellent", percentage: 100, prompt: "What complete, high-quality evidence earns full points?" },
  { level: "GOOD", label: "Good", percentage: 75, prompt: "What minor gaps are acceptable at this level?" },
  { level: "FAIR", label: "Fair", percentage: 50, prompt: "What minimum partial result earns half points?" },
  { level: "NOT_MET", label: "Not met", percentage: 0, prompt: "What missing or incorrect result earns no points?" },
];

type RatingErrors = Partial<Record<RubricRatingLevel, string>>;

interface CriterionErrors {
  code?: string;
  name?: string;
  description?: string;
  weight?: string;
  ratings?: RatingErrors;
  ratingGroup?: string;
}

interface RubricFormErrors {
  name?: string;
  description?: string;
  totalScore?: string;
  criteriaSummary?: string;
  criteria: CriterionErrors[];
}

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const isWeightComplete = (value: number) => Math.abs(value - 100) < WEIGHT_TOLERANCE;
const formatPoints = (value: number) => Number.isFinite(value) ? value.toFixed(2) : "0.00";

const defaultRatings = (): RubricRatingInput[] =>
  RATING_LEVELS.map(({ level }) => ({ level, description: "" }));

const normalizeRatings = (ratings?: RubricRatingInput[]): RubricRatingInput[] =>
  RATING_LEVELS.map(({ level }) => ({
    level,
    description: ratings?.find((rating) => rating.level === level)?.description ?? "",
  }));

const emptyCriterion = (index: number, weight = 0): RubricCriterionInput => ({
  code: "",
  name: "",
  description: "",
  weight,
  maxScore: 0,
  orderIndex: index,
  ratings: defaultRatings(),
});

function applyMaximumPoints(criteria: RubricCriterionInput[], totalScore: number): RubricCriterionInput[] {
  const next = criteria.map((criterion) => ({
    ...criterion,
    maxScore: roundToTwo(totalScore * (Number(criterion.weight) || 0) / 100),
  }));

  const totalWeight = criteria.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0);
  if (!next.length || !isWeightComplete(totalWeight) || totalScore <= 0) return next;

  const allocated = next.reduce((sum, criterion) => sum + criterion.maxScore, 0);
  const adjustment = roundToTwo(totalScore - allocated);
  if (adjustment !== 0) {
    const lastIndex = next.length - 1;
    next[lastIndex] = {
      ...next[lastIndex],
      maxScore: roundToTwo(next[lastIndex].maxScore + adjustment),
    };
  }

  return next;
}

function starterGuidance(level: RubricRatingLevel, criterionName: string): string {
  const subject = criterionName.trim() || "The submission";
  const guidance: Record<RubricRatingLevel, string> = {
    EXCELLENT: `${subject} fully meets the criterion with complete, clear, and verifiable evidence.`,
    GOOD: `${subject} meets the main expectations with only minor gaps that do not affect the overall outcome.`,
    FAIR: `${subject} partially meets the criterion, but important gaps or inconsistencies remain.`,
    NOT_MET: `${subject} does not meet the criterion or provides no verifiable evidence.`,
  };
  return guidance[level];
}

function validateForm(
  name: string,
  description: string,
  totalScore: number,
  criteria: RubricCriterionInput[],
): RubricFormErrors {
  const result: RubricFormErrors = { criteria: criteria.map(() => ({})) };

  if (!name.trim()) result.name = "Rubric name is required.";
  else if (name.trim().length > LIMITS.rubricName) result.name = `Name cannot exceed ${LIMITS.rubricName} characters.`;

  if (description.trim().length > LIMITS.rubricDescription) {
    result.description = `Description cannot exceed ${LIMITS.rubricDescription} characters.`;
  }

  if (!Number.isFinite(totalScore) || totalScore <= 0) {
    result.totalScore = "Total rubric score must be greater than 0.";
  } else if (totalScore > 99_999_999) {
    result.totalScore = "Total rubric score is too large.";
  }

  if (!criteria.length) result.criteriaSummary = "Add at least one criterion.";
  else if (criteria.length > LIMITS.criteria) result.criteriaSummary = `A rubric can contain at most ${LIMITS.criteria} criteria.`;

  const normalizedCodes = criteria.map((criterion) => criterion.code.trim().toUpperCase());
  const totalWeight = criteria.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0);

  criteria.forEach((criterion, index) => {
    const criterionErrors = result.criteria[index];

    if (!criterion.code.trim()) criterionErrors.code = "Criterion code is required.";
    else if (criterion.code.trim().length > LIMITS.criterionCode) criterionErrors.code = `Code cannot exceed ${LIMITS.criterionCode} characters.`;
    else if (normalizedCodes.filter((code) => code === normalizedCodes[index]).length > 1) criterionErrors.code = "Criterion code must be unique.";

    if (!criterion.name.trim()) criterionErrors.name = "Criterion name is required.";
    else if (criterion.name.trim().length > LIMITS.criterionName) criterionErrors.name = `Name cannot exceed ${LIMITS.criterionName} characters.`;

    if ((criterion.description?.trim().length ?? 0) > LIMITS.criterionDescription) {
      criterionErrors.description = `Criterion scope cannot exceed ${LIMITS.criterionDescription} characters.`;
    }

    if (!Number.isFinite(criterion.weight) || criterion.weight <= 0) criterionErrors.weight = "Weight must be greater than 0%.";
    else if (criterion.weight > 100) criterionErrors.weight = "Weight cannot exceed 100%.";
    else if (criterion.maxScore < 0.01) criterionErrors.weight = "This allocation must produce at least 0.01 point.";

    const ratings = normalizeRatings(criterion.ratings);
    const ratingErrors: RatingErrors = {};
    ratings.forEach((rating) => {
      if (!rating.description.trim()) ratingErrors[rating.level] = "Guidance is required for this rating.";
      else if (rating.description.trim().length > LIMITS.criterionDescription) {
        ratingErrors[rating.level] = `Guidance cannot exceed ${LIMITS.criterionDescription} characters.`;
      }
    });
    if (Object.keys(ratingErrors).length) criterionErrors.ratings = ratingErrors;

    const completedGuidance = ratings.map((rating) => rating.description.trim().toLocaleLowerCase()).filter(Boolean);
    if (new Set(completedGuidance).size !== completedGuidance.length) {
      criterionErrors.ratingGroup = "Each rating level needs distinct guidance.";
    }
  });

  if (criteria.length && !isWeightComplete(totalWeight)) {
    result.criteriaSummary = totalWeight < 100
      ? `${formatPoints(100 - totalWeight)}% weight remains to be allocated.`
      : `Total weight exceeds 100% by ${formatPoints(totalWeight - 100)}%.`;
  }

  return result;
}

function hasValidationErrors(errors: RubricFormErrors): boolean {
  return Boolean(
    errors.name
      || errors.description
      || errors.totalScore
      || errors.criteriaSummary
      || errors.criteria.some((criterion) => criterion.code
        || criterion.name
        || criterion.description
        || criterion.weight
        || criterion.ratingGroup
        || Object.keys(criterion.ratings ?? {}).length),
  );
}

function FieldMessage({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="text-sm text-destructive">{message}</p> : null;
}

export function RubricForm({ initialValue, submitting, onSubmit, onCancel }: {
  initialValue?: SaveRubricDraftRequest;
  submitting: boolean;
  onSubmit: (payload: SaveRubricDraftRequest) => void;
  onCancel: () => void;
}) {
  const initialScore = initialValue?.criteria.reduce((sum, item) => sum + Number(item.maxScore || 0), 0) || DEFAULT_TOTAL_SCORE;
  const [name, setName] = useState(initialValue?.name ?? "");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [totalScore, setTotalScore] = useState(roundToTwo(initialScore));
  const [showValidation, setShowValidation] = useState(false);
  const [criteria, setCriteria] = useState<RubricCriterionInput[]>(
    initialValue?.criteria.map((item, index) => ({
      ...item,
      orderIndex: index,
      ratings: normalizeRatings(item.ratings),
    })) ?? [emptyCriterion(0, 100)],
  );

  const totalWeight = useMemo(
    () => criteria.reduce((sum, item) => sum + (Number(item.weight) || 0), 0),
    [criteria],
  );
  const criteriaWithScores = useMemo(
    () => applyMaximumPoints(criteria, totalScore),
    [criteria, totalScore],
  );
  const errors = useMemo(
    () => validateForm(name, description, totalScore, criteriaWithScores),
    [criteriaWithScores, description, name, totalScore],
  );

  const change = (index: number, patch: Partial<RubricCriterionInput>) => {
    setCriteria((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const normalizeOrder = (items: RubricCriterionInput[]) =>
    items.map((item, index) => ({ ...item, orderIndex: index }));

  const move = (from: number, to: number) => setCriteria((current) => {
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return normalizeOrder(next);
  });

  const distributeWeightEvenly = () => {
    setCriteria((current) => {
      if (!current.length) return current;
      const baseWeight = Math.floor((100 / current.length) * 100) / 100;
      return current.map((criterion, index) => ({
        ...criterion,
        weight: index === current.length - 1
          ? roundToTwo(100 - baseWeight * (current.length - 1))
          : baseWeight,
      }));
    });
  };

  const updateRating = (criterionIndex: number, level: RubricRatingLevel, value: string) => {
    const ratings = normalizeRatings(criteria[criterionIndex].ratings).map((rating) =>
      rating.level === level ? { ...rating, description: value } : rating,
    );
    change(criterionIndex, { ratings });
  };

  const fillStarterGuidance = (criterionIndex: number) => {
    const criterion = criteria[criterionIndex];
    const ratings = normalizeRatings(criterion.ratings).map((rating) => ({
      ...rating,
      description: rating.description.trim()
        ? rating.description
        : starterGuidance(rating.level, criterion.name),
    }));
    change(criterionIndex, { ratings });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setShowValidation(true);

    if (hasValidationErrors(errors)) {
      toast.error("Review the highlighted rubric fields.");
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      criteria: criteriaWithScores.map((item, index) => ({
        ...item,
        code: item.code.trim().toUpperCase(),
        name: item.name.trim(),
        description: item.description?.trim() || undefined,
        orderIndex: index,
        ratings: normalizeRatings(item.ratings).map((rating) => ({
          ...rating,
          description: rating.description.trim(),
        })),
      })),
    });
  };

  const visibleErrors: RubricFormErrors = showValidation ? errors : { criteria: criteria.map(() => ({})) };
  const weightComplete = isWeightComplete(totalWeight);
  const remainingWeight = roundToTwo(100 - totalWeight);

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {showValidation && hasValidationErrors(errors) ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Rubric is not ready to save</AlertTitle>
          <AlertDescription>Review the highlighted fields and make sure the total weight equals 100%.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Rubric information</CardTitle>
          <CardDescription>Name this reusable evaluation rubric.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="rubric-name">Name <span className="text-destructive">*</span></Label>
              <span className="text-xs text-muted-foreground">{name.length}/{LIMITS.rubricName}</span>
            </div>
            <Input id="rubric-name" required maxLength={LIMITS.rubricName} value={name} onChange={(event) => setName(event.target.value)} placeholder="Software delivery rubric" aria-invalid={!!visibleErrors.name} aria-describedby={visibleErrors.name ? "rubric-name-error" : undefined} autoFocus />
            <FieldMessage id="rubric-name-error" message={visibleErrors.name} />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="rubric-description">Description</Label>
              <span className="text-xs text-muted-foreground">{description.length}/{LIMITS.rubricDescription}</span>
            </div>
            <Textarea id="rubric-description" maxLength={LIMITS.rubricDescription} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain when this rubric should be used." aria-invalid={!!visibleErrors.description} aria-describedby={visibleErrors.description ? "rubric-description-error" : undefined} />
            <FieldMessage id="rubric-description-error" message={visibleErrors.description} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="size-5" /> Scoring setup</CardTitle>
          <CardDescription>Set the rubric scale once. Maximum points for each criterion are calculated from its weight.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2 sm:max-w-sm">
            <Label htmlFor="rubric-total-score">Total rubric score <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Input id="rubric-total-score" type="number" min="0.01" step="0.01" value={totalScore || ""} onChange={(event) => setTotalScore(Number(event.target.value))} className="pr-16" aria-invalid={!!visibleErrors.totalScore} aria-describedby="rubric-total-score-help rubric-total-score-error" />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">points</span>
              </div>
              <Button type="button" variant={totalScore === 10 ? "secondary" : "outline"} onClick={() => setTotalScore(10)}>10</Button>
              <Button type="button" variant={totalScore === 100 ? "secondary" : "outline"} onClick={() => setTotalScore(100)}>100</Button>
            </div>
            <p id="rubric-total-score-help" className="text-xs text-muted-foreground">Awarded points = maximum points × rating percentage.</p>
            <FieldMessage id="rubric-total-score-error" message={visibleErrors.totalScore} />
          </div>

          <div className="grid gap-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">Weight allocation</span>
              <span className={weightComplete ? "font-semibold text-emerald-600" : totalWeight > 100 ? "font-semibold text-destructive" : "font-semibold text-amber-600 dark:text-amber-400"}>{formatPoints(totalWeight)} / 100%</span>
            </div>
            <Progress value={Math.min(Math.max(totalWeight, 0), 100)} className={totalWeight > 100 ? "[&_[data-slot=progress-indicator]]:bg-destructive" : !weightComplete ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : "[&_[data-slot=progress-indicator]]:bg-emerald-600"} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {weightComplete ? `${formatPoints(totalScore)} total points are fully allocated.` : remainingWeight > 0 ? `${formatPoints(remainingWeight)}% remains to be allocated.` : `Allocation exceeds 100% by ${formatPoints(Math.abs(remainingWeight))}%.`}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={distributeWeightEvenly}>Distribute equally</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Evaluation criteria</CardTitle><CardDescription className="mt-1">Define what is evaluated, then describe observable evidence for each rating.</CardDescription></div>
            <Badge variant="outline">{criteria.length} / {LIMITS.criteria} criteria</Badge>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          {criteriaWithScores.map((item, index) => {
            const criterionErrors = visibleErrors.criteria[index] ?? {};
            const normalizedRatings = normalizeRatings(item.ratings);
            const completedRatings = normalizedRatings.filter((rating) => rating.description.trim()).length;
            const criterionId = `rubric-criterion-${index}`;

            return (
              <div key={index} className="grid gap-4 rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</div>
                  <div><p className="font-medium">{item.name.trim() || `Criterion ${index + 1}`}</p><p className="text-xs text-muted-foreground">{formatPoints(item.maxScore)} points · {formatPoints(item.weight)}% weight</p></div>
                  <div className="ml-auto flex gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move criterion ${index + 1} up`} onClick={() => move(index, index - 1)} disabled={index === 0 || submitting}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move criterion ${index + 1} down`} onClick={() => move(index, index + 1)} disabled={index === criteria.length - 1 || submitting}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Delete criterion ${index + 1}`} onClick={() => setCriteria((items) => normalizeOrder(items.filter((_, itemIndex) => itemIndex !== index)))} disabled={criteria.length === 1 || submitting}><Trash2 /></Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[0.8fr_1.5fr_0.7fr_0.8fr]">
                  <div className="grid content-start gap-2">
                    <div className="flex items-center justify-between gap-2"><Label htmlFor={`${criterionId}-code`}>Code <span className="text-destructive">*</span></Label><span className="text-xs text-muted-foreground">{item.code.length}/{LIMITS.criterionCode}</span></div>
                    <Input id={`${criterionId}-code`} required maxLength={LIMITS.criterionCode} value={item.code} onChange={(event) => change(index, { code: event.target.value.toUpperCase().replace(/\s+/g, "_") })} placeholder="QUALITY" aria-invalid={!!criterionErrors.code} />
                    <FieldMessage id={`${criterionId}-code-error`} message={criterionErrors.code} />
                  </div>
                  <div className="grid content-start gap-2">
                    <div className="flex items-center justify-between gap-2"><Label htmlFor={`${criterionId}-name`}>Name <span className="text-destructive">*</span></Label><span className="text-xs text-muted-foreground">{item.name.length}/{LIMITS.criterionName}</span></div>
                    <Input id={`${criterionId}-name`} required maxLength={LIMITS.criterionName} value={item.name} onChange={(event) => change(index, { name: event.target.value })} placeholder="Code quality" aria-invalid={!!criterionErrors.name} />
                    <FieldMessage id={`${criterionId}-name-error`} message={criterionErrors.name} />
                  </div>
                  <div className="grid content-start gap-2">
                    <Label htmlFor={`${criterionId}-weight`}>Weight (%) <span className="text-destructive">*</span></Label>
                    <Input id={`${criterionId}-weight`} type="number" min="0.01" max="100" step="0.01" value={item.weight || ""} onChange={(event) => change(index, { weight: Number(event.target.value) })} aria-invalid={!!criterionErrors.weight} />
                    <FieldMessage id={`${criterionId}-weight-error`} message={criterionErrors.weight} />
                  </div>
                  <div className="grid content-start gap-2">
                    <Label>Maximum points</Label>
                    <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-semibold" aria-label={`${formatPoints(item.maxScore)} maximum points`}>{formatPoints(item.maxScore)} pts</div>
                    <p className="text-xs text-muted-foreground">Calculated automatically</p>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2"><Label htmlFor={`${criterionId}-description`}>Criterion scope</Label><span className="text-xs text-muted-foreground">{item.description?.length ?? 0}/{LIMITS.criterionDescription}</span></div>
                  <Textarea id={`${criterionId}-description`} rows={2} maxLength={LIMITS.criterionDescription} value={item.description ?? ""} onChange={(event) => change(index, { description: event.target.value })} placeholder="Define the scope, expected evidence, and aspects being evaluated." aria-invalid={!!criterionErrors.description} />
                  <FieldMessage id={`${criterionId}-description-error`} message={criterionErrors.description} />
                </div>

                <div className="grid gap-3 rounded-lg bg-muted/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">Rating guidance</p><Badge variant={completedRatings === RATING_LEVELS.length ? "secondary" : "outline"}>{completedRatings} / {RATING_LEVELS.length} completed</Badge></div><p className="mt-1 text-xs text-muted-foreground">Describe observable evidence at each fixed performance level.</p></div>
                    <Button type="button" variant="outline" size="sm" onClick={() => fillStarterGuidance(index)}><Sparkles /> Fill empty guidance</Button>
                  </div>

                  {RATING_LEVELS.map((rating) => {
                    const current = normalizedRatings.find((entry) => entry.level === rating.level)!;
                    const awardedPoints = roundToTwo(item.maxScore * rating.percentage / 100);
                    const ratingError = criterionErrors.ratings?.[rating.level];

                    return (
                      <div key={rating.level} className="grid gap-2 rounded-lg border bg-background p-3 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
                        <div className="grid gap-1 md:pt-2"><p className="text-sm font-medium">{rating.label}</p><p className="text-xs text-muted-foreground">{rating.percentage}% · {formatPoints(awardedPoints)} pts</p></div>
                        <div className="grid gap-1">
                          <Textarea rows={2} maxLength={LIMITS.criterionDescription} value={current.description} onChange={(event) => updateRating(index, rating.level, event.target.value)} placeholder={rating.prompt} aria-label={`${rating.label} guidance for criterion ${index + 1}`} aria-invalid={!!ratingError || !!criterionErrors.ratingGroup} />
                          <div className="flex items-start justify-between gap-3"><FieldMessage id={`${criterionId}-${rating.level}-error`} message={ratingError} /><span className={current.description.length >= LIMITS.criterionDescription * 0.9 ? "ml-auto text-xs font-medium text-amber-600 dark:text-amber-400" : "ml-auto text-xs text-muted-foreground"}>{current.description.length}/{LIMITS.criterionDescription}</span></div>
                        </div>
                      </div>
                    );
                  })}

                  <FieldMessage id={`${criterionId}-ratings-error`} message={criterionErrors.ratingGroup} />
                </div>
              </div>
            );
          })}

          <FieldMessage id="rubric-criteria-error" message={visibleErrors.criteriaSummary} />
          <Button type="button" variant="outline" className="h-11 w-full border-dashed" onClick={() => setCriteria((items) => [...items, emptyCriterion(items.length)])} disabled={submitting || criteria.length >= LIMITS.criteria}><Plus /> Add criterion</Button>
          <div className="flex flex-wrap justify-end gap-4 rounded-lg bg-muted/40 px-4 py-3 text-sm"><span>Total score: <strong>{formatPoints(totalScore)}</strong></span><span className={weightComplete ? "text-emerald-600" : "text-destructive"}>Total weight: <strong>{formatPoints(totalWeight)}%</strong></span></div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-20 flex flex-col-reverse gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}><ArrowLeft /> Cancel</Button>
        <Button type="submit" disabled={submitting}><Save /> {submitting ? "Saving…" : "Save draft"}</Button>
      </div>
    </form>
  );
}
