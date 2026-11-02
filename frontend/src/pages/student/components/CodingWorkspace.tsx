import type { CodeRunRequest, CodeRunResponse, CodeTestRun, ExamAttemptQuestion } from '@/api/exam.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { ArrowLeft, CheckCircle2, Play, Save, XCircle } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { toast } from 'sonner';

interface CodingWorkspaceProps {
    question: ExamAttemptQuestion;
    index: number;
    /** Code đã lưu của sinh viên (null/rỗng = chưa sửa, hiển thị code mẫu). */
    value: string | null;
    saved: boolean;
    isSaving: boolean;
    hasSaveError: boolean;
    timerBox: ReactNode;
    notice?: ReactNode;
    onChange: (code: string) => void;
    onSave: () => void;
    onBack: () => void;
    onRetry: () => void;
    onRun: (request: CodeRunRequest) => Promise<CodeRunResponse>;
}

const STATUS_LABEL: Record<string, string> = {
    OK: 'Đạt',
    WRONG_ANSWER: 'Sai kết quả',
    COMPILE_ERROR: 'Lỗi biên dịch',
    RUNTIME_ERROR: 'Lỗi khi chạy',
    TIME_LIMIT: 'Quá thời gian',
    INFRA_ERROR: 'Hệ thống chấm lỗi',
};

function runErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        if (message) return message;
        if (error.response?.status === 429) return 'Bạn chạy quá nhanh, vui lòng đợi vài giây.';
        if (!error.response) return 'Không kết nối được tới máy chủ.';
    }
    return 'Không chạy được code. Vui lòng thử lại.';
}

function ResultRow({ label, run }: { label: string; run: CodeTestRun }) {
    return (
        <div className={`rounded-md border p-2 text-xs ${run.passed ? 'border-green-300 bg-green-50/60 dark:bg-green-950/20' : 'border-red-300 bg-red-50/60 dark:bg-red-950/20'}`}>
            <div className="flex items-center gap-2 font-medium">
                {run.passed ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                {label}: {STATUS_LABEL[run.status] ?? run.status}
            </div>
            <div className="mt-1 font-mono">
                <div>Input: {run.inputs.join(' | ')}</div>
                {run.expected != null && run.expected !== '' && <div>Mong đợi: {run.expected}</div>}
                {run.actual != null && <div>Kết quả: {run.actual}</div>}
            </div>
            {run.error && <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-red-700 dark:text-red-400">{run.error}</pre>}
        </div>
    );
}

export function CodingWorkspace({
    question, index, value, saved, isSaving, hasSaveError, timerBox, notice,
    onChange, onSave, onBack, onRetry, onRun,
}: CodingWorkspaceProps) {
    const spec = question.code;
    const starter = spec?.starterCode ?? '';
    const code = value && value.length > 0 ? value : starter;
    const params = spec?.params ?? [];
    const [customInputs, setCustomInputs] = useState<string[]>(() => params.map(() => ''));
    const [useCustom, setUseCustom] = useState(false);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<CodeRunResponse | null>(null);

    const signature = spec
        ? `public static ${spec.returnType} ${spec.functionName}(${params.map((p) => `${p.type} ${p.name}`).join(', ')})`
        : '';

    const gutterRef = useRef<HTMLDivElement>(null);
    const lineCount = code.split('\n').length;

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        const el = event.currentTarget;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const select = (from: number, to: number) =>
            window.requestAnimationFrame(() => el.setSelectionRange(from, to));
        const lineStartOf = (pos: number) => (pos === 0 ? 0 : code.lastIndexOf('\n', pos - 1) + 1);

        // Ctrl/Cmd + Enter: run the examples
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void run();
            return;
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            const lineStart = lineStartOf(start);
            if (event.shiftKey) {
                // Outdent every selected line by up to 4 spaces
                const lines = code.slice(lineStart, end).split('\n');
                let removedFirst = 0;
                let removedTotal = 0;
                const outdented = lines.map((line, i) => {
                    const removed = line.match(/^ {1,4}/)?.[0].length ?? 0;
                    if (i === 0) removedFirst = removed;
                    removedTotal += removed;
                    return line.slice(removed);
                });
                onChange(code.slice(0, lineStart) + outdented.join('\n') + code.slice(end));
                select(Math.max(lineStart, start - removedFirst), Math.max(lineStart, end - removedTotal));
                return;
            }
            if (start !== end && code.slice(start, end).includes('\n')) {
                // Indent every selected line
                const lines = code.slice(lineStart, end).split('\n');
                onChange(code.slice(0, lineStart) + lines.map((line) => '    ' + line).join('\n') + code.slice(end));
                select(start + 4, end + 4 * lines.length);
                return;
            }
            onChange(code.slice(0, start) + '    ' + code.slice(end));
            select(start + 4, start + 4);
            return;
        }

        if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
            // Keep the previous line's indentation, add one level after an opening brace
            event.preventDefault();
            const before = code.slice(lineStartOf(start), start);
            const indent = before.match(/^[ \t]*/)?.[0] ?? '';
            const extra = before.trimEnd().endsWith('{') ? '    ' : '';
            const insert = '\n' + indent + extra;
            onChange(code.slice(0, start) + insert + code.slice(end));
            select(start + insert.length, start + insert.length);
        }
    };

    const run = async () => {
        if (running) return;
        if (code.trim().length === 0) {
            toast.error('Hãy nhập code trước khi chạy.');
            return;
        }
        if (useCustom && customInputs.some((v) => v.trim() === '')) {
            toast.error('Nhập đủ giá trị cho tất cả tham số của test tự chọn.');
            return;
        }
        setRunning(true);
        try {
            const response = await onRun({
                questionId: question.id,
                code,
                customInputs: useCustom ? customInputs : null,
            });
            setResult(response);
        } catch (error) {
            toast.error(runErrorMessage(error));
        } finally {
            setRunning(false);
        }
    };

    return (
        <main className="flex h-[calc(100dvh-10rem)] w-full flex-col gap-4 overflow-hidden">
            {notice}
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {timerBox}
                    <Button variant="outline" onClick={onBack}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Exam
                    </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {saved && <span className="font-medium text-green-600">Saved</span>}
                    {isSaving && <span>Saving...</span>}
                </div>
                <Button
                    onClick={onSave}
                    className={saved ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}
                >
                    <Save className="mr-1 h-4 w-4" /> {saved ? 'Saved' : 'Save Answer'}
                </Button>
            </header>

            {hasSaveError && (
                <p role="alert" className="shrink-0 text-sm text-destructive">
                    Some changes have not been saved to the server.{' '}
                    <Button variant="outline" size="sm" onClick={onRetry}>Retry Saving</Button>
                </p>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-5">
                <section className="min-h-0 overflow-auto rounded-xl border p-4 md:col-span-2">
                    <h2 className="font-semibold">Question {index + 1}</h2>
                    <p className="mt-3 whitespace-pre-wrap text-sm">{question.content}</p>
                    {question.imageUrl?.trim() && (
                        <img
                            src={question.imageUrl}
                            alt={`Question ${index + 1} image`}
                            className="mt-3 max-h-64 rounded-md border object-contain shadow-sm"
                        />
                    )}
                    {spec && (
                        <>
                            <h3 className="mt-5 text-sm font-semibold">Hàm cần viết (Java)</h3>
                            <code className="mt-1 block overflow-x-auto rounded bg-muted px-3 py-2 text-xs">{signature}</code>
                            <h3 className="mt-5 text-sm font-semibold">Ví dụ</h3>
                            <div className="mt-1 grid gap-2">
                                {spec.tests.map((t, i) => (
                                    <div key={i} className="rounded-md border p-2 text-xs font-mono">
                                        {params.map((p, k) => (
                                            <div key={k}>{p.name} = {t.inputs[k]}</div>
                                        ))}
                                        <div className="font-semibold">→ {t.expected}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </section>

                <section className="flex min-h-0 flex-col gap-3 rounded-xl border p-4 md:col-span-3">
                    <h2 className="shrink-0 font-semibold">Your Code</h2>
                    <div className="flex min-h-[8rem] flex-1 overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
                        <div
                            ref={gutterRef}
                            aria-hidden="true"
                            className="select-none overflow-hidden border-r bg-muted/40 py-3 pl-2 pr-2 text-right font-mono text-sm leading-5 text-muted-foreground"
                        >
                            {Array.from({ length: lineCount }, (_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>
                        <textarea
                            aria-label={`Code for question ${index + 1}`}
                            spellCheck={false}
                            wrap="off"
                            className="h-full min-w-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 font-mono text-sm leading-5 outline-none"
                            value={code}
                            onChange={(event) => onChange(event.target.value)}
                            onKeyDown={handleKeyDown}
                            onScroll={(event) => {
                                if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
                            }}
                        />
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="button" onClick={() => void run()} disabled={running}>
                                <Play className="mr-1 h-4 w-4" /> {running ? 'Đang chạy...' : 'Run (Ctrl+Enter)'}
                            </Button>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} />
                                Thêm test tự nhập (không tính điểm)
                            </label>
                            <span className="text-xs text-muted-foreground">Run chỉ chạy các ví dụ ở bên trái; điểm được chấm khi nộp bài.</span>
                        </div>
                        {useCustom && (
                            <div className="grid gap-2 md:grid-cols-2">
                                {params.map((p, k) => (
                                    <div key={k} className="grid gap-1">
                                        <span className="text-xs text-muted-foreground">{p.name} ({p.type})</span>
                                        <Input
                                            aria-label={`Custom ${p.name}`}
                                            value={customInputs[k] ?? ''}
                                            onChange={(e) =>
                                                setCustomInputs((prev) => prev.map((v, j) => (j === k ? e.target.value : v)))
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        {result && (
                            <div className="grid max-h-48 gap-2 overflow-auto">
                                <p className="text-xs font-medium">Ví dụ đạt: {result.passed}/{result.total}</p>
                                {result.tests.map((t) => (
                                    <ResultRow key={t.index} label={`Ví dụ ${t.index + 1}`} run={t} />
                                ))}
                                {result.custom && <ResultRow label="Test tự nhập" run={result.custom} />}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
