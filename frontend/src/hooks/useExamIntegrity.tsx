// NEW (anti-cheat): theo doi hanh vi trong luc lam bai.
// - Chi GHI LOG gui len server, khong tu dong nop bai.
// - Chan copy/cut/paste/chuot phai/phim tat (best-effort: trinh duyet khong the chan 100%).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ExamIntegrityConfig, IntegrityEventType } from '@/api/exam.api';

export interface IntegrityPayload {
    clientId: string;
    events: { type: IntegrityEventType; durationSeconds?: number; detail?: string }[];
}

interface Options {
    attemptId: number | undefined;
    config: ExamIntegrityConfig | undefined;
    /** true khi bai dang IN_PROGRESS */
    active: boolean;
    send: (attemptId: number, payload: IntegrityPayload) => Promise<unknown>;
}

const LABELS: Partial<Record<IntegrityEventType, string>> = {
    TAB_HIDDEN: 'Rời tab',
    WINDOW_BLUR: 'Chuyển cửa sổ',
    FULLSCREEN_EXIT: 'Thoát toàn màn hình',
    COPY: 'Sao chép',
    CUT: 'Cắt',
    PASTE: 'Dán',
    CONTEXT_MENU: 'Chuột phải',
    DEVTOOLS_KEY: 'Phím công cụ nhà phát triển',
    PRINT_ATTEMPT: 'In / chụp màn hình',
};

const newClientId = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useExamIntegrity({ attemptId, config, active, send }: Options) {
    const enabled = Boolean(active && attemptId && config?.enabled);
    const clientIdRef = useRef<string>(newClientId());
    const queueRef = useRef<IntegrityPayload['events']>([]);
    const lastByTypeRef = useRef<Map<string, number>>(new Map());
    const sendRef = useRef(send);
    sendRef.current = send;

    const [violations, setViolations] = useState(0);
    const [lastMessage, setLastMessage] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(
        typeof document !== 'undefined' && Boolean(document.fullscreenElement),
    );

    const flush = useCallback(async () => {
        if (!attemptId) return;
        const events = queueRef.current.splice(0, queueRef.current.length);
        try {
            await sendRef.current(attemptId, { clientId: clientIdRef.current, events });
        } catch {
            // mang loi: tra lai hang doi de gui lan sau
            queueRef.current.unshift(...events);
        }
    }, [attemptId]);

    const record = useCallback((type: IntegrityEventType, durationSeconds?: number, detail?: string) => {
        // chong trung lap (vd: blur + hidden xay ra gan nhau, hoac giu phim)
        const nowMs = Date.now();
        const last = lastByTypeRef.current.get(type) ?? 0;
        if (nowMs - last < 400) return;
        lastByTypeRef.current.set(type, nowMs);
        queueRef.current.push({ type, durationSeconds, detail });
        setViolations((v) => v + 1);
        setLastMessage(LABELS[type] ?? type);
        void flush();
    }, [flush]);

    // heartbeat + gui dinh ky (phat hien mo nhieu noi)
    useEffect(() => {
        if (!enabled) return;
        const timer = window.setInterval(() => void flush(), 20000);
        void flush();
        return () => window.clearInterval(timer);
    }, [enabled, flush]);

    // roi tab / chuyen cua so
    useEffect(() => {
        if (!enabled || !config?.detectTabSwitch) return;
        let hiddenAt: number | null = null;
        let blurAt: number | null = null;
        let blurTimer: number | undefined;
        const secs = (from: number) => Math.max(1, Math.round((Date.now() - from) / 1000));

        const onVisibility = () => {
            if (document.hidden) {
                hiddenAt = Date.now();
            } else if (hiddenAt) {
                record('TAB_HIDDEN', secs(hiddenAt));
                hiddenAt = null;
            }
        };
        const onBlur = () => {
            // neu la roi tab thi visibilitychange se xu ly, tranh dem doi
            blurTimer = window.setTimeout(() => {
                if (!document.hidden) blurAt = Date.now();
            }, 300);
        };
        const onFocus = () => {
            window.clearTimeout(blurTimer);
            if (blurAt) {
                record('WINDOW_BLUR', secs(blurAt));
                blurAt = null;
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
        return () => {
            window.clearTimeout(blurTimer);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
        };
    }, [enabled, config?.detectTabSwitch, record]);

    // chan copy / cut / paste / chuot phai / phim tat
    useEffect(() => {
        if (!enabled || !config?.blockCopyPaste) return;
        const block = (type: IntegrityEventType) => (e: Event) => {
            e.preventDefault();
            record(type);
        };
        const onCopy = block('COPY');
        const onCut = block('CUT');
        const onPaste = block('PASTE');
        const onContext = block('CONTEXT_MENU');
        const onDrop = (e: Event) => e.preventDefault();
        const onKey = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;
            const devtools =
                e.key === 'F12' ||
                (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
                (ctrl && key === 'u') ||
                (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(key));
            if (devtools) {
                e.preventDefault();
                record('DEVTOOLS_KEY', undefined, e.key);
                return;
            }
            if ((ctrl && key === 'p') || e.key === 'PrintScreen') {
                e.preventDefault();
                record('PRINT_ATTEMPT', undefined, e.key);
                return;
            }
            // Ctrl+C / V / X / Insert: chan luon ca khi su kien clipboard khong ban ra
            if (ctrl && ['c', 'v', 'x', 'insert'].includes(key)) {
                e.preventDefault();
                record(key === 'v' ? 'PASTE' : key === 'x' ? 'CUT' : 'COPY');
            }
        };
        document.addEventListener('copy', onCopy);
        document.addEventListener('cut', onCut);
        document.addEventListener('paste', onPaste);
        document.addEventListener('contextmenu', onContext);
        document.addEventListener('drop', onDrop);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('copy', onCopy);
            document.removeEventListener('cut', onCut);
            document.removeEventListener('paste', onPaste);
            document.removeEventListener('contextmenu', onContext);
            document.removeEventListener('drop', onDrop);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [enabled, config?.blockCopyPaste, record]);

    // toan man hinh
    useEffect(() => {
        if (!enabled || !config?.requireFullscreen) return;
        let exitedAt: number | null = null;
        let wasFullscreen = Boolean(document.fullscreenElement);
        const onChange = () => {
            const fs = Boolean(document.fullscreenElement);
            setIsFullscreen(fs);
            if (!fs && wasFullscreen) {
                exitedAt = Date.now();
                record('FULLSCREEN_EXIT');
            } else if (fs && exitedAt) {
                exitedAt = null;
            }
            wasFullscreen = fs;
        };
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, [enabled, config?.requireFullscreen, record]);

    // thoat toan man hinh khi lam xong
    useEffect(() => {
        if (active) return;
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    }, [active]);

    const enterFullscreen = useCallback(async () => {
        try {
            await document.documentElement.requestFullscreen();
        } catch {
            // trinh duyet tu choi
        }
    }, []);

    const needFullscreen = Boolean(enabled && config?.requireFullscreen && !isFullscreen);

    return { enabled, violations, lastMessage, needFullscreen, enterFullscreen };
}

/** Thong bao dang giam sat + chan man hinh khi chua vao toan man hinh. */
export function ExamIntegrityNotice({
                                        config,
                                        state,
                                    }: {
    config: ExamIntegrityConfig | undefined;
    state: ReturnType<typeof useExamIntegrity>;
}) {
    if (!state.enabled || !config) return null;
    const rules: string[] = [];
    if (config.detectTabSwitch) rules.push('đếm số lần rời tab / chuyển cửa sổ');
    if (config.blockCopyPaste) rules.push('chặn sao chép, dán, chuột phải');
    if (config.requireFullscreen) rules.push('yêu cầu toàn màn hình');
    if (config.singleSession) rules.push('chỉ cho phép một nơi làm bài');
    return (
        <>
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium">Bài thi đang được giám sát</p>
                <p className="mt-1">
                    Hệ thống {rules.join(', ')}. Các hành vi vi phạm được ghi lại và giáo viên có thể xem.
                </p>
                {state.violations > 0 && (
                    <p className="mt-1 font-medium">
                        Đã ghi nhận {state.violations} lần vi phạm{state.lastMessage ? ` (gần nhất: ${state.lastMessage})` : ''}.
                    </p>
                )}
            </div>
            {state.needFullscreen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6">
                    <div className="max-w-md space-y-4 rounded-lg border bg-card p-6 text-center shadow-lg">
                        <h2 className="text-lg font-semibold">Cần bật toàn màn hình để làm bài</h2>
                        <p className="text-sm text-muted-foreground">
                            Bài thi yêu cầu chế độ toàn màn hình. Thời gian làm bài vẫn tiếp tục chạy.
                        </p>
                        <Button onClick={() => void state.enterFullscreen()}>Vào toàn màn hình</Button>
                    </div>
                </div>
            )}
        </>
    );
}
