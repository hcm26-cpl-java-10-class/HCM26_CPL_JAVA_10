// Camera proctoring: face detection runs fully in the browser (face-api tiny detector, models in /public/models).
// - Entry photo: exactly one visible, uncovered face is required before the exam can be taken.
// - While taking the exam: camera off, camera covered, examinee left the camera view, extra person in view,
//   head turned more than 35° (left/right or up/down, estimated from 68 face landmarks).
// Each violation is reported once it ends (with its duration) together with an evidence photo.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IntegrityEventType } from '@/api/exam.api';

type FaceApi = typeof import('@vladmandic/face-api');
export type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'lost';
export type CameraViolationType = Extract<
    IntegrityEventType,
    'CAMERA_OFF' | 'CAMERA_COVERED' | 'FACE_MISSING' | 'MULTIPLE_FACES' | 'HEAD_TURNED'
>;

export type EntryCheckResult =
    | { ok: true; dataUrl: string }
    | { ok: false; reason: 'not-ready' | 'covered' | 'no-face' | 'multiple-faces' | 'too-far' | 'error'; message: string };

let faceApiPromise: Promise<FaceApi> | null = null;
export function loadFaceApi(): Promise<FaceApi> {
    if (!faceApiPromise) {
        faceApiPromise = (async () => {
            const faceapi = await import('@vladmandic/face-api');
            const base = `${import.meta.env.BASE_URL}models`;
            await faceapi.nets.tinyFaceDetector.loadFromUri(base);
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri(base);
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
const HEAD_TICKS = 3;      // head turned for ~3s in a row before it counts as a violation

// ---- head pose (estimated from landmarks; webcam estimates are approximate, tune here) ----
export const HEAD_YAW_LIMIT_DEG = 35;   // turned left / right
const PITCH_DOWN_DELTA = 0.14;          // looking down ~35° (relative to the entry-photo baseline)
const PITCH_UP_DELTA = 0.17;            // looking up ~35°
const PROFILE_YAW_DEG = 28;             // a face lost right after being turned this far counts as "turned"

interface Pose { yaw: number; pitch: number }

/** yaw (deg, + = nose toward image-left) from nose-vs-eye-corner distances; pitch = nose position between eyes and chin. */
function poseOf(points: { x: number; y: number }[]): Pose {
    const nose = points[30];
    const wl = Math.max(1, nose.x - points[36].x);
    const wr = Math.max(1, points[45].x - nose.x);
    const s = (wr - wl) / (wr + wl);
    const yaw = (Math.asin(Math.max(-1, Math.min(1, s / 0.9))) * 180) / Math.PI;
    let eyeY = 0;
    for (let i = 36; i <= 47; i += 1) eyeY += points[i].y;
    eyeY /= 12;
    const chinY = points[8].y;
    const pitch = chinY - eyeY > 1 ? (nose.y - eyeY) / (chinY - eyeY) : 0.5;
    return { yaw, pitch };
}

const DEFAULT_BASE: Pose = { yaw: 0, pitch: 0.5 };

/** Direction the head is turned beyond the limit (relative to the baseline), or null. */
function turnedAway(pose: Pose, base: Pose): { label: string } | null {
    const dYaw = pose.yaw - base.yaw;
    if (Math.abs(dYaw) > HEAD_YAW_LIMIT_DEG) {
        return { label: `Head turned to the side (~${Math.round(Math.abs(dYaw))}°)` };
    }
    const dPitch = pose.pitch - base.pitch;
    if (dPitch > PITCH_DOWN_DELTA) return { label: 'Head tilted down (over ~35°)' };
    if (dPitch < -PITCH_UP_DELTA) return { label: 'Head tilted up (over ~35°)' };
    return null;
}

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
    report: (type: CameraViolationType, durationSeconds: number, snapshot?: string | null, detail?: string) => void;
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
    const baseRef = useRef<Pose>(DEFAULT_BASE);
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

    const countFaces = useCallback(async (): Promise<{ count: number; pose: Pose | null } | null> => {
        const f = faceApiRef.current;
        const video = videoRef.current;
        if (!f || !video) return null;
        try {
            const opts = new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
            const found = await f.detectAllFaces(video, opts).withFaceLandmarks(true);
            const pose = found.length === 1 ? poseOf(found[0].landmarks.positions) : null;
            return { count: found.length, pose };
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
        let boxes: { detection: { box: { width: number } }; landmarks: { positions: { x: number; y: number }[] } }[];
        try {
            boxes = await f
                .detectAllFaces(video, new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
                .withFaceLandmarks(true);
        } catch {
            return { ok: false, reason: 'error', message: 'Could not analyse the photo. Please try again.' };
        }
        if (boxes.length === 0) {
            return { ok: false, reason: 'no-face', message: 'No face detected. Look straight at the camera and keep your face fully in view.' };
        }
        if (boxes.length > 1) {
            return { ok: false, reason: 'multiple-faces', message: 'More than one person detected. Only the examinee may be in view.' };
        }
        if (boxes[0].detection.box.width / (video.videoWidth || 640) < 0.12) {
            return { ok: false, reason: 'too-far', message: 'You are too far from the camera. Move closer and try again.' };
        }
        // the entry photo is the reference "looking straight" pose for the head-turn check
        const entryPose = poseOf(boxes[0].landmarks.positions);
        if (Math.abs(entryPose.yaw) > 25 || entryPose.pitch > 0.75 || entryPose.pitch < 0.25) {
            return { ok: false, reason: 'no-face', message: 'Look straight at the camera (do not turn or tilt your head) and try again.' };
        }
        baseRef.current = entryPose;
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
        let turned = 0;
        let lastYawAbs = 0;
        let lastTurnTick = -10;
        let busy = false;
        let current: { type: CameraViolationType; startMs: number; snapshot: string | null; detail?: string } | null = null;

        const finish = () => {
            if (!current) return;
            const secs = Math.max(1, Math.round((Date.now() - current.startMs) / 1000));
            reportRef.current(current.type, secs, current.snapshot, current.detail);
            current = null;
        };
        const begin = (type: CameraViolationType, snapshot: string | null, detail?: string) => {
            current = { type, startMs: Date.now(), snapshot, detail };
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
                let detail: string | undefined;

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
                        const result = await countFaces();
                        if (result === null) {
                            // detector unavailable: only off / covered can be detected
                        } else if (result.count === 0) {
                            // a face lost right after being turned far to the side = still "turned", not "left"
                            if (ticks - lastTurnTick <= 2 && lastYawAbs >= PROFILE_YAW_DEG) {
                                turned += 1; missing = 0;
                                if (turned >= HEAD_TICKS) { observed = 'HEAD_TURNED'; detail = 'Head turned to the side (face not visible)'; }
                            } else {
                                missing += 1; multiple = 0; turned = 0;
                                if (missing >= MISSING_TICKS) observed = 'FACE_MISSING';
                            }
                        } else if (result.count >= 2) {
                            multiple += 1; missing = 0; turned = 0;
                            if (multiple >= MULTIPLE_TICKS) observed = 'MULTIPLE_FACES';
                        } else {
                            missing = 0; multiple = 0;
                            const away = result.pose ? turnedAway(result.pose, baseRef.current) : null;
                            if (result.pose) {
                                lastYawAbs = Math.abs(result.pose.yaw - baseRef.current.yaw);
                                if (lastYawAbs >= PROFILE_YAW_DEG) lastTurnTick = ticks;
                            }
                            if (away) {
                                turned += 1;
                                if (turned >= HEAD_TICKS) { observed = 'HEAD_TURNED'; detail = away.label; }
                            } else {
                                turned = 0;
                            }
                        }
                        if (observed) snapshot = snapshotOf(video, 320, 0.6);
                        else if (ticks % 5 === 0) lastGoodRef.current = snapshotOf(video, 320, 0.6) ?? lastGoodRef.current;
                    }
                }
                if (ticks <= GRACE_TICKS && observed !== 'CAMERA_OFF') observed = null;

                if (observed !== (current?.type ?? null)) {
                    finish();
                    if (observed) begin(observed, snapshot, detail);
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
