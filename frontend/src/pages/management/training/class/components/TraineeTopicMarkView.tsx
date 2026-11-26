import { useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    Check,
    Copy,
    Download,
    Eye,
    EyeOff,
    Lock,
    RotateCcw,
    Save,
    ShieldAlert,
    Unlock,
    Upload,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { read, utils, writeFile } from "xlsx";
import {
    type ClassTopicMarksGradebookResponse,
    externalApi,
    type TopicMarkLockInfo,
} from "@/api/features/external.api";
import { NativeSelect } from "@/components/common/NativeSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ExternalClass, Trainee } from "@/types";
import { autoFitWorksheetColumns } from "@/utils/trainee-import.utils";
import { formatFptStudentIdForSite, normalizeTraineeStatus, resolveTraineeStatusBadge } from "./TraineeModal";

export interface TopicOption {
    code: string;
    name: string;
}

export const TOPIC_OPTIONS: TopicOption[] = [
    { code: "L1_AL_PSE", name: "Algorithm & Problem Solving" },
    { code: "L2_OOP_JAVA", name: "Object-Oriented Programming with Java" },
    { code: "L3_SPRING_BOOT", name: "Enterprise Application with Spring Boot" },
    { code: "L4_DATABASE", name: "Relational Database & SQL Optimization" },
];

export const TOPIC_GPA_PASS_THRESHOLD = 6.0;

export interface DynamicAssessmentColumn {
    key: string;
    name: string;
    weight: number;
    quantity?: number;
}

export interface DynamicTopicSchema {
    code: string;
    name: string;
    title?: string;
    totalWeight: number;
    weightValid: boolean;
    columns: DynamicAssessmentColumn[];
    lock?: TopicMarkLockInfo;
}

export interface DynamicTraineeTopicRecord {
    componentScores: Record<string, number>;
    totalGpa: number;
}

export interface ClassTopicMarkHydratedState {
    schemas: DynamicTopicSchema[];
    recordsByTopic: Record<string, Record<number, DynamicTraineeTopicRecord>>;
}

const DEFAULT_TOPIC_MARK_LOCK: TopicMarkLockInfo = {
    locked: false,
    lockedBy: "",
    lockedAt: "",
    failedAttempts: 0,
    remainingAttempts: 3,
    maxAttempts: 3,
    lockoutTier: 0,
    cooldownUntilEpochMs: null,
    cooldownSecondsRemaining: 0,
};

const DEFAULT_FALLBACK_COLUMNS: DynamicAssessmentColumn[] = [
    { key: "quiz", name: "Quiz", weight: 20 },
    { key: "assignment", name: "Assignment", weight: 30 },
    { key: "practiceFinal", name: "Practice / Final", weight: 50 },
];

const FALLBACK_SCHEMAS: DynamicTopicSchema[] = TOPIC_OPTIONS.map((topic) => ({
    code: topic.code,
    name: topic.name,
    title: `[${topic.code}] ${topic.name}`,
    totalWeight: 100,
    weightValid: true,
    columns: DEFAULT_FALLBACK_COLUMNS,
    lock: { ...DEFAULT_TOPIC_MARK_LOCK },
}));

let classTopicMarkStore: Record<string, ClassTopicMarkHydratedState> = {};

export function resetClassTopicMarkStoreForTest() {
    classTopicMarkStore = {};
}

export function calculateTopicGpa(quiz: number, assignment: number, practiceFinal: number): number {
    const raw = quiz * 0.2 + assignment * 0.3 + practiceFinal * 0.5;
    return Math.round(raw * 10) / 10;
}

export function calculateDynamicTopicGpa(
    componentScores: Record<string, number>,
    columns: DynamicAssessmentColumn[],
): number {
    if (!columns || columns.length === 0) return 0;
    let weightedSum = 0;
    let totalWeight = 0;
    let plainSum = 0;

    for (const col of columns) {
        const val = componentScores[col.key] ?? 0;
        weightedSum += val * col.weight;
        totalWeight += col.weight;
        plainSum += val;
    }

    const raw = totalWeight > 0 ? weightedSum / totalWeight : plainSum / columns.length;
    const rounded = Math.round(raw * 10) / 10;
    return Math.min(10, Math.max(0, rounded));
}

function formatCountdown(totalSeconds: number): string {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const mins = String(Math.floor(safe / 60)).padStart(2, "0");
    const secs = String(safe % 60).padStart(2, "0");
    return `${mins}:${secs}`;
}

/**
 * Generates an account handle from a trainee's Vietnamese full name and row index / Student ID
 * (e.g., "Vũ Mai Trang" -> "trangvm1", "Phan Phú Dũng" -> "dungpp2", "Hoàng Phương Bình" -> "binhhp1").
 */
export function resolveTraineeAccount(trainee: Trainee, rowIndex: number): string {
    const explicitAccount = (trainee as { account?: string }).account?.trim();
    if (explicitAccount && !/^[A-Z]{2}\d{6}$/i.test(explicitAccount)) {
        return explicitAccount.toLowerCase();
    }

    const fullName = (trainee.fullName ?? "").trim();
    if (fullName) {
        const normalized = fullName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/gi, "d")
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .trim()
            .toLowerCase();

        const parts = normalized.split(/\s+/).filter(Boolean);
        if (parts.length > 0) {
            const givenName = parts[parts.length - 1];
            const initials = parts
                .slice(0, -1)
                .map((word) => word[0] ?? "")
                .join("");
            return `${givenName}${initials}${rowIndex + 1}`;
        }
    }

    const email = (trainee.personalEmail ?? trainee.email ?? "").trim();
    if (email.includes("@")) {
        return email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    }

    return (trainee.fptAccount ?? trainee.code ?? `user${rowIndex + 1}`).toLowerCase();
}

const PRESET_SCORE_PROFILES: Array<{ quiz: number; assignment: number; practiceFinal: number }> = [
    { quiz: 8.5, assignment: 8.0, practiceFinal: 8.2 }, // GPA: 8.2
    { quiz: 5.0, assignment: 5.5, practiceFinal: 5.0 }, // GPA: 5.2 (< 6.0 Failure)
    { quiz: 7.5, assignment: 8.0, practiceFinal: 7.8 }, // GPA: 7.8
    { quiz: 9.0, assignment: 8.5, practiceFinal: 9.0 }, // GPA: 8.9
    { quiz: 7.0, assignment: 7.5, practiceFinal: 7.2 }, // GPA: 7.3
    { quiz: 4.5, assignment: 5.0, practiceFinal: 4.8 }, // GPA: 4.8 (< 6.0 Failure)
    { quiz: 8.0, assignment: 7.5, practiceFinal: 8.0 }, // GPA: 7.9
    { quiz: 6.5, assignment: 7.0, practiceFinal: 6.8 }, // GPA: 6.8
    { quiz: 8.5, assignment: 9.0, practiceFinal: 8.6 }, // GPA: 8.7
    { quiz: 5.5, assignment: 5.0, practiceFinal: 5.2 }, // GPA: 5.2 (< 6.0 Failure)
];

const TOPIC_SCORE_OFFSETS: Record<string, number> = {
    L1_AL_PSE: 0,
    L2_OOP_JAVA: 0.4,
    L3_SPRING_BOOT: -0.3,
    L4_DATABASE: 0.2,
};

function clampScore(value: number): number {
    return Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;
}

function buildDefaultRecordForSchema(
    index: number,
    topicCode: string,
    columns: DynamicAssessmentColumn[],
): DynamicTraineeTopicRecord {
    const base = PRESET_SCORE_PROFILES[index % PRESET_SCORE_PROFILES.length];
    const offset = TOPIC_SCORE_OFFSETS[topicCode] ?? 0;
    const componentScores: Record<string, number> = {};

    columns.forEach((col, colIdx) => {
        if (col.key === "quiz") {
            componentScores[col.key] = clampScore(base.quiz + offset);
        } else if (col.key === "assignment") {
            componentScores[col.key] = clampScore(base.assignment + offset);
        } else if (col.key === "practiceFinal") {
            componentScores[col.key] = clampScore(base.practiceFinal + offset);
        } else {
            const raw = [base.quiz, base.assignment, base.practiceFinal][colIdx % 3] + offset;
            componentScores[col.key] = clampScore(raw);
        }
    });

    return {
        componentScores,
        totalGpa: calculateDynamicTopicGpa(componentScores, columns),
    };
}

export function getOrInitClassTopicMarkState(
    classKey: string,
    trainees: Trainee[],
): ClassTopicMarkHydratedState {
    const existing = classTopicMarkStore[classKey];
    const schemas = existing?.schemas?.length ? existing.schemas : FALLBACK_SCHEMAS;
    const recordsByTopic: Record<string, Record<number, DynamicTraineeTopicRecord>> = {
        ...(existing?.recordsByTopic ?? {}),
    };

    for (const schema of schemas) {
        const currentTopicRecords = { ...(recordsByTopic[schema.code] ?? {}) };
        trainees.forEach((trainee, index) => {
            if (!currentTopicRecords[trainee.id]) {
                currentTopicRecords[trainee.id] = buildDefaultRecordForSchema(
                    index,
                    schema.code,
                    schema.columns,
                );
            } else {
                const alignedScores: Record<string, number> = {};
                for (const col of schema.columns) {
                    alignedScores[col.key] =
                        currentTopicRecords[trainee.id].componentScores[col.key] ?? 0;
                }
                currentTopicRecords[trainee.id] = {
                    componentScores: alignedScores,
                    totalGpa: calculateDynamicTopicGpa(alignedScores, schema.columns),
                };
            }
        });
        recordsByTopic[schema.code] = currentTopicRecords;
    }

    const nextState: ClassTopicMarkHydratedState = {
        schemas,
        recordsByTopic,
    };
    classTopicMarkStore[classKey] = nextState;
    return nextState;
}

function applyRemoteTopicMarksToStore(
    classKey: string,
    remote: ClassTopicMarksGradebookResponse,
    trainees: Trainee[],
): ClassTopicMarkHydratedState | null {
    if (!remote?.topics || remote.topics.length === 0) {
        return null;
    }

    const schemas: DynamicTopicSchema[] = remote.topics.map((topic) => ({
        code: topic.code,
        name: topic.name || topic.code,
        title: topic.title,
        totalWeight: Number(topic.totalWeight ?? 0),
        weightValid: Boolean(topic.weightValid),
        columns:
            topic.columns && topic.columns.length > 0
                ? topic.columns.map((c) => ({
                      key: c.key,
                      name: c.name,
                      weight: Number(c.weight ?? 0),
                      quantity: c.quantity,
                  }))
                : DEFAULT_FALLBACK_COLUMNS,
        lock: topic.lock ? { ...DEFAULT_TOPIC_MARK_LOCK, ...topic.lock } : { ...DEFAULT_TOPIC_MARK_LOCK },
    }));

    const recordsByTopic: Record<string, Record<number, DynamicTraineeTopicRecord>> = {};
    for (let tIdx = 0; tIdx < remote.topics.length; tIdx++) {
        const remoteTopic = remote.topics[tIdx];
        const schema = schemas[tIdx];
        const topicMap: Record<number, DynamicTraineeTopicRecord> = {};

        for (const [key, rec] of Object.entries(remoteTopic.recordsByTraineeId ?? {})) {
            const tid = Number(key);
            if (!Number.isFinite(tid) || !rec) continue;
            const alignedScores: Record<string, number> = {};
            for (const col of schema.columns) {
                const rawVal = rec.componentScores?.[col.key];
                alignedScores[col.key] =
                    typeof rawVal === "number" && Number.isFinite(rawVal) ? rawVal : 0;
            }
            topicMap[tid] = {
                componentScores: alignedScores,
                totalGpa: calculateDynamicTopicGpa(alignedScores, schema.columns),
            };
        }

        trainees.forEach((trainee, index) => {
            if (!topicMap[trainee.id]) {
                topicMap[trainee.id] = buildDefaultRecordForSchema(
                    index,
                    schema.code,
                    schema.columns,
                );
            }
        });

        recordsByTopic[schema.code] = topicMap;
    }

    const hydrated: ClassTopicMarkHydratedState = { schemas, recordsByTopic };
    classTopicMarkStore[classKey] = hydrated;
    return hydrated;
}

/**
 * Fetches dynamic Topic Mark schemas & persisted H2 scores for a class.
 * Fails silently when the endpoint is unavailable (e.g. unmocked unit tests).
 */
export async function fetchAndHydrateClassTopicMarks(
    classKey: string,
    trainees: Trainee[],
    shouldCommit?: () => boolean,
): Promise<ClassTopicMarkHydratedState | null> {
    getOrInitClassTopicMarkState(classKey, trainees);
    const remote = await externalApi.getClassTopicMarks(classKey).catch(() => null);
    if (shouldCommit && !shouldCommit()) return null;
    if (!remote) return null;
    return applyRemoteTopicMarksToStore(classKey, remote, trainees);
}

export interface TraineeTopicScoreItem {
    code: string;
    name: string;
    columns: DynamicAssessmentColumn[];
    componentScores: Record<string, number>;
    totalGpa: number;
    isFailed: boolean;
}

/**
 * Aggregates topic scores and calculates overall GPA summary for a single trainee across all topics.
 */
export function getTraineeTopicMarksSummary(
    classKey: string,
    trainees: Trainee[],
    traineeId: number,
): {
    topics: TraineeTopicScoreItem[];
    overallGpa: number;
    passedCount: number;
    failedCount: number;
    highestTopic: TraineeTopicScoreItem | null;
} {
    const state = getOrInitClassTopicMarkState(classKey, trainees);
    const topics: TraineeTopicScoreItem[] = state.schemas.map((schema) => {
        const record =
            state.recordsByTopic[schema.code]?.[traineeId] ??
            buildDefaultRecordForSchema(0, schema.code, schema.columns);
        return {
            code: schema.code,
            name: schema.name,
            columns: schema.columns,
            componentScores: record.componentScores,
            totalGpa: record.totalGpa,
            isFailed: record.totalGpa < TOPIC_GPA_PASS_THRESHOLD,
        };
    });

    const sumGpa = topics.reduce((acc, item) => acc + item.totalGpa, 0);
    const overallGpa = topics.length > 0 ? Math.round((sumGpa / topics.length) * 10) / 10 : 0;
    const failedCount = topics.filter((item) => item.isFailed).length;
    const passedCount = topics.length - failedCount;
    const highestTopic = topics.reduce<TraineeTopicScoreItem | null>(
        (best, item) => (!best || item.totalGpa > best.totalGpa ? item : best),
        null,
    );

    return {
        topics,
        overallGpa,
        passedCount,
        failedCount,
        highestTopic,
    };
}

function normalizeHeaderLabel(value: string): string {
    return value
        .replace(/\([^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

const STICKY_HEADER_CELL_CLASS =
    "sticky top-0 z-20 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-[inset_0_-1px_0_#e2e8f0] dark:bg-slate-900 dark:text-slate-200 dark:shadow-[inset_0_-1px_0_#334155]";

export interface TraineeTopicMarkViewProps {
    classItem: ExternalClass;
    trainees: Trainee[];
    onBack: () => void;
}

type ResultFilter = "all" | "passed" | "failed";

export function TraineeTopicMarkView({ classItem, trainees, onBack }: TraineeTopicMarkViewProps) {
    const queryClient = useQueryClient();
    const classKey = String(classItem.id ?? classItem.code ?? "default");
    const classCodeLabel = (classItem.code || classItem.name || classKey).trim();
    const classSite = classItem.site;

    const [markState, setMarkState] = useState<ClassTopicMarkHydratedState>(() =>
        getOrInitClassTopicMarkState(classKey, trainees),
    );
    const [selectedTopicCode, setSelectedTopicCode] = useState<string>(
        () => markState.schemas[0]?.code ?? TOPIC_OPTIONS[0].code,
    );
    const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
    const [draftInputs, setDraftInputs] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLocking, setIsLocking] = useState(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

    // 4-Digit Security PIN Lock / Unlock modal state
    const [confirmLockOpen, setConfirmLockOpen] = useState(false);
    const [issuedPinModal, setIssuedPinModal] = useState<{
        open: boolean;
        topicCode: string;
        pin: string;
    }>({ open: false, topicCode: "", pin: "" });
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [pinInput, setPinInput] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [unlockError, setUnlockError] = useState("");
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [nowMs, setNowMs] = useState(() => Date.now());

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const synced = getOrInitClassTopicMarkState(classKey, trainees);
        setMarkState(synced);
        if (!synced.schemas.some((s) => s.code === selectedTopicCode) && synced.schemas[0]) {
            setSelectedTopicCode(synced.schemas[0].code);
        }

        let cancelled = false;
        void fetchAndHydrateClassTopicMarks(classKey, trainees, () => !cancelled).then((hydrated) => {
            if (cancelled || !hydrated) return;
            setMarkState(hydrated);
            setSelectedTopicCode((prev) =>
                hydrated.schemas.some((s) => s.code === prev)
                    ? prev
                    : (hydrated.schemas[0]?.code ?? prev),
            );
        });

        return () => {
            cancelled = true;
        };
    }, [classKey, trainees]);

    const activeSchema = useMemo(
        () =>
            markState.schemas.find((s) => s.code === selectedTopicCode) ??
            markState.schemas[0] ??
            FALLBACK_SCHEMAS[0],
        [markState.schemas, selectedTopicCode],
    );

    const lockInfo: TopicMarkLockInfo = activeSchema.lock ?? DEFAULT_TOPIC_MARK_LOCK;
    const isTopicLocked = Boolean(lockInfo.locked);

    // Cooldown countdown effect
    const cooldownTargetEpochMs = useMemo(() => {
        if (lockInfo.cooldownUntilEpochMs && lockInfo.cooldownUntilEpochMs > nowMs) {
            return lockInfo.cooldownUntilEpochMs;
        }
        if (lockInfo.cooldownSecondsRemaining > 0 && !lockInfo.cooldownUntilEpochMs) {
            return Date.now() + lockInfo.cooldownSecondsRemaining * 1000;
        }
        return null;
    }, [lockInfo.cooldownUntilEpochMs, lockInfo.cooldownSecondsRemaining, nowMs]);

    const cooldownSecondsLeft = cooldownTargetEpochMs
        ? Math.max(0, Math.ceil((cooldownTargetEpochMs - nowMs) / 1000))
        : 0;

    useEffect(() => {
        if (!unlockModalOpen) return;
        setNowMs(Date.now());
        if (!lockInfo.cooldownUntilEpochMs) return;
        const timer = window.setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
        return () => window.clearInterval(timer);
    }, [unlockModalOpen, lockInfo.cooldownUntilEpochMs]);

    const topicBaselineRecords = useMemo(
        () => markState.recordsByTopic[activeSchema.code] ?? {},
        [markState.recordsByTopic, activeSchema.code],
    );

    const draftKey = (traineeId: number, colKey: string) =>
        `${activeSchema.code}:${traineeId}:${colKey}`;

    const parsedRows = useMemo(() => {
        return trainees.map((trainee, index) => {
            const baseline =
                topicBaselineRecords[trainee.id] ??
                buildDefaultRecordForSchema(index, activeSchema.code, activeSchema.columns);
            const account = resolveTraineeAccount(trainee, index);
            const email = (trainee.personalEmail ?? trainee.email ?? "").trim();
            const status = normalizeTraineeStatus(trainee.status);

            const effectiveScores: Record<string, number> = {};
            const cellErrors: Record<string, string> = {};
            let rowDirty = false;

            for (const col of activeSchema.columns) {
                const key = `${activeSchema.code}:${trainee.id}:${col.key}`;
                const baseVal = baseline.componentScores[col.key] ?? 0;

                if (Object.prototype.hasOwnProperty.call(draftInputs, key)) {
                    const raw = draftInputs[key];
                    const trimmed = raw.trim();
                    const parsed = Number(trimmed);
                    if (!trimmed || !Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
                        cellErrors[col.key] = "Must be between 0 and 10";
                        effectiveScores[col.key] = baseVal;
                        rowDirty = true;
                    } else {
                        const rounded = Math.round(parsed * 10) / 10;
                        effectiveScores[col.key] = rounded;
                        if (rounded !== baseVal) {
                            rowDirty = true;
                        }
                    }
                } else {
                    effectiveScores[col.key] = baseVal;
                }
            }

            const totalGpa = calculateDynamicTopicGpa(effectiveScores, activeSchema.columns);
            const isFailed = totalGpa < TOPIC_GPA_PASS_THRESHOLD;

            return {
                no: index + 1,
                trainee,
                account,
                email,
                status,
                baselineScores: baseline.componentScores,
                effectiveScores,
                cellErrors,
                rowDirty,
                totalGpa,
                isFailed,
            };
        });
    }, [trainees, topicBaselineRecords, activeSchema, draftInputs]);

    const visibleRows = useMemo(() => {
        if (resultFilter === "passed") return parsedRows.filter((r) => !r.isFailed);
        if (resultFilter === "failed") return parsedRows.filter((r) => r.isFailed);
        return parsedRows;
    }, [parsedRows, resultFilter]);

    const hasDirtyDrafts = parsedRows.some((r) => r.rowDirty);
    const hasValidationErrors = parsedRows.some((r) => Object.keys(r.cellErrors).length > 0);

    const kpiSummary = useMemo(() => {
        if (parsedRows.length === 0) {
            return { avgGpa: 0, passed: 0, failed: 0 };
        }
        const sumGpa = parsedRows.reduce((acc, r) => acc + r.totalGpa, 0);
        const failed = parsedRows.filter((r) => r.isFailed).length;
        return {
            avgGpa: Math.round((sumGpa / parsedRows.length) * 10) / 10,
            passed: parsedRows.length - failed,
            failed,
        };
    }, [parsedRows]);

    const patchTopicLockInState = (topicCode: string, nextLock: TopicMarkLockInfo) => {
        const normalizedLock: TopicMarkLockInfo = {
            ...DEFAULT_TOPIC_MARK_LOCK,
            ...nextLock,
            cooldownUntilEpochMs:
                nextLock.cooldownUntilEpochMs ??
                (nextLock.cooldownSecondsRemaining > 0
                    ? Date.now() + nextLock.cooldownSecondsRemaining * 1000
                    : null),
        };
        setMarkState((prev) => {
            const nextState: ClassTopicMarkHydratedState = {
                ...prev,
                schemas: prev.schemas.map((s) =>
                    s.code === topicCode ? { ...s, lock: normalizedLock } : s,
                ),
            };
            classTopicMarkStore[classKey] = nextState;
            return nextState;
        });
    };

    const handleTopicChange = (nextTopic: string) => {
        setSelectedTopicCode(nextTopic);
        setResultFilter("all");
    };

    const handleDraftScoreChange = (traineeId: number, colKey: string, value: string) => {
        if (isTopicLocked) return;
        const key = draftKey(traineeId, colKey);
        setDraftInputs((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const clearActiveTopicDrafts = () => {
        const prefix = `${activeSchema.code}:`;
        setDraftInputs((prev) => {
            const next: Record<string, string> = {};
            for (const [k, v] of Object.entries(prev)) {
                if (!k.startsWith(prefix)) {
                    next[k] = v;
                }
            }
            return next;
        });
    };

    const persistTopicRecords = async (
        targetTopicCode: string,
        source: "inline_edit" | "excel_import",
        recordsByTraineeId: Record<string, { componentScores: Record<string, number> }>,
        successMessage: string,
    ): Promise<boolean> => {
        setIsSaving(true);
        try {
            const response = await externalApi.saveClassTopicMarks(classKey, {
                topicCode: targetTopicCode,
                source,
                trainees: trainees.map((t) => ({
                    id: t.id,
                    studentId: formatFptStudentIdForSite(t.fptAccount || t.code, classSite, t.id),
                    fullName: t.fullName,
                    personalEmail: t.personalEmail || t.email,
                })),
                recordsByTraineeId,
            });

            const hydrated = applyRemoteTopicMarksToStore(classKey, response, trainees);
            if (hydrated) {
                setMarkState(hydrated);
            }
            clearActiveTopicDrafts();
            void queryClient.invalidateQueries({ queryKey: ["external", "class-activities", classKey] });
            toast.success(successMessage);
            return true;
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Failed to save Topic Marks. Please verify scores are between 0 and 10.";
            toast.error(msg);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveMarks = async () => {
        if (isTopicLocked || hasValidationErrors || !hasDirtyDrafts) return;
        const payloadRecords: Record<string, { componentScores: Record<string, number> }> = {};
        for (const row of parsedRows) {
            payloadRecords[String(row.trainee.id)] = {
                componentScores: row.effectiveScores,
            };
        }
        await persistTopicRecords(
            activeSchema.code,
            "inline_edit",
            payloadRecords,
            `Saved Topic Marks for ${activeSchema.code}.`,
        );
    };

    const handleConfirmLock = async () => {
        if (hasValidationErrors) return;
        setIsLocking(true);
        try {
            if (hasDirtyDrafts) {
                const payloadRecords: Record<string, { componentScores: Record<string, number> }> = {};
                for (const row of parsedRows) {
                    payloadRecords[String(row.trainee.id)] = {
                        componentScores: row.effectiveScores,
                    };
                }
                const savedOk = await persistTopicRecords(
                    activeSchema.code,
                    "inline_edit",
                    payloadRecords,
                    `Saved Topic Marks for ${activeSchema.code}.`,
                );
                if (!savedOk) {
                    return;
                }
            }

            const lockRes = await externalApi.lockClassTopicMarks(classKey, {
                topicCode: activeSchema.code,
            });
            if (lockRes.gradebook) {
                const hydrated = applyRemoteTopicMarksToStore(classKey, lockRes.gradebook, trainees);
                if (hydrated) {
                    setMarkState(hydrated);
                }
            } else if (lockRes.lock) {
                patchTopicLockInState(activeSchema.code, lockRes.lock);
            }

            clearActiveTopicDrafts();
            void queryClient.invalidateQueries({ queryKey: ["external", "class-activities", classKey] });
            setConfirmLockOpen(false);
            setIssuedPinModal({
                open: true,
                topicCode: activeSchema.code,
                pin: lockRes.pin,
            });
            toast.success(`Topic Marks for ${activeSchema.code} are now locked.`);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Failed to lock Topic Marks. Please try again.";
            toast.error(msg);
        } finally {
            setIsLocking(false);
        }
    };

    const handleOpenUnlockModal = () => {
        setPinInput("");
        setShowPin(false);
        setUnlockError("");
        setNowMs(Date.now());
        setUnlockModalOpen(true);
    };

    const handleSubmitUnlock = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (cooldownSecondsLeft > 0) return;

        const cleanPin = pinInput.trim();
        if (!/^\d{4}$/.test(cleanPin)) {
            setUnlockError("Please enter a valid 4-digit numeric PIN.");
            return;
        }

        setIsUnlocking(true);
        setUnlockError("");
        try {
            const res = await externalApi.unlockClassTopicMarks(classKey, {
                topicCode: activeSchema.code,
                pin: cleanPin,
            });

            if (res.unlocked) {
                if (res.gradebook) {
                    const hydrated = applyRemoteTopicMarksToStore(classKey, res.gradebook, trainees);
                    if (hydrated) {
                        setMarkState(hydrated);
                    }
                } else if (res.lock) {
                    patchTopicLockInState(activeSchema.code, res.lock);
                }
                void queryClient.invalidateQueries({ queryKey: ["external", "class-activities", classKey] });
                setUnlockModalOpen(false);
                setPinInput("");
                setUnlockError("");
                toast.success(`Unlocked Topic Marks for ${activeSchema.code}.`);
                return;
            }

            if (res.lock) {
                patchTopicLockInState(activeSchema.code, res.lock);
            }
            setUnlockError(res.message || "Incorrect 4-digit PIN.");
            setPinInput("");
        } catch (err: unknown) {
            const data = (
                err as {
                    response?: {
                        data?: {
                            message?: string;
                            lock?: TopicMarkLockInfo;
                        };
                    };
                }
            )?.response?.data;

            if (data?.lock) {
                patchTopicLockInState(activeSchema.code, data.lock);
                setNowMs(Date.now());
            }
            setUnlockError(data?.message ?? "Incorrect 4-digit PIN. Please try again.");
            setPinInput("");
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleCopyIssuedPin = async () => {
        if (!issuedPinModal.pin) return;
        try {
            await navigator.clipboard?.writeText(issuedPinModal.pin);
            toast.success("Copied 4-digit security PIN to clipboard.");
        } catch {
            toast.info(`Security PIN: ${issuedPinModal.pin}`);
        }
    };

    const handleDownloadTemplate = () => {
        const colHeaders = activeSchema.columns.map((col) => `${col.name} (${col.weight}%)`);
        const headers = [
            "No",
            "Full Name",
            "Personal Email",
            "Account",
            "Topic Code",
            ...colHeaders,
            "Total Topic GPA",
        ];
        const dataRows = parsedRows.map((row) => [
            row.no,
            row.trainee.fullName,
            row.email,
            row.account,
            activeSchema.code,
            ...activeSchema.columns.map((col) => row.effectiveScores[col.key] ?? 0),
            row.totalGpa,
        ]);

        const colWidths: Record<string, number> = {
            No: 6,
            "Full Name": 25,
            "Personal Email": 30,
            Account: 16,
            "Topic Code": 18,
            "Total Topic GPA": 16,
        };
        for (const h of colHeaders) {
            colWidths[h] = Math.max(16, h.length + 4);
        }

        const worksheet = utils.aoa_to_sheet([headers, ...dataRows]);
        autoFitWorksheetColumns(worksheet, colWidths);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "Topic Mark Template");
        writeFile(workbook, `${classCodeLabel}_${activeSchema.code}_Mark_Template.xlsx`);
        toast.success(`Downloaded dynamic template for ${activeSchema.code} (${activeSchema.columns.length} columns).`);
    };

    const handleExportMark = () => {
        const colHeaders = activeSchema.columns.map((col) => `${col.name} (${col.weight}%)`);
        const headers = [
            "No",
            "Full Name",
            "Personal Email",
            "Account",
            "Status",
            "Topic Code",
            ...colHeaders,
            "Total Topic GPA",
            "Evaluation",
        ];
        const dataRows = parsedRows.map((row) => [
            row.no,
            row.trainee.fullName,
            row.email,
            row.account,
            row.status,
            activeSchema.code,
            ...activeSchema.columns.map((col) => (row.effectiveScores[col.key] ?? 0).toFixed(1)),
            row.totalGpa.toFixed(1),
            row.isFailed ? "Topic GPA Failure (< 6.0)" : "Passed",
        ]);

        const colWidths: Record<string, number> = {
            No: 6,
            "Full Name": 25,
            "Personal Email": 30,
            Account: 16,
            Status: 12,
            "Topic Code": 18,
            "Total Topic GPA": 16,
            Evaluation: 24,
        };
        for (const h of colHeaders) {
            colWidths[h] = Math.max(16, h.length + 4);
        }

        const worksheet = utils.aoa_to_sheet([headers, ...dataRows]);
        autoFitWorksheetColumns(worksheet, colWidths);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "Topic Marks");
        writeFile(workbook, `${classCodeLabel}_${activeSchema.code}_Topic_Marks.xlsx`);
        toast.success(`Exported ${parsedRows.length} topic mark records for ${activeSchema.code}.`);
    };

    const handleImportMarkFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (isTopicLocked) return;
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            const workbook = read(buffer, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;

            if (!worksheet) {
                setImportErrors(["The uploaded Excel file contains no readable worksheet."]);
                setIsErrorModalOpen(true);
                return;
            }

            const rawMatrix = utils.sheet_to_json<unknown[]>(worksheet, {
                header: 1,
                defval: "",
                blankrows: false,
            });

            if (rawMatrix.length < 2) {
                setImportErrors(["The uploaded file contains no trainee mark rows to import."]);
                setIsErrorModalOpen(true);
                return;
            }

            const rawHeaders = (rawMatrix[0] ?? []).map((cell) => String(cell ?? "").trim());
            const lowerHeaders = rawHeaders.map((h) => h.toLowerCase());
            const normalizedHeaders = rawHeaders.map((h) => normalizeHeaderLabel(h));

            const findColIdx = (candidates: string[]) =>
                lowerHeaders.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

            const nameIdx = findColIdx(["full name", "fullname", "student", "trainee"]);
            const emailIdx = findColIdx(["personal email", "email"]);
            const accountIdx = findColIdx(["account", "fpt account"]);

            const dynamicColIndices: Array<{ col: DynamicAssessmentColumn; idx: number }> = [];
            const missingSchemaErrors: string[] = [];

            for (const col of activeSchema.columns) {
                const exactLabel = `${col.name} (${col.weight}%)`.toLowerCase();
                const normName = normalizeHeaderLabel(col.name);
                let idx = lowerHeaders.findIndex((h) => h === exactLabel);
                if (idx === -1) {
                    idx = normalizedHeaders.findIndex(
                        (h) => h === normName || (normName.length > 0 && h.includes(normName)),
                    );
                }
                if (idx === -1) {
                    missingSchemaErrors.push(
                        `Missing column '${col.name} (${col.weight}%)' expected for topic ${activeSchema.code}.`,
                    );
                } else {
                    dynamicColIndices.push({ col, idx });
                }
            }

            if (missingSchemaErrors.length > 0) {
                setImportErrors([
                    ...missingSchemaErrors,
                    "Please download the latest template for this topic so all columns match H2 assessments.",
                ]);
                setIsErrorModalOpen(true);
                return;
            }

            const errors: string[] = [];
            const importedPayload: Record<string, { componentScores: Record<string, number> }> = {};

            const parseScoreCell = (
                rawVal: unknown,
                colLabel: string,
                excelRowNumber: number,
                traineeLabel: string,
            ): number | null => {
                const str = String(rawVal ?? "").trim();
                if (!str) {
                    errors.push(
                        `Row ${excelRowNumber} (${traineeLabel}) — Column '${colLabel}': Score cannot be empty.`,
                    );
                    return null;
                }
                const num = Number(str);
                if (!Number.isFinite(num)) {
                    errors.push(
                        `Row ${excelRowNumber} (${traineeLabel}) — Column '${colLabel}': Score '${str}' is not a valid number.`,
                    );
                    return null;
                }
                if (num < 0 || num > 10) {
                    errors.push(
                        `Row ${excelRowNumber} (${traineeLabel}) — Column '${colLabel}': Score ${num} must be between 0 and 10.`,
                    );
                    return null;
                }
                return Math.round(num * 10) / 10;
            };

            for (let i = 1; i < rawMatrix.length; i++) {
                const rowCells = rawMatrix[i] ?? [];
                const excelRowNum = i + 1;
                const rawName = nameIdx >= 0 ? String(rowCells[nameIdx] ?? "").trim() : "";
                const rawEmail = emailIdx >= 0 ? String(rowCells[emailIdx] ?? "").trim().toLowerCase() : "";
                const rawAccount = accountIdx >= 0 ? String(rowCells[accountIdx] ?? "").trim().toLowerCase() : "";

                if (!rawName && !rawEmail && !rawAccount) continue;

                const matchedRow = parsedRows.find(
                    (r) =>
                        (rawEmail && r.email.toLowerCase() === rawEmail) ||
                        (rawAccount && r.account.toLowerCase() === rawAccount) ||
                        (rawName && (r.trainee.fullName ?? "").trim().toLowerCase() === rawName.toLowerCase()),
                );

                const label = rawName || rawEmail || rawAccount || `Row ${excelRowNum}`;
                if (!matchedRow) {
                    errors.push(
                        `Row ${excelRowNum} (${label}): Trainee does not exist in the current class's Trainee List.`,
                    );
                    continue;
                }

                const nextScores: Record<string, number> = {};
                let rowValid = true;

                for (const { col, idx } of dynamicColIndices) {
                    const parsedVal = parseScoreCell(rowCells[idx], col.name, excelRowNum, label);
                    if (parsedVal === null) {
                        rowValid = false;
                    } else {
                        nextScores[col.key] = parsedVal;
                    }
                }

                if (rowValid) {
                    importedPayload[String(matchedRow.trainee.id)] = {
                        componentScores: nextScores,
                    };
                }
            }

            if (errors.length > 0) {
                setImportErrors(errors);
                setIsErrorModalOpen(true);
                return;
            }

            if (Object.keys(importedPayload).length === 0) {
                setImportErrors(["No matching trainee rows found in the uploaded file."]);
                setIsErrorModalOpen(true);
                return;
            }

            const ok = await persistTopicRecords(
                activeSchema.code,
                "excel_import",
                importedPayload,
                `Imported ${Object.keys(importedPayload).length} Topic Marks for ${activeSchema.code}.`,
            );
            if (ok) {
                const nextTopicRecords: Record<number, DynamicTraineeTopicRecord> = {
                    ...topicBaselineRecords,
                };
                for (const [idStr, item] of Object.entries(importedPayload)) {
                    const tid = Number(idStr);
                    nextTopicRecords[tid] = {
                        componentScores: item.componentScores,
                        totalGpa: calculateDynamicTopicGpa(item.componentScores, activeSchema.columns),
                    };
                }
                const nextState: ClassTopicMarkHydratedState = {
                    ...markState,
                    recordsByTopic: {
                        ...markState.recordsByTopic,
                        [activeSchema.code]: nextTopicRecords,
                    },
                };
                classTopicMarkStore[classKey] = nextState;
                setMarkState(nextState);
            }
        } catch {
            setImportErrors(["Failed to parse the Excel file. Please use the provided template."]);
            setIsErrorModalOpen(true);
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const totalColCount = 6 + activeSchema.columns.length;
    const effectiveRemainingAttempts =
        lockInfo.cooldownUntilEpochMs && lockInfo.cooldownUntilEpochMs <= nowMs
            ? lockInfo.maxAttempts
            : lockInfo.remainingAttempts;

    return (
        <div
            data-testid="topic-mark-view"
            className="flex flex-1 min-h-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950"
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label="Import Mark File"
                className="hidden"
                onChange={handleImportMarkFile}
            />

            {/* 1. Top Header Bar */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Topic Mark {classCodeLabel}
                    </h2>
                    <Badge
                        variant="secondary"
                        className={cn(
                            "text-xs font-medium",
                            activeSchema.weightValid
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
                        )}
                    >
                        {activeSchema.columns.length} Assessments • Total Weight: {activeSchema.totalWeight}%
                    </Badge>
                    {isTopicLocked ? (
                        <Badge
                            data-testid="topic-lock-badge"
                            variant="secondary"
                            title={
                                lockInfo.lockedBy
                                    ? `Locked by ${lockInfo.lockedBy}${lockInfo.lockedAt ? ` at ${lockInfo.lockedAt}` : ""}`
                                    : "Scores locked with 4-digit security PIN"
                            }
                            className="gap-1 border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        >
                            <Lock className="size-3" aria-hidden />
                            <span>Marks Locked</span>
                        </Badge>
                    ) : (
                        <Badge
                            data-testid="topic-lock-badge"
                            variant="secondary"
                            className="gap-1 border border-slate-200 bg-slate-100 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                            <Unlock className="size-3" aria-hidden />
                            <span>Editable</span>
                        </Badge>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-5">
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        <Download className="size-3.5" aria-hidden />
                        Download Template
                    </button>
                    <button
                        type="button"
                        disabled={isTopicLocked}
                        onClick={() => fileInputRef.current?.click()}
                        title={isTopicLocked ? "Unlock marks with 4-digit PIN before importing" : undefined}
                        className={cn(
                            "inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
                            isTopicLocked
                                ? "cursor-not-allowed text-slate-400 dark:text-slate-600"
                                : "text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300",
                        )}
                    >
                        <Upload className="size-3.5" aria-hidden />
                        Import Mark
                    </button>
                    <button
                        type="button"
                        onClick={handleExportMark}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        <Download className="size-3.5" aria-hidden />
                        Export Mark
                    </button>
                </div>
            </div>

            {/* Locked Anti-Tampering Banner */}
            {isTopicLocked && (
                <div
                    data-testid="topic-locked-banner"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3.5 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                >
                    <div className="flex items-center gap-2">
                        <Lock className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                        <span>
                            Scores for <strong>{activeSchema.code}</strong> are locked to prevent tampering
                            {lockInfo.lockedBy ? ` (by ${lockInfo.lockedBy})` : ""}. Enter the 4-digit security PIN to edit or import scores.
                        </span>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleOpenUnlockModal}
                        className="h-7 gap-1 bg-amber-600 px-2.5 text-xs text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
                    >
                        <Unlock className="size-3" aria-hidden />
                        <span>Unlock Marks</span>
                    </Button>
                </div>
            )}

            {/* 2. Sub-header Bar: Topic Selector, Filters & KPI Strip */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 py-1">
                <div className="flex flex-wrap items-center gap-3">
                    <label
                        htmlFor="topic-code-select"
                        className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                        Topic Code
                    </label>
                    <div className="w-56">
                        <NativeSelect
                            id="topic-code-select"
                            aria-label="Topic Code"
                            value={activeSchema.code}
                            onChange={(e) => handleTopicChange(e.target.value)}
                            className="h-9 font-medium"
                        >
                            {markState.schemas.map((topic) => (
                                <option key={topic.code} value={topic.code}>
                                    {topic.lock?.locked ? "🔒 " : ""}
                                    {topic.code} — {topic.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </div>

                    <div className="flex items-center gap-1" role="group" aria-label="Filter by result">
                        {(
                            [
                                { key: "all", label: `All (${parsedRows.length})` },
                                { key: "passed", label: `Passed (${kpiSummary.passed})` },
                                { key: "failed", label: `Failed (${kpiSummary.failed})` },
                            ] as const
                        ).map((opt) => (
                            <Button
                                key={opt.key}
                                type="button"
                                size="sm"
                                variant={resultFilter === opt.key ? "default" : "outline"}
                                onClick={() => setResultFilter(opt.key)}
                                className={cn(
                                    "h-8 px-2.5 text-xs",
                                    resultFilter === opt.key &&
                                        "bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500",
                                )}
                            >
                                {opt.label}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>
                        Avg GPA: <strong className="text-slate-900 dark:text-slate-100">{kpiSummary.avgGpa.toFixed(1)}</strong>
                    </span>
                    <div
                        className="flex items-center gap-2"
                        title={`Trainees with Total Topic GPA below ${TOPIC_GPA_PASS_THRESHOLD.toFixed(1)} are highlighted`}
                    >
                        <span
                            aria-hidden
                            className="inline-block size-4 rounded-[3px] border border-red-200 bg-red-100 dark:border-red-800 dark:bg-red-950/70"
                        />
                        <span>Topic GPA Failure</span>
                    </div>
                </div>
            </div>

            {hasValidationErrors && !isTopicLocked && (
                <div
                    role="alert"
                    className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                    <AlertCircle className="size-4 shrink-0" aria-hidden />
                    <span>Scores must be valid numbers between 0 and 10 before saving.</span>
                </div>
            )}

            {/* 3. Dynamic Schema Gradebook Table */}
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-200 bg-white fams-scrollbar dark:border-slate-800 dark:bg-slate-950">
                <table
                    aria-label="Topic Mark Table"
                    className="w-full min-w-[960px] caption-bottom text-sm border-collapse"
                >
                    <TableHeader>
                        <TableRow className="border-b border-slate-200 hover:bg-transparent dark:border-slate-800">
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-12 text-center")}>
                                No
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "min-w-44 text-left")}>
                                Full Name
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "min-w-48 text-left")}>
                                Personal Email
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-28 text-left")}>
                                Account
                            </TableHead>
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-24 text-center")}>
                                Status
                            </TableHead>
                            {activeSchema.columns.map((col) => (
                                <TableHead
                                    key={col.key}
                                    className={cn(STICKY_HEADER_CELL_CLASS, "min-w-28 text-center whitespace-nowrap")}
                                >
                                    {col.name} ({col.weight}%)
                                </TableHead>
                            ))}
                            <TableHead className={cn(STICKY_HEADER_CELL_CLASS, "w-32 text-center whitespace-nowrap")}>
                                Total Topic GPA
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibleRows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={totalColCount}
                                    className="h-32 text-center text-sm text-muted-foreground"
                                >
                                    {parsedRows.length === 0
                                        ? "No trainees enrolled in this class yet."
                                        : "No trainees match the selected filter."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            visibleRows.map((row) => {
                                const statusBadge = resolveTraineeStatusBadge(row.status);

                                return (
                                    <TableRow
                                        key={row.trainee.id}
                                        className={cn(
                                            "border-b border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-slate-800/70 dark:hover:bg-slate-900/40",
                                            row.isFailed && "bg-red-50/40 hover:bg-red-50/70 dark:bg-red-950/20",
                                        )}
                                    >
                                        <TableCell className="px-3 py-2 text-center text-sm text-slate-700 dark:text-slate-300">
                                            {row.no}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">
                                            {row.trainee.fullName}
                                        </TableCell>
                                        <TableCell
                                            className="truncate px-3 py-2 text-left text-sm font-normal text-gray-800 dark:text-slate-200"
                                            title={row.email}
                                        >
                                            {row.email || "—"}
                                        </TableCell>
                                        <TableCell className="truncate px-3 py-2 text-left text-sm font-normal text-gray-800 dark:text-slate-200">
                                            {row.account}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-center">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                    statusBadge.className,
                                                )}
                                            >
                                                {statusBadge.label}
                                            </Badge>
                                        </TableCell>

                                        {activeSchema.columns.map((col) => {
                                            const key = draftKey(row.trainee.id, col.key);
                                            const baseVal = row.baselineScores[col.key] ?? 0;
                                            const displayVal = Object.prototype.hasOwnProperty.call(draftInputs, key)
                                                ? draftInputs[key]
                                                : String(baseVal);
                                            const hasError = Boolean(row.cellErrors[col.key]);
                                            const isModified =
                                                !hasError && row.effectiveScores[col.key] !== baseVal;

                                            return (
                                                <TableCell key={col.key} className="px-2 py-1.5 text-center">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={10}
                                                        step={0.1}
                                                        disabled={isTopicLocked}
                                                        aria-label={`${col.name} score for ${row.trainee.fullName}`}
                                                        value={displayVal}
                                                        onChange={(e) =>
                                                            handleDraftScoreChange(
                                                                row.trainee.id,
                                                                col.key,
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={cn(
                                                            "h-8 w-20 rounded-md border px-2 text-center text-sm tabular-nums transition-colors focus:outline-none focus:ring-2",
                                                            isTopicLocked
                                                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                                                                : hasError
                                                                  ? "border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300"
                                                                  : isModified
                                                                    ? "border-amber-400 bg-amber-50/70 font-semibold text-slate-900 focus:ring-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200"
                                                                    : "border-slate-200 bg-background text-foreground focus:border-blue-500 focus:ring-blue-500/20 dark:border-slate-700",
                                                        )}
                                                    />
                                                </TableCell>
                                            );
                                        })}

                                        <TableCell
                                            data-testid={`gpa-cell-${row.trainee.id}`}
                                            className={cn(
                                                "px-3 py-2 text-center text-sm tabular-nums",
                                                row.isFailed
                                                    ? "bg-red-50 text-red-700 font-semibold dark:bg-red-950/50 dark:text-red-300"
                                                    : "font-semibold text-slate-800 dark:text-slate-200",
                                            )}
                                        >
                                            <span>{row.totalGpa.toFixed(1)}</span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </table>
            </div>

            {/* 4. Footer Controls */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="h-9 rounded-md border-slate-300 px-4 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                >
                    Back to Trainee List
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                    {isTopicLocked ? (
                        <Button
                            type="button"
                            onClick={handleOpenUnlockModal}
                            className="h-9 gap-1.5 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
                        >
                            <Unlock className="size-3.5" aria-hidden />
                            <span>Unlock Marks</span>
                        </Button>
                    ) : (
                        <>
                            {hasDirtyDrafts ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isSaving || isLocking}
                                    onClick={clearActiveTopicDrafts}
                                    className="h-9 gap-1.5"
                                >
                                    <RotateCcw className="size-3.5" aria-hidden />
                                    <span>Discard</span>
                                </Button>
                            ) : null}

                            <Button
                                type="button"
                                disabled={!hasDirtyDrafts || hasValidationErrors || isSaving || isLocking}
                                onClick={handleSaveMarks}
                                className={cn(
                                    "h-9 gap-1.5",
                                    hasDirtyDrafts && !hasValidationErrors
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                        : "",
                                )}
                            >
                                <Save className="size-3.5" aria-hidden />
                                <span>{isSaving ? "Saving..." : "Save Marks"}</span>
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                disabled={hasValidationErrors || isSaving || isLocking || parsedRows.length === 0}
                                onClick={() => setConfirmLockOpen(true)}
                                className="h-9 gap-1.5 border-[#283593] text-[#283593] hover:bg-blue-50 dark:border-blue-500 dark:text-blue-300 dark:hover:bg-blue-950/40"
                            >
                                <Lock className="size-3.5" aria-hidden />
                                <span>{hasDirtyDrafts ? "Save & Lock Marks" : "Lock Marks"}</span>
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Modal A: Confirm Lock Marks */}
            <Dialog open={confirmLockOpen} onOpenChange={setConfirmLockOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="size-4 text-[#283593] dark:text-blue-400" aria-hidden />
                            Lock Topic Marks ({activeSchema.code})
                        </DialogTitle>
                        <DialogDescription>
                            Locking freezes inline editing and Excel imports for this topic to prevent unauthorized tampering.
                            A one-time 4-digit security PIN will be generated for future unlocking.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
                        <p>
                            • Any future edits require entering the <strong>4-digit PIN</strong>.
                        </p>
                        <p>
                            • Entering an incorrect PIN <strong>3 times</strong> triggers a progressive lockout (1 min → 5 min → 15 min → 30 min).
                        </p>
                        {hasDirtyDrafts ? (
                            <p className="font-medium text-emerald-700 dark:text-emerald-300">
                                • Your unsaved inline score changes will be saved to H2 before locking.
                            </p>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirmLockOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={isLocking || isSaving}
                            onClick={handleConfirmLock}
                            className="gap-1.5 bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                            <Lock className="size-3.5" aria-hidden />
                            <span>{isLocking ? "Locking..." : "Confirm & Generate PIN"}</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal B: Issued One-Time 4-Digit Security PIN */}
            <Dialog
                open={issuedPinModal.open}
                onOpenChange={(open) => setIssuedPinModal((prev) => ({ ...prev, open }))}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                            <Lock className="size-4" aria-hidden />
                            Security PIN Generated ({issuedPinModal.topicCode})
                        </DialogTitle>
                        <DialogDescription>
                            Save this 4-digit security PIN carefully. It is stored as an encrypted hash in H2 and will only be shown once.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-5 dark:border-slate-800 dark:bg-slate-900">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            4-Digit Unlock PIN
                        </span>
                        <div
                            data-testid="issued-pin-code"
                            className="flex items-center gap-2.5 font-mono text-3xl font-bold tracking-[0.2em] text-slate-900 dark:text-slate-100"
                        >
                            {issuedPinModal.pin.split("").map((digit, idx) => (
                                <span
                                    key={idx}
                                    className="flex size-12 items-center justify-center rounded-lg border-2 border-[#283593]/30 bg-white shadow-2xs dark:border-blue-500/40 dark:bg-slate-950"
                                >
                                    {digit}
                                </span>
                            ))}
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={handleCopyIssuedPin} className="gap-1.5">
                            <Copy className="size-3.5" aria-hidden />
                            <span>Copy PIN</span>
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            onClick={() => setIssuedPinModal((prev) => ({ ...prev, open: false }))}
                            className="bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal C: Unlock Topic Marks with 4-Digit PIN & Cooldown */}
            <Dialog open={unlockModalOpen} onOpenChange={setUnlockModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Unlock className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
                            Unlock Topic Marks ({activeSchema.code})
                        </DialogTitle>
                        <DialogDescription>
                            Enter the 4-digit security PIN issued when this topic was locked.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmitUnlock} className="space-y-4">
                        {cooldownSecondsLeft > 0 ? (
                            <div
                                data-testid="pin-lockout-banner"
                                role="alert"
                                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                            >
                                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                                <div className="space-y-0.5">
                                    <p className="font-semibold">
                                        Temporarily Locked (Tier {lockInfo.lockoutTier})
                                    </p>
                                    <p>
                                        Too many incorrect attempts. Please wait{" "}
                                        <strong className="font-mono text-sm">
                                            {formatCountdown(cooldownSecondsLeft)}
                                        </strong>{" "}
                                        before trying again.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                <span>Remaining attempts before lockout:</span>
                                <span
                                    data-testid="pin-remaining-attempts"
                                    className={cn(
                                        "font-semibold",
                                        effectiveRemainingAttempts <= 1
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-foreground",
                                    )}
                                >
                                    {effectiveRemainingAttempts} / {lockInfo.maxAttempts}
                                </span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="topic-mark-unlock-pin">4-Digit Security PIN</Label>
                            <div className="relative">
                                <Input
                                    id="topic-mark-unlock-pin"
                                    aria-label="4-Digit Security PIN"
                                    type={showPin ? "text" : "password"}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={4}
                                    disabled={cooldownSecondsLeft > 0 || isUnlocking}
                                    placeholder="••••"
                                    value={pinInput}
                                    onChange={(e) => {
                                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 4);
                                        setPinInput(digitsOnly);
                                        if (unlockError) setUnlockError("");
                                    }}
                                    className="pr-10 text-center font-mono text-lg tracking-[0.4em]"
                                />
                                <button
                                    type="button"
                                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                                    onClick={() => setShowPin((prev) => !prev)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPin ? (
                                        <EyeOff className="size-4" aria-hidden />
                                    ) : (
                                        <Eye className="size-4" aria-hidden />
                                    )}
                                </button>
                            </div>
                            {unlockError && cooldownSecondsLeft === 0 ? (
                                <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                                    {unlockError}
                                </p>
                            ) : null}
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setUnlockModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={cooldownSecondsLeft > 0 || isUnlocking || pinInput.trim().length !== 4}
                                className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
                            >
                                <Unlock className="size-3.5" aria-hidden />
                                <span>{isUnlocking ? "Verifying..." : "Unlock"}</span>
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* All-or-Nothing Import Validation Error Modal */}
            <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="size-5" aria-hidden />
                            Import Validation Failed
                        </DialogTitle>
                        <DialogDescription>
                            All-or-Nothing validation rejected the file because one or more rows contained invalid data.
                            No marks were modified.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-60 overflow-y-auto rounded-md border border-red-200 bg-red-50/60 p-3 text-xs text-red-800 space-y-1.5">
                        {importErrors.map((err, idx) => (
                            <div key={idx} className="flex items-start gap-1.5">
                                <span className="font-bold">•</span>
                                <span>{err}</span>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsErrorModalOpen(false)}>
                            <Check className="mr-1.5 size-3.5" aria-hidden />
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default TraineeTopicMarkView;
