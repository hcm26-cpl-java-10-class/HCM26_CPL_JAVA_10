import type { TemplateRoleQuotas, TemplateTeamConstraints } from "@/types/features/project-template";

export const templateTeamRoles = [
  { key: "pm", label: "PM", name: "Project Manager" },
  { key: "ba", label: "BA", name: "Business Analyst" },
  { key: "dev", label: "DEV", name: "Developer" },
  { key: "qa", label: "QA", name: "Quality Assurance" },
] as const;

export interface TeamConstraintsValues {
  minMembers: string;
  maxMembers: string;
  roleQuotas: Record<keyof TemplateRoleQuotas, string>;
  allowMultiRole: boolean;
}

export type TeamConstraintsErrors = Record<string, string[] | undefined>;

export function toTeamConstraintsValues(constraints: TemplateTeamConstraints | null): TeamConstraintsValues {
  return {
    minMembers: constraints?.minMembers.toString() ?? "",
    maxMembers: constraints?.maxMembers.toString() ?? "",
    roleQuotas: {
      pm: constraints?.roleQuotas.pm.toString() ?? "0",
      ba: constraints?.roleQuotas.ba.toString() ?? "0",
      dev: constraints?.roleQuotas.dev.toString() ?? "0",
      qa: constraints?.roleQuotas.qa.toString() ?? "0",
    },
    allowMultiRole: constraints?.allowMultiRole ?? false,
  };
}

function validInteger(value: string, minimum: number) {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) >= minimum && Number(trimmed) <= 2147483647;
}

export function teamRoleTotal(values: TeamConstraintsValues): number | null {
  if (!templateTeamRoles.every(({ key }) => validInteger(values.roleQuotas[key], 0))) return null;
  return templateTeamRoles.reduce((total, { key }) => total + Number(values.roleQuotas[key]), 0);
}

export function validateTeamConstraints(values: TeamConstraintsValues): TeamConstraintsErrors {
  const errors: TeamConstraintsErrors = {};
  const validMinimum = validInteger(values.minMembers, 1);
  const validMaximum = validInteger(values.maxMembers, 1);
  if (!validMinimum) errors.minMembers = ["Minimum members must be a positive whole number"];
  if (!validMaximum) errors.maxMembers = ["Maximum members must be a positive whole number"];
  if (validMinimum && validMaximum && Number(values.minMembers) > Number(values.maxMembers)) {
    const message = "Minimum members must not exceed maximum members";
    errors.minMembers = [message];
    errors.maxMembers = [message];
  }
  for (const { key, label } of templateTeamRoles) {
    if (!validInteger(values.roleQuotas[key], 0)) {
      errors[`roleQuotas.${key}`] = [`${label} minimum must be a whole number of 0 or greater`];
    }
  }
  const total = teamRoleTotal(values);
  if (validMaximum && total !== null && total > Number(values.maxMembers)) {
    errors.roleQuotas = ["Total minimum role quotas must not exceed maximum members"];
  }
  return errors;
}
