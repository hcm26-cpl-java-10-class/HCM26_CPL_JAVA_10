// Camera proctoring: face detection runs fully in the browser (face-api tiny detector, models in /public/models).
// - Entry photo: exactly one visible, uncovered face is required before the exam can be taken.
// - While taking the exam: camera off, camera covered, examinee left the camera view, extra person in view.
// Each violation is reported once it ends (with its duration) together with an evidence photo.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IntegrityEventType } from '@/api/exam.api';

type FaceApi = typeof import('@vladmandic/face-api');
export type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'lost';
export type CameraViolationType = Extract<
    IntegrityEventType,
    'CAMERA_OFF' | 'CAMERA_COVERED' | 'FACE_MISSING' | 'MULTIPLE_FACES'
>;

export type EntryCheckResult =
    | { ok: true; dataUrl: string }
    | { ok: false; reason: 'not-ready' | 'covered' | 'no-face' | 'multiple-faces' | 'too-far' | 'error'; message: string };

let faceApiPromise: Promise<FaceApi> | null = null;
export function loadFaceApi(): Promise<FaceApi> {
    if (!faceApiPromise) {
        faceApiPromise = (async () => {
            const faceapi = await import('@vladmandic/face-api');
            await faceapi.nets.tinyFaceDetector.loadFromUri(`${import.meta.env.BASE_URL}models`);
            return faceapi;
        })().catch((e) => {
            faceApiPromise = null;
            throw e;
        });
    }
    return faceApiPromise;
}

const TICK_MS = 1000;
const MISSING_TICKS = 3;   // ~3s without a face before it counts as "left the camera"
const MULTIPLE_TICKS = 2;  // ~2s with 2+ faces before it counts as "extra person"
const GRACE_TICKS = 3;     // ignore the first seconds after monitoring starts

/** Mean brightness and contrast of a tiny copy of the frame -> detects a covered / black camera. */
function analyzeFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): { covered: boolean } {
    const w = 64;
    const h = 48;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { covered: false };
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    let sumSq = 0;
    const n = w * h;
    for (let i = 0; i < data.length; i += 4) {
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += l;
        sumSq += l * l;
    }
    const mean = sum / n;
    const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    return { covered: mean < 22 || std < 9 };
}

function snapshotOf(video: HTMLVideoElement, width: number, quality: number): string | null {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round((width * vh) / vw);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
}

interface Options {
    /** Camera is needed (camera proctoring on and the attempt is in progress). */
    enabled: boolean;
    /** Start detecting violations (entry photo is done). */
    monitoring: boolean;
    /** Report a finished violation. `silent` = the examinee was already notified when it started. */
    report: (type: CameraViolationType, durationSeconds: number, snapshot?: string | null) => void;
    /** Examinee should be notified now (violation just started). */
    announce: (type: CameraViolationType) => void;
}

export function useCameraProctoring({ enabled, monitoring, report, announce }: Options) {
    const [state, setState] = useState<CameraState>('idle');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [modelError, setModelError] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const faceApiRef = useRef<FaceApi | null>(null);
    const lastGoodRef = useRef<string | null>(null);
    const reportRef = useRef(report);
    reportRef.current = report;
    const announceRef = useRef(announce);
    announceRef.current = announce;

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
    }, []);

    const start = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setState('denied');
            return;
        }
        setState('starting');
        try {
            stopStream();
            const media = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: false,
            });
            if (!videoRef.current) {
                const v = document.createElement('video');
                v.muted = true;
                v.playsInline = true;
                videoRef.current = v;
            }
            videoRef.current.srcObject = media;
            await videoRef.current.play().catch(() => undefined);
            streamRef.current = media;
            setStream(media);
            setState('live');
            media.getVideoTracks().forEach((t) => {
                t.addEventListener('ended', () => setState((s) => (s === 'denied' ? s : 'lost')));
            });
        } catch (e) {
            const name = (e as { name?: string })?.name;
            setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'lost');
        }
    }, [stopStream]);

    // open the camera while needed, release it afterwards
    useEffect(() => {
        if (!enabled) {
            stopStream();
            setState('idle');
            return;
        }
        void start();
        void loadFaceApi().then((f) => { faceApiRef.current = f; setModelError(false); }).catch(() => setModelError(true));
        return () => stopStream();
    }, [enabled, start, stopStream]);

    // camera lost -> keep trying to re-open it (works silently once permission is granted)
    useEffect(() => {
        if (!enabled || state !== 'lost') return;
        const id = window.setInterval(() => void start(), 3000);
        return () => window.clearInterval(id);
    }, [enabled, state, start]);

    const retryModels = useCallback(() => {
        setModelError(false);
        void loadFaceApi().then((f) => { faceApiRef.current = f; }).catch(() => setModelError(true));
    }, []);

    const isLive = useCallback(() => {
        const track = streamRef.current?.getVideoTracks()[0];
        const video = videoRef.current;
        return Boolean(track && track.readyState === 'live' && track.enabled && !track.muted
            && video && video.readyState >= 2 && !video.paused);
    }, []);

    const countFaces = useCallback(async (): Promise<number | null> => {
        const f = faceApiRef.current;
        const video = videoRef.current;
        if (!f || !video) return null;
        try {
            const found = await f.detectAllFaces(video, new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }));
            return found.length;
        } catch {
            return null;
        }
    }, []);

    /** Entry check: one clear face, camera not covered -> returns the photo to upload. */
    const captureEntry = useCallback(async (): Promise<EntryCheckResult> => {
        const video = videoRef.current;
        if (!video || !isLive()) {
            return { ok: false, reason: 'not-ready', message: 'The camera is not ready yet. Please wait a moment and try again.' };
        }
        if (!faceApiRef.current) {
            try { faceApiRef.current = await loadFaceApi(); setModelError(false); }
            catch {
                setModelError(true);
                return { ok: false, reason: 'error', message: 'Face detection could not be loaded. Check your connection and try again.' };
            }
        }
        if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
        if (analyzeFrame(video, canvasRef.current).covered) {
            return { ok: false, reason: 'covered', message: 'Your camera looks covered or too dark. Uncover it and make sure the room is lit.' };
        }
        const f = faceApiRef.current!;
        let boxes: { box: { width: number } }[];
        try {
            boxes = await f.detectAllFaces(video, new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }));
        } catch {
            return { ok: false, reason: 'error', message: 'Could not analyse the photo. Please try again.' };
        }
        if (boxes.length === 0) {
            return { ok: false, reason: 'no-face', message: 'No face detected. Look straight at the camera and keep your face fully in view.' };
        }
        if (boxes.length > 1) {
            return { ok: false, reason: 'multiple-faces', message: 'More than one person detected. Only the examinee may be in view.' };
        }
        if (boxes[0].box.width / (video.videoWidth || 640) < 0.12) {
            return { ok: false, reason: 'too-far', message: 'You are too far from the camera. Move closer and try again.' };
        }
        const dataUrl = snapshotOf(video, 480, 0.8);
        if (!dataUrl) return { ok: false, reason: 'not-ready', message: 'Could not capture the photo. Please try again.' };
        return { ok: true, dataUrl };
    }, [isLive]);

    // ---- monitoring loop ----
    useEffect(() => {
        if (!enabled || !monitoring) return;
        let ticks = 0;
        let missing = 0;
        let multiple = 0;
        let busy = false;
        let current: { type: CameraViolationType; startMs: number; snapshot: string | null } | null = null;

        const finish = () => {
            if (!current) return;
            const secs = Math.max(1, Math.round((Date.now() - current.startMs) / 1000));
            reportRef.current(current.type, secs, current.snapshot);
            current = null;
        };
        const begin = (type: CameraViolationType, snapshot: string | null) => {
            current = { type, startMs: Date.now(), snapshot };
            announceRef.current(type);
        };

        const tick = async () => {
            if (busy) return;
            busy = true;
            try {
                ticks += 1;
                const video = videoRef.current;
                let observed: CameraViolationType | null = null;
                let snapshot: string | null = null;

                if (!isLive() || !video) {
                    observed = 'CAMERA_OFF';
                    snapshot = lastGoodRef.current;
                } else {
                    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
                    const covered = analyzeFrame(video, canvasRef.current).covered;
                    if (covered) {
                        observed = 'CAMERA_COVERED';
                        snapshot = snapshotOf(video, 320, 0.6);
                        missing = 0; multiple = 0;
                    } else {
                        const faces = await countFaces();
                        if (faces === null) {
                            // detector unavailable: only off / covered can be detected
                        } else if (faces === 0) {
                            missing += 1; multiple = 0;
                            if (missing >= MISSING_TICKS) observed = 'FACE_MISSING';
                        } else if (faces >= 2) {
                            multiple += 1; missing = 0;
                            if (multiple >= MULTIPLE_TICKS) observed = 'MULTIPLE_FACES';
                        } else {
                            missing = 0; multiple = 0;
                        }
                        if (observed) snapshot = snapshotOf(video, 320, 0.6);
                        else if (ticks % 5 === 0) lastGoodRef.current = snapshotOf(video, 320, 0.6) ?? lastGoodRef.current;
                    }
                }
                if (ticks <= GRACE_TICKS && observed !== 'CAMERA_OFF') observed = null;

                if (observed !== (current?.type ?? null)) {
                    finish();
                    if (observed) begin(observed, snapshot);
                }
            } finally {
                busy = false;
            }
        };

        const id = window.setInterval(() => void tick(), TICK_MS);
        const onHide = () => finish();
        window.addEventListener('pagehide', onHide);
        return () => {
            window.clearInterval(id);
            window.removeEventListener('pagehide', onHide);
            finish(); // exam finished / page left while a violation was still open
        };
    }, [enabled, monitoring, isLive, countFaces]);

    return { state, stream, modelError, start, retryModels, captureEntry };
}

/** Small live preview of the camera stream (shares the same MediaStream). */
export function CameraVideo({ stream, className }: { stream: MediaStream | null; className?: string }) {
    return (
        <video
            className={className}
            autoPlay
            muted
            playsInline
            ref={(el) => {
                if (el && el.srcObject !== stream) el.srcObject = stream;
            }}
        />
    );
}
