import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RubricCriterionInput, RubricRatingLevel, SaveRubricDraftRequest } from "@/types";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const LIMITS = {
  rubricName: 50,
  rubricDescription: 500,
  criterionCode: 30,
  criterionName: 100,
  criterionDescription: 500,
} as const;

const RATING_LEVELS: { level: RubricRatingLevel; label: string; percentage: number }[] = [
  { level: "EXCELLENT", label: "Excellent", percentage: 100 },
  { level: "GOOD", label: "Good", percentage: 75 },
  { level: "FAIR", label: "Fair", percentage: 50 },
  { level: "NOT_MET", label: "Not met", percentage: 0 },
];

const defaultRatings = () => RATING_LEVELS.map(({ level }) => ({ level, description: "" }));

const emptyCriterion = (index: number): RubricCriterionInput => ({
  code: "", name: "", description: "", weight: 0, maxScore: 0, orderIndex: index, ratings: defaultRatings(),
});

export function RubricForm({ initialValue, submitting, onSubmit, onCancel }: {
  initialValue?: SaveRubricDraftRequest;
  submitting: boolean;
  onSubmit: (payload: SaveRubricDraftRequest) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [criteria, setCriteria] = useState<RubricCriterionInput[]>(
    initialValue?.criteria.map((item, index) => ({ ...item, orderIndex: index, ratings: item.ratings?.length ? item.ratings : defaultRatings() })) ?? [emptyCriterion(0)],
  );
  const totalWeight = useMemo(() => criteria.reduce((sum, item) => sum + (Number(item.weight) || 0), 0), [criteria]);
  const totalScore = useMemo(() => criteria.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0), [criteria]);

  const change = (index: number, patch: Partial<RubricCriterionInput>) => {
    setCriteria((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };
  const normalizeOrder = (items: RubricCriterionInput[]) => items.map((item, index) => ({ ...item, orderIndex: index }));
  const move = (from: number, to: number) => setCriteria((current) => {
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return normalizeOrder(next);
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error("Rubric name is required.");
    if (name.trim().length > LIMITS.rubricName) return toast.error(`Rubric name cannot exceed ${LIMITS.rubricName} characters.`);
    if (description.trim().length > LIMITS.rubricDescription) return toast.error(`Rubric description cannot exceed ${LIMITS.rubricDescription} characters.`);
    if (!criteria.length) return toast.error("Add at least one criterion.");
    if (criteria.some((item) => !item.code.trim() || !item.name.trim() || item.weight <= 0 || item.maxScore <= 0)) {
      return toast.error("Every criterion needs a code, name, positive weight and positive max score.");
    }
    if (criteria.some((item) => item.code.trim().length > LIMITS.criterionCode)) return toast.error(`Criterion code cannot exceed ${LIMITS.criterionCode} characters.`);
    if (criteria.some((item) => item.name.trim().length > LIMITS.criterionName)) return toast.error(`Criterion name cannot exceed ${LIMITS.criterionName} characters.`);
    if (criteria.some((item) => (item.description?.trim().length ?? 0) > LIMITS.criterionDescription)) return toast.error(`Criterion description cannot exceed ${LIMITS.criterionDescription} characters.`);
    if (criteria.some((item) => item.ratings.length !== RATING_LEVELS.length || item.ratings.some((rating) => !rating.description.trim()))) return toast.error("Every rating level needs guidance.");
    if (criteria.some((item) => item.ratings.some((rating) => rating.description.trim().length > LIMITS.criterionDescription))) return toast.error(`Rating guidance cannot exceed ${LIMITS.criterionDescription} characters.`);
    const codes = criteria.map((item) => item.code.trim().toUpperCase());
    if (new Set(codes).size !== codes.length) return toast.error("Criterion codes must be unique.");
    if (Math.abs(totalWeight - 100) > 0.001) return toast.error("Total weight must equal exactly 100%. ");
    onSubmit({
      name: name.trim(), description: description.trim() || undefined,
      criteria: criteria.map((item, index) => ({ ...item, code: item.code.trim().toUpperCase(), name: item.name.trim(), orderIndex: index, ratings: item.ratings.map((rating) => ({ ...rating, description: rating.description.trim() })) })),
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Card>
        <CardHeader><CardTitle>Rubric information</CardTitle><CardDescription>Name this reusable evaluation rubric.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="rubric-name">Name <span className="text-destructive">*</span></Label><span className="text-xs text-muted-foreground">{name.length}/{LIMITS.rubricName}</span></div><Input id="rubric-name" maxLength={LIMITS.rubricName} value={name} onChange={(e) => setName(e.target.value)} placeholder="Software delivery rubric" autoFocus /></div>
          <div className="grid gap-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="rubric-description">Description</Label><span className="text-xs text-muted-foreground">{description.length}/{LIMITS.rubricDescription}</span></div><Textarea id="rubric-description" maxLength={LIMITS.rubricDescription} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain when this rubric should be used." /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div><CardTitle>Evaluation criteria</CardTitle><CardDescription className="mt-1">Weights must add up to exactly 100%.</CardDescription></div>
          <Button type="button" variant="outline" size="sm" onClick={() => setCriteria((items) => [...items, emptyCriterion(items.length)])} disabled={submitting || criteria.length >= 100}><Plus /> Add criterion</Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {criteria.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-xl border p-4">
              <div className="flex items-center justify-between"><p className="font-medium">Criterion {index + 1}</p><div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, index - 1)} disabled={index === 0 || submitting}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, index + 1)} disabled={index === criteria.length - 1 || submitting}><ArrowDown /></Button>
                <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setCriteria((items) => normalizeOrder(items.filter((_, i) => i !== index)))} disabled={criteria.length === 1 || submitting}><Trash2 /></Button>
              </div></div>
              <div className="grid gap-3 md:grid-cols-[0.8fr_1.5fr_0.6fr_0.6fr]">
                <div className="grid gap-2"><div className="flex items-center justify-between gap-2"><Label>Code</Label><span className="text-xs text-muted-foreground">{item.code.length}/{LIMITS.criterionCode}</span></div><Input maxLength={LIMITS.criterionCode} value={item.code} onChange={(e) => change(index, { code: e.target.value.toUpperCase().replace(/\s+/g, "_") })} placeholder="QUALITY" /></div>
                <div className="grid gap-2"><div className="flex items-center justify-between gap-2"><Label>Name</Label><span className="text-xs text-muted-foreground">{item.name.length}/{LIMITS.criterionName}</span></div><Input maxLength={LIMITS.criterionName} value={item.name} onChange={(e) => change(index, { name: e.target.value })} placeholder="Code quality" /></div>
                <div className="grid gap-2"><Label>Weight (%)</Label><Input type="number" min="0.01" max="100" step="0.01" value={item.weight || ""} onChange={(e) => change(index, { weight: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Max score</Label><Input type="number" min="0.01" step="0.01" value={item.maxScore || ""} onChange={(e) => change(index, { maxScore: Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-2"><div className="flex items-center justify-between gap-2"><Label>Description</Label><span className="text-xs text-muted-foreground">{item.description?.length ?? 0}/{LIMITS.criterionDescription}</span></div><Textarea rows={2} maxLength={LIMITS.criterionDescription} value={item.description ?? ""} onChange={(e) => change(index, { description: e.target.value })} placeholder="Describe what a successful result looks like." /></div>
              <div className="grid gap-3 rounded-lg bg-muted/30 p-3">
                <div><p className="text-sm font-medium">Rating guidance</p><p className="text-xs text-muted-foreground">Describe what the reviewer should look for at each level.</p></div>
                {RATING_LEVELS.map((rating, ratingIndex) => {
                  const current = item.ratings[ratingIndex] ?? { level: rating.level, description: "" };
                  return <div key={rating.level} className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start"><div className="pt-2 text-sm font-medium">{rating.label} <span className="text-muted-foreground">({rating.percentage}%)</span></div><div className="grid gap-1"><Textarea rows={2} maxLength={LIMITS.criterionDescription} value={current.description} onChange={(e) => change(index, { ratings: item.ratings.map((entry, entryIndex) => entryIndex === ratingIndex ? { ...entry, description: e.target.value } : entry) })} placeholder={`Guidance for ${rating.label.toLowerCase()}`} /><span className="text-right text-xs text-muted-foreground">{current.description.length}/{LIMITS.criterionDescription}</span></div></div>;
                })}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap justify-end gap-4 rounded-lg bg-muted/40 px-4 py-3 text-sm">
            <span>Total score: <strong>{totalScore.toFixed(2)}</strong></span>
            <span className={Math.abs(totalWeight - 100) < 0.001 ? "text-emerald-600" : "text-destructive"}>Total weight: <strong>{totalWeight.toFixed(2)}%</strong></span>
          </div>
        </CardContent>
      </Card>
      <div className="sticky bottom-0 flex flex-col-reverse gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}><ArrowLeft /> Cancel</Button>
        <Button type="submit" disabled={submitting}><Save /> {submitting ? "Saving…" : "Save draft"}</Button>
      </div>
    </form>
  );
}
