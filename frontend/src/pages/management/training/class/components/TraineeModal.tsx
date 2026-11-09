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
    membershipOnly?: boolean;
    open: boolean;
    mode: TraineeModalMode;
    site?: string;
    trainee?: Trainee | null;
    existingTrainees: Trainee[];
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: TraineeFormInput) => void;
    onSwitchToEdit?: () => void;
}

export interface FptStudentIdSiteRule {
    siteCategory: "HCM" | "HN" | "OTHER";
    siteLabel: string;
    prefixes: readonly string[];
    pattern: RegExp;
    placeholder: string;
    formatHint: string;
    errorMessage: string;
}

const HCM_STUDENT_ID_RULE: FptStudentIdSiteRule = {
    siteCategory: "HCM",
    siteLabel: "HCM",
    prefixes: ["SE", "SS", "AI", "IA"],
    pattern: /^(?:SE|SS|AI|IA)\d{6}$/i,
    placeholder: "e.g. SE180101 (SE/SS/AI/IA + 6 digits)",
    formatHint: "HCM: SE / SS / AI / IA + 6 digits",
    errorMessage:
        "FPT Student ID for HCM site must be SE, SS, AI, or IA followed by 6 digits (e.g. SE180101).",
};

const HN_STUDENT_ID_RULE: FptStudentIdSiteRule = {
    siteCategory: "HN",
    siteLabel: "HN",
    prefixes: ["HE", "HS", "AI", "IA"],
    pattern: /^(?:HE|HS|AI|IA)\d{6}$/i,
    placeholder: "e.g. HE180101 (HE/HS/AI/IA + 6 digits)",
    formatHint: "HN: HE / HS / AI / IA + 6 digits",
    errorMessage:
        "FPT Student ID for HN site must be HE, HS, AI, or IA followed by 6 digits (e.g. HE180101).",
};

const OTHER_SITE_STUDENT_ID_RULE: FptStudentIdSiteRule = {
    siteCategory: "OTHER",
    siteLabel: "Other Site",
    prefixes: ["DE"],
    pattern: /^DE\d{6}$/i,
    placeholder: "e.g. DE180101 (DE + 6 digits)",
    formatHint: "DE + 6 digits",
    errorMessage: "FPT Student ID for this site must be DE followed by 6 digits (e.g. DE180101).",
};

export function getFptStudentIdRuleBySite(site?: string): FptStudentIdSiteRule {
    const normalized = (site ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    if (
        !normalized ||
        normalized.includes("hcm") ||
        normalized.includes("ho chi minh") ||
        normalized.includes("sai gon") ||
        normalized.includes("saigon")
    ) {
        return HCM_STUDENT_ID_RULE;
    }

    if (normalized.includes("hn") || normalized.includes("ha noi") || normalized.includes("hanoi")) {
        return HN_STUDENT_ID_RULE;
    }

    return OTHER_SITE_STUDENT_ID_RULE;
}

export function formatFptStudentIdForSite(rawValue?: string, site?: string, traineeId = 1): string {
    const rule = getFptStudentIdRuleBySite(site);
    const cleaned = (rawValue ?? "").trim().toUpperCase();

    if (rule.pattern.test(cleaned)) {
        return cleaned;
    }

    const codeMatch = /^([A-Z]{2})(\d{6})$/.exec(cleaned);
    if (codeMatch) {
        const [, prefix, digits] = codeMatch;
        if (rule.prefixes.includes(prefix)) {
            return `${prefix}${digits}`;
        }
        if (rule.siteCategory === "HN") {
            const mapped = prefix === "SE" ? "HE" : prefix === "SS" ? "HS" : rule.prefixes[0];
            return `${mapped}${digits}`;
        }
        if (rule.siteCategory === "HCM") {
            const mapped = prefix === "HE" ? "SE" : prefix === "HS" ? "SS" : rule.prefixes[0];
            return `${mapped}${digits}`;
        }
        return `DE${digits}`;
    }

    if (!cleaned) return "";

    const absId = Math.abs(traineeId || 1);
    const prefix = rule.prefixes[(absId - 1) % rule.prefixes.length];
    const numberPart = String(180000 + (absId % 100000)).padStart(6, "0");
    return `${prefix}${numberPart}`;
}

const GENDER_OPTIONS: TraineeGender[] = ["Male", "Female", "Other"];
const STATUS_OPTIONS: TraineeStatus[] = ["Active", "Inactive", "Dropped Out"];

export const MAX_TRAINEE_NAME_LENGTH = 100;
export const MIN_TRAINEE_AGE_YEARS = 17;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NATIONAL_ID_PATTERN = /^\d{9,12}$/;

export function getMaxAllowedDobDateString(referenceDate: Date = new Date()): string {
    const cutoffYear = referenceDate.getFullYear() - MIN_TRAINEE_AGE_YEARS;
    const month = referenceDate.getMonth();
    const day = referenceDate.getDate();
    const cutoff = new Date(cutoffYear, month, day);
    // Handle Feb 29 on a leap year when reference year - 17 is not a leap year
    if (cutoff.getMonth() !== month) {
        cutoff.setDate(0);
    }
    const yyyy = String(cutoff.getFullYear()).padStart(4, "0");
    const mm = String(cutoff.getMonth() + 1).padStart(2, "0");
    const dd = String(cutoff.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export function isDobAtLeastMinAge(
    dobStr: string,
    minAgeYears: number = MIN_TRAINEE_AGE_YEARS,
    referenceDate: Date = new Date(),
): boolean {
    const trimmed = dobStr.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (!match) return false;
    const birthYear = Number(match[1]);
    const birthMonth = Number(match[2]) - 1;
    const birthDay = Number(match[3]);
    const birthDate = new Date(birthYear, birthMonth, birthDay);
    if (
        Number.isNaN(birthDate.getTime()) ||
        birthDate.getFullYear() !== birthYear ||
        birthDate.getMonth() !== birthMonth ||
        birthDate.getDate() !== birthDay
    ) {
        return false;
    }

    let age = referenceDate.getFullYear() - birthYear;
    const monthDiff = referenceDate.getMonth() - birthMonth;
    if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDay)) {
        age -= 1;
    }
    return age >= minAgeYears;
}

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

function toInitialFormValues(trainee?: Trainee | null, site?: string): TraineeFormInput {
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
        fptAccount: formatFptStudentIdForSite(trainee.fptAccount ?? trainee.code, site, trainee.id),
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
    site?: string,
    editingId?: number,
): FormErrors {
    const errors: FormErrors = {};
    const peers = existingTrainees.filter((item) => item.id !== editingId);
    const studentIdRule = getFptStudentIdRuleBySite(site);

    const fullName = values.fullName.trim();
    if (!fullName) {
        errors.fullName = "Full Name is required.";
    } else if (values.fullName.length > MAX_TRAINEE_NAME_LENGTH) {
        errors.fullName = `Full Name must not exceed ${MAX_TRAINEE_NAME_LENGTH} characters.`;
    }

    const studentId = values.fptAccount.trim().toUpperCase();
    if (!studentId) {
        errors.fptAccount = "FPT Student ID is required.";
    } else if (!studentIdRule.pattern.test(studentId)) {
        errors.fptAccount = studentIdRule.errorMessage;
    } else if (
        peers.some(
            (item) =>
                formatFptStudentIdForSite(item.fptAccount ?? item.code, site, item.id).toUpperCase() ===
                studentId,
        )
    ) {
        errors.fptAccount = "FPT Student ID already exists in this class.";
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

    const dob = (values.dob ?? "").trim();
    if (!dob) {
        errors.dob = "Date of Birth is required.";
    } else if (!isDobAtLeastMinAge(dob, MIN_TRAINEE_AGE_YEARS)) {
        errors.dob = `Trainee must be at least ${MIN_TRAINEE_AGE_YEARS} years old (University level).`;
    }

    return errors;
}

function TraineeProfileBody({
    trainee,
    site,
    onClose,
    onSwitchToEdit,
    membershipOnly,
}: {
    trainee: Trainee;
    site?: string;
    onClose: () => void;
    onSwitchToEdit?: () => void;
    membershipOnly?: boolean;
}) {
    const badge = resolveTraineeStatusBadge(trainee.status);
    const studentId = membershipOnly ? trainee.fptAccount || trainee.code || "" : formatFptStudentIdForSite(trainee.fptAccount || trainee.code, site, trainee.id);
    const fields: Array<{ label: string; value: string }> = [
        { label: "Full Name", value: trainee.fullName || "—" },
        { label: "FPT Student ID", value: studentId || "—" },
        { label: "Personal Email", value: trainee.personalEmail || trainee.email || "—" },
        { label: "National ID", value: trainee.nationalId || "—" },
        { label: "DOB", value: trainee.dob ? formatDate(trainee.dob) : "—" },
        { label: "Gender", value: trainee.gender || "—" },
    ];

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-3">
                <div>
                    <p className="text-base font-semibold text-foreground">{trainee.fullName || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                        FPT Student ID: {studentId || "—"}
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
    site,
    trainee,
    existingTrainees,
    onClose,
    onSubmit,
}: {
    mode: "create" | "edit";
    site?: string;
    trainee?: Trainee | null;
    existingTrainees: Trainee[];
    onClose: () => void;
    onSubmit: (values: TraineeFormInput) => void;
}) {
    const [values, setValues] = useState<TraineeFormInput>(() => toInitialFormValues(trainee, site));
    const [errors, setErrors] = useState<FormErrors>({});
    const studentIdRule = getFptStudentIdRuleBySite(site);
    const maxAllowedDob = getMaxAllowedDobDateString();

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
        const validationErrors = validateTraineeForm(values, existingTrainees, site, trainee?.id);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        onSubmit({
            fullName: values.fullName.trim(),
            fptAccount: values.fptAccount.trim().toUpperCase(),
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
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="trainee-full-name">
                            Full Name <span className="text-destructive">*</span>
                        </Label>
                        <span className="text-[11px] font-medium text-muted-foreground">
                            {values.fullName.length}/{MAX_TRAINEE_NAME_LENGTH}
                        </span>
                    </div>
                    <Input
                        id="trainee-full-name"
                        placeholder="e.g. Hoàng Phương Bình"
                        maxLength={MAX_TRAINEE_NAME_LENGTH}
                        value={values.fullName}
                        aria-invalid={Boolean(errors.fullName)}
                        onChange={(e) =>
                            updateField("fullName", e.target.value.slice(0, MAX_TRAINEE_NAME_LENGTH))
                        }
                    />
                    {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName}</p> : null}
                </div>

                {/* 2. FPT Student ID */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="trainee-fpt-account">
                            FPT Student ID <span className="text-destructive">*</span>
                        </Label>
                        <span className="text-[11px] font-medium text-muted-foreground">
                            {studentIdRule.formatHint}
                        </span>
                    </div>
                    <Input
                        id="trainee-fpt-account"
                        placeholder={studentIdRule.placeholder}
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

                {/* 5. DOB */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="trainee-dob">
                            DOB <span className="text-destructive">*</span>
                        </Label>
                        <span className="text-[11px] font-medium text-muted-foreground">
                            {values.dob ? formatDate(values.dob) : `Min ${MIN_TRAINEE_AGE_YEARS} years old`}
                        </span>
                    </div>
                    <Input
                        id="trainee-dob"
                        type="date"
                        max={maxAllowedDob}
                        value={values.dob ?? ""}
                        aria-invalid={Boolean(errors.dob)}
                        onChange={(e) => updateField("dob", e.target.value)}
                    />
                    {errors.dob ? <p className="text-xs text-destructive">{errors.dob}</p> : null}
                </div>

                {/* 6. Gender */}
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

                {/* 7. Status */}
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

function MembershipFormBody({ trainee, existingTrainees, onSubmit, onClose }: {
    trainee?: Trainee | null; existingTrainees: Trainee[]; onSubmit: (input: TraineeFormInput) => void; onClose: () => void;
}) {
    const [studentId, setStudentId] = useState(trainee?.fptAccount ?? trainee?.code ?? "");
    const [fullName, setFullName] = useState(trainee?.fullName ?? "");
    const [status, setStatus] = useState<TraineeStatus>(normalizeTraineeStatus(trainee?.status));
    const [error, setError] = useState("");
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const code = studentId.trim().toUpperCase();
        if (!trainee && (!/^[A-Z0-9_-]{2,64}$/.test(code) || !fullName.trim() || fullName.trim().length > 100)) {
            setError("Provide the existing Student ID and Full Name (maximum 100 characters)."); return;
        }
        if (!trainee && existingTrainees.some(row => (row.fptAccount ?? row.code ?? "").toUpperCase() === code)) {
            setError("Student is already enrolled in this class."); return;
        }
        onSubmit({ fptAccount: code, fullName: fullName.trim(), personalEmail: trainee?.personalEmail ?? trainee?.email ?? "",
            nationalId: trainee?.nationalId ?? "", dob: trainee?.dob ?? "", gender: normalizeTraineeGender(trainee?.gender),
            status: trainee ? status : "Active" });
    };
    return <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">Only an existing active master student can be enrolled. Personal profiles are read-only; Save Changes verifies the identity with the backend.</p>
        <div className="space-y-2"><Label htmlFor="enrollment-student-id">FPT Student ID *</Label>
            <Input id="enrollment-student-id" value={studentId} readOnly={!!trainee} maxLength={64} onChange={event => setStudentId(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="enrollment-full-name">Full Name *</Label>
            <Input id="enrollment-full-name" value={fullName} readOnly={!!trainee} maxLength={100} onChange={event => setFullName(event.target.value)} /></div>
        {trainee && <div className="space-y-2"><Label htmlFor="enrollment-status">Enrollment Status</Label>
            <NativeSelect id="enrollment-status" value={status} onChange={event => setStatus(event.target.value as TraineeStatus)}>
                {STATUS_OPTIONS.map(value => <option key={value}>{value}</option>)}
            </NativeSelect></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{trainee ? "Update Trainee" : "Add Trainee"}</Button></DialogFooter>
    </form>;
}

export function TraineeModal({
    membershipOnly = false,
    open,
    mode,
    site,
    trainee,
    existingTrainees,
    onOpenChange,
    onSubmit,
    onSwitchToEdit,
}: TraineeModalProps) {
    const title =
        mode === "create" ? (membershipOnly ? "Enroll Existing Trainee" : "Add New Trainee")
            : mode === "edit" ? (membershipOnly ? "Edit Enrollment" : "Edit Trainee") : "Trainee Profile";
    const description =
        membershipOnly ? "Enroll an existing student or update their enrollment status. Personal profile information is managed in the master directory."
            : mode === "create"
            ? "Fill in trainee details to add them to the class list. Click Save Changes to persist."
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
                        membershipOnly={membershipOnly}
                        trainee={trainee}
                        site={site}
                        onClose={() => onOpenChange(false)}
                        onSwitchToEdit={onSwitchToEdit}
                    />
                ) : membershipOnly ? (
                    <MembershipFormBody key={`${mode}-${trainee?.id ?? "new"}-${open}`} trainee={trainee}
                        existingTrainees={existingTrainees} onSubmit={onSubmit} onClose={() => onOpenChange(false)} />
                ) : (
                    <TraineeFormBody
                        key={`${mode}-${trainee?.id ?? "new"}-${site ?? ""}-${open ? "open" : "closed"}`}
                        mode={mode === "edit" ? "edit" : "create"}
                        site={site}
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
