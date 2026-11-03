import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { DetailGroup, DetailItem } from "@/components/common/DetailGrid";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ExternalClass } from "@/types";
import { programLabel } from "@/utils/class.utils";
import { formatDate } from "@/utils/session.utils";
import { ClassStatusBadge } from "./ClassStatusBadge";

/**
 * Class Info > General. Every label of the reference design is shown; the ones the master system's class API
 * does not return say "Not available" explicitly instead of being hidden or filled with made-up values.
 */
export function ClassInfoTab({ classItem }: { classItem: ExternalClass }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="space-y-3">
            <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-base font-semibold hover:bg-muted/40">
                    General
                    <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="grid gap-x-10 border-t px-4 py-1 md:grid-cols-2 xl:grid-cols-3">
                        <DetailGroup>
                            <DetailItem label="Class Name" unavailable={!classItem.name}>
                                {classItem.name}
                            </DetailItem>
                            <DetailItem label="Class Code" unavailable={!classItem.code}>
                                {classItem.code}
                            </DetailItem>
                            <DetailItem label="Delivery Type" unavailable={!classItem.deliveryType}>
                                {classItem.deliveryType}
                            </DetailItem>
                            <DetailItem label="Trainee Type" unavailable={!classItem.traineeType}>
                                {classItem.traineeType}
                            </DetailItem>
                            <DetailItem label="Format Type" unavailable={!classItem.formatType}>
                                {classItem.formatType}
                            </DetailItem>
                            <DetailItem label="Skills" unavailable={!classItem.skills}>
                                {classItem.skills}
                            </DetailItem>
                        </DetailGroup>

                        <DetailGroup>
                            <DetailItem label="Training Program" unavailable={!classItem.trainingProgram && classItem.programId == null}>
                                {classItem.trainingProgram || programLabel(classItem.programId)}
                            </DetailItem>
                            <DetailItem label="Site" unavailable={!classItem.site}>
                                {classItem.site}
                            </DetailItem>
                            <DetailItem label="Location" unavailable={!classItem.location}>
                                {classItem.location}
                            </DetailItem>
                            <DetailItem label="Expected Start Date" unavailable={!classItem.startDate}>
                                {formatDate(classItem.startDate)}
                            </DetailItem>
                            <DetailItem label="Expected End Date" unavailable={!classItem.endDate}>
                                {formatDate(classItem.endDate)}
                            </DetailItem>
                            <DetailItem label="Planned Trainee No." unavailable={classItem.plannedSize == null}>
                                {classItem.plannedSize}
                            </DetailItem>
                        </DetailGroup>

                        <DetailGroup>
                            <DetailItem label="Subject Type" unavailable={!classItem.subjectType}>
                                {classItem.subjectType}
                            </DetailItem>
                            <DetailItem label="Planned Revenue" unavailable={!classItem.plannedRevenue}>
                                {classItem.plannedRevenue}
                            </DetailItem>
                            <DetailItem label="Scope" unavailable={!classItem.scope}>
                                {classItem.scope}
                            </DetailItem>
                            <DetailItem label="Supplier / Partner" unavailable={!classItem.supplierPartner}>
                                {classItem.supplierPartner}
                            </DetailItem>
                            <DetailItem label="Key Program" unavailable={!classItem.keyProgram}>
                                {classItem.keyProgram}
                            </DetailItem>
                            <DetailItem label="Class Admin" unavailable={!classItem.classAdmin}>
                                {classItem.classAdmin}
                            </DetailItem>
                            <DetailItem label="Master Trainer" unavailable={!classItem.masterTrainer}>
                                {classItem.masterTrainer}
                            </DetailItem>
                            <DetailItem label="Status" unavailable={!classItem.status}>
                                <ClassStatusBadge status={classItem.status} />
                            </DetailItem>
                        </DetailGroup>
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <p className="text-xs text-muted-foreground">
                “Not available” means the master training system's class API does not return that field (it provides the code, name, program id,
                start / end dates, status and planned size). Nothing is guessed or stored locally.
            </p>
        </div>
    );
}
