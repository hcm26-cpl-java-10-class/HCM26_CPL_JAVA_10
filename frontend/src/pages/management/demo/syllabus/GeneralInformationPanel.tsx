import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import {
    syllabusApi,
    type SyllabusInformationInput,
} from "@/api/features/demo/syllabus.api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { usePermissions } from "@/hooks/usePermissions";

type FieldName =
    | "description"
    | "teachingMethods"
    | "degreeLevel"
    | "timeAllocation"
    | "studentResponsibilities"
    | "requiredTools";

const fields: {
    key: FieldName;
    label: string;
    max: number;
    multiline?: boolean;
}[] = [
    {
        key: "description",
        label: "Description",
        max: 1500,
        multiline: true,
    },
    {
        key: "teachingMethods",
        label: "Teaching Methods",
        max: 500,
    },
    {
        key: "degreeLevel",
        label: "Degree Level",
        max: 100,
    },
    {
        key: "timeAllocation",
        label: "Time Allocation",
        max: 500,
    },
    {
        key: "studentResponsibilities",
        label: "Student Responsibilities",
        max: 2000,
        multiline: true,
    },
    {
        key: "requiredTools",
        label: "Required Tools",
        max: 1500,
        multiline: true,
    },
];

const empty: SyllabusInformationInput = {
    code: "",
    name: "",
    description: "",
    teachingMethods: "",
    degreeLevel: "",
    timeAllocation: "",
    studentResponsibilities: "",
    requiredTools: "",
    scoringScale: null,
};

function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | {
            message?: string;
            errors?: Record<string, string[]>;
        }
            | undefined;

        if (data?.errors) {
            const first = Object.values(data.errors).flat()[0];

            if (typeof first === "string") {
                return first;
            }
        }

        if (typeof data?.message === "string") {
            return data.message;
        }

        if (error.response?.status === 403) {
            return "You do not have permission to edit this syllabus.";
        }

        if (error.response?.status === 404) {
            return "Syllabus not found or information API is unavailable.";
        }
    }

    return "Unable to save syllabus information.";
}

export default function GeneralInformationPanel({
                                                    syllabusId,
                                                }: {
    syllabusId: number;
}) {
    const qc = useQueryClient();
    const { hasPermission } = usePermissions();

    const canEdit = hasPermission("SYLLABUS_UPDATE");

    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [form, setForm] =
        useState<SyllabusInformationInput>(empty);

    const [scoreText, setScoreText] = useState("");

    const query = useQuery({
        queryKey: ["syllabus-information", syllabusId],
        queryFn: () => syllabusApi.getInformation(syllabusId),
        enabled: Number.isSafeInteger(syllabusId) && syllabusId > 0,
    });

    const info = query.data;

    function openEdit() {
        if (!info || !canEdit) return;

        setForm({
            code: info.code,
            name: info.name,
            description: info.description ?? "",
            teachingMethods: info.teachingMethods ?? "",
            degreeLevel: info.degreeLevel ?? "",
            timeAllocation: info.timeAllocation ?? "",
            studentResponsibilities:
                info.studentResponsibilities ?? "",
            requiredTools: info.requiredTools ?? "",
            scoringScale: info.scoringScale ?? null,
        });

        setScoreText(
            info.scoringScale == null
                ? ""
                : String(info.scoringScale)
        );

        setOpen(true);
    }

    function updateField(
        key: FieldName,
        value: string
    ) {
        setForm((previous) => ({
            ...previous,
            [key]: value,
        }));
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (saving || !canEdit) return;

        const code = form.code.trim().toUpperCase();
        const name = form.name.trim().replace(/\s+/g, " ");

        if (!/^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(code)) {
            toast.error("Invalid syllabus code (3-30 characters).");
            return;
        }

        if (
            name.length < 3 ||
            name.length > 150 ||
            !/\p{L}/u.test(name)
        ) {
            toast.error("Syllabus name must contain letters (3-150 characters).");
            return;
        }

        for (const field of fields) {
            if (form[field.key].trim().length > field.max) {
                toast.error(`${field.label} is too long.`);
                return;
            }
        }

        let scoringScale: number | null = null;

        if (scoreText.trim() !== "") {
            if (!/^\d+$/.test(scoreText.trim())) {
                toast.error("Scoring Scale must be an integer.");
                return;
            }

            scoringScale = Number(scoreText.trim());

            if (
                !Number.isSafeInteger(scoringScale) ||
                scoringScale < 1 ||
                scoringScale > 100
            ) {
                toast.error("Scoring Scale must be between 1 and 100.");
                return;
            }
        }

        const payload: SyllabusInformationInput = {
            code,
            name,
            description: form.description.trim(),
            teachingMethods: form.teachingMethods.trim(),
            degreeLevel: form.degreeLevel.trim(),
            timeAllocation: form.timeAllocation.trim(),
            studentResponsibilities:
                form.studentResponsibilities.trim(),
            requiredTools: form.requiredTools.trim(),
            scoringScale,
        };

        setSaving(true);

        try {
            await syllabusApi.updateInformation(syllabusId, payload);

            await Promise.all([
                qc.invalidateQueries({
                    queryKey: ["syllabus-information", syllabusId],
                }),
                qc.invalidateQueries({
                    queryKey: ["syllabus", syllabusId],
                }),
                qc.invalidateQueries({
                    queryKey: ["syllabuses"],
                }),
            ]);

            setOpen(false);
            toast.success("General Information saved successfully.");
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="w-full rounded-xl border bg-card p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">
                    General Information
                </h2>

                {canEdit && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!info}
                        onClick={openEdit}
                    >
                        <Pencil className="size-4" />
                        Edit Information
                    </Button>
                )}
            </div>

            {query.isPending ? (
                <p className="text-sm text-muted-foreground">
                    Loading General Information...
                </p>
            ) : query.isError ? (
                <div className="space-y-3">
                    <p className="text-sm text-destructive">
                        Could not load General Information.
                    </p>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void query.refetch()}
                    >
                        Try Again
                    </Button>
                </div>
            ) : info ? (
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed text-sm">
                        <tbody>
                        {fields.map((field) => (
                            <tr
                                key={field.key}
                                className="border-b last:border-b-0"
                            >
                                <th
                                    scope="row"
                                    className="w-[38%] py-3 pr-5 text-left align-top font-normal text-muted-foreground"
                                >
                                    {field.label}
                                </th>

                                <td className="whitespace-pre-wrap break-words py-3 align-top">
                                    {info[field.key] || (
                                        <span className="text-muted-foreground">
                        Not provided
                      </span>
                                    )}
                                </td>
                            </tr>
                        ))}

                        <tr>
                            <th
                                scope="row"
                                className="w-[38%] py-3 pr-5 text-left font-normal text-muted-foreground"
                            >
                                Scoring Scale
                            </th>

                            <td className="py-3">
                                {info.scoringScale ?? "Not provided"}
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            ) : null}

            <Modal
                open={open}
                title="Edit Syllabus Information"
                size="lg"
                onClose={() => {
                    if (!saving) setOpen(false);
                }}
            >
                <form
                    className="max-h-[70vh] space-y-4 overflow-y-auto pr-2"
                    onSubmit={(event) => void handleSave(event)}
                >
                    <div className="space-y-1">
                        <label htmlFor="info-code" className="text-sm font-medium">
                            Syllabus Code *
                        </label>

                        <Input
                            id="info-code"
                            value={form.code}
                            maxLength={30}
                            required
                            onChange={(event) =>
                                setForm((previous) => ({
                                    ...previous,
                                    code: event.target.value,
                                }))
                            }
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="info-name" className="text-sm font-medium">
                            Syllabus Name *
                        </label>

                        <Input
                            id="info-name"
                            value={form.name}
                            maxLength={150}
                            required
                            onChange={(event) =>
                                setForm((previous) => ({
                                    ...previous,
                                    name: event.target.value,
                                }))
                            }
                        />
                    </div>

                    {fields.map((field) => (
                        <div key={field.key} className="space-y-1">
                            <label
                                htmlFor={`info-${field.key}`}
                                className="text-sm font-medium"
                            >
                                {field.label}
                            </label>

                            {field.multiline ? (
                                <textarea
                                    id={`info-${field.key}`}
                                    className="w-full rounded-md border bg-background p-3 text-sm"
                                    value={form[field.key]}
                                    rows={4}
                                    maxLength={field.max}
                                    onChange={(event) =>
                                        updateField(field.key, event.target.value)
                                    }
                                />
                            ) : (
                                <Input
                                    id={`info-${field.key}`}
                                    value={form[field.key]}
                                    maxLength={field.max}
                                    onChange={(event) =>
                                        updateField(field.key, event.target.value)
                                    }
                                />
                            )}
                        </div>
                    ))}

                    <div className="space-y-1">
                        <label
                            htmlFor="info-scoring"
                            className="text-sm font-medium"
                        >
                            Scoring Scale
                        </label>

                        <Input
                            id="info-scoring"
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            value={scoreText}
                            onChange={(event) =>
                                setScoreText(event.target.value)
                            }
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>

                        <Button type="submit" disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}