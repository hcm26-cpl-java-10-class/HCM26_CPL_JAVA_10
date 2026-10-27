import type { AssignmentRole } from "@/api/features/class-setup.api";

export interface TextOption {
  value: string;
  label: string;
  aliases?: string[];
}

export function trainerTextOptions(trainers: { id: number; name: string; email?: string | null }[]): TextOption[] {
  return trainers.map((trainer) => ({ value: String(trainer.id),
    label: `${trainer.name}${trainer.email ? ` · ${trainer.email}` : ""} · ID ${trainer.id}`,
    aliases: [trainer.name, ...(trainer.email ? [trainer.email] : [])] }));
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve only one existing identity. An unknown numeric ID never becomes a name substring. */
export function textMatches(text: string, options: TextOption[]): TextOption[] {
  const query = normalize(text);
  if (!query) return [];
  if (/^\d+$/.test(query)) {
    const id = Number(query);
    return Number.isSafeInteger(id) && id > 0 ? options.filter((option) => option.value === String(id)) : [];
  }
  const names = (option: TextOption) => [option.value, option.label, ...(option.aliases ?? [])].map(normalize);
  const exact = options.filter((option) => names(option).includes(query));
  if (exact.length) return exact;
  if (query.length < 2) return [];
  const words = options.filter((option) => names(option).some((name) => name.split(/[^a-z0-9]+/).includes(query)));
  return words.length ? words : options.filter((option) => names(option).some((name) => name.includes(query)));
}

export function resolveText(text: string, options: TextOption[]): string | undefined {
  const matches = textMatches(text, options);
  return matches.length === 1 ? matches[0].value : undefined;
}

export const roleOptions: TextOption[] = [
  { value: "MAIN", label: "Main trainer", aliases: ["Main", "Chính", "Giảng viên chính"] },
  { value: "ASSISTANT", label: "Assistant trainer", aliases: ["Assistant", "Phụ", "Giảng viên phụ"] },
];

export function parseRole(text: string): AssignmentRole | undefined {
  // Roles use explicit names/aliases; a partial word must not silently choose a business role.
  const query = normalize(text);
  return roleOptions.find((option) => [option.value, option.label, ...(option.aliases ?? [])].some((alias) => normalize(alias) === query))?.value as AssignmentRole | undefined;
}
