import axiosInstance from "@/api/axios";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type Completion = {
    started: number;
    submitted: number;
    inProgress: number;
    expired: number;
    pendingReview: number;
    completionRate: number | null;
    averageDurationMinutes: number | null;
};

type OptionStat = {
    sourceOptionId: number;
    content: string;
    correct: boolean;
    selectedCount: number;
    selectedRate: number | null;
};

type ItemStat = {
    sourceQuestionId: number;
    order: number;
    content: string;
    type: "MULTIPLE_CHOICE" | "ESSAY" | "CODING";
    points: number;
    attempts: number;
    answered: number;
    answerRate: number | null;
    fullyCorrect: number;
    correctRate: number | null;
    difficultyIndex: number | null;
    difficultyLevel: "EASY" | "MEDIUM" | "HARD" | null;
    discrimination: number | null;
    discriminationLevel: "GOOD" | "FAIR" | "POOR" | "NEGATIVE" | null;
    flags: string[];
    options: OptionStat[];
};

type ItemAnalysis = {
    examId: number;
    examTitle: string;
    completion: Completion;
    analyzedAttempts: number;
    discriminationAvailable: boolean;
    minAttemptsForDiscrimination: number;
    averageDifficultyIndex: number | null;
    flaggedItems: number;
    items: ItemStat[];
};

const FLAG_LABEL: Record<string, string> = {
    NEGATIVE_DISCRIMINATION: "Weak students beat strong ones - check the answer key",
    LOW_DISCRIMINATION: "Barely separates strong from weak students",
    NOBODY_CORRECT: "Almost nobody got it right - check the key or wording",
    UNUSED_DISTRACTOR: "Some wrong option was never chosen",
};

const DIFFICULTY_STYLE: Record<string, string> = {
    EASY: "bg-green-100 text-green-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HARD: "bg-red-100 text-red-800",
};

const DISCRIMINATION_STYLE: Record<string, string> = {
    GOOD: "bg-green-100 text-green-800",
    FAIR: "bg-amber-100 text-amber-800",
    POOR: "bg-orange-100 text-orange-800",
    NEGATIVE: "bg-red-100 text-red-800",
};

const TYPE_LABEL: Record<string, string> = {
    MULTIPLE_CHOICE: "MCQ",
    ESSAY: "Essay",
    CODING: "Coding",
};

function pct(value: number | null | undefined): string {
    return value == null ? "—" : `${(value * 100).toFixed(0)}%`;
}

function Card({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
            {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
    );
}

function Pill({ text, style }: { text: string; style?: string }) {
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style ?? "bg-muted text-muted-foreground"}`}>
            {text}
        </span>
    );
}

export function ItemAnalysisSection({ examId }: { examId: number }) {
    const [expanded, setExpanded] = useState<number | null>(null);

    const query = useQuery({
        queryKey: ["exam-item-analysis", examId],
        queryFn: async () => {
            const response = await axiosInstance.get<ItemAnalysis>(
                `/exams/${examId}/result-statistics/item-analysis`,
            );
            return response.data;
        },
        enabled: Number.isInteger(examId) && examId > 0,
    });

    const data = query.data;

    return (
        <section className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <h2 className="text-lg font-semibold">Completion &amp; Item Analysis</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Difficulty and discrimination per question, based on fully graded attempts.
            </p>

            {query.isLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading analysis...</p>
            )}
            {query.isError && (
                <p className="py-8 text-center text-sm text-red-600">Could not load item analysis.</p>
            )}

            {data && (
                <div className="mt-4 space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Card
                            label="Completion rate"
                            value={pct(data.completion.completionRate)}
                            detail={`${data.completion.submitted} submitted / ${data.completion.started} started`}
                        />
                        <Card
                            label="Not finished"
                            value={String(data.completion.inProgress)}
                            detail={`${data.completion.expired} auto-submitted at timeout, ${data.completion.pendingReview} pending review`}
                        />
                        <Card
                            label="Average time spent"
                            value={
                                data.completion.averageDurationMinutes == null
                                    ? "—"
                                    : `${data.completion.averageDurationMinutes.toFixed(1)} min`
                            }
                        />
                        <Card
                            label="Average difficulty (p)"
                            value={data.averageDifficultyIndex == null ? "—" : data.averageDifficultyIndex.toFixed(2)}
                            detail={`${data.flaggedItems} question(s) need review`}
                        />
                    </div>

                    {!data.discriminationAvailable && (
                        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            Discrimination needs at least {data.minAttemptsForDiscrimination} graded attempts
                            (currently {data.analyzedAttempts}).
                        </p>
                    )}

                    {data.items.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            No fully graded attempts yet.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                        <th className="w-8 py-2" />
                                        <th className="py-2 pr-3">#</th>
                                        <th className="py-2 pr-3">Question</th>
                                        <th className="py-2 pr-3">Type</th>
                                        <th className="py-2 pr-3">Answered</th>
                                        <th className="py-2 pr-3">Fully correct</th>
                                        <th className="py-2 pr-3">Difficulty (p)</th>
                                        <th className="py-2 pr-3">Discrimination (D)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.items.map((item) => {
                                        const isOpen = expanded === item.sourceQuestionId;
                                        const canExpand = item.options.length > 0 || item.flags.length > 0;
                                        return (
                                            <Fragment key={item.sourceQuestionId}>
                                                <tr
                                                    className={`border-b border-border align-top ${canExpand ? "cursor-pointer hover:bg-muted/40" : ""}`}
                                                    onClick={() =>
                                                        canExpand && setExpanded(isOpen ? null : item.sourceQuestionId)
                                                    }
                                                >
                                                    <td className="py-2 text-muted-foreground">
                                                        {canExpand &&
                                                            (isOpen ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            ))}
                                                    </td>
                                                    <td className="py-2 pr-3">{item.order}</td>
                                                    <td className="max-w-[320px] py-2 pr-3">
                                                        <p className="line-clamp-2">{item.content}</p>
                                                        {item.flags.length > 0 && (
                                                            <p className="mt-1 text-xs text-red-600">
                                                                {item.flags.length} warning(s)
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="py-2 pr-3">{TYPE_LABEL[item.type] ?? item.type}</td>
                                                    <td className="py-2 pr-3">
                                                        {item.answered}/{item.attempts} ({pct(item.answerRate)})
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        {item.fullyCorrect}/{item.attempts} ({pct(item.correctRate)})
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-10">
                                                                {item.difficultyIndex == null
                                                                    ? "—"
                                                                    : item.difficultyIndex.toFixed(2)}
                                                            </span>
                                                            {item.difficultyLevel && (
                                                                <Pill
                                                                    text={item.difficultyLevel}
                                                                    style={DIFFICULTY_STYLE[item.difficultyLevel]}
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-10">
                                                                {item.discrimination == null
                                                                    ? "—"
                                                                    : item.discrimination.toFixed(2)}
                                                            </span>
                                                            {item.discriminationLevel && (
                                                                <Pill
                                                                    text={item.discriminationLevel}
                                                                    style={DISCRIMINATION_STYLE[item.discriminationLevel]}
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isOpen && (
                                                    <tr className="border-b border-border bg-muted/30">
                                                        <td />
                                                        <td colSpan={7} className="space-y-3 py-3 pr-3">
                                                            <p className="text-sm">{item.content}</p>
                                                            {item.flags.length > 0 && (
                                                                <ul className="list-disc space-y-1 pl-5 text-xs text-red-600">
                                                                    {item.flags.map((flag) => (
                                                                        <li key={flag}>{FLAG_LABEL[flag] ?? flag}</li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                            {item.options.length > 0 && (
                                                                <div className="space-y-1">
                                                                    {item.options.map((option) => (
                                                                        <div
                                                                            key={option.sourceOptionId}
                                                                            className="flex items-center gap-3 text-xs"
                                                                        >
                                                                            <span
                                                                                className={`w-24 shrink-0 font-medium ${option.correct ? "text-green-700" : "text-muted-foreground"}`}
                                                                            >
                                                                                {option.correct ? "Correct" : "Distractor"}
                                                                            </span>
                                                                            <div className="h-2 w-40 shrink-0 overflow-hidden rounded bg-border">
                                                                                <div
                                                                                    className={`h-full ${option.correct ? "bg-green-600" : "bg-indigo-500"}`}
                                                                                    style={{
                                                                                        width: `${Math.round((option.selectedRate ?? 0) * 100)}%`,
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <span className="w-20 shrink-0">
                                                                                {option.selectedCount} ({pct(option.selectedRate)})
                                                                            </span>
                                                                            <span className="min-w-0 truncate">{option.content}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        p = average score / max score of the question (higher = easier; &lt;0.3 hard, &ge;0.8 easy).
                        D = p of the top 27% attempts minus p of the bottom 27% (&ge;0.3 good, &lt;0 means the
                        question works backwards).
                    </p>
                </div>
            )}
        </section>
    );
}
