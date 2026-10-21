import type { TrainingClassLocationOption } from "@/api/features/schedule/training-class.api";

export const TRAINING_CLASS_LIMITS = { text: 255, description: 2000, minCapacity: 1, maxCapacity: 50 } as const;

export function changeTrainingClassField(data: Record<string, unknown>, name: string, value: unknown,
    locations: TrainingClassLocationOption[]) {
    const next = { ...data, [name]: value };
    if (name === "site" && !locations.some((location) => location.site === value && location.value === data.location)) {
        next.location = "";
    }
    return next;
}

export function validateTrainingClassForm(data: Record<string, unknown>, context?: {
    locations?: TrainingClassLocationOption[];
    classStatus?: string;
    originalStartDate?: string;
}) {
    const errors: Record<string, string[]> = {};
    const required = {
        code: "Class code", name: "Class name", site: "Site",
        traineeType: "Trainee type", deliveryFormat: "Delivery format",
        location: "Location", startDate: "Start date", endDate: "End date",
    };
    for (const [field, label] of Object.entries(required)) {
        const value = String(data[field] ?? "").trim();
        if (!value) errors[field] = [`${label} is required.`];
        else if (!["startDate", "endDate"].includes(field) && String(data[field] ?? "").length > TRAINING_CLASS_LIMITS.text) {
            errors[field] = [`${label} must not exceed 255 characters.`];
        }
    }
    const capacity = Number(data.capacity);
    if (!/^\d+$/.test(String(data.capacity ?? "")) || !Number.isSafeInteger(capacity)
        || capacity < TRAINING_CLASS_LIMITS.minCapacity || capacity > TRAINING_CLASS_LIMITS.maxCapacity) {
        errors.capacity = ["Capacity must be a whole number from 1 to 50."];
    }
    const start = String(data.startDate ?? "");
    const end = String(data.endDate ?? "");
    for (const [field, value] of [["startDate", start], ["endDate", end]]) {
        if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value)
            || Number.isNaN(Date.parse(value))
            || new Date(value).toISOString().slice(0, 10) !== value)) {
            errors[field] = ["Enter a valid date."];
        }
    }
    if (!errors.startDate && !errors.endDate && end < start) {
        errors.endDate = ["End date must not be before start date."];
    }
    if (context?.classStatus === "ONGOING" && start !== context.originalStartDate) {
        errors.startDate = ["Start date cannot be changed after a class is Ongoing."];
    }
    if (context?.locations && data.site && data.location
        && !context.locations.some((location) => location.site === data.site && location.value === data.location)) {
        errors.location = ["Select a valid location for the selected site."];
    }
    if (String(data.description ?? "").length > TRAINING_CLASS_LIMITS.description) {
        errors.description = ["Description must not exceed 2000 characters."];
    }
    return errors;
}
