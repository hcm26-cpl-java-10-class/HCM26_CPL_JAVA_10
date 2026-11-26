import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PoolQuota } from "@/api/features/exam.api";
import type { QuestionDTO } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ANY = "__any__";

/** Lets the teacher fix the mix each student receives, e.g. 5 EASY + 3 MEDIUM + 2 HARD, or 4 questions of one topic. */
export function PoolQuotaEditor({ questions, quotas, disabled, saving, onSave }: {
    questions: QuestionDTO[];
    quotas: PoolQuota[];
    disabled?: boolean;
    saving?: boolean;
    onSave: (quotas: PoolQuota[]) => void;
}) {
    const [rows, setRows] = useState<PoolQuota[]>(quotas);
    useEffect(() => setRows(quotas), [quotas]);

    const topics = useMemo(
        () => Array.from(new Set(questions.map((q) => (q.topic ?? "").trim().toLowerCase()).filter(Boolean))).sort(),
        [questions],
    );
    const available = (row: PoolQuota) =>
        questions.filter(
            (q) =>
                (!row.difficulty || q.difficulty === row.difficulty) &&
                (!row.topic || (q.topic ?? "").trim().toLowerCase() === row.topic),
        ).length;

    const total = rows.reduce((sum, r) => sum + (Number.isFinite(r.count) ? r.count : 0), 0);
    const problems = rows.map((r) =>
        !r.difficulty && !r.topic
            ? "Choose a difficulty or a topic"
            : r.count < 1
              ? "Count must be at least 1"
              : r.count > available(r)
                ? `Only ${available(r)} matching questions`
                : null,
    );
    const invalid = problems.some(Boolean) || total > questions.length;
    const dirty = JSON.stringify(rows) !== JSON.stringify(quotas);

    const update = (index: number, patch: Partial<PoolQuota>) =>
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

    return (
        <div className="space-y-2 border-t pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium">Question mix per student <span className="font-normal text-muted-foreground">(optional)</span></p>
                <Button type="button" size="sm" variant="outline" disabled={disabled || saving} onClick={() => setRows([...rows, { difficulty: null, topic: null, count: 1 }])}>
                    <Plus className="mr-1 size-3.5" /> Add rule
                </Button>
            </div>

            {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No mix set: each student gets a random sample of the pool. Add rules to control how many easy/medium/hard or per-topic questions they get.</p>
            ) : (
                <ul className="space-y-1.5">
                    {rows.map((row, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2">
                            <Select value={row.difficulty ?? ANY} onValueChange={(v) => update(i, { difficulty: v === ANY ? null : v })} disabled={disabled || saving}>
                                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ANY}>Any difficulty</SelectItem>
                                    <SelectItem value="EASY">Easy</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="HARD">Hard</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={row.topic ?? ANY} onValueChange={(v) => update(i, { topic: v === ANY ? null : v })} disabled={disabled || saving}>
                                <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ANY}>Any topic</SelectItem>
                                    {topics.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Input
                                type="number"
                                min={1}
                                className="h-8 w-20"
                                aria-label="Number of questions"
                                value={Number.isFinite(row.count) ? row.count : ""}
                                disabled={disabled || saving}
                                onChange={(e) => update(i, { count: Number(e.target.value) })}
                            />
                            <span className={`text-xs ${problems[i] ? "text-destructive" : "text-muted-foreground"}`}>
                                {problems[i] ?? `of ${available(row)} available`}
                            </span>
                            <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Remove rule" disabled={disabled || saving} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                                <Trash2 className="size-3.5" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            {(rows.length > 0 || quotas.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Each student gets {total} questions.</span>
                    {total > questions.length && <span className="text-xs text-destructive">More than the pool ({questions.length}).</span>}
                    <Button type="button" size="sm" disabled={disabled || saving || invalid || !dirty} onClick={() => onSave(rows)}>
                        {saving ? "Saving..." : rows.length === 0 ? "Remove mix" : "Save mix"}
                    </Button>
                </div>
            )}
        </div>
    );
}
