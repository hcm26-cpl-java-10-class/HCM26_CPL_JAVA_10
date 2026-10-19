import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CreateCalendarVersionRequest } from "@/types";
import { Copy, FilePlus2, X } from "lucide-react";

interface CreateVersionDialogProps {
    open: boolean;
    calendarName: string;
    hasActiveVersion: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (request: CreateCalendarVersionRequest) => Promise<void>;
}

export function CreateVersionDialog({
                                        open,
                                        calendarName,
                                        hasActiveVersion,
                                        onOpenChange,
                                        onSubmit,
                                    }: CreateVersionDialogProps) {
    const [mode, setMode] =
        useState<CreateCalendarVersionRequest["mode"]>("EMPTY");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setMode("EMPTY");
            setName("");
            setDescription("");
            setError("");
        }
    }, [open]);

    if (!open) {
        return null;
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const trimmedName = name.trim();
        const trimmedDescription = description.trim();

        if (!trimmedName) {
            setError("Name is required.");
            return;
        }

        if (trimmedName.length > 150) {
            setError("Name must be at most 150 characters.");
            return;
        }

        if (trimmedDescription.length > 500) {
            setError("Description must be at most 500 characters.");
            return;
        }

        if (mode === "COPY_ACTIVE" && !hasActiveVersion) {
            setError("There is no active version to copy.");
            return;
        }

        setError("");
        setSubmitting(true);

        try {
            await onSubmit({
                mode,
                name: trimmedName,
                description: trimmedDescription || null,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !submitting) {
                    onOpenChange(false);
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-version-title"
                className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl"
            >
                <form onSubmit={(event) => void handleSubmit(event)}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2
                                id="create-version-title"
                                className="text-xl font-semibold"
                            >
                                Create calendar version
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Calendar: {calendarName}
                            </p>
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Close dialog"
                            disabled={submitting}
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="size-4" />
                        </Button>
                    </div>

                    <fieldset
                        disabled={submitting}
                        className="mt-6 space-y-3"
                    >
                        <legend className="mb-3 text-sm font-medium">
                            Choose how to initialize the draft
                        </legend>

                        <label
                            className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${
                                mode === "EMPTY"
                                    ? "border-primary bg-primary/5"
                                    : ""
                            }`}
                        >
                            <input
                                type="radio"
                                name="creationMode"
                                value="EMPTY"
                                checked={mode === "EMPTY"}
                                onChange={() => setMode("EMPTY")}
                                className="mt-1"
                            />

                            <span className="flex-1">
                                <span className="flex items-center gap-2 font-medium">
                                    <FilePlus2 className="size-4" />
                                    Empty draft
                                </span>
                                <span className="mt-1 block text-sm text-muted-foreground">
                                    Create a draft without copying the active
                                    version.
                                </span>
                            </span>
                        </label>

                        <label
                            className={`flex gap-3 rounded-xl border p-4 ${
                                hasActiveVersion
                                    ? "cursor-pointer"
                                    : "cursor-not-allowed opacity-50"
                            } ${
                                mode === "COPY_ACTIVE"
                                    ? "border-primary bg-primary/5"
                                    : ""
                            }`}
                        >
                            <input
                                type="radio"
                                name="creationMode"
                                value="COPY_ACTIVE"
                                checked={mode === "COPY_ACTIVE"}
                                disabled={!hasActiveVersion}
                                onChange={() => setMode("COPY_ACTIVE")}
                                className="mt-1"
                            />

                            <span className="flex-1">
                                <span className="flex items-center gap-2 font-medium">
                                    <Copy className="size-4" />
                                    Copy active version
                                </span>
                                <span className="mt-1 block text-sm text-muted-foreground">
                                    Initialize the draft using the active
                                    version&apos;s content.
                                </span>

                                {!hasActiveVersion && (
                                    <span className="mt-2 block text-xs text-destructive">
                                        Unavailable because this calendar has
                                        no active version.
                                    </span>
                                )}
                            </span>
                        </label>
                    </fieldset>

                    <div className="mt-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="create-version-name">Name</Label>
                            <Input
                                id="create-version-name"
                                value={name}
                                maxLength={150}
                                disabled={submitting}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="create-version-description">
                                Description
                            </Label>
                            <Textarea
                                id="create-version-description"
                                value={description}
                                maxLength={500}
                                rows={4}
                                disabled={submitting}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Description is optional. Leave blank to create
                                without one.
                            </p>
                        </div>

                        {error && (
                            <p role="alert" className="text-sm text-destructive">
                                {error}
                            </p>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={submitting}
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            disabled={
                                submitting ||
                                (mode === "COPY_ACTIVE" && !hasActiveVersion)
                            }
                        >
                            {submitting ? "Creating..." : "Create draft"}
                        </Button>
                    </div>
                </form>
            </section>
        </div>
    );
}