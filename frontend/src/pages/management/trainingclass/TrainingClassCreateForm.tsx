import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EntitySchema } from "@/types";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormFieldRenderer } from "@/components/datatable/modal/form/FormFieldRenderer";
import { getOpenClassRequestOptions, getTrainingClassCreateOptions } from "@/api/features/schedule/training-class.api";
import { validateTrainingClassForm, changeTrainingClassField } from "./training-class-form";

interface Props {
    open: boolean;
    onClose: (open: boolean) => void;
    schema: EntitySchema;
    onSubmit: (data: Record<string, unknown>) => void;
    fieldErrors?: Record<string, string[]>;
    isSubmitting?: boolean;
}

export default function TrainingClassCreateForm({
                                                    open,
                                                    onClose,
                                                    schema,
                                                    onSubmit,
                                                    fieldErrors = {},
                                                    isSubmitting = false,
                                                }: Props) {
    const [form, setForm] = useState<Record<string, unknown>>({});
    const [requestId, setRequestId] = useState("");
    const [error, setError] = useState("");
    const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
    const errors = { ...fieldErrors, ...localErrors };
    const optionsQuery = useQuery({ queryKey: ["training-class-create-options"], queryFn: getTrainingClassCreateOptions, enabled: open });
    const locations = optionsQuery.data?.locations ?? [];

    const requestsQuery = useQuery({
        queryKey: ["training-class-request-options"],
        queryFn: getOpenClassRequestOptions,
        enabled: open,
        staleTime: 0,
    });

    useEffect(() => {
        if (open) {
            setForm({});
            setRequestId("");
            setError("");
            setLocalErrors({});
        }
    }, [open]);

    const requests = requestsQuery.data ?? [];

    const selectedRequest = requests.find(
        (request) => String(request.id) === requestId,
    );

    const fields = schema.fields.filter(
        (field) =>
            field.editable !== false &&
            field.name !== "programVersionId" &&
            field.name !== "openClassRequestId" &&
            field.type !== "dynamic" &&
            !field.dynamicChild,
    ).map((field) => field.name === "location" ? { ...field, type: "select" as const,
        disabled: !form.site || !optionsQuery.isSuccess,
        helpText: form.site ? "Choose a location at the selected site." : "Select a site first.",
        options: locations.filter((location) => location.site === form.site) } : field);

    const busy = isSubmitting;

    function save() {
        if (busy) return;

        if (!selectedRequest) {
            setError("Please select an approved open class request.");
            return;
        }

        setError("");

        const validation = validateTrainingClassForm(form, { locations });
        setLocalErrors(validation);
        if (Object.keys(validation).length) return;

        onSubmit({
            ...form,
            openClassRequestId: selectedRequest.id,
            programVersionId: selectedRequest.programVersionId,
        });
    }

    return (
        <Sheet
            open={open}
            onOpenChange={(nextOpen) => {
                if (!busy) {
                    onClose(nextOpen);
                }
            }}
        >
            <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader className="border-b">
                    <SheetTitle>Create Training Class</SheetTitle>
                    <SheetDescription>
                        Save Draft v1, then submit it for approval. The class stays in Planning until it is started.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-5 overflow-y-auto px-4 py-3">
                    {optionsQuery.isError && <p role="alert" className="text-sm text-destructive">Unable to load locations. Close this form and try again.</p>}
                    <fieldset
                        disabled={busy}
                        className="space-y-4 rounded-lg border bg-muted/30 p-4"
                    >
                        <p className="text-sm font-medium">
                            Class: Planning · Revision: Draft v1
                        </p>

                        <p className="text-xs text-muted-foreground">
                            Request and program options currently use demo data.
                        </p>

                        {requestsQuery.isPending && (
                            <p role="status">
                                Loading approved requests...
                            </p>
                        )}

                        {requestsQuery.isError && (
                            <div role="alert" className="space-y-2">
                                <p>Unable to load approved requests.</p>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        void requestsQuery.refetch()
                                    }
                                    disabled={requestsQuery.isFetching}
                                >
                                    Retry
                                </Button>
                            </div>
                        )}

                        {requestsQuery.isSuccess && (
                            <>
                                <FormFieldRenderer
                                    field={{
                                        name: "openClassRequestId",
                                        label: "Approved Request",
                                        type: "select",
                                        options: requests.map((request) => ({
                                            value: String(request.id),
                                            label: request.label,
                                        })),
                                    }}
                                    value={requestId}
                                    errorClass={
                                        fieldErrors.openClassRequestId?.length
                                            ? "border-destructive"
                                            : ""
                                    }
                                    fieldErrors={
                                        fieldErrors.openClassRequestId
                                    }
                                    onChange={(_name, value) => {
                                        if (busy) return;
                                        setRequestId(String(value));
                                        setError("");
                                    }}
                                />

                                {!requests.length && (
                                    <p role="status" className="text-sm">
                                        No eligible approved requests are available.
                                    </p>
                                )}
                            </>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="training-program">
                                Training Program
                            </Label>

                            <Input
                                id="training-program"
                                readOnly
                                value={selectedRequest?.programLabel ?? ""}
                                placeholder="Select a request first"
                            />

                            <p className="text-xs text-muted-foreground">
                                The program version follows the approved request.
                            </p>

                            {fieldErrors.programVersionId?.map(
                                (message, index) => (
                                    <p
                                        key={`${index}-${message}`}
                                        className="text-sm text-destructive"
                                    >
                                        {message}
                                    </p>
                                ),
                            )}
                        </div>
                    </fieldset>

                    <fieldset disabled={busy} className="space-y-4">
                        {fields.map((field) => (
                            <FormFieldRenderer
                                key={field.name}
                                field={field}
                                value={form[field.name] ?? ""}
                                errorClass={
                                        errors[field.name]?.length
                                        ? "border-destructive"
                                        : ""
                                }
                                fieldErrors={errors[field.name]}
                                onChange={(name, value) => {
                                    if (busy) return;

                                    setLocalErrors((previous) => {
                                        const next = { ...previous };
                                        delete next[name];
                                        return next;
                                    });

                                    setForm((previous) => changeTrainingClassField(previous, name, value, locations));
                                }}
                            />
                        ))}
                    </fieldset>

                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                </div>

                <SheetFooter className="border-t sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => onClose(false)}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="button"
                        onClick={save}
                        disabled={
                            busy ||
                            !requestsQuery.isSuccess ||
                            !optionsQuery.isSuccess ||
                            requestsQuery.isFetching ||
                            !selectedRequest
                        }
                    >
                        {busy ? "Saving..." : "Save Draft v1"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
