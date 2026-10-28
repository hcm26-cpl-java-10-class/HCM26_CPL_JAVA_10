import type { SubjectDTO } from "@/types/features/subject";
import { wordLimitError } from "../../../components/datatable/util/word-count.ts";

export type SubjectFormValues = Partial<Omit<SubjectDTO, "durationHours" | "deliveryMode">> & {
  durationHours: number | "";
  deliveryMode?: SubjectDTO["deliveryMode"] | "";
};

export function subjectDefaults(subject?: SubjectDTO | null): SubjectFormValues {
  return {
    code: subject?.code ?? "", name: subject?.name ?? "", version: subject?.version ?? "",
    technicalGroup: subject?.technicalGroup ?? "", durationHours: subject?.durationHours ?? "",
    description: subject?.description ?? "", objectives: subject?.objectives ?? "", skills: subject?.skills ?? "",
    deliveryMode: subject?.deliveryMode ?? "", outline: subject?.outline ?? "", isActive: subject?.isActive ?? true,
  };
}

export function validateSubject(values: SubjectFormValues): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const [field, label] of [["code", "Code"], ["name", "Name"], ["version", "Version"]] as const) {
    if (!values[field]?.trim()) errors[field] = [`${label} is required.`];
  }
  if (!Number.isInteger(values.durationHours) || Number(values.durationHours) < 1) {
    errors.durationHours = ["Hours must be a whole number greater than 0."];
  }
  const lengths = { code: 50, name: 255, version: 20, technicalGroup: 100, objectives: 4000, skills: 4000, outline: 12000 } as const;
  for (const field of Object.keys(lengths) as (keyof typeof lengths)[]) {
    if ((values[field]?.length ?? 0) > lengths[field]) errors[field] = [`Maximum ${lengths[field]} characters.`];
  }
  const wordError = wordLimitError(values.description, 500, "Description");
  if (wordError) errors.description = [wordError];
  return errors;
}

export function subjectPayload(values: SubjectFormValues): SubjectDTO {
  return {
    code: values.code!.trim(), name: values.name!.trim(), version: values.version!.trim(),
    technicalGroup: values.technicalGroup?.trim(), durationHours: Number(values.durationHours),
    description: values.description, objectives: values.objectives, skills: values.skills,
    deliveryMode: values.deliveryMode || undefined, outline: values.outline, isActive: values.isActive,
  };
}
