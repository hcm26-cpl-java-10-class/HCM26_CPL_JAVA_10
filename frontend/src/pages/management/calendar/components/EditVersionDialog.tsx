import { useEffect, useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type {
    CalendarVersionResponse,
    UpdateCalendarVersionRequest,
} from "@/types";

interface EditVersionDialogProps {
    version: CalendarVersionResponse | null;
    submitting: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (request: UpdateCalendarVersionRequest) => Promise<void>;
}

export function EditVersionDialog({
                                      version,
                                      submitting,
                                      onOpenChange,
                                      onSubmit,
                                  }: EditVersionDialogProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        setName(version?.name ?? "");
        setDescription(version?.description ?? "");
        setError("");
    }, [version]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!version) return;

        const request: UpdateCalendarVersionRequest = {};
        const originalName = version.name ?? "";
        const originalDescription = version.description ?? null;
        const nextDescription =
            description.trim() === "" ? null : description;

        if (name !== originalName) {
            if (!name.trim()) {
                setError("Name không được để trống.");
                return;
            }

            if (name.length > 150) {
                setError("Name không được dài quá 150 ký tự.");
                return;
            }

            request.name = name.trim();
        }

        if (nextDescription !== originalDescription) {
            if (nextDescription !== null && nextDescription.length > 500) {
                setError("Description không được dài quá 500 ký tự.");
                return;
            }

            request.description = nextDescription;
        }

        if (Object.keys(request).length === 0) {
            setError("Hãy thay đổi Name hoặc Description trước khi lưu.");
            return;
        }

        setError("");
        await onSubmit(request);
    };

    return (
        <Dialog
            open={version !== null}
            onOpenChange={(open) => {
                if (!open) onOpenChange(false);
            }}
        >
            <DialogContent>
                <form onSubmit={(event) => void handleSubmit(event)}>
                    <DialogHeader>
                        <DialogTitle>Edit calendar version</DialogTitle>
                        <DialogDescription>
                            Chỉnh sửa metadata của DRAFT v
                            {version?.versionNumber}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-5 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="calendar-version-name">Name</Label>
                            <Input
                                id="calendar-version-name"
                                value={name}
                                maxLength={150}
                                disabled={submitting}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="calendar-version-description">
                                Description
                            </Label>
                            <Textarea
                                id="calendar-version-description"
                                value={description}
                                maxLength={500}
                                rows={4}
                                disabled={submitting}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Để trống Description để xóa mô tả.
                            </p>
                        </div>

                        {error && (
                            <p role="alert" className="text-sm text-destructive">
                                {error}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="mt-5">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={submitting}
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}