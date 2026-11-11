// NEW (anti-cheat): theo doi hanh vi trong luc lam bai.
// - Chi GHI LOG gui len server, khong tu dong nop bai.
// - Chan copy/cut/paste/chuot phai/phim tat (best-effort: trinh duyet khong the chan 100%).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ExamIntegrityConfig, IntegrityEventType } from '@/api/exam.api';
import {
    CameraVideo,
    useCameraProctoring,
    type CameraViolationType,
} from '@/hooks/useCameraProctoring';

export interface IntegrityPayload {
    clientId: string;
    events: { type: IntegrityEventType; durationSeconds?: number; detail?: string; snapshot?: string }[];
}

interface Options {
    attemptId: number | undefined;
    config: ExamIntegrityConfig | undefined;
    /** true khi bai dang IN_PROGRESS */
    active: boolean;
    send: (attemptId: number, payload: IntegrityPayload) => Promise<unknown>;
    /** Camera proctoring: upload the entry photo of the attempt. */
    sendEntryPhoto?: (attemptId: number, imageData: string) => Promise<unknown>;
    /** Called after the entry photo is saved (reload the attempt so the questions appear). */
    onEntryPhotoSaved?: () => void;
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
    CAMERA_OFF: 'Camera turned off',
    CAMERA_COVERED: 'Camera is covered',
    FACE_MISSING: 'You left the camera view',
    MULTIPLE_FACES: 'Another person is in the camera view',
    HEAD_TURNED: 'Head turned away from the screen',
    DIFFERENT_PERSON: 'A different person is taking the exam',
};

const newClientId = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useExamIntegrity({ attemptId, config, active, send, sendEntryPhoto, onEntryPhotoSaved }: Options) {
    const enabled = Boolean(active && attemptId && config?.enabled);
    const clientIdRef = useRef<string>(newClientId());
    const queueRef = useRef<IntegrityPayload['events']>([]);
    const lastByTypeRef = useRef<Map<string, number>>(new Map());
    const sendRef = useRef(send);
    sendRef.current = send;

    const [violations, setViolations] = useState(0);
    const [lastMessage, setLastMessage] = useState<string | null>(null);
    const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
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

    const notifyOn = Boolean(config?.notifyOnViolation);
    const notifyRef = useRef(notifyOn);
    notifyRef.current = notifyOn;

    /** Tell the examinee about a violation (only when the teacher enabled notifications). */
    const announce = useCallback((type: IntegrityEventType) => {
        setLastMessage(LABELS[type] ?? type);
        if (notifyRef.current) setBanner({ text: LABELS[type] ?? type, key: Date.now() });
    }, []);

    const record = useCallback((
        type: IntegrityEventType,
        durationSeconds?: number,
        detail?: string,
        snapshot?: string,
        silent = false,
    ) => {
        // chong trung lap (vd: blur + hidden xay ra gan nhau, hoac giu phim)
        const nowMs = Date.now();
        const last = lastByTypeRef.current.get(type) ?? 0;
        if (nowMs - last < 400) return;
        lastByTypeRef.current.set(type, nowMs);
        queueRef.current.push({ type, durationSeconds, detail, snapshot });
        setViolations((v) => v + 1);
        if (!silent) announce(type);
        void flush();
    }, [flush, announce]);

    // auto-hide the notification banner
    useEffect(() => {
        if (!banner) return;
        const id = window.setTimeout(() => setBanner(null), 10000);
        return () => window.clearTimeout(id);
    }, [banner]);

    // ---- camera proctoring ----
    const cameraEnabled = Boolean(active && attemptId && config?.enabled && config.cameraProctoring);
    const [photoSavedFor, setPhotoSavedFor] = useState<number | null>(null);
    const entryDone = Boolean(config?.entryPhotoDone) || (attemptId != null && photoSavedFor === attemptId);
    const needEntryPhoto = cameraEnabled && !entryDone;
    const camera = useCameraProctoring({
        enabled: cameraEnabled,
        monitoring: cameraEnabled && entryDone,
        // the examinee was notified when the violation started -> the report at its end is silent
        report: (type: CameraViolationType, secs, snapshot, detail) =>
            record(type, secs, detail, snapshot ?? undefined, true),
        announce: (type: CameraViolationType) => announce(type),
        referenceKey: attemptId ? `exam-face-ref-${attemptId}` : null,
    });

    const submitEntryPhoto = useCallback(async (dataUrl: string) => {
        if (!attemptId || !sendEntryPhoto) throw new Error('No upload handler');
        await sendEntryPhoto(attemptId, dataUrl);
        setPhotoSavedFor(attemptId);
        onEntryPhotoSaved?.();
    }, [attemptId, sendEntryPhoto, onEntryPhotoSaved]);

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

    return {
        enabled,
        violations,
        lastMessage,
        needFullscreen,
        enterFullscreen,
        banner,
        dismissBanner: () => setBanner(null),
        cameraEnabled,
        needEntryPhoto,
        camera,
        submitEntryPhoto,
    };
}

/**
 * Overlays shown during an exam: entry-photo gate, "camera required" lock, live camera preview,
 * violation notifications (when the teacher enabled them) and the fullscreen requirement.
 */
export function ExamIntegrityNotice({
    config,
    state,
}: {
    config: ExamIntegrityConfig | undefined;
    state: ReturnType<typeof useExamIntegrity>;
}) {
    if (!state.enabled && !state.cameraEnabled) return null;
    if (!config) return null;
    const cam = state.camera;
    return (
        <>
            {state.needEntryPhoto && <EntryPhotoGate state={state} />}

            {state.cameraEnabled && !state.needEntryPhoto && cam.state !== 'live' && (
                <div className="fixed inset-0 z-[105] flex items-center justify-center bg-background/95 p-6">
                    <div className="max-w-md space-y-4 rounded-lg border bg-card p-6 text-center shadow-lg">
                        <h2 className="text-lg font-semibold">Turn your camera on to continue</h2>
                        <p className="text-sm text-muted-foreground">
                            {cam.state === 'denied'
                                ? 'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.'
                                : 'Your camera is off or disconnected. The exam stays locked until it is back. The timer keeps running.'}
                        </p>
                        <Button onClick={() => void cam.start()}>Turn camera on</Button>
                    </div>
                </div>
            )}

            {state.cameraEnabled && !state.needEntryPhoto && cam.state === 'live' && (
                <DraggableCameraPreview stream={cam.stream} />
            )}

            {config.notifyOnViolation && state.banner && (
                <div
                    key={state.banner.key}
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
                    onClick={state.dismissBanner}
                >
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="violation-popup-title"
                        className="w-full max-w-md space-y-4 rounded-lg border border-red-300 bg-card p-6 text-center shadow-2xl dark:border-red-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-700 dark:bg-red-950 dark:text-red-300">!</div>
                        <h2 id="violation-popup-title" className="text-lg font-semibold text-red-700 dark:text-red-300">
                            Violation detected
                        </h2>
                        <p className="text-base font-medium">{state.banner.text}</p>
                        <p className="text-sm text-muted-foreground">
                            This has been recorded and your instructor can review it. Please follow the exam rules.
                        </p>
                        <Button onClick={state.dismissBanner}>I understand</Button>
                    </div>
                </div>
            )}

            {state.enabled && state.needFullscreen && !state.needEntryPhoto && (
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

// Remembered between remounts (the notice is rendered by different page layouts).
let savedCameraPos: { x: number; y: number } | null = null;
let savedCameraWidth = 128;
const CAMERA_MIN_W = 96;
const CAMERA_MAX_W = 480;

/** Live camera preview: drag it anywhere on the screen and zoom it in / out with the − / + buttons. */
function DraggableCameraPreview({ stream }: { stream: MediaStream | null }) {
    const [W, setW] = useState(savedCameraWidth);
    const H = Math.round((W * 3) / 4);
    const clamp = (x: number, y: number) => ({
        x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - W)),
        y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - H)),
    });
    const [pos, setPos] = useState(() =>
        clamp(savedCameraPos?.x ?? window.innerWidth - W - 12, savedCameraPos?.y ?? window.innerHeight - H - 12));
    const dragRef = useRef<{ dx: number; dy: number } | null>(null);

    useEffect(() => {
        const onResize = () => setPos((p) => clamp(p.x, p.y));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [W]);

    const resize = (next: number) => {
        const w = Math.min(CAMERA_MAX_W, Math.max(CAMERA_MIN_W, next));
        savedCameraWidth = w;
        setW(w);
        // keep the box inside the screen after growing
        setPos((p) => ({
            x: Math.min(p.x, Math.max(0, window.innerWidth - w)),
            y: Math.min(p.y, Math.max(0, window.innerHeight - Math.round((w * 3) / 4))),
        }));
    };
    const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
    const ctl = 'flex size-6 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-40';

    return (
        <div
            className="fixed z-[60] cursor-grab touch-none select-none overflow-hidden rounded-lg border bg-black shadow-lg active:cursor-grabbing"
            style={{ left: pos.x, top: pos.y, width: W, height: H }}
            title="Drag to move"
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
            }}
            onPointerMove={(e) => {
                if (!dragRef.current) return;
                const next = clamp(e.clientX - dragRef.current.dx, e.clientY - dragRef.current.dy);
                savedCameraPos = next;
                setPos(next);
            }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
        >
            <CameraVideo stream={stream} className="pointer-events-none size-full -scale-x-100 object-cover" />
            <span className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
            </span>
            <div className="absolute bottom-1 right-1 flex gap-1" onPointerDown={stop}>
                <button type="button" className={ctl} aria-label="Smaller camera" disabled={W <= CAMERA_MIN_W}
                    onClick={() => resize(W - 32)}>−</button>
                <button type="button" className={ctl} aria-label="Larger camera" disabled={W >= CAMERA_MAX_W}
                    onClick={() => resize(W + 32)}>+</button>
            </div>
        </div>
    );
}

/** Full-screen gate: the examinee must open the camera and pass the face check before seeing the questions. */
function EntryPhotoGate({ state }: { state: ReturnType<typeof useExamIntegrity> }) {
    const cam = state.camera;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const capture = async () => {
        setBusy(true);
        setError(null);
        try {
            const result = await cam.captureEntry();
            if (!result.ok) {
                setError(result.message);
                return;
            }
            await state.submitEntryPhoto(result.dataUrl);
            setDone(true);
        } catch {
            setError('Could not save the photo. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const live = cam.state === 'live';
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-auto bg-background p-4">
            <div className="w-full max-w-lg space-y-4 rounded-lg border bg-card p-6 text-center shadow-lg">
                <h2 className="text-lg font-semibold">Camera check before the exam</h2>
                <p className="text-sm text-muted-foreground">
                    This exam uses camera proctoring. Turn on your camera, look straight at it and make sure you are the only
                    person in view. A photo will be taken and saved for your instructor.
                </p>
                <div className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-md border bg-black">
                    {live ? (
                        <CameraVideo stream={cam.stream} className="size-full -scale-x-100 object-cover" />
                    ) : (
                        <div className="flex size-full items-center justify-center p-4 text-sm text-white/80">
                            {cam.state === 'starting' && 'Opening camera...'}
                            {cam.state === 'denied' && 'Camera access was blocked. Allow the camera for this site in your browser settings.'}
                            {(cam.state === 'idle' || cam.state === 'lost') && 'Camera is off.'}
                        </div>
                    )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                {cam.modelError && (
                    <p className="text-sm text-destructive">
                        Face detection failed to load.{' '}
                        <button type="button" className="underline" onClick={cam.retryModels}>Retry</button>
                    </p>
                )}
                {done && <p className="text-sm text-green-600">Photo verified. Loading your exam...</p>}
                <div className="flex justify-center gap-2">
                    {!live && <Button variant="outline" onClick={() => void cam.start()}>Turn camera on</Button>}
                    <Button disabled={!live || busy || done} onClick={() => void capture()}>
                        {busy ? 'Checking...' : 'Take photo & verify'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
