import { verifyCodeSpec, type CodeVerifyResponse } from "@/api/exam.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CODE_TYPES, type CodeSpec, type CodeTestCase } from "@/types/features/exam";
import axios from "axios";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Play, Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";

export const VISIBLE_TESTS = 2;
export const HIDDEN_TESTS = 8;
export const DEFAULT_TIME_LIMIT = 5;
export const MIN_TIME_LIMIT = 1;
export const MAX_TIME_LIMIT = 10;
const MAX_PARAMS = 6;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,49}$/;
const KEYWORDS = new Set([
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const",
    "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float",
    "for", "goto", "if", "implements", "import", "instanceof", "int", "interface", "long", "native",
    "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp",
    "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void",
    "volatile", "while", "true", "false", "null", "var", "record", "main",
]);

const isIdent = (s: string) => IDENT.test(s) && !KEYWORDS.has(s);

/** String and char values keep their spaces exactly as typed; every other type is trimmed. */
const keepsSpaces = (type: string) => type === "String" || type === "char";
const normalizeValue = (type: string, raw: string) => (keepsSpaces(type) ? raw ?? "" : (raw ?? "").trim());

/** Return types whose expected value may legitimately be empty (empty string / empty array). */
const MAY_BE_EMPTY = new Set(["int[]", "boolean[]", "String", "String[]"]);

export function emptyTests(paramCount: number): CodeTestCase[] {
    return Array.from({ length: VISIBLE_TESTS + HIDDEN_TESTS }, (_, i) => ({
        inputs: Array.from({ length: paramCount }, () => ""),
        expected: "",
        visible: i < VISIBLE_TESTS,
    }));
}

export function emptyCodeSpec(): CodeSpec {
    return {
        functionName: "solve",
        returnType: "int",
        params: [{ name: "a", type: "int" }],
        tests: emptyTests(1),
        timeLimitSeconds: DEFAULT_TIME_LIMIT,
    };
}

/** Spec ready to send to the server: names trimmed, values normalized per type. */
export function normalizeSpecForSave(spec: CodeSpec): CodeSpec {
    const params = spec.params.map((p) => ({ name: p.name.trim(), type: p.type }));
    return {
        functionName: spec.functionName.trim(),
        returnType: spec.returnType,
        params,
        timeLimitSeconds: spec.timeLimitSeconds ?? DEFAULT_TIME_LIMIT,
        tests: spec.tests.map((t) => ({
            inputs: params.map((p, k) => normalizeValue(p.type, t.inputs[k] ?? "")),
            expected: normalizeValue(spec.returnType, t.expected),
            visible: t.visible,
        })),
    };
}

function checkValue(type: string, raw: string): string | null {
    const v = raw ?? "";
    if (v.length > 1000) return "is too long (max 1000 characters)";
    if (/[\r\n]/.test(v)) return "must not contain line breaks";
    const t = v.trim();
    switch (type) {
        case "int":
            return /^[+-]?\d+$/.test(t) && Math.abs(Number(t)) <= 2147483648 ? null : "must be an integer (int)";
        case "long":
            return /^[+-]?\d+$/.test(t) ? null : "must be an integer (long)";
        case "double":
            return t !== "" && Number.isFinite(Number(t)) ? null : "is not a valid number";
        case "boolean":
            return /^(true|false)$/i.test(t) ? null : "must be true or false";
        case "char":
            return v.length === 1 ? null : "must be exactly 1 character";
        case "int[]":
            if (t === "") return null;
            return t.split(",").every((p) => /^[+-]?\d+$/.test(p.trim())) ? null : "must be comma-separated integers, e.g. 1,2,3";
        case "boolean[]":
            if (t === "") return null;
            return t.split(",").every((p) => /^(true|false)$/i.test(p.trim())) ? null : "must be comma-separated true/false values";
        default:
            return null;
    }
}

export interface CodeSpecIssue {
    message: string;
    /** fn | ret | time | params | param-<i> | in-<test>-<param> | exp-<test> */
    field: string;
}

/** All problems of a coding setup (same rules as the backend). Empty = valid. */
export function codeSpecIssues(spec: CodeSpec | null | undefined): CodeSpecIssue[] {
    const issues: CodeSpecIssue[] = [];
    if (!spec) return [{ message: "Declare the function and the test cases.", field: "fn" }];
    if (!isIdent(spec.functionName.trim()))
        issues.push({
            message: "Function name is invalid (letters, digits and _, must not start with a digit or be a Java keyword).",
            field: "fn",
        });
    if (!(CODE_TYPES as readonly string[]).includes(spec.returnType))
        issues.push({ message: "Return type is invalid.", field: "ret" });
    const limit = spec.timeLimitSeconds;
    if (limit == null || !Number.isInteger(limit) || limit < MIN_TIME_LIMIT || limit > MAX_TIME_LIMIT)
        issues.push({
            message: `Time limit must be a whole number from ${MIN_TIME_LIMIT} to ${MAX_TIME_LIMIT} seconds.`,
            field: "time",
        });
    if (spec.params.length > MAX_PARAMS)
        issues.push({ message: `At most ${MAX_PARAMS} parameters.`, field: "params" });
    const names = new Set<string>();
    spec.params.forEach((p, i) => {
        const n = p.name.trim();
        if (!isIdent(n)) issues.push({ message: `Parameter ${i + 1} has an invalid name: '${n}'.`, field: `param-${i}` });
        else if (names.has(n)) issues.push({ message: `Parameter name '${n}' is used twice.`, field: `param-${i}` });
        names.add(n);
    });
    if (issues.some((x) => x.field === "fn" || x.field === "ret" || x.field.startsWith("param"))) return issues;

    spec.tests.forEach((t, i) => {
        const label = `Test ${i + 1} (${t.visible ? "visible" : "hidden"})`;
        spec.params.forEach((p, k) => {
            const problem = checkValue(p.type, t.inputs[k] ?? "");
            if (problem) issues.push({ message: `${label}, parameter '${p.name}' ${problem}.`, field: `in-${i}-${k}` });
        });
        const problem = checkValue(spec.returnType, t.expected);
        if (problem) issues.push({ message: `${label}, expected result ${problem}.`, field: `exp-${i}` });
        else if (t.expected === "" && !MAY_BE_EMPTY.has(spec.returnType))
            issues.push({ message: `${label}: enter the expected result.`, field: `exp-${i}` });
    });
    return issues;
}

/** Error messages only (kept for callers that just need the list). */
export function validateCodeSpec(spec: CodeSpec | null | undefined): string[] {
    return codeSpecIssues(spec).map((i) => i.message);
}

const hint = (type: string) =>
    type === "int[]" || type === "String[]" || type === "boolean[]"
        ? "e.g. 1,2,3 (items must not contain commas)"
        : type === "boolean"
          ? "true / false"
          : type === "char"
            ? "one character"
            : type === "String"
              ? "text (spaces are kept)"
              : "number";

const STATUS_LABEL: Record<string, string> = {
    OK: "Matches",
    WRONG_ANSWER: "Differs",
    COMPILE_ERROR: "Compile error",
    RUNTIME_ERROR: "Runtime error",
    TIME_LIMIT: "Time limit exceeded",
    INFRA_ERROR: "Judge unavailable",
    SKIPPED: "Skipped (fix the inputs first)",
};

function starterTemplate(spec: CodeSpec): string {
    const dflt: Record<string, string> = {
        int: "0", long: "0L", double: "0.0", boolean: "false", char: "' '", String: '""',
        "int[]": "new int[0]", "boolean[]": "new boolean[0]", "String[]": "new String[0]",
    };
    const params = spec.params.map((p) => `${p.type} ${p.name}`).join(", ");
    return `class Solution {\n    public static ${spec.returnType} ${spec.functionName || "solve"}(${params}) {\n        return ${dflt[spec.returnType] ?? "null"};\n    }\n}\n`;
}

const requestError = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        if (message) return message;
        if (!error.response) return "Cannot reach the server.";
    }
    return "Could not run the reference solution. Please try again.";
};

interface Props {
    value: CodeSpec;
    onChange: (next: CodeSpec) => void;
    disabled?: boolean;
    /** Show the list of problems and highlight invalid cells (turn on after the first failed save). */
    showErrors?: boolean;
}

export function CodeSpecEditor({ value, onChange, disabled, showErrors }: Props) {
    const [refOpen, setRefOpen] = useState(false);
    const [refCode, setRefCode] = useState("");
    const [running, setRunning] = useState(false);
    const [refError, setRefError] = useState<string | null>(null);
    const [result, setResult] = useState<CodeVerifyResponse | null>(null);
    const [ranWith, setRanWith] = useState<string | null>(null);

    const issues = codeSpecIssues(value);
    const bad = new Set(showErrors ? issues.map((i) => i.field) : []);
    const invalid = (field: string) => (bad.has(field) ? "border-destructive focus-visible:ring-destructive" : "");

    const setParams = (params: CodeSpec["params"]) =>
        onChange({
            ...value,
            params,
            tests: value.tests.map((t) => ({
                ...t,
                inputs: params.map((_, i) => t.inputs[i] ?? ""),
            })),
        });
    const setTest = (index: number, patch: Partial<CodeTestCase>) =>
        onChange({
            ...value,
            tests: value.tests.map((t, i) => (i === index ? { ...t, ...patch } : t)),
        });

    const signature = `public static ${value.returnType} ${value.functionName || "..."}(${value.params
        .map((p) => `${p.type} ${p.name}`)
        .join(", ")})`;

    const stale = result != null && ranWith !== JSON.stringify(value);
    const fillable = result ? result.tests.filter((t) => t.status === "WRONG_ANSWER" && t.actual != null).map((t) => t.index) : [];

    const runReference = async () => {
        if (running) return;
        setRunning(true);
        setRefError(null);
        try {
            const response = await verifyCodeSpec(normalizeSpecForSave(value), refCode);
            setResult(response);
            setRanWith(JSON.stringify(value));
        } catch (error) {
            setResult(null);
            setRefError(requestError(error));
        } finally {
            setRunning(false);
        }
    };

    const fillExpected = (indices: number[]) => {
        if (!result || indices.length === 0) return;
        const next: CodeSpec = {
            ...value,
            tests: value.tests.map((t, i) => {
                const r = result.tests[i];
                return indices.includes(i) && r && r.actual != null ? { ...t, expected: r.actual } : t;
            }),
        };
        onChange(next);
        const tests = result.tests.map((t) =>
            indices.includes(t.index) ? { ...t, status: "OK", matches: true } : t,
        );
        setResult({ ...result, tests, matched: tests.filter((t) => t.matches).length });
        setRanWith(JSON.stringify(next));
    };

    return (
        <section className="grid gap-4 rounded-md border p-4">
            <div className="grid gap-1">
                <Label>Function declaration (Coderbyte style, Java only)</Label>
                <p className="text-xs text-muted-foreground">
                    The system generates the starter code for students. Exactly {VISIBLE_TESTS} visible and {HIDDEN_TESTS} hidden
                    tests are required; every passed test is worth 10% of the question&apos;s score.
                </p>
            </div>

            {showErrors && issues.length > 0 && (
                <div
                    id="code-spec-errors"
                    role="alert"
                    tabIndex={-1}
                    className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
                >
                    <p className="font-medium">Please fix {issues.length} problem{issues.length > 1 ? "s" : ""} before saving:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {issues.map((issue, i) => (
                            <li key={i}>{issue.message}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                    <Label>Function name</Label>
                    <Input
                        value={value.functionName}
                        disabled={disabled}
                        aria-invalid={bad.has("fn")}
                        className={invalid("fn")}
                        onChange={(e) => onChange({ ...value, functionName: e.target.value })}
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Return type</Label>
                    <Select
                        value={value.returnType}
                        disabled={disabled}
                        onValueChange={(v) => onChange({ ...value, returnType: v })}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {CODE_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="code-time-limit">Time limit per test (seconds)</Label>
                    <Input
                        id="code-time-limit"
                        type="number"
                        min={MIN_TIME_LIMIT}
                        max={MAX_TIME_LIMIT}
                        step={1}
                        value={value.timeLimitSeconds ?? ""}
                        disabled={disabled}
                        aria-invalid={bad.has("time")}
                        className={invalid("time")}
                        onChange={(e) =>
                            onChange({ ...value, timeLimitSeconds: e.target.value === "" ? null : Number(e.target.value) })
                        }
                    />
                    <span className="text-xs text-muted-foreground">
                        {MIN_TIME_LIMIT}-{MAX_TIME_LIMIT}, default {DEFAULT_TIME_LIMIT}. Java start-up uses about 1 second.
                    </span>
                </div>
            </div>

            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label>Parameters ({value.params.length}/{MAX_PARAMS})</Label>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={disabled || value.params.length >= MAX_PARAMS}
                        onClick={() =>
                            setParams([...value.params, { name: `p${value.params.length + 1}`, type: "int" }])
                        }
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add parameter
                    </Button>
                </div>
                {value.params.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input
                            aria-label={`Name of parameter ${i + 1}`}
                            aria-invalid={bad.has(`param-${i}`)}
                            className={`flex-1 ${invalid(`param-${i}`)}`}
                            value={p.name}
                            disabled={disabled}
                            onChange={(e) =>
                                setParams(value.params.map((q, k) => (k === i ? { ...q, name: e.target.value } : q)))
                            }
                        />
                        <div className="w-36">
                            <Select
                                value={p.type}
                                disabled={disabled}
                                onValueChange={(v) =>
                                    setParams(value.params.map((q, k) => (k === i ? { ...q, type: v } : q)))
                                }
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CODE_TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Remove parameter ${i + 1}`}
                            disabled={disabled}
                            onClick={() => setParams(value.params.filter((_, k) => k !== i))}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <code className="block overflow-x-auto rounded bg-muted px-3 py-2 text-xs">{signature}</code>
            </div>

            <div className="grid gap-2">
                <Label>Test cases</Label>
                <p className="text-xs text-muted-foreground">
                    Values are trimmed, except for String and char which keep their spaces. Array items must not contain commas.
                </p>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                            <tr>
                                <th className="w-10 px-2 py-2">#</th>
                                <th className="w-24 px-2 py-2">Shown to</th>
                                {value.params.map((p, k) => (
                                    <th key={k} className="px-2 py-2" title={hint(p.type)}>
                                        {p.name || `p${k + 1}`} <span className="font-normal">({p.type})</span>
                                    </th>
                                ))}
                                <th className="px-2 py-2" title={hint(value.returnType)}>
                                    Expected <span className="font-normal">({value.returnType})</span>
                                </th>
                                {result && <th className="px-2 py-2">Reference output</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {value.tests.map((t, i) => {
                                const r = result?.tests[i];
                                return (
                                    <tr key={i} className={`border-b last:border-b-0 ${t.visible ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}>
                                        <td className="px-2 py-1.5 text-xs font-medium">{i + 1}</td>
                                        <td className="px-2 py-1.5 text-xs">{t.visible ? "Students" : "Grading only"}</td>
                                        {value.params.map((p, k) => (
                                            <td key={k} className="px-2 py-1.5">
                                                <Input
                                                    aria-label={`Test ${i + 1} ${p.name}`}
                                                    aria-invalid={bad.has(`in-${i}-${k}`)}
                                                    className={`h-8 min-w-[7rem] font-mono text-xs ${invalid(`in-${i}-${k}`)}`}
                                                    value={t.inputs[k] ?? ""}
                                                    disabled={disabled}
                                                    onChange={(e) =>
                                                        setTest(i, {
                                                            inputs: value.params.map((_, j) =>
                                                                j === k ? e.target.value : t.inputs[j] ?? "",
                                                            ),
                                                        })
                                                    }
                                                />
                                            </td>
                                        ))}
                                        <td className="px-2 py-1.5">
                                            <Input
                                                aria-label={`Test ${i + 1} expected result`}
                                                aria-invalid={bad.has(`exp-${i}`)}
                                                className={`h-8 min-w-[7rem] font-mono text-xs ${invalid(`exp-${i}`)}`}
                                                value={t.expected}
                                                disabled={disabled}
                                                onChange={(e) => setTest(i, { expected: e.target.value })}
                                            />
                                        </td>
                                        {result && (
                                            <td className="px-2 py-1.5">
                                                {r ? (
                                                    <div className="flex items-center gap-2">
                                                        {r.status === "OK" ? (
                                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                                                        ) : (
                                                            <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                                                        )}
                                                        <span
                                                            className="max-w-[10rem] truncate font-mono text-xs"
                                                            title={r.error ?? r.actual ?? ""}
                                                        >
                                                            {r.status === "OK" || r.status === "WRONG_ANSWER"
                                                                ? r.actual === ""
                                                                    ? "(empty)"
                                                                    : r.actual
                                                                : STATUS_LABEL[r.status] ?? r.status}
                                                        </span>
                                                        {r.status === "WRONG_ANSWER" && !disabled && (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-6 px-2 text-xs"
                                                                onClick={() => fillExpected([i])}
                                                            >
                                                                Use
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid gap-3 rounded-md border border-dashed p-3">
                <button
                    type="button"
                    className="flex w-full items-center gap-2 text-left text-sm font-medium"
                    aria-expanded={refOpen}
                    onClick={() => setRefOpen((v) => !v)}
                >
                    {refOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Check the tests with a reference solution
                    <span className="text-xs font-normal text-muted-foreground">(not saved, students never see it)</span>
                </button>
                {refOpen && (
                    <div className="grid gap-3">
                        <p className="text-xs text-muted-foreground">
                            Paste your own Java solution (class <code>Solution</code> with the function above). It runs on all{" "}
                            {value.tests.length} tests, hidden ones included. Tests whose output differs from the expected result
                            are marked, and you can copy the reference output into the expected column. The code is kept only while this
                            form is open.
                        </p>
                        <textarea
                            aria-label="Reference solution"
                            spellCheck={false}
                            wrap="off"
                            rows={10}
                            disabled={disabled}
                            className="w-full resize-y overflow-auto whitespace-pre rounded-md border bg-background p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={refCode}
                            placeholder={starterTemplate(value)}
                            onChange={(e) => setRefCode(e.target.value)}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" onClick={() => void runReference()} disabled={disabled || running || refCode.trim() === ""}>
                                {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                                {running ? "Running..." : "Run on all tests"}
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={disabled || running || refCode.trim() !== ""} onClick={() => setRefCode(starterTemplate(value))}>
                                Insert template
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={disabled || running || fillable.length === 0}
                                onClick={() => fillExpected(fillable)}
                            >
                                Fill all differing expected values ({fillable.length})
                            </Button>
                        </div>
                        {refError && (
                            <p role="alert" className="rounded-md border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
                                {refError}
                            </p>
                        )}
                        {result?.infraError && (
                            <p role="alert" className="rounded-md border border-amber-400 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                The code judge did not respond for some tests. Try again in a few seconds.
                            </p>
                        )}
                        {result?.compileError && (
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-destructive bg-destructive/10 p-2 font-mono text-xs text-destructive">
                                {result.compileError}
                            </pre>
                        )}
                        {result && (
                            <p className="text-xs">
                                <span className="font-medium">
                                    {result.matched}/{result.total} tests match the expected result.
                                </span>
                                {stale && (
                                    <span className="ml-2 text-amber-700 dark:text-amber-300">
                                        The tests changed after this run. Run again to refresh.
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

export { MAX_PARAMS };
