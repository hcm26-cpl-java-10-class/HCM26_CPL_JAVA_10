import axiosInstance from "@/api/axios";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Info } from "lucide-react";

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

type CodeTestStat = {
    index: number;
    visible: boolean;
    inputs: string[] | null;
    expected: string | null;
    evaluated: number;
    passed: number;
    passRate: number | null;
    statusCounts: Record<string, number>;
};

type CodeStat = {
    graded: number;
    compileErrors: number;
    noCode: number;
    timeouts: number;
    runtimeErrors: number;
    tests: CodeTestStat[];
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
    code: CodeStat | null;
};

type ItemAnalysis = {
    examId: number;
    examTitle: string;
    completion: Completion;
    analyzedAttempts: number;
    discriminationAvailable: boolean;
    minAttemptsForDiscrimination: number;
  discriminationProblem: "TOO_FEW_ATTEMPTS" | "SCORES_TOO_CLOSE" | "GROUPS_OVERLAP" | null;
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

const STATUS_LABEL: Record<string, string> = {
    OK: "Passed",
    WRONG_ANSWER: "Wrong answer",
    COMPILE_ERROR: "Compile error",
    RUNTIME_ERROR: "Runtime error",
    TIME_LIMIT: "Time limit",
    NO_CODE: "No code",
    INFRA_ERROR: "Judge error",
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

type SortKey = "order" | "correctRate" | "difficultyIndex" | "discrimination";

function Pill({ text, style }: { text: string; style?: string }) {
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style ?? "bg-muted text-muted-foreground"}`}>
            {text}
        </span>
    );
}

export function ItemAnalysisSection({ examId }: { examId: number }) {
    const [expanded, setExpanded] = useState<number | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>("order");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [onlyFlagged, setOnlyFlagged] = useState(false);

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

    const rows = useMemo(() => {
        const items = (data?.items ?? []).filter((item) => !onlyFlagged || item.flags.length > 0);
        const sign = sortDir === "asc" ? 1 : -1;
        // Questions without a value (null) always go to the bottom.
        return [...items].sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            return (av - bv) * sign;
        });
    }, [data, onlyFlagged, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const sortHeader = (key: SortKey, label: string, hint?: string) => (
        <th className="py-2 pr-3" aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
            <button
                type="button"
                onClick={() => toggleSort(key)}
                title={hint}
                className="inline-flex items-center gap-1 hover:text-foreground"
            >
                {label}
                {hint && <Info className="h-3 w-3" aria-hidden="true" />}
                {sortKey === key ? (
                    sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                )}
            </button>
        </th>
    );

    return (
        <section className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <h2 className="text-lg font-semibold">Completion &amp; Item Analysis</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Per student only the best fully graded attempt is counted. Unfinished attempts are auto-submitted when time runs out.
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
                            detail={`${data.completion.submitted} submitted / ${data.completion.started} students`}
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
                            <strong>Discrimination (D) is not shown: data not reliable enough.</strong>{" "}
                            {data.discriminationProblem === "SCORES_TOO_CLOSE"
                                ? "Total scores are almost identical across the class, so strong and weak students cannot be told apart."
                                : data.discriminationProblem === "GROUPS_OVERLAP"
                                  ? "Too many students share the same total score, so the top and bottom groups overlap."
                                  : `It needs at least ${data.minAttemptsForDiscrimination} fully graded attempts (currently ${data.analyzedAttempts}).`}
                        </p>
                    )}

                    {data.items.length > 0 && (
                        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={onlyFlagged}
                                onChange={(e) => setOnlyFlagged(e.target.checked)}
                            />
                            Show only questions with warnings ({data.flaggedItems})
                        </label>
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
                                        {sortHeader("order", "#")}
                                        <th className="py-2 pr-3">Question</th>
                                        <th className="py-2 pr-3">Type</th>
                                        <th className="py-2 pr-3">Answered</th>
                                        {sortHeader("correctRate", "Fully correct")}
                                        {sortHeader(
                                            "difficultyIndex",
                                            "Difficulty (p)",
                                            "p = average score / max score. Higher means easier: p >= 0.8 easy, p < 0.3 hard.",
                                        )}
                                        {sortHeader(
                                            "discrimination",
                                            "Discrimination (D)",
                                            "D = p of the top 27% minus p of the bottom 27%. >= 0.3 good, < 0 means weak students did better than strong ones.",
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                                                No questions match the filter.
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((item) => {
                                        const isOpen = expanded === item.sourceQuestionId;
                                        const canExpand = item.options.length > 0 || item.flags.length > 0 || item.code != null;
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
                                                            <span className={data.discriminationAvailable ? "w-10" : "text-xs text-muted-foreground"}>
                                                                {item.discrimination == null
                                                                    ? data.discriminationAvailable
                                                                        ? "—"
                                                                        : "Not reliable"
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
                                                            {item.code && (
                                                                <div className="space-y-2">
                                                                    {item.code.graded === 0 ? (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            No per-test data yet (attempts graded before this feature
                                                                            was added need to be regraded).
                                                                        </p>
                                                                    ) : (
                                                                        <>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {item.code.graded} graded submission(s): {item.code.compileErrors} compile
                                                                                error(s), {item.code.runtimeErrors} runtime error(s), {item.code.timeouts} timeout(s),{" "}
                                                                                {item.code.noCode} without code.
                                                                            </p>
                                                                            {item.code.tests.map((test) => {
                                                                                const failures = Object.entries(test.statusCounts)
                                                                                    .filter(([status]) => status !== "OK")
                                                                                    .sort((a, b) => b[1] - a[1]);
                                                                                return (
                                                                                    <div key={test.index} className="flex items-center gap-3 text-xs">
                                                                                        <span className="w-28 shrink-0 font-medium">
                                                                                            Test {test.index + 1} ({test.visible ? "visible" : "hidden"})
                                                                                        </span>
                                                                                        <div className="h-2 w-40 shrink-0 overflow-hidden rounded bg-border">
                                                                                            <div
                                                                                                className="h-full bg-green-600"
                                                                                                style={{ width: `${Math.round((test.passRate ?? 0) * 100)}%` }}
                                                                                            />
                                                                                        </div>
                                                                                        <span className="w-24 shrink-0">
                                                                                            {test.passed}/{test.evaluated} ({pct(test.passRate)})
                                                                                        </span>
                                                                                        <span className="min-w-0 truncate text-muted-foreground">
                                                                                            {test.inputs?.join(", ")} → {test.expected}
                                                                                            {failures.length > 0 &&
                                                                                                `  |  ${failures
                                                                                                    .map(([status, count]) => `${STATUS_LABEL[status] ?? status}: ${count}`)
                                                                                                    .join(", ")}`}
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </>
                                                                    )}
                                                                </div>
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
