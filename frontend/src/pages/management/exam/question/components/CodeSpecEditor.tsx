import { previewMain, verifyCodeSpec, type CodeVerifyResponse } from "@/api/exam.api";
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
import { CheckCircle2, Loader2, Play, Plus, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

export const DEFAULT_TEST_COUNT = 5;
export const DEFAULT_VISIBLE_TESTS = 2;
export const MIN_TESTS = 1;
export const DEFAULT_TIME_LIMIT = 5;
export const MIN_TIME_LIMIT = 1;
export const MAX_TIME_LIMIT = 10;
const MAX_PARAMS = 6;
const MAIN_CLASS = /\bclass\s+Main\b/;
const MAIN_METHOD = /\bstatic\s+void\s+main\s*\(/;
const MAX_MAIN_LENGTH = 20000;
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

export interface DetectedDeclaration {
    fn: string;
    ret: string;
    params: { name: string; type: string }[];
}

/**
 * Reads the function declaration from a reference solution: the first `static <type> name(<params>)`
 * whose types are all supported. If a method with `preferredName` exists, that one wins.
 */
export function detectDeclaration(code: string, preferredName?: string): DetectedDeclaration | null {
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    const re = /\bstatic\s+(?:final\s+)?([A-Za-z]+(?:\s*\[\s*\])?)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g;
    const supported = (t: string) => (CODE_TYPES as readonly string[]).includes(t);
    const found: DetectedDeclaration[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean))) {
        const ret = m[1].replace(/\s+/g, "");
        const fn = m[2];
        if (!supported(ret) || !isIdent(fn)) continue;
        const raw = m[3].trim();
        const params: DetectedDeclaration["params"] = [];
        let ok = raw === "" || raw.split(",").length <= MAX_PARAMS;
        if (raw !== "" && ok) {
            for (const part of raw.split(",")) {
                const tokens = part.replace(/\bfinal\b/g, " ").replace(/\s*\[\s*\]/g, "[]").trim().split(/\s+/);
                const type = tokens.slice(0, -1).join("");
                const name = tokens[tokens.length - 1];
                if (tokens.length < 2 || !supported(type) || !isIdent(name)) {
                    ok = false;
                    break;
                }
                params.push({ type, name });
            }
        }
        if (ok) found.push({ fn, ret, params });
    }
    return found.find((d) => d.fn === preferredName) ?? found[0] ?? null;
}

export function emptyTests(paramCount: number): CodeTestCase[] {
    return Array.from({ length: DEFAULT_TEST_COUNT }, (_, i) => ({
        inputs: Array.from({ length: paramCount }, () => ""),
        expected: "",
        visible: i < DEFAULT_VISIBLE_TESTS,
    }));
}

export function emptyCodeSpec(): CodeSpec {
    return {
        functionName: "solve",
        returnType: "int",
        params: [{ name: "a", type: "int" }],
        tests: emptyTests(1),
        timeLimitSeconds: DEFAULT_TIME_LIMIT,
        customMain: false,
        mainCode: null,
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
        customMain: !!spec.customMain,
        mainCode: spec.customMain ? spec.mainCode ?? "" : null,
        referenceCode: spec.referenceCode?.trim() ? spec.referenceCode : null,
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
    if (spec.customMain) {
        const main = spec.mainCode ?? "";
        if (main.trim() === "") issues.push({ message: "The custom main function is empty.", field: "main" });
        else if (main.length > MAX_MAIN_LENGTH)
            issues.push({ message: `The custom main function is too long (max ${MAX_MAIN_LENGTH} characters).`, field: "main" });
        else if (!MAIN_CLASS.test(main) || !MAIN_METHOD.test(main))
            issues.push({
                message: "The custom main must be inside class Main and declare public static void main(String[] args).",
                field: "main",
            });
    }
    const names = new Set<string>();
    spec.params.forEach((p, i) => {
        const n = p.name.trim();
        if (!isIdent(n)) issues.push({ message: `Parameter ${i + 1} has an invalid name: '${n}'.`, field: `param-${i}` });
        else if (names.has(n)) issues.push({ message: `Parameter name '${n}' is used twice.`, field: `param-${i}` });
        names.add(n);
    });
    if (issues.some((x) => x.field === "fn" || x.field === "ret" || x.field.startsWith("param"))) return issues;

    if (spec.tests.length < MIN_TESTS) issues.push({ message: "Add at least one test case.", field: "tests" });
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

/** Small beginner-style example solutions, keyed by "<return type>|<type of the first parameter>". */
const EXAMPLE_BODIES: Record<string, (x: string) => string> = {
    "boolean|int": (n) =>
        `        // Prime check: true when ${n} has no divisor from 2 up to its square root.\n` +
        `        if (${n} < 2) return false;\n` +
        `        for (int i = 2; i * i <= ${n}; i++) {\n` +
        `            if (${n} % i == 0) return false;\n` +
        `        }\n` +
        `        return true;`,
    "boolean|String": (s) =>
        `        // Palindrome check.\n` +
        `        return new StringBuilder(${s}).reverse().toString().equals(${s});`,
    "int|int": (n) => `        // Square of the number.\n        return ${n} * ${n};`,
    "int|int[]": (a) =>
        `        // Sum of all elements.\n` +
        `        int sum = 0;\n` +
        `        for (int v : ${a}) sum += v;\n` +
        `        return sum;`,
    "int|String": (s) => `        // Length of the text.\n        return ${s}.length();`,
    "long|int": (n) =>
        `        // Factorial of the number.\n` +
        `        long result = 1;\n` +
        `        for (int i = 2; i <= ${n}; i++) result *= i;\n` +
        `        return result;`,
    "long|int[]": (a) =>
        `        // Sum of all elements (as long).\n` +
        `        long sum = 0;\n` +
        `        for (int v : ${a}) sum += v;\n` +
        `        return sum;`,
    "double|int[]": (a) =>
        `        // Average of the elements (0 for an empty array).\n` +
        `        if (${a}.length == 0) return 0;\n` +
        `        double sum = 0;\n` +
        `        for (int v : ${a}) sum += v;\n` +
        `        return sum / ${a}.length;`,
    "double|int": (n) => `        // Half of the number.\n        return ${n} / 2.0;`,
    "char|String": (s) =>
        `        // First character (a space for an empty text).\n` +
        `        return ${s}.isEmpty() ? ' ' : ${s}.charAt(0);`,
    "String|String": (s) =>
        `        // Reverse the text.\n` +
        `        return new StringBuilder(${s}).reverse().toString();`,
    "String|int": (n) => `        // The number as text.\n        return String.valueOf(${n});`,
    "int[]|int[]": (a) =>
        `        // Sort ascending.\n` +
        `        int[] result = ${a}.clone();\n` +
        `        Arrays.sort(result);\n` +
        `        return result;`,
    "boolean[]|int[]": (a) =>
        `        // true for every even element.\n` +
        `        boolean[] result = new boolean[${a}.length];\n` +
        `        for (int i = 0; i < ${a}.length; i++) result[i] = ${a}[i] % 2 == 0;\n` +
        `        return result;`,
    "String[]|String": (s) =>
        `        // Split the text into words.\n` +
        `        return ${s}.trim().isEmpty() ? new String[0] : ${s}.trim().split("\\\\s+");`,
};

function starterTemplate(spec: CodeSpec): string {
    const dflt: Record<string, string> = {
        int: "0", long: "0L", double: "0.0", boolean: "false", char: "' '", String: '""',
        "int[]": "new int[0]", "boolean[]": "new boolean[0]", "String[]": "new String[0]",
    };
    const params = spec.params.map((p) => `${p.type} ${p.name}`).join(", ");
    const first = spec.params[0];
    const example = first ? EXAMPLE_BODIES[`${spec.returnType}|${first.type}`] : undefined;
    const body = example
        ? example(first.name)
        : `        // TODO: write your solution here.\n        return ${dflt[spec.returnType] ?? "null"};`;
    return `class Solution {\n    public static ${spec.returnType} ${spec.functionName || "solve"}(${params}) {\n${body}\n    }\n}\n`;
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
    /**
     * Gives the parent a function to call when Save is pressed. It compares the declaration in the form with the
     * reference solution and the custom main and returns the problems (the parent blocks saving; nothing is changed,
     * main is never reset).
     */
    onRegisterSaveCheck?: (check: () => string[]) => void;
}

export function CodeSpecEditor({ value, onChange, disabled, showErrors, onRegisterSaveCheck }: Props) {
    const declSig = JSON.stringify([
        value.functionName.trim(),
        value.returnType,
        value.params.map((p) => [p.name.trim(), p.type]),
    ]);
    const [generatedMain, setGeneratedMain] = useState<string | null>(null);
    const [mainError, setMainError] = useState<string | null>(null);
    /** Declaration the custom main was written for (to warn when it changes afterwards). */
    const [mainBase, setMainBase] = useState<string | null>(() => (value.customMain ? declSig : null));
    // The teacher's demo solution is saved with the question, so it lives in the spec (not in local state).
    const refCode = value.referenceCode ?? "";
    const setRefCode = (next: string) => onChange({ ...value, referenceCode: next });
    const [resetting, setResetting] = useState(false);
    const [resetNote, setResetNote] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [refError, setRefError] = useState<string | null>(null);
    const [result, setResult] = useState<CodeVerifyResponse | null>(null);
    const [ranWith, setRanWith] = useState<string | null>(null);

    const issues = codeSpecIssues(value);
    const bad = new Set(showErrors ? issues.map((i) => i.field) : []);
    const invalid = (field: string) => (bad.has(field) ? "border-destructive focus-visible:ring-destructive" : "");

    // Tests with exactly the same inputs: their input cells get a red border (visual hint only, nothing blocks saving).
    const duplicateRows = new Set<number>();
    if (value.params.length > 0) {
        const seen = new Map<string, number>();
        value.tests.forEach((t, i) => {
            const raw = value.params.map((_, k) => t.inputs[k] ?? "");
            if (raw.every((v) => v === "")) return; // rows that are still blank
            const key = JSON.stringify(value.params.map((p, k) => normalizeValue(p.type, raw[k])));
            const first = seen.get(key);
            if (first === undefined) seen.set(key, i);
            else {
                duplicateRows.add(first);
                duplicateRows.add(i);
            }
        });
    }

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

    const addTest = () =>
        onChange({
            ...value,
            tests: [...value.tests, { inputs: value.params.map(() => ""), expected: "", visible: false }],
        });
    const removeTest = (index: number) => {
        if (value.tests.length <= MIN_TESTS) return;
        onChange({ ...value, tests: value.tests.filter((_, i) => i !== index) });
    };

    const signature = `public static ${value.returnType} ${value.functionName || "..."}(${value.params
        .map((p) => `${p.type} ${p.name}`)
        .join(", ")})`;

    const declarationBad = issues.some((i) => i.field === "fn" || i.field === "ret" || i.field.startsWith("param"));

    // Keep the auto-generated main in sync with the declaration (debounced server call).
    useEffect(() => {
        if (declarationBad) {
            setGeneratedMain(null);
            setMainError("Fix the function declaration above to see the generated main.");
            return;
        }
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            try {
                const main = await previewMain(normalizeSpecForSave(value));
                if (!cancelled) {
                    setGeneratedMain(main);
                    setMainError(null);
                }
            } catch (error) {
                if (!cancelled) {
                    setGeneratedMain(null);
                    setMainError(requestError(error));
                }
            }
        }, 500);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [declSig, declarationBad]);

    const enableCustomMain = () => {
        onChange({ ...value, customMain: true, mainCode: generatedMain ?? value.mainCode ?? "" });
        setMainBase(declSig);
    };
    const disableCustomMain = () => {
        onChange({ ...value, customMain: false, mainCode: null });
        setMainBase(null);
    };
    const declSigOf = (spec: CodeSpec) =>
        JSON.stringify([spec.functionName.trim(), spec.returnType, spec.params.map((p) => [p.name.trim(), p.type])]);

    /**
     * "Reset to generated": if a reference solution is pasted below, first read the function declaration
     * from it (name, return type, parameters), then rebuild main for that declaration.
     */
    const resetMain = async () => {
        if (resetting) return;
        setResetNote(null);
        let next = value;
        if (refCode.trim() !== "") {
            const found = detectDeclaration(refCode, value.functionName);
            if (!found) {
                setResetNote(
                    "No function with supported types found in the reference solution, so the declaration was left unchanged.",
                );
            } else {
                next = {
                    ...value,
                    functionName: found.fn,
                    returnType: found.ret,
                    params: found.params,
                    tests: value.tests.map((t) => ({ ...t, inputs: found.params.map((_, i) => t.inputs[i] ?? "") })),
                };
                setResetNote(
                    `Declaration read from the reference solution: public static ${found.ret} ${found.fn}(${found.params
                        .map((p) => `${p.type} ${p.name}`)
                        .join(", ")})`,
                );
            }
        }
        if (!next.customMain) {
            onChange(next);
            return;
        }
        setResetting(true);
        try {
            const main = await previewMain(normalizeSpecForSave(next));
            onChange({ ...next, mainCode: main });
            setMainBase(declSigOf(next));
        } catch (error) {
            onChange(next);
            setResetNote(requestError(error));
        } finally {
            setResetting(false);
        }
    };
    const mainOutdated = !!value.customMain && mainBase != null && mainBase !== declSig;

    const [saveNotes, setSaveNotes] = useState<string[]>([]);
    useEffect(() => setSaveNotes([]), [declSig, refCode, value.mainCode, value.customMain]);

    /** Warnings shown when saving. Read-only: it never edits the declaration, tests or main. */
    const saveWarnings = (): string[] => {
        const notes: string[] = [];
        const fn = value.functionName.trim();
        const sigOf = (ret: string, name: string, params: { type: string; name: string }[]) =>
            `public static ${ret} ${name}(${params.map((p) => `${p.type} ${p.name}`).join(", ")})`;
        if (refCode.trim() !== "") {
            const found = detectDeclaration(refCode, fn);
            if (!found) {
                notes.push("The reference solution has no function with supported types, so its declaration could not be compared with the form.");
            } else {
                const formSig = sigOf(value.returnType, fn, value.params.map((p) => ({ type: p.type, name: p.name.trim() })));
                const codeSig = sigOf(found.ret, found.fn, found.params);
                if (formSig !== codeSig) {
                    notes.push(`The declaration in the form does not match the reference solution. Form: ${formSig}. Reference solution: ${codeSig}.`);
                }
            }
        }
        if (value.customMain) {
            if (mainOutdated) {
                notes.push("The function declaration changed after your custom main was written. Check that main still matches it. Main was not changed.");
            } else if (fn && !new RegExp(`\\bSolution\\s*\\.\\s*${fn}\\s*\\(`).test(value.mainCode ?? "")) {
                notes.push(`Your custom main does not call Solution.${fn}(...). Main was not changed.`);
            }
        }
        setSaveNotes(notes);
        return notes;
    };
    useEffect(() => {
        onRegisterSaveCheck?.(saveWarnings);
    });

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
                    The system generates the starter code for students. Add as many test cases as you need (at least {MIN_TESTS});
                    tick the ones students may see during the exam, the others are used for grading only. Every test is worth the
                    same share of the question&apos;s score.
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

            <div className="grid gap-3 rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                        <Label>Main function</Label>
                        <p className="text-xs text-muted-foreground">
                            The system runs the student&apos;s <code>Solution</code> class with this <code>Main</code>: it reads one
                            parameter per line from stdin, calls your function and prints the result. Students and graders see it
                            read-only.{" "}
                            {value.customMain ? "You are using a custom main." : "It is generated from the declaration above."}
                        </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={!!value.customMain}
                            disabled={disabled || (!value.customMain && !generatedMain)}
                            onChange={(e) => (e.target.checked ? enableCustomMain() : disableCustomMain())}
                        />
                        Customize main
                    </label>
                </div>
                {!value.customMain && mainError && <p className="text-xs text-muted-foreground">{mainError}</p>}
                <textarea
                    aria-label="Main function"
                    aria-invalid={bad.has("main")}
                    spellCheck={false}
                    wrap="off"
                    rows={12}
                    readOnly={!value.customMain || disabled}
                    className={`w-full resize-y overflow-auto whitespace-pre rounded-md border p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        value.customMain ? "bg-background" : "bg-muted/40 text-muted-foreground"
                    } ${invalid("main")}`}
                    value={value.customMain ? value.mainCode ?? "" : generatedMain ?? ""}
                    onChange={(e) => onChange({ ...value, mainCode: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={disabled || resetting || (!value.customMain && refCode.trim() === "")}
                        onClick={() => void resetMain()}
                    >
                        {resetting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Reset to generated
                    </Button>
                    <span className="text-muted-foreground">
                        {refCode.trim() !== ""
                            ? "Reads the function declaration from the reference solution below, then rebuilds main."
                            : "Paste a reference solution below to read the declaration from it automatically."}
                        {value.customMain &&
                            " Keep reading one parameter per line from stdin and print only the result; it is still compared with the expected value by the return type."}
                    </span>
                </div>
                {resetNote && <p className="text-xs text-muted-foreground">{resetNote}</p>}
                {saveNotes.length > 0 && (
                    <div id="code-save-notes" role="alert" className="grid gap-1 rounded-md border border-amber-400 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        <p className="font-medium">Not saved. Please fix this first:</p>
                        {saveNotes.map((n) => (
                            <p key={n}>{n}</p>
                        ))}
                        <p className="text-muted-foreground">
                            Edit the form or the reference solution so they match, or press &quot;Reset to generated&quot; to copy the
                            declaration from the reference solution. Your main is never changed by saving.
                        </p>
                    </div>
                )}
                {mainOutdated && (
                    <p role="alert" className="rounded-md border border-amber-400 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        The function declaration changed after you customized main. Check that main still matches it, or reset it.
                    </p>
                )}
            </div>

            <div className="grid gap-3 rounded-md border border-dashed p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    Check the tests with a reference solution
                    <span className="text-xs font-normal text-muted-foreground">(saved with the question, students never see it)</span>
                </div>
                {(
                    <div className="grid gap-3">
                        <p className="text-xs text-muted-foreground">
                            Paste your own Java solution (class <code>Solution</code> with the function above). It runs on all{" "}
                            {value.tests.length} tests, hidden ones included. Tests whose output differs from the expected result
                            are marked, and you can copy the reference output into the expected column. The code is saved with the question
                            for teachers only.
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
                        {result?.compileError && (
                            <p className="text-xs text-muted-foreground">
                                If the error mentions <code>Main.java</code>, the function declaration above (name, return type and
                                parameters) does not match your solution. Current declaration: <code>{signature}</code>
                            </p>
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
            <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>
                        Test cases ({value.tests.length}) - {value.tests.filter((t) => t.visible).length} shown to students
                    </Label>
                    <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addTest}>
                        <Plus className="mr-1 h-4 w-4" /> Add test case
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Tick &quot;Show to students&quot; for the tests students can see while taking the exam. Values are trimmed, except for String and char which keep their spaces. Array items must not contain commas.
                </p>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                            <tr>
                                <th className="w-10 px-2 py-2">#</th>
                                <th className="w-28 px-2 py-2">Show to students</th>
                                {value.params.map((p, k) => (
                                    <th key={k} className="px-2 py-2" title={hint(p.type)}>
                                        {p.name || `p${k + 1}`} <span className="font-normal">({p.type})</span>
                                    </th>
                                ))}
                                <th className="px-2 py-2" title={hint(value.returnType)}>
                                    Expected <span className="font-normal">({value.returnType})</span>
                                </th>
                                {result && <th className="px-2 py-2">Reference output</th>}
                                <th className="w-10 px-2 py-2"><span className="sr-only">Remove</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {value.tests.map((t, i) => {
                                const r = result?.tests[i];
                                return (
                                    <tr key={i} className={`border-b last:border-b-0 ${t.visible ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}>
                                        <td className="px-2 py-1.5 text-xs font-medium">{i + 1}</td>
                                        <td className="px-2 py-1.5">
                                            <label className="flex items-center gap-2 text-xs">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Show test ${i + 1} to students`}
                                                    checked={t.visible}
                                                    disabled={disabled}
                                                    onChange={(e) => setTest(i, { visible: e.target.checked })}
                                                />
                                                {t.visible ? "Shown" : "Hidden"}
                                            </label>
                                        </td>
                                        {value.params.map((p, k) => (
                                            <td key={k} className="px-2 py-1.5">
                                                <Input
                                                    aria-label={`Test ${i + 1} ${p.name}`}
                                                    aria-invalid={bad.has(`in-${i}-${k}`) || duplicateRows.has(i)}
                                                    className={`h-8 min-w-[7rem] font-mono text-xs ${invalid(`in-${i}-${k}`)} ${
                                                        duplicateRows.has(i) ? "border-destructive focus-visible:ring-destructive" : ""
                                                    }`}
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
                                        <td className="px-2 py-1.5">
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                aria-label={`Remove test ${i + 1}`}
                                                disabled={disabled || value.tests.length <= MIN_TESTS}
                                                onClick={() => removeTest(i)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

export { MAX_PARAMS };
