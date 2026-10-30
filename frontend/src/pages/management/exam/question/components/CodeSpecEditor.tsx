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
import { Plus, Trash2 } from "lucide-react";

export const VISIBLE_TESTS = 2;
export const HIDDEN_TESTS = 8;
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
    };
}

function checkValue(type: string, raw: string): string | null {
    const v = raw ?? "";
    if (v.length > 1000) return "quá dài (tối đa 1000 ký tự)";
    if (/[\r\n]/.test(v)) return "không được chứa xuống dòng";
    const t = v.trim();
    switch (type) {
        case "int":
            return /^[+-]?\d+$/.test(t) && Math.abs(Number(t)) <= 2147483648 ? null : "phải là số nguyên (int)";
        case "long":
            return /^[+-]?\d+$/.test(t) ? null : "phải là số nguyên (long)";
        case "double":
            return t !== "" && Number.isFinite(Number(t)) ? null : "không phải số hợp lệ";
        case "boolean":
            return /^(true|false)$/i.test(t) ? null : "phải là true hoặc false";
        case "int[]":
            if (t === "") return null;
            return t.split(",").every((p) => /^[+-]?\d+$/.test(p.trim())) ? null : "mảng int cách nhau bởi dấu phẩy, ví dụ 1,2,3";
        default:
            return null;
    }
}

/** Trả về danh sách lỗi (rỗng nếu hợp lệ), cùng quy tắc với backend. */
export function validateCodeSpec(spec: CodeSpec | null | undefined): string[] {
    const errors: string[] = [];
    if (!spec) return ["Cần khai báo hàm và test case."];
    const fn = spec.functionName.trim();
    if (!isIdent(fn)) errors.push("Tên hàm không hợp lệ (chữ, số, _, không bắt đầu bằng số, không trùng từ khóa Java).");
    if (!(CODE_TYPES as readonly string[]).includes(spec.returnType)) errors.push("Kiểu trả về không hợp lệ.");
    if (spec.params.length > MAX_PARAMS) errors.push(`Tối đa ${MAX_PARAMS} tham số.`);
    const names = new Set<string>();
    for (const p of spec.params) {
        const n = p.name.trim();
        if (!isIdent(n)) errors.push(`Tên tham số không hợp lệ: '${n}'.`);
        else if (names.has(n)) errors.push(`Tên tham số bị trùng: ${n}.`);
        names.add(n);
    }
    if (errors.length) return errors;
    spec.tests.forEach((t, i) => {
        const label = `Test ${i + 1} (${t.visible ? "hiển thị" : "ẩn"})`;
        spec.params.forEach((p, k) => {
            const problem = checkValue(p.type, t.inputs[k] ?? "");
            if (problem) errors.push(`${label}, tham số '${p.name}': ${problem}.`);
        });
        const problem = checkValue(spec.returnType, t.expected);
        if (problem) errors.push(`${label}, kết quả mong đợi: ${problem}.`);
        if (t.expected.trim() === "" && spec.returnType !== "int[]" && spec.returnType !== "String")
            errors.push(`${label}: chưa nhập kết quả mong đợi.`);
    });
    return errors;
}

const hint = (type: string) =>
    type === "int[]" || type === "String[]" ? "vd: 1,2,3" : type === "boolean" ? "true / false" : type === "String" ? "chuỗi" : "số";

interface Props {
    value: CodeSpec;
    onChange: (next: CodeSpec) => void;
    disabled?: boolean;
}

export function CodeSpecEditor({ value, onChange, disabled }: Props) {
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

    return (
        <section className="grid gap-4 rounded-md border p-4">
            <div className="grid gap-1">
                <Label>Khai báo hàm (kiểu Coderbyte, chỉ Java)</Label>
                <p className="text-xs text-muted-foreground">
                    Hệ thống tự sinh code mẫu cho sinh viên. Cần đúng {VISIBLE_TESTS} test hiển thị và {HIDDEN_TESTS} test ẩn; mỗi test đạt = 10% điểm câu.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label>Tên hàm</Label>
                    <Input
                        value={value.functionName}
                        disabled={disabled}
                        onChange={(e) => onChange({ ...value, functionName: e.target.value })}
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Kiểu trả về</Label>
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
            </div>

            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label>Tham số ({value.params.length}/{MAX_PARAMS})</Label>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={disabled || value.params.length >= MAX_PARAMS}
                        onClick={() =>
                            setParams([...value.params, { name: `p${value.params.length + 1}`, type: "int" }])
                        }
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Thêm tham số
                    </Button>
                </div>
                {value.params.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input
                            aria-label={`Tên tham số ${i + 1}`}
                            className="flex-1"
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
                            aria-label={`Xóa tham số ${i + 1}`}
                            disabled={disabled}
                            onClick={() => setParams(value.params.filter((_, k) => k !== i))}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <code className="block overflow-x-auto rounded bg-muted px-3 py-2 text-xs">{signature}</code>
            </div>

            <div className="grid gap-3">
                <Label>Test case</Label>
                {value.tests.map((t, i) => (
                    <div
                        key={i}
                        className={`grid gap-2 rounded-md border p-3 ${t.visible ? "border-blue-300 bg-blue-50/40 dark:bg-blue-950/20" : ""}`}
                    >
                        <div className="text-xs font-semibold">
                            Test {i + 1} — {t.visible ? "Hiển thị cho sinh viên" : "Ẩn (dùng để chấm)"}
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                            {value.params.map((p, k) => (
                                <div key={k} className="grid gap-1">
                                    <span className="text-xs text-muted-foreground">
                                        {p.name} ({p.type}) · {hint(p.type)}
                                    </span>
                                    <Input
                                        aria-label={`Test ${i + 1} ${p.name}`}
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
                                </div>
                            ))}
                            <div className="grid gap-1">
                                <span className="text-xs text-muted-foreground">
                                    Kết quả mong đợi ({value.returnType}) · {hint(value.returnType)}
                                </span>
                                <Input
                                    aria-label={`Test ${i + 1} kết quả mong đợi`}
                                    value={t.expected}
                                    disabled={disabled}
                                    onChange={(e) => setTest(i, { expected: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export { MAX_PARAMS };
