import { Pencil } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { TraineeFormInput, TraineeGender, TraineeStatus } from "@/api/features/trainee.api";
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
import { cn } from "@/lib/utils";
import type { Trainee } from "@/types";
import { formatDate, splitLocalDateTime } from "@/utils/session.utils";

export type TraineeModalMode = "create" | "edit" | "view";

export interface TraineeModalProps {
    open: boolean;
    mode: TraineeModalMode;
    trainee?: Trainee | null;
    existingTrainees: Trainee[];
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: TraineeFormInput) => void;
    onSwitchToEdit?: () => void;
}

const GENDER_OPTIONS: TraineeGender[] = ["Male", "Female", "Other"];
const STATUS_OPTIONS: TraineeStatus[] = ["Active", "Inactive", "Dropped Out"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCOUNT_PATTERN = /^[A-Za-z0-9._-]{2,50}$/;
const NATIONAL_ID_PATTERN = /^\d{9,12}$/;

export function normalizeTraineeGender(gender?: string): TraineeGender {
    const normalized = (gender ?? "").trim().toLowerCase();
    if (normalized === "female") return "Female";
    if (normalized === "other") return "Other";
    return "Male";
}

export function normalizeTraineeStatus(status?: string): TraineeStatus {
    const normalized = (status ?? "").trim().toLowerCase();
    if (normalized === "inactive") return "Inactive";
    if (normalized === "dropped" || normalized === "drop-out" || normalized === "dropped out") {
        return "Dropped Out";
    }
    return "Active";
}

export function resolveTraineeStatusBadge(status?: string) {
    const normalized = (status ?? "Active").trim().toLowerCase();

    if (!normalized || normalized === "active" || normalized === "studying") {
        return {
            label: "Active",
            className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300",
        };
    }

    if (normalized === "inactive") {
        return {
            label: "Inactive",
            className: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300",
        };
    }

    if (normalized === "dropped" || normalized === "drop-out" || normalized === "dropped out") {
        return {
            label: "Dropped Out",
            className: "bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300",
        };
    }

    const raw = (status ?? "").trim();
    return {
        label: raw.charAt(0).toUpperCase() + raw.slice(1),
        className: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300",
    };
}

function toInitialFormValues(trainee?: Trainee | null): TraineeFormInput {
    if (!trainee) {
        return {
            fullName: "",
            fptAccount: "",
            personalEmail: "",
            nationalId: "",
            employeeId: "",
            accessCardId: "",
            dob: "",
            gender: "Male",
            status: "Active",
        };
    }

    return {
        fullName: trainee.fullName ?? "",
        fptAccount: trainee.fptAccount ?? trainee.code ?? "",
        personalEmail: trainee.personalEmail ?? trainee.email ?? "",
        nationalId: trainee.nationalId ?? "",
        employeeId: trainee.employeeId ?? "",
        accessCardId: trainee.accessCardId ?? "",
        dob: trainee.dob ? splitLocalDateTime(trainee.dob).date : "",
        gender: normalizeTraineeGender(trainee.gender),
        status: normalizeTraineeStatus(trainee.status),
    };
}

type FormFieldKey = keyof TraineeFormInput;
type FormErrors = Partial<Record<FormFieldKey, string>>;

function validateTraineeForm(
    values: TraineeFormInput,
    existingTrainees: Trainee[],
    editingId?: number,
): FormErrors {
    const errors: FormErrors = {};
    const peers = existingTrainees.filter((item) => item.id !== editingId);

    const fullName = values.fullName.trim();
    if (!fullName) {
        errors.fullName = "Full Name is required.";
    }

    const account = values.fptAccount.trim();
    if (!account) {
        errors.fptAccount = "FPT Student Account is required.";
    } else if (!ACCOUNT_PATTERN.test(account)) {
        errors.fptAccount = "Account must be 2–50 letters, numbers, dots, underscores, or hyphens.";
    } else if (
        peers.some((item) => (item.fptAccount ?? item.code ?? "").trim().toLowerCase() === account.toLowerCase())
    ) {
        errors.fptAccount = "FPT Student Account already exists in this class.";
    }

    const email = values.personalEmail.trim();
    if (!email) {
        errors.personalEmail = "Personal Email is required.";
    } else if (!EMAIL_PATTERN.test(email)) {
        errors.personalEmail = "Please enter a valid email address.";
    } else if (
        peers.some((item) => (item.personalEmail ?? item.email ?? "").trim().toLowerCase() === email.toLowerCase())
    ) {
        errors.personalEmail = "Personal Email already exists in this class.";
    }

    const nationalId = values.nationalId.trim();
    if (!nationalId) {
        errors.nationalId = "National ID is required.";
    } else if (!NATIONAL_ID_PATTERN.test(nationalId)) {
        errors.nationalId = "National ID must be 9 to 12 digits.";
    } else if (peers.some((item) => (item.nationalId ?? "").trim() === nationalId)) {
        errors.nationalId = "National ID already exists in this class.";
    }

    return errors;
}

function TraineeProfileBody({
    trainee,
    onClose,
    onSwitchToEdit,
}: {
    trainee: Trainee;
    onClose: () => void;
    onSwitchToEdit?: () => void;
}) {
    const badge = resolveTraineeStatusBadge(trainee.status);
    const fields: Array<{ label: string; value: string }> = [
        { label: "Full Name", value: trainee.fullName || "—" },
        { label: "FPT Student Account", value: trainee.fptAccount || trainee.code || "—" },
        { label: "Personal Email", value: trainee.personalEmail || trainee.email || "—" },
        { label: "National ID", value: trainee.nationalId || "—" },
        { label: "Employee ID", value: trainee.employeeId || "—" },
        { label: "Access Card ID", value: trainee.accessCardId || "—" },
        { label: "DOB", value: trainee.dob ? formatDate(trainee.dob) : "—" },
        { label: "Gender", value: trainee.gender || "—" },
    ];

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-3">
                <div>
                    <p className="text-base font-semibold text-foreground">{trainee.fullName || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                        Account: {trainee.fptAccount || trainee.code || "—"}
                    </p>
                </div>
                <Badge variant="secondary" className={cn("rounded-full px-3 py-0.5 text-xs font-medium", badge.className)}>
                    {badge.label}
                </Badge>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 py-1 sm:grid-cols-2">
                {fields.map(({ label, value }) => (
                    <div key={label} className="rounded-md border px-3 py-2">
                        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 text-sm font-medium text-foreground break-all">{value}</dd>
                    </div>
                ))}
            </dl>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Close
                </Button>
                {onSwitchToEdit ? (
                    <Button
                        type="button"
                        className="bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500"
                        onClick={onSwitchToEdit}
                    >
                        <Pencil className="size-4" aria-hidden /> Edit
                    </Button>
                ) : null}
            </DialogFooter>
        </>
    );
}

function TraineeFormBody({
    mode,
    trainee,
    existingTrainees,
    onClose,
    onSubmit,
}: {
    mode: "create" | "edit";
    trainee?: Trainee | null;
    existingTrainees: Trainee[];
    onClose: () => void;
    onSubmit: (values: TraineeFormInput) => void;
}) {
    const [values, setValues] = useState<TraineeFormInput>(() => toInitialFormValues(trainee));
    const [errors, setErrors] = useState<FormErrors>({});

    const updateField = <K extends FormFieldKey>(field: K, value: TraineeFormInput[K]) => {
        setValues((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const validationErrors = validateTraineeForm(values, existingTrainees, trainee?.id);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        onSubmit({
            fullName: values.fullName.trim(),
            fptAccount: values.fptAccount.trim(),
            personalEmail: values.personalEmail.trim(),
            nationalId: values.nationalId.trim(),
            employeeId: (values.employeeId ?? "").trim(),
            accessCardId: (values.accessCardId ?? "").trim(),
            dob: values.dob ?? "",
            gender: values.gender,
            status: values.status,
        });
    };

    return (
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* 1. Full Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="trainee-full-name">
                        Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="trainee-full-name"
                        placeholder="e.g. Hoàng Phương Bình"
                        value={values.fullName}
                        aria-invalid={Boolean(errors.fullName)}
                        onChange={(e) => updateField("fullName", e.target.value)}
                    />
                    {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName}</p> : null}
                </div>

                {/* 2. FPT Student Account */}
                <div className="space-y-1.5">
                    <Label htmlFor="trainee-fpt-account">
                        FPT Student Account <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="trainee-fpt-account"
                        placeholder="e.g. binhhp1"
                        value={values.fptAccount}
                        aria-invalid={Boolean(errors.fptAccount)}
                        onChange={(e) => updateField("fptAccount", e.target.value)}
                    />
                    {errors.fptAccount ? <p className="text-xs text-destructive">{errors.fptAccount}</p> : null}
                </div>

                {/* 3. Personal Email */}
                <div className="space-y-1.5">
                    <Label htmlFor="trainee-personal-email">
                        Personal Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="trainee-personal-email"
                        type="email"
                        placeholder="e.g. phuongbinh.conan@gmail.com"
                        value={values.personalEmail}
                        aria-invalid={Boolean(errors.personalEmail)}
                        onChange={(e) => updateField("personalEmail", e.target.value)}
                    />
                    {errors.personalEmail ? <p className="text-xs text-destructive">{errors.personalEmail}</p> : null}
                </div>

                {/* 4. National ID */}
                <div className="space-y-1.5">
                    <Label htmlFor="trainee-national-id">
                        National ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="trainee-national-id"
                        placeholder="e.g. 075204005839"
                        value={values.nationalId}
                        aria-invalid={Boolean(errors.nationalId)}
                        onChange={(e) => updateField("nationalId", e.target.value)}
                    />
                    {errors.nationalId ? <p className="text-xs text-destructive">{errors.nationalId}</p> : null}
                </div>

                {/* 5. Employee ID */}
                <div className="space-y-1.5">
                    <Label htmlFor="trainee-employee-id">Employee ID</Label>
                    <Input
                        id="trainee-employee-id"
                        placeholder="e.g. FPT26081"
                        value={values.employeeId ?? ""}
                        onChange={(e) => updateField("employeeId", e.target.value)}
                    />
                </div>

                {/* 6. Access Card ID */}
                <div className="space-y-1.5">
                    <Label htmlFor="trainee-access-card-id">Access Card ID</Label>
                    <Input
                        id="trainee-access-card-id"
                        placeholder="e.g. AC-88201"
                        value={values.accessCardId ?? ""}
                        onChange={(e) => updateField("accessCardId", e.target.value)}
                    />
                </div>

                {/* 7. DOB */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="trainee-dob">DOB</Label>
                        {values.dob ? (
                            <span className="text-xs text-muted-foreground">{formatDate(values.dob)}</span>
                        ) : null}
                    </div>
                    <Input
                        id="trainee-dob"
                        type="date"
                        value={values.dob ?? ""}
                        onChange={(e) => updateField("dob", e.target.value)}
                    />
                </div>

                {/* 8. Gender */}
                <div className="space-y-1.5">
                    <Label htmlFor="trainee-gender">Gender</Label>
                    <NativeSelect
                        id="trainee-gender"
                        value={values.gender}
                        onChange={(e) => updateField("gender", e.target.value as TraineeGender)}
                    >
                        {GENDER_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </NativeSelect>
                </div>

                {/* 9. Status */}
                <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="trainee-status">Status</Label>
                    <NativeSelect
                        id="trainee-status"
                        value={values.status}
                        onChange={(e) => updateField("status", e.target.value as TraineeStatus)}
                    >
                        {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </NativeSelect>
                </div>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    className="bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                    {mode === "create" ? "Add Trainee" : "Update Trainee"}
                </Button>
            </DialogFooter>
        </form>
    );
}

export function TraineeModal({
    open,
    mode,
    trainee,
    existingTrainees,
    onOpenChange,
    onSubmit,
    onSwitchToEdit,
}: TraineeModalProps) {
    const title =
        mode === "create" ? "Add New Trainee" : mode === "edit" ? "Edit Trainee" : "Trainee Profile";
    const description =
        mode === "create"
            ? "Fill in trainee details to add them to the class list. Click Save Changes on the toolbar to persist."
            : mode === "edit"
              ? "Modify trainee information. Changes are staged locally until you click Save Changes."
              : "Detailed personal and enrollment profile of the selected trainee.";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {mode === "view" && trainee ? (
                    <TraineeProfileBody
                        trainee={trainee}
                        onClose={() => onOpenChange(false)}
                        onSwitchToEdit={onSwitchToEdit}
                    />
                ) : (
                    <TraineeFormBody
                        key={`${mode}-${trainee?.id ?? "new"}-${open ? "open" : "closed"}`}
                        mode={mode === "edit" ? "edit" : "create"}
                        trainee={trainee}
                        existingTrainees={existingTrainees}
                        onClose={() => onOpenChange(false)}
                        onSubmit={onSubmit}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

export default TraineeModal;

