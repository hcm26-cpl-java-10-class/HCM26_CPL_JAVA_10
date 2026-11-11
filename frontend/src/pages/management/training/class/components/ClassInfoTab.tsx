import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ExternalClass } from "@/types";
import { programLabel } from "@/utils/class.utils";
import { formatDate } from "@/utils/session.utils";
import { ClassReadinessPanel } from "./ClassReadinessPanel";

interface InfoField {
    label: string;
    value?: ReactNode;
}

function displayValue(value?: ReactNode): ReactNode {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string" && value.trim() === "") return "—";
    return value;
}

export function ClassInfoTab({ classItem, onNavigate = () => {} }: { classItem: ExternalClass; onNavigate?: (tab: string) => void }) {
    const [open, setOpen] = useState(true);

    const trainingProgram =
        classItem.trainingProgram ||
        classItem.program ||
        (classItem.programId != null ? programLabel(classItem.programId) : undefined);

    const generalFields: InfoField[] = [
        // Row 1
        { label: "Class Name", value: classItem.name || classItem.code },
        { label: "Delivery Type", value: classItem.deliveryType },
        { label: "Trainee Type", value: classItem.traineeType },
        // Row 2
        { label: "Format Type", value: classItem.formatType },
        { label: "Skills", value: classItem.skills },
        { label: "Training Program", value: trainingProgram },
        // Row 3
        { label: "Site", value: classItem.site },
        { label: "Location", value: classItem.location },
        { label: "Expected Start Date", value: classItem.startDate ? formatDate(classItem.startDate) : undefined },
        // Row 4
        { label: "Expected End Date", value: classItem.endDate ? formatDate(classItem.endDate) : undefined },
        {
            label: "Planned Trainee No.",
            value: classItem.plannedSize != null ? String(classItem.plannedSize) : undefined,
        },
        { label: "Subject Type", value: classItem.subjectType },
        // Row 5
        { label: "Planned Revenue", value: classItem.plannedRevenue },
        { label: "Scope", value: classItem.scope },
        { label: "Supplier/Partner", value: classItem.supplierPartner },
        // Row 6
        { label: "Key Program", value: classItem.keyProgram },
        { label: "Global SE", value: classItem.globalSe },
        { label: "Job Recommendation", value: classItem.jobRecommendation },
    ];

    return (
        <div className="space-y-4">
            <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-lg border bg-card">
                <CollapsibleTrigger className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left text-sm font-semibold hover:bg-muted/50">
                    <span>General</span>
                    <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <dl className="grid grid-cols-1 border-t md:grid-cols-3">
                        {generalFields.map((field, index) => (
                            <div
                                key={field.label}
                                className={cn(
                                    "grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-baseline gap-3 border-b px-4 py-3 text-sm",
                                    "md:border-r md:[&:nth-child(3n)]:border-r-0",
                                    index >= generalFields.length - 3 && "md:border-b-0",
                                    index === generalFields.length - 1 && "border-b-0",
                                )}
                            >
                                <dt className="font-medium text-muted-foreground">{field.label}</dt>
                                <dd className="break-words font-semibold text-foreground">{displayValue(field.value)}</dd>
                            </div>
                        ))}
                    </dl>
                </CollapsibleContent>
            </Collapsible>
            <ClassReadinessPanel classItem={classItem} onNavigate={onNavigate} />
        </div>
    );
}

export default ClassInfoTab;
